#!/usr/bin/env node
// Promo codes: make a batch, hand codes out, list and revoke (spec agents/unvibe/2026-10-25-promo-codes-spec.md).
//
//   node scripts/promo-batch.mjs generate <batch> <count> [--csv path] [--sql path]
//                                         [--months 3] [--cap 300] [--redeem-by "2026-11-30 23:59:59 America/Los_Angeles"] [--label text]
//       Writes the codes to a private CSV (mode 600; columns code, given_to, given_at; default
//       ~/.config/unvibe-promo/unvibe-promo-<batch>.csv) and a hash-only SQL insert (the batch
//       row plus sha256("unvibe-promo:" + code) per code; default next to the CSV). Never
//       overwrites either file. The SQL is run once, by hand, with the owner's yes. Prints the SQL's
//       sha256, which the owner records somewhere off this Mac. A label with control characters is
//       refused.
//   node scripts/promo-batch.mjs take <batch> <who> [--csv path]
//       Marks the next unused code as given to <who> (with the time) and prints it. A lock file
//       next to the CSV makes sure two senders never get the same code.
//   node scripts/promo-batch.mjs verify <batch> --expect-sha <sha256> [--csv path] [--sql path]
//       Run right before the SQL goes to production: refuses unless the SQL's sha256 is the one
//       generate printed (recorded off this Mac), then checks that the SQL is exactly the insert
//       generate writes for the codes in the CSV (nothing added, removed or swapped) and prints the
//       batch settings.
//   node scripts/promo-batch.mjs list
//   node scripts/promo-batch.mjs revoke <code>
//       Call the API's admin endpoint: UNVIBE_APP_BACKEND_URL (e.g. https://api.unvibe.site) and
//       UNVIBE_ADMIN_STATS_TOKEN from the environment. A revoked, redeemed code takes its months back.
//
// Codes: 16 characters of Crockford base32, 80 bits from crypto.randomInt, shown XXXX-XXXX-XXXX-XXXX.
// Normalising and hashing match web/src/lib/promoCode.ts (test/promoBatchScript.test.ts checks).
import { createHash, randomInt } from 'node:crypto';
import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{16}$/;
const BATCH_RE = /^[a-z0-9][a-z0-9_-]{0,47}$/;
const HEADER = 'code,given_to,given_at';
const DEFAULTS = { months: 3, cap: 300, redeemBy: '2026-11-30 23:59:59 America/Los_Angeles' };
const REDEEM_RE = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})? [A-Za-z_]+\/[A-Za-z_]+$/;
const CONTROL_RE = /[\u0000-\u001f\u007f]/;
const SHA_RE = /^[0-9a-f]{64}$/;
const LABELS = { calhacks13: 'Cal Hacks 13.0' };
const LOCK_WAIT_MS = 10_000;

export function newCode() {
  let code = '';
  for (let i = 0; i < 16; i += 1) code += ALPHABET[randomInt(32)];
  return code;
}

export function normalise(raw) {
  if (typeof raw !== 'string' || raw.length > 64) return null;
  const code = raw.toUpperCase().replace(/[\s-]+/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  return CODE_RE.test(code) ? code : null;
}

export function hashOf(code) {
  return createHash('sha256').update(`unvibe-promo:${code}`).digest('hex');
}

export function format(code) {
  return code.match(/.{4}/g).join('-');
}

/** Throws, so `finally` blocks (the take lock) still run; main prints it and exits 1. */
function fail(message) {
  throw new Error(message);
}

function defaultCsv(batch) {
  return join(homedir(), '.config', 'unvibe-promo', `unvibe-promo-${batch}.csv`);
}

function parseArgs(argv) {
  const positional = [];
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const value = argv[i + 1];
      if (value === undefined || value.startsWith('--')) fail(`${arg} needs a value`);
      options[arg.slice(2)] = value;
      i += 1;
    } else {
      positional.push(arg);
    }
  }
  return { positional, options };
}

// ------------------------------------------------------------------------------ CSV

function csvField(value) {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** A spreadsheet must never run a name as a formula. */
function safeCell(value) {
  const flat = value.replace(/[\r\n]+/g, ' ').trim();
  return /^[=+\-@\t]/.test(flat) ? `'${flat}` : flat;
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

function readCodes(csvPath) {
  if (!existsSync(csvPath)) fail(`no CSV at ${csvPath}`);
  const [header, ...rows] = parseCsv(readFileSync(csvPath, 'utf8'));
  if (header?.join(',') !== HEADER) fail(`${csvPath} does not start with "${HEADER}"`);
  return rows.filter((row) => row.length >= 1 && row[0] !== '').map(([code, givenTo = '', givenAt = '']) => ({ code, givenTo, givenAt }));
}

function writeCsv(path, rows, flag) {
  const text = [HEADER, ...rows.map((row) => [row.code, row.givenTo, row.givenAt].map(csvField).join(','))].join('\n') + '\n';
  writeFileSync(path, text, { mode: 0o600, flag });
}

// ------------------------------------------------------------------------------ generate

function sqlString(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

export function insertSql({ batch, label, months, cap, redeemBy, hashes, generatedAt }) {
  return [
    `-- Promo batch ${batch}: ${hashes.length} code hashes, sha256("unvibe-promo:" + code) in hex. No codes.`,
    `-- Generated ${generatedAt} by web/scripts/promo-batch.mjs. Run once, with the owner's yes. Running it`,
    '-- again fails on the existing batch row and changes nothing.',
    'begin;',
    'insert into public.promo_batches (id, label, months, redeem_by, max_redemptions)',
    `  values (${sqlString(batch)}, ${sqlString(label)}, ${months}, timestamptz ${sqlString(redeemBy)}, ${cap});`,
    'insert into public.promo_codes (code_hash, batch_id) values',
    hashes.map((hash) => `  (${sqlString(hash)}, ${sqlString(batch)})`).join(',\n') + ';',
    'commit;',
    '',
  ].join('\n');
}

/**
 * Another user who can change the folder, or any folder above it, could swap the CSV or the SQL or
 * plant files beside them. The folder must be a real folder (not a symlink), yours, and not group-
 * or world-writable. Every folder above it, both as written and as reached through symlinks, must
 * belong to you or root and must not be group- or world-writable unless it has the sticky bit (like
 * /tmp, where others can't rename or delete what is yours).
 */
function assertPrivateFolder(folder) {
  const own = lstatSync(folder, { throwIfNoEntry: false });
  if (!own) return;
  if (own.isSymbolicLink()) fail(`${folder} is a symlink; pass the real folder path instead`);
  const uid = typeof process.getuid === 'function' ? process.getuid() : undefined;
  if (!own.isDirectory()) fail(`${folder} is not a folder`);
  if (uid !== undefined && own.uid !== uid) fail(`${folder} belongs to another user; use a folder of your own`);
  if ((own.mode & 0o022) !== 0) fail(`${folder} can be written by other users; run chmod 700 on it first`);
  for (const start of new Set([resolve(folder), realpathSync(folder)])) {
    for (let dir = dirname(start); ; dir = dirname(dir)) {
      const parent = lstatSync(dir);
      const shared = !parent.isSymbolicLink() && (parent.mode & 0o022) !== 0 && (parent.mode & 0o1000) === 0;
      if (shared || (uid !== undefined && parent.uid !== uid && parent.uid !== 0)) {
        fail(`${dir}, a folder above ${folder}, can be changed by other users; keep the promo files in a folder only you control`);
      }
      if (dir === dirname(dir)) break;
    }
  }
}

function generate(batch, countText, options) {
  if (!BATCH_RE.test(batch ?? '')) fail('batch must be lower case letters, digits, - or _ (up to 48)');
  const count = Number(countText);
  if (!Number.isInteger(count) || count < 1 || count > 10_000) fail('count must be a whole number from 1 to 10000');
  const months = Number(options.months ?? DEFAULTS.months);
  if (!Number.isInteger(months) || months < 1 || months > 12) fail('--months must be 1 to 12');
  const cap = Number(options.cap ?? DEFAULTS.cap);
  if (!Number.isInteger(cap) || cap < 1) fail('--cap must be a whole number above 0');
  const redeemBy = options['redeem-by'] ?? DEFAULTS.redeemBy;
  if (!REDEEM_RE.test(redeemBy)) {
    fail('--redeem-by must look like "2026-11-30 23:59:59 America/Los_Angeles"');
  }
  const fullLabel = options.label ?? LABELS[batch] ?? batch;
  if (CONTROL_RE.test(fullLabel)) fail('--label must not contain control characters such as tabs or line breaks');
  const label = fullLabel.slice(0, 120);
  const csvPath = resolve(options.csv ?? defaultCsv(batch));
  const sqlPath = resolve(options.sql ?? join(dirname(csvPath), `unvibe-promo-${batch}-insert.sql`));
  for (const path of [csvPath, sqlPath]) if (existsSync(path)) fail(`${path} already exists; nothing written`);

  const codes = new Set();
  while (codes.size < count) codes.add(newCode());
  const rows = [...codes].map((code) => ({ code: format(code), givenTo: '', givenAt: '' }));
  // Both folders are checked before anything is written: the SQL is what later runs on production.
  for (const folder of new Set([dirname(csvPath), dirname(sqlPath)])) {
    mkdirSync(folder, { recursive: true, mode: 0o700 });
    assertPrivateFolder(folder);
  }
  writeCsv(csvPath, rows, 'wx');
  const sql = insertSql({ batch, label, months, cap, redeemBy, hashes: [...codes].map(hashOf), generatedAt: new Date().toISOString() });
  writeFileSync(sqlPath, sql, { mode: 0o600, flag: 'wx' });
  console.log(`${count} codes for ${batch} (${months} months, cap ${cap}, redeem by ${redeemBy})`);
  console.log(`codes (private, mode 600): ${csvPath}`);
  console.log(`hash-only SQL: ${sqlPath}`);
  const sha = sha256Hex(sql);
  console.log(`SQL sha256: ${sha}`);
  console.log('record this sha256 somewhere off this Mac (a note on your phone, for example); verify needs it');
  const paths = `${options.csv ? ` --csv ${JSON.stringify(csvPath)}` : ''}${options.sql ? ` --sql ${JSON.stringify(sqlPath)}` : ''}`;
  console.log(`right before running it on production: node scripts/promo-batch.mjs verify ${batch} --expect-sha ${sha}${paths}`);
}

// ------------------------------------------------------------------------------ take

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function withLock(lockPath, work) {
  const started = Date.now();
  let fd;
  for (;;) {
    try {
      fd = openSync(lockPath, 'wx', 0o600);
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() - started > LOCK_WAIT_MS) {
        const age = Math.round((Date.now() - statSync(lockPath).mtimeMs) / 1000);
        fail(`${lockPath} is held (${age} s old). If no other take is running, delete it and try again.`);
      }
      sleep(50 + randomInt(50));
    }
  }
  try {
    writeFileSync(fd, `${process.pid}\n`);
    return work();
  } finally {
    closeSync(fd);
    unlinkSync(lockPath);
  }
}

function take(batch, who, options) {
  if (!BATCH_RE.test(batch ?? '')) fail('batch must be lower case letters, digits, - or _');
  const recipient = safeCell(who ?? '');
  if (!recipient) fail('say who the code is for, e.g. take calhacks13 "Ada L. (ada@school.edu)"');
  const csvPath = resolve(options.csv ?? defaultCsv(batch));
  assertPrivateFolder(dirname(csvPath));
  if (!existsSync(csvPath)) fail(`no CSV at ${csvPath}`);
  const code = withLock(`${csvPath}.lock`, () => {
    const rows = readCodes(csvPath);
    const next = rows.find((row) => !row.givenTo);
    if (!next) fail(`no unused codes left in ${csvPath}`);
    next.givenTo = recipient.slice(0, 200);
    next.givenAt = new Date().toISOString();
    const tmp = `${csvPath}.tmp-${process.pid}`;
    writeCsv(tmp, rows, 'wx');
    renameSync(tmp, csvPath);
    return next.code;
  });
  console.log(code);
}

// ------------------------------------------------------------------------------ verify

const GENERATED_RE = /^-- Generated (\S+) by web\/scripts\/promo-batch\.mjs\./;
const BATCH_ROW_RE = /^ {2}values \('((?:[^']|'')*)', '((?:[^']|'')*)', (\d+), timestamptz '((?:[^']|'')*)', (\d+)\);$/;
const unquote = (value) => value.replace(/''/g, "'");

function sha256Hex(data) {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Nothing in the SQL is trusted until its sha256 matches the one generate printed, which the owner
 * recorded off this Mac: anyone who could edit the SQL here could edit a sha stored beside it. Then
 * the SQL must be exactly what generate writes for the codes in the private CSV: rebuilt here from
 * the CSV and compared byte for byte, so an added statement, a swapped hash or a dropped code all
 * fail. The batch settings are printed for the owner to confirm.
 */
function verify(batch, options) {
  if (!BATCH_RE.test(batch ?? '')) fail('batch must be lower case letters, digits, - or _');
  const expected = options['expect-sha'];
  if (!SHA_RE.test(expected ?? '')) {
    fail('verify needs --expect-sha <sha256>: the 64 lowercase hex characters generate printed, as you recorded them off this Mac');
  }
  const csvPath = resolve(options.csv ?? defaultCsv(batch));
  const sqlPath = resolve(options.sql ?? join(dirname(csvPath), `unvibe-promo-${batch}-insert.sql`));
  for (const folder of new Set([dirname(csvPath), dirname(sqlPath)])) assertPrivateFolder(folder);
  if (!existsSync(sqlPath)) fail(`no SQL at ${sqlPath}`);
  const bytes = readFileSync(sqlPath);
  const actual = sha256Hex(bytes);
  if (actual !== expected) {
    fail(`${sqlPath} has sha256 ${actual}, not the ${expected} you recorded; it changed after generate, do not run it`);
  }
  const sql = bytes.toString('utf8');
  const lines = sql.split('\n');
  const generatedAt = GENERATED_RE.exec(lines[1] ?? '')?.[1];
  const row = BATCH_ROW_RE.exec(lines[5] ?? '');
  if (!generatedAt || !row) fail(`${sqlPath} is not a promo insert written by generate; do not run it`);
  const [, id, label, monthsText, redeemBy, capText] = row;
  if (unquote(id) !== batch) fail(`${sqlPath} is for batch ${unquote(id)}, not ${batch}`);
  const months = Number(monthsText);
  const cap = Number(capText);
  const hashes = readCodes(csvPath).map(({ code: raw }) => {
    const code = normalise(raw);
    if (!code) fail(`${csvPath} has a row that is not a promo code`);
    return hashOf(code);
  });
  const want = insertSql({ batch, label: unquote(label), months, cap, redeemBy: unquote(redeemBy), hashes, generatedAt });
  if (!Buffer.from(want, 'utf8').equals(bytes)) {
    const wantLines = want.split('\n');
    let at = 0;
    while (at < wantLines.length && at < lines.length && wantLines[at] === lines[at]) at += 1;
    fail(`${sqlPath} does not match the codes in ${csvPath} (first difference on line ${at + 1}); do not run it`);
  }
  if (CONTROL_RE.test(unquote(label))) fail(`${sqlPath} has a control character in its label; do not run it`);
  if (months < 1 || months > 12) fail(`${sqlPath} gives ${months} months; generate allows 1 to 12`);
  if (cap < 1) fail(`${sqlPath} has a cap of ${cap}`);
  if (!REDEEM_RE.test(unquote(redeemBy))) fail(`${sqlPath} has an unexpected redeem-by date`);
  console.log(`OK: ${sqlPath} has the sha256 you recorded and is exactly the insert for the ${hashes.length} codes in ${csvPath}.`);
  console.log(`batch ${batch} (${unquote(label)}): ${months} months, cap ${cap}, redeem by ${unquote(redeemBy)}`);
  console.log(`SQL sha256: ${actual}`);
}

// ------------------------------------------------------------------------------ admin API

function adminConfig() {
  const base = process.env.UNVIBE_APP_BACKEND_URL?.trim();
  const token = process.env.UNVIBE_ADMIN_STATS_TOKEN?.trim();
  if (!base || !token) fail('set UNVIBE_APP_BACKEND_URL and UNVIBE_ADMIN_STATS_TOKEN');
  const url = new URL('/api/v1/admin/promo', base);
  if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) fail('the API URL must be https');
  return { url, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } };
}

async function callAdmin(method, body) {
  const { url, headers } = adminConfig();
  const response = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) fail('the API refused the admin token (401)');
  return { status: response.status, data };
}

const day = (iso) => (iso ? iso.slice(0, 16).replace('T', ' ') + 'Z' : '-');

async function list() {
  const { status, data } = await callAdmin('GET');
  if (status !== 200) fail(`list failed (${status}): ${JSON.stringify(data)}`);
  for (const b of data.batches ?? []) {
    console.log(`${b.id} (${b.label}): ${b.months} months, redeem by ${day(b.redeemBy)}${b.revokedAt ? `, REVOKED ${day(b.revokedAt)}` : ''}`);
    console.log(`  codes ${b.codes}, redeemed ${b.redeemed}, redemptions revoked ${b.redemptionsRevoked}, codes revoked ${b.revoked}, cap left ${b.capLeft} of ${b.maxRedemptions}`);
  }
  const redemptions = data.redemptions ?? [];
  console.log(`redemptions: ${redemptions.length}`);
  for (const r of redemptions) {
    console.log(`  ${r.batchId} ${r.codeHashPrefix} ${r.email ?? '(no email)'} redeemed ${day(r.redeemedAt)} pro until ${day(r.proUntil)}${r.revokedAt ? ` revoked ${day(r.revokedAt)}` : ''}`);
  }
}

async function revoke(raw) {
  const code = normalise(raw ?? '');
  if (!code) fail('that is not a promo code (16 letters and numbers)');
  const { status, data } = await callAdmin('POST', { action: 'revoke_code', code });
  if (status === 404) fail(`no such code (hash ${hashOf(code).slice(0, 8)})`);
  if (status !== 200) fail(`revoke failed (${status}): ${JSON.stringify(data)}`);
  const months = data.monthsTakenBack
    ? `unused promo time taken back, Pro now until ${day(data.proUntil)}`
    : 'nothing taken back (not redeemed, already revoked, promo time used up, account gone, or a paid plan)';
  console.log(`${data.status}: ${hashOf(code).slice(0, 8)}, ${months}`);
}

// ------------------------------------------------------------------------------ main

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, options } = parseArgs(rest);
  if (command === 'generate') return generate(positional[0], positional[1], options);
  if (command === 'take') return take(positional[0], positional.slice(1).join(' '), options);
  if (command === 'list') return list();
  if (command === 'revoke') return revoke(positional[0]);
  if (command === 'verify') return verify(positional[0], options);
  fail('usage: generate <batch> <count> [--csv path] [--sql path] | take <batch> <who> [--csv path] | verify <batch> --expect-sha <sha256> [--csv path] [--sql path] | list | revoke <code>');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`promo-batch: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
