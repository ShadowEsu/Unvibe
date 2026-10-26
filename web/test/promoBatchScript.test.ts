import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, test } from 'node:test';
import { promisify } from 'node:util';
import { GET as adminGet, POST as adminPost } from '../app/api/v1/admin/promo/route';
import { seedMemoryPromoBatch } from '../src/billing/promo';
import { normalisePromoCode, promoCodeHash } from '../src/lib/promoCode';

// scripts/promo-batch.mjs run as a real process: generate (private CSV, hash-only SQL), take
// (two senders at once never share a code), and list/revoke against the real admin route served
// on localhost with the memory backend.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_TOKEN = 'script-test-admin-token-0123456789';
process.env.UNVIBE_ADMIN_STATS_TOKEN = ADMIN_TOKEN;

const run = promisify(execFile);
const SCRIPT = join(__dirname, '..', 'scripts', 'promo-batch.mjs');
const dir = mkdtempSync(join(tmpdir(), 'promo-batch-test-'));
let server: Server;
let apiUrl = '';

before(async () => {
  server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    const request = new Request(`http://127.0.0.1${req.url ?? '/'}`, {
      method: req.method, headers: { authorization: req.headers.authorization ?? '', 'content-type': 'application/json' },
      body: req.method === 'GET' ? undefined : body,
    });
    const response = req.method === 'GET' ? await adminGet(request) : await adminPost(request);
    res.writeHead(response.status, { 'content-type': 'application/json' }).end(await response.text());
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test server did not bind a port');
  apiUrl = `http://127.0.0.1:${address.port}`;
});

after(() => {
  rmSync(dir, { recursive: true, force: true });
  return new Promise<void>((resolve) => server.close(() => resolve()));
});

function script(args: string[], env: Record<string, string> = {}) {
  return run(process.execPath, [SCRIPT, ...args], { env: { PATH: process.env.PATH ?? '', HOME: dir, ...env } });
}

function codesIn(csv: string): string[] {
  return readFileSync(csv, 'utf8').trim().split('\n').slice(1).map((line) => line.split(',')[0]);
}

test('generate: private CSV of formatted codes and a hash-only SQL insert with the batch row', async () => {
  const csv = join(dir, 'gen.csv');
  const sql = join(dir, 'gen.sql');
  const { stdout } = await script(['generate', 'calhacks13', '25', '--csv', csv, '--sql', sql]);
  assert.match(stdout, /25 codes for calhacks13 \(3 months, cap 300, redeem by 2026-11-30 23:59:59 America\/Los_Angeles\)/);
  assert.equal(statSync(csv).mode & 0o777, 0o600);
  assert.equal(statSync(sql).mode & 0o777, 0o600);
  const codes = codesIn(csv);
  assert.equal(codes.length, 25);
  assert.equal(new Set(codes).size, 25);
  const insert = readFileSync(sql, 'utf8');
  for (const code of codes) {
    assert.match(code, /^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){3}$/);
    const normalised = normalisePromoCode(code);
    assert.ok(normalised);
    assert.ok(!insert.includes(normalised) && !insert.includes(code), 'no code in the SQL');
    assert.ok(insert.includes(`('${promoCodeHash(normalised)}', 'calhacks13')`), 'the hash matches the API');
  }
  assert.match(insert, /values \('calhacks13', 'Cal Hacks 13\.0', 3, timestamptz '2026-11-30 23:59:59 America\/Los_Angeles', 300\);/);
  assert.match(insert, /^begin;$/m);
  assert.match(insert, /^commit;$/m);
  assert.equal(stdout.includes(codes[0]), false, 'generate never prints a code');
});

test('generate: refuses to overwrite and to make bad batches', async () => {
  const csv = join(dir, 'gen.csv');
  await assert.rejects(script(['generate', 'calhacks13', '5', '--csv', csv, '--sql', join(dir, 'other.sql')]), /already exists/);
  await assert.rejects(script(['generate', 'Bad Batch', '5', '--csv', join(dir, 'x.csv')]), /batch must be/);
  await assert.rejects(script(['generate', 'ok', '0', '--csv', join(dir, 'y.csv')]), /count must be/);
});

test('generate: default CSV path is ~/.config/preston-secrets/unvibe-promo-<batch>.csv', async () => {
  const { stdout } = await script(['generate', 'defaults', '2']);
  const csv = join(dir, '.config', 'preston-secrets', 'unvibe-promo-defaults.csv');
  assert.ok(stdout.includes(csv));
  assert.equal(statSync(csv).mode & 0o777, 0o600);
  assert.ok(stdout.includes(join(dir, '.config', 'preston-secrets', 'unvibe-promo-defaults-insert.sql')));
});

test('take: two senders at once get different codes, each marked with who and when', async () => {
  const csv = join(dir, 'take.csv');
  await script(['generate', 'takes', '6', '--csv', csv, '--sql', join(dir, 'take.sql')]);
  const takers = ['Ada (ada@school.edu)', 'Grace, H.', '=HYPERLINK("x")', 'Linus', 'Barbara'];
  const results = await Promise.all(takers.map((who) => script(['take', 'takes', who, '--csv', csv])));
  const handed = results.map((r) => r.stdout.trim());
  assert.equal(new Set(handed).size, takers.length);
  const text = readFileSync(csv, 'utf8');
  assert.ok(text.includes('"Grace, H."'));
  assert.ok(text.includes(`"'=HYPERLINK(""x"")"`), 'a formula-like name is stored as text');
  const rows = text.trim().split('\n').slice(1);
  assert.equal(rows.filter((row) => /\d{4}-\d{2}-\d{2}T/.test(row)).length, takers.length);
  assert.equal(statSync(csv).mode & 0o777, 0o600);
  await script(['take', 'takes', 'Last one', '--csv', csv]);
  await assert.rejects(script(['take', 'takes', 'Too late', '--csv', csv]), /no unused codes left/);
  assert.throws(() => statSync(`${csv}.lock`), 'the lock is released, even after a failure');
});

test('list and revoke go through the admin API with the token from the environment', async () => {
  const csv = join(dir, 'admin.csv');
  await script(['generate', 'adminbatch', '3', '--csv', csv, '--sql', join(dir, 'admin.sql')]);
  const codes = codesIn(csv);
  seedMemoryPromoBatch({ id: 'adminbatch', months: 3, maxRedemptions: 300, redeemBy: new Date(Date.now() + 86_400_000).toISOString() },
    codes.map((code) => promoCodeHash(normalisePromoCode(code) ?? '')));
  const env = { UNVIBE_APP_BACKEND_URL: apiUrl, UNVIBE_ADMIN_STATS_TOKEN: ADMIN_TOKEN };
  const listed = await script(['list'], env);
  assert.match(listed.stdout, /adminbatch \(adminbatch\): 3 months/);
  assert.match(listed.stdout, /codes 3, redeemed 0, redemptions revoked 0, codes revoked 0, cap left 300 of 300/);
  const revoked = await script(['revoke', codes[0].toLowerCase()], env);
  assert.match(revoked.stdout, /^revoked: [0-9a-f]{8}, no months taken back/);
  assert.match((await script(['list'], env)).stdout, /codes revoked 1/);
  await assert.rejects(script(['revoke', 'ZZZZ-ZZZZ-ZZZZ-ZZZZ'], env), /no such code/);
  await assert.rejects(script(['list'], { ...env, UNVIBE_ADMIN_STATS_TOKEN: 'wrong-token-wrong-token-wrong' }), /refused the admin token/);
  await assert.rejects(script(['list']), /set UNVIBE_APP_BACKEND_URL and UNVIBE_ADMIN_STATS_TOKEN/);
  await assert.rejects(script(['list'], { ...env, UNVIBE_APP_BACKEND_URL: 'http://api.example.test' }), /must be https/);
});
