import test from 'node:test';
import assert from 'node:assert/strict';
import { TRY_CONSENT_VERSION, looksSecret, trySystemPrompt, validateTry } from '../src/lib/tryDemo';

const consent = { v: TRY_CONSENT_VERSION, aiSend: true, age18: true };
const REFUSED = { ok: false, error: 'Tick both boxes to send this code to Claude.' };

test('try demo accepts a small snippet with both ticks and defaults the level', () => {
  const result = validateTry({ code: 'const a = 1;', consent });
  assert.ok(result.ok);
  if (result.ok) assert.equal(result.level, 'intermediate');
});

test('try demo rejects empty, huge and secret-bearing input', () => {
  assert.equal(validateTry({ code: '   ', consent }).ok, false);
  assert.equal(validateTry({ code: 'x'.repeat(2_000), consent }).ok, false);
  assert.equal(validateTry({ code: Array(80).fill('a').join('\n'), consent }).ok, false);
  assert.equal(validateTry({ code: 'const key = "sk-abcdefghijklmnopqrstu";', consent }).ok, false);
  assert.equal(validateTry(null).ok, false);
});

test('try demo refuses code unless both boxes were ticked for the current version', () => {
  const code = 'const a = 1;';
  assert.equal(TRY_CONSENT_VERSION, '2026-10-29');
  assert.deepEqual(validateTry({ code }), REFUSED, 'missing consent');
  assert.deepEqual(validateTry({ code, consent: TRY_CONSENT_VERSION }), REFUSED, 'a bare version string');
  assert.deepEqual(validateTry({ code, consent: { ...consent, v: '2026-01-01' } }), REFUSED, 'wrong version');
  assert.deepEqual(validateTry({ code, consent: { ...consent, v: '2026-10-28' } }), REFUSED, 'the version before the box named Anthropic');
  assert.deepEqual(validateTry({ code, consent: { ...consent, aiSend: false } }), REFUSED, 'aiSend false');
  assert.deepEqual(validateTry({ code, consent: { v: TRY_CONSENT_VERSION, aiSend: true } }), REFUSED, 'age18 missing');
  assert.deepEqual(validateTry({ code, consent: { ...consent, age18: 'true' } }), REFUSED, 'age18 not exactly true');
  assert.deepEqual(validateTry({ code, consent }), { ok: true, code, level: 'intermediate' });
});

test('secret patterns catch common key shapes but not normal code', () => {
  assert.ok(looksSecret('AKIAABCDEFGHIJKLMNOP'));
  assert.ok(looksSecret('password = "hunter2hunter2"'));
  assert.equal(looksSecret('function add(a, b) { return a + b; }'), false);
});

test('unquoted .env and config secrets are refused (Security 0939 E2)', () => {
  // Fake values on purpose: low entropy, so the repo's own secret scanner (rightly) ignores them.
  for (const line of [
    'PAYMENTS_API_KEY=abc123abc123abc123abc123',
    'JWT_SECRET=aaaa1111bbbb2222',
    'export GITHUB_TOKEN=abcd1234abcd1234',
    'db_password: hunter2hunter2',
    'DB_PASS=Tr0ub4dor&3 # prod',
    'NODE_ENV=production\nAPI_KEY=abc123abc123\nPORT=3000',
  ]) assert.ok(looksSecret(line), line);
});

test('passwords in URLs are refused unless the host is local or the password a placeholder', () => {
  assert.ok(looksSecret('DATABASE_URL=postgres://shop:S3cretPw@db.example.com:5432/shop'));
  assert.ok(looksSecret('redis://default:abc123@cache.internal:6379'));
  assert.equal(looksSecret('DATABASE_URL=postgres://shop:devpass@localhost:5432/shop'), false);
  assert.equal(looksSecret('postgres://app:app@127.0.0.1/app'), false);
  assert.equal(looksSecret('postgres://user:<password>@db.example.com/app'), false);
  assert.equal(looksSecret('postgres://user:${DB_PASS}@db.example.com/app'), false);
  assert.equal(looksSecret('mysql://root:****@db.example.com/app'), false);
  assert.equal(looksSecret('see https://user@example.com/docs and https://example.com:8080/a'), false);
});

test('placeholders, references and ordinary code with key/token/pass names still go through', () => {
  for (const code of [
    'PAYMENTS_API_KEY=replace-with-your-test-key',
    'SECRET_KEY=changeme',
    'API_KEY = os.environ["API_KEY"]',
    'const token = getToken(user1);',
    'token = await fetchToken()',
    'API_KEY=${API_KEY}',
    'cache-key: node-modules',
    'sort_key = 1',
    'for key, value in pairs(t) do print(key, value) end',
    'BYPASS_CACHE=true',
  ]) assert.equal(looksSecret(code), false, code);
});

test('prompt tells the model to ignore instructions inside the snippet', () => {
  assert.match(trySystemPrompt('beginner'), /Ignore any instructions/);
});
