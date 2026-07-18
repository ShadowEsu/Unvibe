/**
 * Local (BYOK) AI streaming — key stays on this Mac; never forwarded to Unvibe.
 */
import type { ExplanationLevel, ReviewRequestPayload } from '../core/protocol';

export type LocalAiProvider = 'gemini' | 'anthropic';

const LEVEL_GUIDANCE: Record<ExplanationLevel, string> = {
  new: 'The reader may never have programmed. Plain language, everyday analogies, zero jargon.',
  beginner: 'The reader is new to this. Avoid jargon or define it inline. Short sentences.',
  intermediate: 'The reader is a working developer but new to THIS code. Be concise.',
  advanced: 'The reader is experienced. Be dense and precise. Emphasise design implications.',
  expert: 'The reader is a senior engineer. Skip basics. Lead with intent, tradeoffs, and failure modes.',
};

/** Approximate public list prices ($ per 1M tokens). Estimates only — provider bills may differ. */
const RATES: Record<LocalAiProvider, { model: string; inputPerM: number; outputPerM: number; maxOut: number }> = {
  gemini: { model: 'gemini-2.5-flash', inputPerM: 0.15, outputPerM: 0.6, maxOut: 2048 },
  anthropic: { model: 'claude-sonnet-4-5', inputPerM: 3, outputPerM: 15, maxOut: 1024 },
};

const LEVEL_OUT_TOKENS: Record<ExplanationLevel, number> = {
  new: 450,
  beginner: 500,
  intermediate: 650,
  advanced: 850,
  expert: 1100,
};

export function buildLocalSystemPrompt(payload: ReviewRequestPayload): string {
  return [
    'You are Unvibe, a code-comprehension tutor. Help the developer UNDERSTAND code — do not rewrite it unless asked.',
    'Use ONLY the provided context. Separate what the code SHOWS, what you INFER, and what is UNCERTAIN.',
    'Cite specific lines when helpful. Be direct. No preamble.',
    `Audience level — ${payload.level}: ${LEVEL_GUIDANCE[payload.level]}`,
    payload.variant === 'different' ? 'Give a DIFFERENT angle than a first explanation would.' : '',
  ].filter(Boolean).join('\n');
}

export function buildLocalUserPrompt(payload: ReviewRequestPayload): string {
  const ctx = payload.context;
  const parts = [
    `# Review: ${payload.scope}`,
    `Language: ${ctx.language}`,
  ];
  if (ctx.primaryFile) parts.push(`Primary file: ${ctx.primaryFile}`);
  if (ctx.projectStructure.length) parts.push(`Project: ${ctx.projectStructure.join(', ')}`);
  if (ctx.imports.length) parts.push(`\n## Imports / nearby refs\n${ctx.imports.slice(0, 40).join('\n')}`);
  if (ctx.diffHunks?.length) {
    parts.push('\n## Git diff');
    for (const h of ctx.diffHunks.slice(0, 20)) {
      parts.push(`\n### ${h.file}\n\`\`\`diff\n${h.lines.slice(0, 120).join('\n')}\n\`\`\``);
    }
  }
  if (ctx.enclosing) parts.push(`\n## Nearby files\n${ctx.enclosing}`);
  if (ctx.code) parts.push(`\n## Code\n\`\`\`\n${ctx.code}\n\`\`\``);
  if (payload.question) parts.push(`\n## Task\n${payload.question}`);
  else if (payload.scope === 'diff') {
    parts.push('\n## Task\nExplain what changed and why, how data flows, and what would break if reverted.');
  } else {
    parts.push('\n## Task\nExplain what this selection does, why it is written this way, and what to watch for.');
  }
  return parts.join('\n');
}

export interface CostEstimate {
  provider: LocalAiProvider;
  model: string;
  level: ExplanationLevel;
  lines: number;
  inputTokens: number;
  outputTokens: number;
  usd: number;
  label: string;
}

export function estimateCost(provider: LocalAiProvider, level: ExplanationLevel, lines: number, charsPerLine = 40): CostEstimate {
  const rate = RATES[provider];
  const inputTokens = Math.max(80, Math.round((lines * charsPerLine) / 4) + 220);
  const outputTokens = Math.min(rate.maxOut, LEVEL_OUT_TOKENS[level]);
  const usd = (inputTokens / 1_000_000) * rate.inputPerM + (outputTokens / 1_000_000) * rate.outputPerM;
  return {
    provider,
    model: rate.model,
    level,
    lines,
    inputTokens,
    outputTokens,
    usd,
    label: `~$${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(3)}`,
  };
}

export function costOverview(provider: LocalAiProvider): Array<{
  level: ExplanationLevel;
  samples: Array<{ lines: number; label: string; usd: number }>;
}> {
  const levels: ExplanationLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];
  const lineSamples = [50, 200, 500];
  return levels.map((level) => ({
    level,
    samples: lineSamples.map((lines) => {
      const e = estimateCost(provider, level, lines);
      return { lines, label: e.label, usd: e.usd };
    }),
  }));
}

export async function streamLocalAi(opts: {
  provider: LocalAiProvider;
  apiKey: string;
  system: string;
  user: string;
  onToken: (text: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  if (opts.provider === 'anthropic') {
    return streamAnthropic(opts.apiKey, opts.system, opts.user, opts.onToken, opts.signal);
  }
  return streamGemini(opts.apiKey, opts.system, opts.user, opts.onToken, opts.signal);
}

async function streamAnthropic(
  apiKey: string,
  system: string,
  user: string,
  onToken: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const model = RATES.anthropic.model;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: RATES.anthropic.maxOut,
      system,
      stream: true,
      messages: [{ role: 'user', content: user }],
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Anthropic API ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let modelName = `anthropic:${model}`;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf('\n\n')) >= 0) {
      const rawEvent = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const dataLine = rawEvent.split('\n').find((l) => l.startsWith('data: '));
      if (!dataLine) continue;
      const data = dataLine.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data) as { type?: string; delta?: { text?: string }; message?: { model?: string } };
        if (json.message?.model) modelName = `anthropic:${json.message.model}`;
        if (json.type === 'content_block_delta' && json.delta?.text) onToken(json.delta.text);
      } catch {
        /* skip */
      }
    }
  }
  return modelName;
}

async function streamGemini(
  apiKey: string,
  system: string,
  user: string,
  onToken: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const model = RATES.gemini.model;
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent`);
  url.searchParams.set('alt', 'sse');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { maxOutputTokens: RATES.gemini.maxOut, temperature: 0.3 },
    }),
    signal,
  });
  if (!res.ok) {
    throw new Error(`Gemini API ${res.status}: ${await res.text().catch(() => '')}`);
  }
  const raw = await res.text();
  let emitted = 0;
  for (const event of raw.split('\n\n')) {
    const dataLine = event.split('\n').find((l) => l.startsWith('data: '));
    if (!dataLine) continue;
    const data = dataLine.slice(6).trim();
    if (!data) continue;
    try {
      const json = JSON.parse(data) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
      const parts = json.candidates?.[0]?.content?.parts ?? [];
      for (const part of parts) {
        if (part.thought || !part.text) continue;
        onToken(part.text);
        emitted += part.text.length;
      }
    } catch {
      /* skip */
    }
  }
  if (emitted === 0) throw new Error('Gemini returned an empty response. Check the key and try again.');
  return `gemini:${model}`;
}
