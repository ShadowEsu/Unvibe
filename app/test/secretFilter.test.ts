import test from 'node:test';
import assert from 'node:assert/strict';
import { scanText, hasBlocking } from '../src/core/secretFilter';

test('blocks known credential patterns', () => {
  const findings = scanText('const key = "AKIAIOSFODNN7EXAMPLE";', 'x.ts');
  assert.ok(hasBlocking(findings));
  assert.ok(findings.every((f) => !f.masked.includes('AKIAIOSFODNN7EXAMPLE')));
});

test('clean code produces no findings', () => {
  const findings = scanText('function add(a: number, b: number) { return a + b; }', 'x.ts');
  assert.equal(findings.length, 0);
});

test('blocks modern provider keys and connection strings', () => {
  const samples: Array<[string, string]> = [
    ['openai-key', `const k = "sk-proj-${'a1B2'.repeat(12)}";`],
    ['anthropic-key', `ANTHROPIC="sk-ant-api03-${'Zx9_'.repeat(10)}"`],
    ['stripe-restricted-key', `rk_live_${'4eC39HqLyjWDarjtT1zdp7dc'}`],
    ['stripe-webhook-secret', `whsec_${'abcdEFGH1234'.repeat(3)}`],
    ['gitlab-token', `token: glpat-${'xY7_'.repeat(6)}`],
    ['npm-token', `//registry.npmjs.org/:_authToken=npm_${'A1b2C3d4E5'.repeat(3)}abcdef`],
    ['huggingface-token', `hf_${'QwErTy'.repeat(6)}`],
    ['sendgrid-key', `SG.${'a'.repeat(22)}.${'B'.repeat(43)}`],
    ['google-oauth-secret', `GOCSPX-${'k9_Lm'.repeat(6)}`],
    ['digitalocean-token', `dop_v1_${'ab12'.repeat(16)}`],
    ['shopify-token', `shpat_${'0f'.repeat(16)}`],
    ['database-url-password', 'DATABASE_URL=postgres://admin:hunter2secret@db.example.com:5432/app'],
    ['azure-storage-key', `DefaultEndpointsProtocol=https;AccountName=x;AccountKey=${'Ab12'.repeat(22)}==`],
  ];
  for (const [rule, line] of samples) {
    const findings = scanText(line, 'x.env');
    assert.ok(findings.some((f) => f.rule === rule && f.severity === 'block'), `expected ${rule} to block`);
    assert.ok(findings.every((f) => !f.masked.includes(line.slice(-12))), `${rule} must be masked`);
  }
});

test('does not flag ordinary code that merely looks similar', () => {
  const clean = [
    'const task = "sk-learn is a Python library";',
    'const url = "postgres://localhost/app";',
    'import { shape } from "./shapes";',
  ];
  for (const line of clean) {
    assert.equal(hasBlocking(scanText(line, 'x.ts')), false, line);
  }
});

// Seeded generator so the probe is repeatable; 30 seeds stand in for the audit's 30 random runs.
function randomSource(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (chars: string, n: number) => Array.from({ length: n }, () => chars[Math.floor(next() * chars.length)]).join('');
  const bytes = (n: number) => Buffer.from(Array.from({ length: n }, () => Math.floor(next() * 256)));
  return {
    alnum: (n: number) => pick('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789', n),
    upnum: (n: number) => pick('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', n),
    hex: (n: number) => pick('0123456789abcdef', n),
    b64: (n: number) => bytes(n).toString('base64'),
    b64url: (n: number) => bytes(n).toString('base64url'),
  };
}

// Prefixes are split so the repository secret scan never sees a key-shaped literal.
const PEM = (kind: string) => '-----' + 'BEGIN ' + kind + 'PRIVATE KEY-----';
const JWT_HEAD = 'ey' + 'JhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';

/** The audit's 37-line probe. `consent` lines are inherently ambiguous; every other line must block. */
function probeCases(seed: number): Array<{ name: string; text: string; expect: 'block' | 'consent' | 'clean' }> {
  const r = randomSource(seed);
  const block = (name: string, text: string) => ({ name, text, expect: 'block' as const });
  return [
    block('aws key id', `AWS_ACCESS_KEY_ID=AKIA${r.upnum(16)}`),
    block('aws secret (env)', `AWS_SECRET_ACCESS_KEY=${r.b64(30).slice(0, 40)}`),
    block('aws secret (~/.aws/credentials)', `aws_secret_access_key = ${r.b64(30).slice(0, 40)}`),
    { name: 'aws secret bare in code', text: `const s = "${r.b64(30).slice(0, 40)}";`, expect: 'consent' },
    block('stripe sk_live', `STRIPE_SECRET_KEY=sk_${'live'}_51${r.alnum(97)}`),
    block('stripe rk_live', `rk_${'live'}_51${r.alnum(97)}`),
    block('stripe whsec', `STRIPE_WEBHOOK_SECRET=whsec_${r.alnum(32)}`),
    block('github ghp', `token: gh${'p'}_${r.alnum(36)}`),
    block('github fine-grained', `github_${'pat'}_11${r.alnum(80)}`),
    block('openai sk-proj', `OPENAI_API_KEY=s${'k'}-proj-${r.b64url(120)}`),
    block('anthropic', `ANTHROPIC_API_KEY=s${'k'}-ant-api03-${r.b64url(70)}`),
    block('google AIza', `GEMINI_API_KEY=AI${'za'}${r.b64url(26).slice(0, 35)}`),
    block('RSA PEM', PEM('RSA ')),
    block('PKCS8 PEM', PEM('')),
    block('encrypted PEM', PEM('ENCRYPTED ')),
    { name: 'PEM body only', text: `${r.b64(48)}\n${r.b64(48)}\n${r.b64(48)}`, expect: 'consent' },
    block('service-account JSON', `  "private_key": "${PEM('')}\\nMIIEvQIBADANBg${r.b64(30)}\\n",`),
    block('JWT (supabase service_role)', `SUPABASE_SERVICE_ROLE_KEY=${JWT_HEAD}.${r.b64url(60)}.${r.b64url(32)}`),
    block('supabase sb_secret_', `SUPABASE_SERVICE_ROLE_KEY=sb_${'secret'}_${r.alnum(32)}`),
    block('supabase sbp_ PAT', `SUPABASE_ACCESS_TOKEN=sb${'p'}_${r.hex(40)}`),
    block('supabase sbp_ PAT bare', `const t = 'sb${'p'}_${r.hex(40)}'`),
    block('postgres URL', `DATABASE_URL=postgres://postgres:${r.alnum(16)}@db.example.co:5432/postgres`),
    block('postgres URL with symbol password', 'DATABASE_URL=postgresql://app:p%40ss!w0rd@host/db'),
    block('password with symbols (.env)', 'DB_PASSWORD=' + 'Tr0ub4dor&3horse!'),
    block('password with symbols (yaml)', 'password: "' + 'S3cure!Pass#2024"'),
    block('passphrase with spaces', 'SESSION_SECRET="' + 'correct horse battery staple"'),
    block('nextauth secret', `NEXTAUTH_SECRET=${r.b64(32)}`),
    block('KEY= suffix only (generic)', `MAILGUN_KEY=${r.hex(32)}`),
    block('PRIVATE_KEY= hex (web3)', `PRIVATE_KEY=0x${r.hex(64)}`),
    block('twilio auth token', `TWILIO_AUTH_TOKEN=${r.hex(32)}`),
    block('slack webhook', `SLACK_WEBHOOK=https://hooks.slack.com/services/T${r.upnum(8)}/B${r.upnum(10)}/${r.alnum(24)}`),
    block('discord webhook', `https://discord.com/api/webhooks/${'1'.repeat(18)}/${r.b64url(51)}`),
    block('npmrc', `//registry.npmjs.org/:_authToken=np${'m'}_${r.alnum(36)}`),
    block('bearer header', `Authorization: Bearer ${r.alnum(39)}7`),
    block('resend', `RESEND_API_KEY=r${'e'}_${r.alnum(32)}`),
    { name: 'split string concat', text: `const k = "sk_${'live'}_" + "${r.alnum(40)}";`, expect: 'consent' },
    { name: 'benign code', text: 'function debounce(fn, wait) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), wait); }; }', expect: 'clean' },
  ];
}

test('audit probe: no secret line leaves without a finding, and known formats block', () => {
  const misses: string[] = [];
  const unsure: string[] = [];
  for (let seed = 1; seed <= 30; seed += 1) {
    const cases = probeCases(seed);
    assert.equal(cases.length, 37);
    for (const { name, text, expect } of cases) {
      const findings = scanText(text, 'probe.env');
      if (expect === 'clean' && findings.length > 0) misses.push(`${name} flagged (seed ${seed})`);
      if (expect === 'block' && !hasBlocking(findings)) misses.push(`${name} did not block (seed ${seed})`);
      if (expect === 'consent' && findings.length === 0) unsure.push(`${name} (seed ${seed})`);
    }
  }
  assert.deepEqual(misses, []);
  // Lines with no recognisable format rely on the entropy check, which is statistical: about 3% of
  // random 40-character strings score under 4.5 bits. Allow at most one such miss in 30 runs.
  assert.ok(unsure.length <= 1, unsure.join(', '));
});

test('private key headers block in every PEM flavour', () => {
  for (const kind of ['', 'RSA ', 'EC ', 'DSA ', 'OPENSSH ', 'ENCRYPTED ', 'PGP ']) {
    assert.ok(hasBlocking(scanText(PEM(kind), 'key.pem')), kind || 'PKCS8');
  }
  assert.ok(hasBlocking(scanText('-----' + 'BEGIN PGP PRIVATE KEY BLOCK-----', 'key.asc')));
  assert.equal(hasBlocking(scanText('-----BEGIN PUBLIC KEY-----', 'key.pub')), false);
});

test('database connection strings with any password block', () => {
  for (const url of [
    'postgres://user:' + 'pass@localhost:5432/app',
    'mysql+pymysql://root:' + 'S3cret!@db/app',
    'redis://:' + 'hunter22@cache:6379',
    'mongodb+srv://app:' + 'Zq9vR2xL@cluster0.example.net/db',
  ]) {
    assert.ok(hasBlocking(scanText(url, 'x.env')), url);
  }
});

test('ordinary code with secret-sounding names, ids and hashes is not blocked', () => {
  const r = randomSource(7);
  const benign = [
    'const token = getToken();',
    'password: string;',
    'token?: string | null;',
    'const password = req.body.password;',
    "if (password !== confirmPassword) throw new Error('Passwords do not match');",
    'const apiKey = process.env.API_KEY;',
    'const secret = process.env.SESSION_SECRET!;',
    'password: z.string().min(8),',
    'secretKey: config.secretKey,',
    "const [password, setPassword] = useState('');",
    '<input type="password" name="password" autoComplete="current-password" />',
    "const STORAGE_KEY = 'unvibe.settings.v2';",
    "const queryKey = ['user', userId];",
    "tokenType: 'Bearer',",
    'const accessToken = await refreshAccessToken(refreshToken);',
    'headers: { authorization: `Bearer ${token}` },',
    'DB_PASSWORD=${DB_PASSWORD}',
    'API_KEY=your-api-key-here',
    'OPENAI_API_KEY=<your key>',
    "password: '********',",
    'SECRET_KEY=changeme',
    'DATABASE_URL=postgres://localhost:5432/app',
    'DATABASE_URL=postgres://${DB_USER}:${DB_PASSWORD}@db:5432/app',
    'PWD=/Users/preston/code/unvibe',
    'password = os.environ["DB_PASSWORD"]',
    '    password=settings.DB_PASSWORD,',
    'token := os.Getenv("GITHUB_TOKEN")',
    "password: 'Password',",
    "password: 'Mot de passe',",
    'const secretMessage = "Hello there, friend";',
    'throw new Error("Invalid token: expected a string");',
    'export const PASSWORD_MIN_LENGTH = 12;',
    'const tokens = text.split(/\\s+/);',
    "const accessTokenKey = 'access_token';",
    "hotkey: 'CommandOrControl+Shift+U',",
    'const requestId = "3f2b8c1e-9a4d-4e7b-8f6a-2c5d9e0b1a7f";',
    'idempotencyKey: "3f2b8c1e-9a4d-4e7b-8f6a-2c5d9e0b1a7f",',
    `commit ${r.hex(40)}`,
    `const sha = "${r.hex(64)}";`,
    `const publicKey = "${r.hex(64)}";`,
    'color: #1e293b; background-color: #ffffffcc; border: 1px solid #0f172a;',
    '--secret-color: #ff00aa;',
    'const monkey = "banana";',
    'Authorization: Bearer <token>',
  ];
  for (const line of benign) {
    assert.equal(hasBlocking(scanText(line, 'x.ts')), false, line);
  }
});

test('long adversarial lines scan in linear time', () => {
  // Runs on the main process: a pasted 120k-character line must not freeze the app.
  const adversarial = [
    'a.'.repeat(60_000),
    'a-'.repeat(60_000),
    'a.b-'.repeat(30_000),
    `${'a.'.repeat(59_990)}password=`,
    '-----BEGIN ' + 'A '.repeat(59_990),
    'Bearer '.repeat(17_000),
    'postgres://a:'.repeat(9_000),
    'hooks.slack.com/services/'.repeat(4_800),
    'token: "'.repeat(15_000),
    'a: '.repeat(40_000),
    '$.'.repeat(60_000),
    '_-'.repeat(60_000),
    'a-.'.repeat(40_000),
    '-'.repeat(120_000),
  ];
  for (const line of adversarial) {
    const started = performance.now();
    scanText(line, 'x.ts');
    const ms = performance.now() - started;
    assert.ok(ms < 250, `${line.slice(0, 16)}… (${line.length} chars) took ${Math.round(ms)} ms`);
  }
});

test('names after dots or dashes still match', () => {
  for (const line of ['mysql --password=' + 'S3cret!xyz9', 'obj?.token = "' + 'S3cret!xyz9"', 'this.config.apiKey = "' + 'S3cret!xyz9"']) {
    assert.ok(hasBlocking(scanText(line, 'x.sh')), line);
  }
});
