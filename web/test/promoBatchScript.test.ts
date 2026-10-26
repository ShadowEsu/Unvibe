import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
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

/** The script with HOME in the temp dir and no admin settings unless the test passes them. */
function script(args: string[], extra: Record<string, string> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, HOME: dir };
  Reflect.deleteProperty(env, 'UNVIBE_APP_BACKEND_URL');
  Reflect.deleteProperty(env, 'UNVIBE_ADMIN_STATS_TOKEN');
  return run(process.execPath, [SCRIPT, ...args], { env: Object.assign(env, extra), encoding: 'utf8' });
}

function codesIn(csv: string): string[] {
  return readFileSync(csv, 'utf8').trim().split('\n').slice(1).map((line) => line.split(',')[0]);
}

function shaOf(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
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

test('generate: default CSV path is ~/.config/unvibe-promo/unvibe-promo-<batch>.csv', async () => {
  const { stdout } = await script(['generate', 'defaults', '2']);
  const csv = join(dir, '.config', 'unvibe-promo', 'unvibe-promo-defaults.csv');
  assert.ok(stdout.includes(csv));
  assert.equal(statSync(csv).mode & 0o777, 0o600);
  assert.ok(stdout.includes(join(dir, '.config', 'unvibe-promo', 'unvibe-promo-defaults-insert.sql')));
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

test('take: refuses a promo folder other users can write, and hands nothing out', async () => {
  // 0o770 and 0o707: the group bit alone and the world bit alone are each enough to refuse.
  for (const mode of [0o777, 0o770, 0o707]) {
    const name = `opens${mode.toString(8)}`;
    const folder = join(dir, `shared-${mode.toString(8)}`);
    const csv = join(folder, 'open.csv');
    await script(['generate', name, '2', '--csv', csv, '--sql', join(folder, 'open.sql')]);
    chmodSync(folder, mode);
    await assert.rejects(script(['take', name, 'Ada', '--csv', csv]), /can be written by other users/, `mode ${mode.toString(8)}`);
    assert.ok(!readFileSync(csv, 'utf8').includes('Ada'), `no code was handed out (mode ${mode.toString(8)})`);
  }
});

test('generate: refuses a CSV or SQL folder other users can write, and writes nothing', async () => {
  for (const mode of [0o770, 0o707]) {
    const shared = join(dir, `gen-shared-${mode.toString(8)}`);
    mkdirSync(shared);
    chmodSync(shared, mode);
    const csv = join(shared, 'codes.csv');
    const sql = join(shared, 'insert.sql');
    await assert.rejects(script(['generate', 'shared', '2', '--csv', csv, '--sql', sql]), /can be written by other users/, `both in a ${mode.toString(8)} folder`);
    // A shared SQL folder alone is enough, and the CSV in the private folder isn't written either.
    const privateCsv = join(dir, `gen-private-${mode.toString(8)}.csv`);
    await assert.rejects(script(['generate', 'shared', '2', '--csv', privateCsv, '--sql', sql]), /can be written by other users/, `SQL in a ${mode.toString(8)} folder`);
    for (const path of [csv, sql, privateCsv]) assert.throws(() => statSync(path), `${path} was not written`);
  }
});

test('generate prints the SQL sha256, and verify accepts the untouched files, also after a take', async () => {
  const csv = join(dir, 'ver.csv');
  const sql = join(dir, 'ver.sql');
  const { stdout } = await script(['generate', 'verbatch', '4', '--csv', csv, '--sql', sql]);
  const printed = /^SQL sha256: ([0-9a-f]{64})$/m.exec(stdout)?.[1] ?? '';
  assert.equal(printed, shaOf(sql), 'the printed sha256 is the file\'s');
  assert.match(stdout, /^record this sha256 somewhere off this Mac \(a note on your phone, for example\); verify needs it$/m);
  assert.ok(stdout.includes(`verify verbatch --expect-sha ${printed} --csv `), 'it says how to verify, with the sha and the paths it used');
  const ok = await script(['verify', 'verbatch', '--expect-sha', printed, '--csv', csv, '--sql', sql]);
  assert.match(ok.stdout, /^OK: .* has the sha256 you recorded and is exactly the insert for the 4 codes in /m);
  assert.match(ok.stdout, /^batch verbatch \(verbatch\): 3 months, cap 300, redeem by 2026-11-30 23:59:59 America\/Los_Angeles$/m);
  assert.ok(ok.stdout.includes(`SQL sha256: ${printed}`));
  await script(['take', 'verbatch', 'Ada', '--csv', csv]);
  await script(['verify', 'verbatch', '--expect-sha', printed, '--csv', csv, '--sql', sql]);
});

test('verify: needs the recorded sha256 and refuses an SQL edited after generate', async () => {
  const csv = join(dir, 'shaed.csv');
  const sql = join(dir, 'shaed.sql');
  await script(['generate', 'shaed', '3', '--csv', csv, '--sql', sql]);
  const recorded = shaOf(sql);
  await assert.rejects(script(['verify', 'shaed', '--csv', csv, '--sql', sql]), /verify needs --expect-sha <sha256>: .* recorded them off this Mac/, 'no --expect-sha');
  await assert.rejects(script(['verify', 'shaed', '--expect-sha', recorded.toUpperCase(), '--csv', csv, '--sql', sql]), /verify needs --expect-sha/, 'upper case hex');
  await assert.rejects(script(['verify', 'shaed', '--expect-sha', recorded.slice(1), '--csv', csv, '--sql', sql]), /verify needs --expect-sha/, '63 characters');
  // An SQL-only edit to the cap and the redeem-by date still rebuilds to the same bytes, so only the
  // recorded sha256 can catch it.
  writeFileSync(sql, readFileSync(sql, 'utf8').replace(', 300);', ', 300000);').replace("'2026-11-30 23:59:59", "'2036-11-30 23:59:59"));
  await assert.rejects(script(['verify', 'shaed', '--expect-sha', recorded, '--csv', csv, '--sql', sql]), /has sha256 [0-9a-f]{64}, not the [0-9a-f]{64} you recorded; .*do not run it/, 'cap and redeem-by edited in the SQL');
});

test('verify: refuses an SQL that no longer matches the private CSV', async () => {
  // Each SQL below is checked against its own current sha256, so the rebuild alone must catch it.
  const verify = (batch: string, csv: string, sql: string) => script(['verify', batch, '--expect-sha', shaOf(sql), '--csv', csv, '--sql', sql]);
  const fresh = async (name: string) => {
    const csv = join(dir, `${name}.csv`);
    const sql = join(dir, `${name}.sql`);
    await script(['generate', name, '3', '--csv', csv, '--sql', sql]);
    return { csv, sql, text: readFileSync(sql, 'utf8') };
  };
  const swapped = await fresh('swapone');
  writeFileSync(swapped.sql, swapped.text.replace(/'[0-9a-f]{64}'/, `'${'0'.repeat(64)}'`));
  await assert.rejects(verify('swapone', swapped.csv, swapped.sql), /does not match the codes/, 'a swapped hash');
  const extra = await fresh('extrastmt');
  writeFileSync(extra.sql, extra.text.replace('commit;', "update public.profiles set plan = 'pro';\ncommit;"));
  await assert.rejects(verify('extrastmt', extra.csv, extra.sql), /does not match the codes/, 'an added statement');
  const fewer = await fresh('fewercodes');
  writeFileSync(fewer.csv, readFileSync(fewer.csv, 'utf8').trimEnd().split('\n').slice(0, -1).join('\n') + '\n');
  await assert.rejects(verify('fewercodes', fewer.csv, fewer.sql), /does not match the codes/, 'a code dropped from the CSV');
  await assert.rejects(verify('otherbatch', fewer.csv, swapped.sql), /is for batch swapone, not otherbatch/, 'another batch\'s SQL');
  const many = await fresh('toomany');
  writeFileSync(many.sql, many.text.replace("', 3, timestamptz", "', 24, timestamptz"));
  await assert.rejects(verify('toomany', many.csv, many.sql), /gives 24 months/, 'months outside 1 to 12');
});

test('generate and verify refuse a label with control characters', async () => {
  for (const char of ['\t', '\n', '\u001b', '\u007f']) {
    const csv = join(dir, 'ctl.csv');
    const sql = join(dir, 'ctl.sql');
    await assert.rejects(script(['generate', 'ctl', '2', '--label', `Cal${char}Hacks`, '--csv', csv, '--sql', sql]), /--label must not contain control characters/, `generate, U+${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
    for (const path of [csv, sql]) assert.throws(() => statSync(path), `${path} was not written`);
  }
  const csv = join(dir, 'ctlsql.csv');
  const sql = join(dir, 'ctlsql.sql');
  await script(['generate', 'ctlsql', '2', '--label', 'Cal Hacks', '--csv', csv, '--sql', sql]);
  const text = readFileSync(sql, 'utf8');
  for (const char of ['\t', '\u001b', '\u007f']) {
    // The edited SQL is checked against its own sha256 and rebuilds byte for byte with that label.
    writeFileSync(sql, text.replace("'Cal Hacks'", `'Cal${char}Hacks'`));
    await assert.rejects(script(['verify', 'ctlsql', '--expect-sha', shaOf(sql), '--csv', csv, '--sql', sql]), /has a control character in its label; do not run it/, `verify, U+${char.charCodeAt(0).toString(16).padStart(4, '0')}`);
  }
});

test('generate refuses a promo folder under a parent other users can change; a sticky parent is fine', async () => {
  const open = join(dir, 'open-parent');
  mkdirSync(open);
  chmodSync(open, 0o777);
  const inner = join(open, 'mine');
  await assert.rejects(script(['generate', 'underopen', '2', '--csv', join(inner, 'c.csv'), '--sql', join(inner, 'c.sql')]), /a folder above .* can be changed by other users/, 'a writable parent');
  for (const path of [join(inner, 'c.csv'), join(inner, 'c.sql')]) assert.throws(() => statSync(path), `${path} was not written`);
  // The link is a parent of the promo folder: through it every folder is private, so only the walk
  // over the path as written sees the writable folder that holds the link.
  const target = join(dir, 'private-target');
  mkdirSync(target, { mode: 0o700 });
  symlinkSync(target, join(open, 'link'));
  const vialink = join(open, 'link', 'inner');
  await assert.rejects(script(['generate', 'vialink', '2', '--csv', join(vialink, 'c.csv'), '--sql', join(vialink, 'c.sql')]), /a folder above .* can be changed by other users/, 'a link placed in a writable parent');
  for (const path of [join(target, 'inner', 'c.csv'), join(target, 'inner', 'c.sql')]) assert.throws(() => statSync(path), `${path} was not written`);
  const sticky = join(dir, 'sticky-parent');
  mkdirSync(sticky);
  chmodSync(sticky, 0o1777);
  const mine = join(sticky, 'mine');
  await script(['generate', 'understicky', '2', '--csv', join(mine, 'c.csv'), '--sql', join(mine, 'c.sql')]);
  await script(['take', 'understicky', 'Ada', '--csv', join(mine, 'c.csv')]);
});

test('generate, take and verify refuse a promo folder that is itself a symlink, and write nothing', async () => {
  const real = join(dir, 'entry-real');
  mkdirSync(real, { mode: 0o700 });
  const link = join(dir, 'entry-link');
  symlinkSync(real, link);
  await assert.rejects(script(['generate', 'entrylink', '2', '--csv', join(link, 'c.csv'), '--sql', join(link, 'c.sql')]), /entry-link is a symlink; pass the real folder path instead/, 'generate');
  for (const path of [join(real, 'c.csv'), join(real, 'c.sql')]) assert.throws(() => statSync(path), `${path} was not written`);
  await script(['generate', 'entrylink', '2', '--csv', join(real, 'c.csv'), '--sql', join(real, 'c.sql')]);
  await assert.rejects(script(['take', 'entrylink', 'Ada', '--csv', join(link, 'c.csv')]), /is a symlink; pass the real folder path/, 'take');
  assert.ok(!readFileSync(join(real, 'c.csv'), 'utf8').includes('Ada'), 'no code was handed out');
  await assert.rejects(script(['verify', 'entrylink', '--expect-sha', shaOf(join(real, 'c.sql')), '--csv', join(link, 'c.csv'), '--sql', join(link, 'c.sql')]), /is a symlink; pass the real folder path/, 'verify');
});

test('take refuses a promo folder that belongs to another user', { skip: process.getuid?.() === 0 ? 'root owns /usr' : false }, async () => {
  // /usr exists, is root's and is not writable by others, so only the owner check can refuse it.
  await assert.rejects(script(['take', 'x', 'Ada', '--csv', '/usr/x.csv']), /\/usr belongs to another user; use a folder of your own/);
  assert.throws(() => statSync('/usr/x.csv'), 'nothing was created in /usr');
});

test('take and verify refuse a regular file passed as the promo folder, and write nothing', async () => {
  const afile = join(dir, 'afile');
  writeFileSync(afile, 'not a folder\n', { mode: 0o600 });
  await assert.rejects(script(['take', 'x', 'Ada', '--csv', join(afile, 'x.csv')]), /afile is not a folder/, 'take');
  await assert.rejects(script(['verify', 'x', '--expect-sha', '0'.repeat(64), '--csv', join(afile, 'x.csv'), '--sql', join(afile, 'x.sql')]), /afile is not a folder/, 'verify');
  assert.equal(readFileSync(afile, 'utf8'), 'not a folder\n', 'the file is unchanged');
});

test('generate refuses a symlink in a sticky folder used as the promo folder, and writes nothing', async () => {
  const sticky = join(dir, 'sticky-links');
  mkdirSync(sticky);
  chmodSync(sticky, 0o1777);
  const real = join(dir, 'sticky-link-target');
  mkdirSync(real, { mode: 0o700 });
  const link = join(sticky, 'promo');
  symlinkSync(real, link);
  await assert.rejects(script(['generate', 'stickylink', '2', '--csv', join(link, 'c.csv'), '--sql', join(link, 'c.sql')]), /sticky-links\/promo is a symlink; pass the real folder path instead/);
  assert.deepEqual(readdirSync(real), [], 'nothing was written through the link');
});

test('take: a missing CSV says so', async () => {
  await assert.rejects(script(['take', 'nobatch', 'Ada', '--csv', join(dir, 'nowhere', 'x.csv')]), /no CSV at /);
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
  assert.match(revoked.stdout, /^revoked: [0-9a-f]{8}, nothing taken back/);
  assert.match((await script(['list'], env)).stdout, /codes revoked 1/);
  await assert.rejects(script(['revoke', 'ZZZZ-ZZZZ-ZZZZ-ZZZZ'], env), /no such code/);
  await assert.rejects(script(['list'], { ...env, UNVIBE_ADMIN_STATS_TOKEN: 'wrong-token-wrong-token-wrong' }), /refused the admin token/);
  await assert.rejects(script(['list']), /set UNVIBE_APP_BACKEND_URL and UNVIBE_ADMIN_STATS_TOKEN/);
  await assert.rejects(script(['list'], { ...env, UNVIBE_APP_BACKEND_URL: 'http://api.example.test' }), /must be https/);
});
