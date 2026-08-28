export const WEB_APP_LEVELS = ['new', 'beginner', 'intermediate', 'advanced', 'expert'] as const;

export type WebAppLevel = (typeof WEB_APP_LEVELS)[number];

export interface WebAppReviewPayload {
  scope: 'selection';
  level: WebAppLevel;
  context: {
    language: string;
    primaryFile?: string;
    projectStructure: string[];
    imports: string[];
    code: string;
    selection: { file: string; startLine: number; endLine: number };
  };
}

export interface SecretFinding {
  label: string;
}

const secretRules: Array<{ label: string; pattern: RegExp }> = [
  { label: 'private key', pattern: /-----BEGIN(?: [A-Z]+)? PRIVATE KEY-----/ },
  { label: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
  { label: 'Stripe secret key', pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
  { label: 'credential assignment', pattern: /\b(?:api[_-]?key|access[_-]?token|secret|password)\s*[:=]\s*["'][^"'\s]{8,}/i },
];

/** Blocks common credentials in the browser before a review request is sent. */
export function findSecret(code: string): SecretFinding | null {
  for (const rule of secretRules) {
    if (rule.pattern.test(code)) return { label: rule.label };
  }
  return null;
}

export function createWebAppPayload(input: { code: string; language: string; fileName?: string; level: string }): WebAppReviewPayload | { error: string } {
  const code = input.code.trim();
  if (!code) return { error: 'Paste or type code before asking Unvibe to explain it.' };
  if (code.length > 30_000) return { error: 'Keep a web review under 30,000 characters for now.' };
  if (!WEB_APP_LEVELS.includes(input.level as WebAppLevel)) return { error: 'Choose a valid explanation depth.' };
  const secret = findSecret(code);
  if (secret) return { error: `This selection may contain a ${secret.label}. It stays in this browser and will not be sent.` };
  const file = input.fileName?.trim() || `selection.${input.language || 'txt'}`;
  return {
    scope: 'selection',
    level: input.level as WebAppLevel,
    context: {
      language: input.language || 'text',
      primaryFile: file,
      projectStructure: [],
      imports: [],
      code,
      selection: { file, startLine: 1, endLine: code.split('\n').length },
    },
  };
}
