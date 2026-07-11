import type { ExplanationLevel, ReviewRequestPayload } from './protocol';

const LEVEL_GUIDANCE: Record<ExplanationLevel, string> = {
  new: 'The reader may never have programmed. Plain language, everyday analogies, zero jargon. Walk through what the code is doing step by step, gently.',
  expert:
    'The reader is a senior engineer. Skip basics entirely. Lead with intent, tradeoffs, invariants, and failure modes. Terse and dense.',
  beginner:
    'The reader is new to this. Avoid jargon or define it inline. Explain the intent before the mechanics. Short sentences.',
  intermediate:
    'The reader is a working developer but new to THIS code. Focus on what changed, why, and how data flows. Be concise.',
  advanced:
    'The reader is experienced. Be dense and precise. Emphasise design implications, edge cases, and what would break if removed.',
};

/**
 * System prompt. Enforces the anti-hallucination contract: use only provided context,
 * distinguish what is visible vs inferred vs uncertain, and cite file + line.
 */
export function buildSystemPrompt(payload: ReviewRequestPayload): string {
  return [
    'You are Uncode, a code-comprehension tutor. You help a developer UNDERSTAND code that an',
    'AI agent (or they) just wrote — you do not rewrite it unless asked.',
    '',
    'Rules:',
    '- Use ONLY the provided context. Do not invent files, symbols, or behaviour you cannot see.',
    '- Clearly separate: what the code plainly SHOWS, what you INFER, and what is UNCERTAIN.',
    '- Wrap EVERY reference to specific code in a citation marker of the exact form',
    '  [[cite:FILE:START-END]] or [[cite:FILE:LINE]], where FILE is a path shown in the context.',
    '  Example: "the loop [[cite:src/sync.ts:20-27]] retries on failure". Never cite a file that',
    '  is not present in the provided context.',
    '- If the context is insufficient to answer, say so and name what you would need.',
    '- Be direct. No preamble, no flattery, no restating the question.',
    '',
    `Audience level — ${payload.level}: ${LEVEL_GUIDANCE[payload.level]}`,
    payload.variant === 'different'
      ? '\nThe reader asked for a DIFFERENT explanation than before — change the angle (e.g. from mechanics to intent, or use a concrete example).'
      : '',
  ].join('\n');
}

/** Serialises the constructed context into the user message. */
export function buildUserPrompt(payload: ReviewRequestPayload): string {
  const { context: ctx, scope } = payload;
  const parts: string[] = [];

  parts.push(`# Review request: ${scope}`);
  parts.push(`Language: ${ctx.language}`);
  if (ctx.primaryFile) {
    parts.push(`Primary file: ${ctx.primaryFile}`);
  }
  if (ctx.projectStructure.length) {
    parts.push(`Project (top level): ${ctx.projectStructure.join(', ')}`);
  }
  if (ctx.imports.length) {
    parts.push('\n## Imports\n```\n' + ctx.imports.join('\n') + '\n```');
  }

  if (ctx.diffHunks?.length) {
    parts.push('\n## Git diff (working tree vs HEAD)');
    for (const h of ctx.diffHunks) {
      parts.push(`\n### ${h.file} @@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`);
      parts.push('```diff\n' + h.lines.join('\n') + '\n```');
    }
  }

  if (ctx.enclosing && scope === 'selection') {
    parts.push('\n## Surrounding code (context, ±20 lines)\n```\n' + ctx.enclosing + '\n```');
  }
  if (ctx.code) {
    const heading = scope === 'selection' ? 'Selected code' : 'File';
    const range = ctx.selection ? ` (lines ${ctx.selection.startLine}-${ctx.selection.endLine})` : '';
    parts.push(`\n## ${heading}${range}\n\`\`\`\n${ctx.code}\n\`\`\``);
    if (ctx.truncated) {
      parts.push('_(code was truncated for length)_');
    }
  }

  if (payload.question) {
    parts.push(`\n## Follow-up question\n${payload.question}`);
  } else {
    parts.push(`\n## Task\n${taskForScope(scope)}`);
  }

  return parts.join('\n');
}

/** System + user prompt for generating one multiple-choice comprehension question as JSON. */
export function buildComprehensionPrompt(payload: ReviewRequestPayload): { system: string; user: string } {
  const system = [
    'You are Uncode. Generate ONE multiple-choice question that tests whether the reader',
    'UNDERSTOOD the provided code (not trivia or recall). Use only the provided context.',
    '',
    'Return ONLY a JSON object, no prose, no code fences, of exactly this shape:',
    '{"question": string, "options": [string, string, string, string],',
    ' "answerIndex": 0-3, "rationale": string, "concept": kebab-case-slug, "conceptLabel": string}',
    'Exactly one option must be correct. Keep options plausible and similar in length.',
  ].join('\n');
  const user = buildUserPrompt({ ...payload, question: undefined });
  return { system, user };
}

function taskForScope(scope: ReviewRequestPayload['scope']): string {
  switch (scope) {
    case 'project':
      return 'Give an architecture-level overview: the main parts, how they fit together, the entry points, and where a newcomer should start reading. Cite the directories/files you reference.';
    case 'diff':
      return 'Explain what changed and why, and how data flows through the change. End with one sentence on what would break if the change were reverted.';
    default:
      return 'Explain what this code does and why, at the requested level. End with one sentence on what would break if it were removed or changed.';
  }
}
