/**
 * Local, pre-send secret scanning. Runs in the extension host on the exact text that would
 * be transmitted. Known credential patterns are `block` severity (hard stop); high-entropy
 * strings are `suspect` severity (surfaced in the transmission preview for the user to judge).
 *
 * See docs/privacy.md. This is the privacy backbone — the backend never sees the repo, and
 * nothing leaves the machine without passing through here first.
 */

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
  { rule: 'private-key', re: /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/ },
  {
    rule: 'jwt',
    re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  },
  {
    rule: 'secret-assignment',
    re: /(?:api[_-]?key|secret|token|password|passwd|pwd|access[_-]?key|client[_-]?secret|auth[_-]?token)["']?\s*[:=]\s*["']?[A-Za-z0-9_\-/+]{12,}/i,
  },
];

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
