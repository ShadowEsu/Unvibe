/**
 * Local (BYOK) AI streaming. Key stays on this Mac; never forwarded to Unvibe.
 * Cheap default models per provider — Anthropic / OpenAI / Gemini / Grok / DeepSeek / Kimi.
 */
import type { ExplanationLevel, ReviewRequestPayload } from '../core/protocol';

export type LocalAiProviderId =
  | 'gemini'
  | 'anthropic'
  | 'openai'
  | 'grok'
  | 'deepseek'
  | 'kimi';

export interface LocalAiProviderInfo {
  id: LocalAiProviderId;
  label: string;
  model: string;
  blurb: string;
  inputPerM: number;
  outputPerM: number;
  maxOut: number;
  /** OpenAI-compatible base URL when applicable. */
  baseUrl?: string;
}

const PROVIDERS: Record<LocalAiProviderId, LocalAiProviderInfo> = {
  gemini: {
    id: 'gemini',
    label: 'Gemini',
    model: 'gemini-2.5-flash-lite',
    blurb: 'Google Flash-Lite — usually the cheapest daily pick.',
    inputPerM: 0.10,
    outputPerM: 0.40,
    maxOut: 2048,
  },
  anthropic: {
    id: 'anthropic',
    label: 'Anthropic',
    model: 'claude-haiku-4-5',
    blurb: 'Claude Haiku — fast and cheaper than Sonnet/Opus.',
    inputPerM: 1,
    outputPerM: 5,
    maxOut: 1024,
  },
  openai: {
    id: 'openai',
    label: 'OpenAI',
    model: 'gpt-4o-mini',
    blurb: 'GPT-4o mini — solid and inexpensive for explanations.',
    inputPerM: 0.15,
    outputPerM: 0.60,
    maxOut: 1024,
    baseUrl: 'https://api.openai.com/v1',
  },
  grok: {
    id: 'grok',
    label: 'Grok',
    model: 'grok-3-mini',
    blurb: 'xAI Grok mini — OpenAI-compatible, keep costs low.',
    inputPerM: 0.30,
    outputPerM: 0.50,
    maxOut: 1024,
    baseUrl: 'https://api.x.ai/v1',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    model: 'deepseek-chat',
    blurb: 'DeepSeek chat — strong value for code comprehension.',
    inputPerM: 0.28,
    outputPerM: 0.42,
    maxOut: 1024,
    baseUrl: 'https://api.deepseek.com',
  },
  kimi: {
    id: 'kimi',
    label: 'Kimi',
    model: 'moonshot-v1-8k',
    blurb: 'Moonshot Kimi — OpenAI-compatible Moonshot API.',
    inputPerM: 0.20,
    outputPerM: 2.0,
    maxOut: 1024,
    baseUrl: 'https://api.moonshot.ai/v1',
  },
};

export const DEFAULT_LOCAL_AI_PROVIDER: LocalAiProviderId = 'gemini';

/** @deprecated Prefer LocalAiProviderId — kept for older settings migration. */
export type LocalAiModelId = string;

export function listLocalAiProviders(): LocalAiProviderInfo[] {
  return [
    PROVIDERS.gemini,
    PROVIDERS.openai,
    PROVIDERS.anthropic,
    PROVIDERS.deepseek,
    PROVIDERS.grok,
    PROVIDERS.kimi,
  ];
}

/** Alias used by IPC that previously returned models. */
export function listLocalAiModels(): Array<LocalAiProviderInfo & { id: LocalAiProviderId }> {
  return listLocalAiProviders();
}

export function normalizeLocalAiProvider(value: unknown): LocalAiProviderId {
  if (
    value === 'gemini'
    || value === 'anthropic'
    || value === 'openai'
    || value === 'grok'
    || value === 'deepseek'
    || value === 'kimi'
  ) return value;
  if (value === 'gemini-2.5-flash' || value === 'gemini-2.5-flash-lite') return 'gemini';
  return DEFAULT_LOCAL_AI_PROVIDER;
}

/** @deprecated */
export function normalizeLocalAiModel(value: unknown): LocalAiProviderId {
  return normalizeLocalAiProvider(value);
}

export function guessProviderFromKey(key: string): LocalAiProviderId | null {
  const k = key.trim();
  if (!k) return null;
  const lower = k.toLowerCase();
  if (k.startsWith('AIza') || /^AI[a-zA-Z0-9_-]{20,}/.test(k)) return 'gemini';
  if (k.startsWith('sk-ant-')) return 'anthropic';
  if (k.startsWith('xai-')) return 'grok';
  if (lower.includes('moonshot') || lower.includes('kimi')) return 'kimi';
  if (lower.includes('deepseek')) return 'deepseek';
  if (k.startsWith('sk-')) return 'openai';
  return null;
}

const LEVEL_GUIDANCE: Record<ExplanationLevel, string> = {
  new: 'The reader may never have programmed. Plain language, everyday analogies, zero jargon.',
  beginner: 'The reader is new to this. Avoid jargon or define it inline. Short sentences.',
  intermediate: 'The reader is a working developer but new to THIS code. Be concise.',
  advanced: 'The reader is experienced. Be dense and precise. Emphasise design implications.',
  expert: 'The reader is a senior engineer. Skip basics. Lead with intent, tradeoffs, and failure modes.',
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
    'Write clean readable prose. Short paragraphs or simple markdown bullets (* item) are fine.',
    'Do NOT use [[cite:...]] markers, HTML, XML, curly-brace templates, or raw markup like {}<>?.',
    'When referring to code, say "line 12" or name the function in plain words.',
    'Be direct. No preamble.',
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
  provider: LocalAiProviderId;
  model: string;
  modelLabel: string;
  level: ExplanationLevel;
  lines: number;
  inputTokens: number;
  outputTokens: number;
  usd: number;
  label: string;
}

export function estimateCost(providerId: LocalAiProviderId | string, level: ExplanationLevel, lines: number, charsPerLine = 40): CostEstimate {
  const provider = PROVIDERS[normalizeLocalAiProvider(providerId)];
  const inputTokens = Math.max(80, Math.round((lines * charsPerLine) / 4) + 220);
  const outputTokens = Math.min(provider.maxOut, LEVEL_OUT_TOKENS[level]);
  const usd = (inputTokens / 1_000_000) * provider.inputPerM + (outputTokens / 1_000_000) * provider.outputPerM;
  return {
    provider: provider.id,
    model: provider.model,
    modelLabel: provider.label,
    level,
    lines,
    inputTokens,
    outputTokens,
    usd,
    label: `~$${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(3)}`,
  };
}

export function costOverview(providerId: LocalAiProviderId | string): Array<{
  level: ExplanationLevel;
  samples: Array<{ lines: number; label: string; usd: number }>;
}> {
  const provider = normalizeLocalAiProvider(providerId);
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
  model?: LocalAiProviderId | string;
  provider?: LocalAiProviderId | string;
  apiKey: string;
  system: string;
  user: string;
  onToken: (text: string) => void;
  signal?: AbortSignal;
}): Promise<string> {
  const provider = normalizeLocalAiProvider(opts.provider ?? opts.model);
  if (provider === 'gemini') {
    return streamGemini(PROVIDERS.gemini, opts.apiKey, opts.system, opts.user, opts.onToken, opts.signal);
  }
  if (provider === 'anthropic') {
    return streamAnthropic(PROVIDERS.anthropic, opts.apiKey, opts.system, opts.user, opts.onToken, opts.signal);
  }
  return streamOpenAiCompatible(PROVIDERS[provider], opts.apiKey, opts.system, opts.user, opts.onToken, opts.signal);
}

async function streamGemini(
  info: LocalAiProviderInfo,
  apiKey: string,
  system: string,
  user: string,
  onToken: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const url = new URL(`https://generativelanguage.googleapis.com/v1beta/models/${info.model}:streamGenerateContent`);
  url.searchParams.set('alt', 'sse');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: {
        maxOutputTokens: info.maxOut,
        temperature: 0.3,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal,
  });
  if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text().catch(() => '')}`);
  const raw = await res.text();
  let emitted = 0;
  for (const event of raw.split('\n\n')) {
    const dataLine = event.split('\n').find((l) => l.startsWith('data: '));
    if (!dataLine) continue;
    const data = dataLine.slice(6).trim();
    if (!data) continue;
    try {
      const json = JSON.parse(data) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> } }> };
      for (const part of json.candidates?.[0]?.content?.parts ?? []) {
        if (part.thought || !part.text) continue;
        onToken(part.text);
        emitted += part.text.length;
      }
    } catch {
      /* skip */
    }
  }
  if (emitted === 0) throw new Error('Gemini returned an empty response. Check the key and try again.');
  return `gemini:${info.model}`;
}

async function streamAnthropic(
  info: LocalAiProviderInfo,
  apiKey: string,
  system: string,
  user: string,
  onToken: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: info.model,
      max_tokens: info.maxOut,
      system,
      stream: true,
      messages: [{ role: 'user', content: user }],
    }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Anthropic API ${res.status}: ${await res.text().catch(() => '')}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let emitted = 0;
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
        const json = JSON.parse(data) as { type?: string; delta?: { text?: string } };
        if (json.type === 'content_block_delta' && json.delta?.text) {
          onToken(json.delta.text);
          emitted += json.delta.text.length;
        }
      } catch {
        /* skip */
      }
    }
  }
  if (emitted === 0) throw new Error('Anthropic returned an empty response. Check the key and try again.');
  return `anthropic:${info.model}`;
}

async function streamOpenAiCompatible(
  info: LocalAiProviderInfo,
  apiKey: string,
  system: string,
  user: string,
  onToken: (text: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const base = (info.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: info.model,
      max_tokens: info.maxOut,
      temperature: 0.3,
      stream: true,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`${info.label} API ${res.status}: ${await res.text().catch(() => '')}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let emitted = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (!data || data === '[DONE]') continue;
      try {
        const json = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
        const text = json.choices?.[0]?.delta?.content;
        if (text) {
          onToken(text);
          emitted += text.length;
        }
      } catch {
        /* skip */
      }
    }
  }
  if (emitted === 0) throw new Error(`${info.label} returned an empty response. Check the key and try again.`);
  return `${info.id}:${info.model}`;
}
