import type { ExplanationLevel, ReviewRequestPayload } from './protocol.js';

const LEVEL_GUIDANCE: Record<ExplanationLevel, string> = {
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
    '- When you reference code, cite the file and line/range you were given (e.g. `foo.ts:12-18`).',
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
    parts.push('\n## Task\nExplain what this code does and why, at the requested level. End with one sentence on what would break if it were removed or changed.');
  }

  return parts.join('\n');
}
