/**
 * Local, pre-send secret scanning. Runs in the extension host on the exact text that would
 * be transmitted. Known credential patterns are `block` severity (hard stop); high-entropy
 * strings are `suspect` severity (surfaced in the transmission preview for the user to judge).
 *
 * See docs/privacy.md. This is the privacy backbone — the backend never sees the repo, and
 * nothing leaves the machine without passing through here first.
 */

import type { ReviewRequestPayload } from './protocol';

export type Severity = 'block' | 'suspect';

export interface SecretFinding {
  rule: string;
  severity: Severity;
  file: string;
  /** 1-based line number within the scanned text. */
  line: number;
  /** Masked preview of the matched value — never the raw secret. */
  masked: string;
}

interface Pattern {
  rule: string;
  re: RegExp;
}

const PATTERNS: Pattern[] = [
  { rule: 'aws-access-key-id', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { rule: 'google-api-key', re: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { rule: 'slack-token', re: /\bxox[baprs]-[0-9A-Za-z-]{10,}\b/ },
  { rule: 'github-token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{36}\b/ },
  { rule: 'github-pat', re: /\bgithub_pat_[0-9A-Za-z_]{22,}\b/ },
  { rule: 'stripe-key', re: /\bsk_(?:live|test)_[0-9A-Za-z]{16,}\b/ },
  { rule: 'private-key', re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY(?: BLOCK)?-----/ },
  { rule: 'openai-key', re: /\bsk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{32,}\b/ },
  { rule: 'anthropic-key', re: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/ },
  { rule: 'stripe-restricted-key', re: /\brk_(?:live|test)_[0-9A-Za-z]{16,}\b/ },
  { rule: 'stripe-webhook-secret', re: /\bwhsec_[0-9A-Za-z]{24,}\b/ },
  { rule: 'gitlab-token', re: /\bglpat-[0-9A-Za-z_-]{20,}\b/ },
  { rule: 'npm-token', re: /\bnpm_[0-9A-Za-z]{36}\b/ },
  { rule: 'huggingface-token', re: /\bhf_[0-9A-Za-z]{30,}\b/ },
  { rule: 'sendgrid-key', re: /\bSG\.[0-9A-Za-z_-]{22}\.[0-9A-Za-z_-]{43}\b/ },
  { rule: 'google-oauth-secret', re: /\bGOCSPX-[0-9A-Za-z_-]{20,}\b/ },
  { rule: 'digitalocean-token', re: /\bdo[por]_v1_[0-9a-f]{64}\b/ },
  { rule: 'shopify-token', re: /\bshp(?:at|ca|pa|ss)_[0-9a-fA-F]{32}\b/ },
  {
    rule: 'database-url-password',
    re: /\b(?:postgres(?:ql)?|mysql|mariadb|mssql|sqlserver|mongodb|rediss?|amqps?|clickhouse|cockroachdb)(?:\+[a-z0-9]+)?:\/\/[^:\s/'"@]*:(?![$<{[])[^@\s/'"]+@/i,
  },
  { rule: 'azure-storage-key', re: /\bAccountKey=[A-Za-z0-9+/]{40,}={0,2}/ },
  { rule: 'supabase-key', re: /\b(?:sb_secret_|sbp_)[0-9A-Za-z_-]{20,}/ },
  { rule: 'slack-webhook', re: /\bhooks\.slack\.com\/(?:services|workflows|triggers)\/[A-Za-z0-9_/-]{20,}/ },
  { rule: 'discord-webhook', re: /\bdiscord(?:app)?\.com\/api\/webhooks\/\d{5,}\/[A-Za-z0-9_-]{20,}/ },
  { rule: 'bearer-token', re: /\b[Bb]earer\s+(?=[A-Za-z0-9._~+/-]*\d)[A-Za-z0-9._~+/-]{20,}/ },
  {
    rule: 'jwt',
    re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
];

/**
 * `name = value`, `name: value` and `name := value` pairs. A pair is a secret when the name says so
 * and the value is a literal rather than code, so each match is judged by `assignedSecret`.
 */
// A name can only start where a run of name characters starts (`(?<![\w$.-])`), so a long
// `a.a.a…` or `a-a-a…` run is scanned once instead of once per dot. Leading `.`/`-` (as in
// `--password=` or `?.token`) belong to the run but not to the captured name.
const ASSIGNMENT =
  /(?<![\w$.-])[.-]*([A-Za-z_$][\w$.-]*)["']?\s*(?::=|=(?![=>~])|:(?![:/]))\s*(?:"([^"\n]*)"|'([^'\n]*)'|`([^`\n]*)`|([^\s"'`,;]+))/g;
/** Names that always hold a secret (compared lowercase, without `_`, `-` and `$`). */
const SECRET_NAME =
  /(?:passw(?:or)?ds?|pwd|passphrase|secrets?|tokens?|credentials?|(?:api|private|secret|access|auth|signing|encryption|master|client)keys?)$/;
/** Any other `*key` name holds a secret only when the value looks like a generated key. */
const KEY_NAME = /keys?$/;
const PUBLIC_NAME = /public|pubkey/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Values that are references, placeholders, paths or plain numbers rather than a pasted secret. */
const NOT_A_SECRET = [
  /^\d+$/,
  /^(.)\1+$/,
  /^(?:~|\.{1,2})?\/[A-Za-z][\w.@-]*(?:\/[\w.@-]+)*\/?$/,
  /:\/\//,
  /\$\{|\$\(|\{\{|%\(|^\$\w/,
  /^<.*>$/,
  /your[\s_-]|change[_-]?me|example|placeholder|dummy|redacted/i,
  /^(?:password|passwd|secret|token|string|required|optional|undefined|null|none|true|false)$/i,
];

/** Long hex, or a long token whose characters are spread like a generated key. */
function credentialShaped(value: string): boolean {
  if (/^(?:0x)?[0-9a-fA-F]{32,}$/.test(value)) return true;
  if (UUID.test(value) || !/^[A-Za-z0-9_+/=-]{16,}$/.test(value)) return false;
  return shannonEntropy(value) >= (/\d/.test(value) ? 3.8 : 4.5);
}

function assignedSecret(name: string, value: string, quoted: boolean): boolean {
  const last = name.split('.').filter(Boolean).pop() ?? name;
  const normalized = last.toLowerCase().replace(/[_$-]/g, '');
  if (PUBLIC_NAME.test(normalized)) return false;
  const secretName = SECRET_NAME.test(normalized);
  if (!secretName && !KEY_NAME.test(normalized)) return false;
  const v = value.trim();
  if (v.length < 8 || NOT_A_SECRET.some((re) => re.test(v))) return false;
  if (credentialShaped(v)) return true;
  if (!secretName) return false;
  if (quoted) {
    // Spaced text is a passphrase only in env-style names; `password: 'Mot de passe'` is a label.
    if (/\s/.test(v)) return /^[A-Z][A-Z0-9_]*$/.test(last);
    return !/^\p{L}+$/u.test(v) && !/^[a-z]+(?:[_.:-][a-z0-9]+)+$/.test(v) && !/^[A-Z][A-Z_]*$/.test(v);
  }
  // Unquoted: skip code such as `password: string`, `token = getToken()`, `secret: env.SECRET!`.
  if (/^[A-Za-z_$][\w$]*!?$/.test(v)) return false;
  return !/^[A-Za-z_$][\w$]*[.([?<{]/.test(v) && !/^[[{(]/.test(v);
}

const ENTROPY_MIN_LEN = 25;
const ENTROPY_THRESHOLD = 4.5;
const LONG_TOKEN = /[A-Za-z0-9_\-/+=]{25,}/g;

/** Shannon entropy in bits per character. */
export function shannonEntropy(input: string): number {
  if (input.length === 0) {
    return 0;
  }
  const counts = new Map<string, number>();
  for (const ch of input) {
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of counts.values()) {
    const p = count / input.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function mask(value: string): string {
  if (value.length <= 8) {
    return '*'.repeat(value.length);
  }
  return `${value.slice(0, 4)}${'*'.repeat(Math.min(value.length - 6, 12))}${value.slice(-2)}`;
}

/** Scan a block of text; `file` is a label attached to findings. */
export function scanText(text: string, file: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const seen = new Set<string>();
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const pattern of PATTERNS) {
      const match = pattern.re.exec(line);
      if (match) {
        const key = `${pattern.rule}:${index}:${match[0]}`;
        if (!seen.has(key)) {
          seen.add(key);
          findings.push({
            rule: pattern.rule,
            severity: 'block',
            file,
            line: index + 1,
            masked: mask(match[0]),
          });
        }
      }
    }

    const assignment = [...line.matchAll(ASSIGNMENT)].find((m) =>
      assignedSecret(m[1]!, m[2] ?? m[3] ?? m[4] ?? m[5] ?? '', m[5] === undefined));
    if (assignment) {
      findings.push({
        rule: 'secret-assignment',
        severity: 'block',
        file,
        line: index + 1,
        masked: mask(assignment[0]),
      });
    }

    const tokens = line.match(LONG_TOKEN);
    if (tokens) {
      for (const token of tokens) {
        if (token.length >= ENTROPY_MIN_LEN && shannonEntropy(token) >= ENTROPY_THRESHOLD) {
          const key = `entropy:${index}:${token}`;
          if (!seen.has(key)) {
            seen.add(key);
            findings.push({
              rule: 'high-entropy-string',
              severity: 'suspect',
              file,
              line: index + 1,
              masked: mask(token),
            });
          }
        }
      }
    }
  });

  return findings;
}

/** Scan multiple labelled blocks. */
export function scanBlocks(blocks: Array<{ file: string; text: string }>): SecretFinding[] {
  return blocks.flatMap((b) => scanText(b.text, b.file));
}

export function hasBlocking(findings: SecretFinding[]): boolean {
  return findings.some((f) => f.severity === 'block');
}

/** Scan every part of a review request that would be sent: code, nearby code, imports, diff hunks and the question. */
export function scanReviewPayload(payload: ReviewRequestPayload): SecretFinding[] {
  const blocks: Array<{ file: string; text: string }> = [];
  if (payload.context.code) blocks.push({ file: 'code', text: payload.context.code });
  if (payload.context.enclosing) blocks.push({ file: 'nearby', text: payload.context.enclosing });
  for (const line of payload.context.imports) blocks.push({ file: 'import', text: line });
  for (const h of payload.context.diffHunks ?? []) blocks.push({ file: h.file, text: h.lines.join('\n') });
  if (payload.question) blocks.push({ file: 'question', text: payload.question });
  return scanBlocks(blocks);
}

/**
 * Scan what the user typed into Chat or a follow-up box: the new message and their earlier turns
 * (the renderer resends those). Model replies are skipped: they came from the model, and example
 * code in a reply must not block the user's next message.
 */
export function scanTypedText(
  message: string,
  earlier: ReadonlyArray<{ role: string; content: string }> = [],
): SecretFinding[] {
  return scanBlocks([
    ...earlier
      .filter((m) => m.role === 'user' && typeof m.content === 'string')
      .map((m) => ({ file: 'earlier message', text: m.content })),
    { file: 'message', text: message },
  ]);
}
