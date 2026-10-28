#!/usr/bin/env node
// Makes a random Try it room code and the row to commit in web/src/lib/tryRooms.ts (TRY_ROOMS).
//
//   TRY_ROOM_KEY_FILE=~/.config/preston-secrets/try-room-key node web/scripts/try-room-code.mjs \
//     --id 2026-11-03-a --start 2026-11-03T18:00:00-08:00 --hours 2 --per-hour 60
//
// The key is read from a file only readable by its owner (mode 600), so it never lands in shell
// history or a process list.
//
// The code is printed once, for the host, and goes to them privately: never into git, a PR, a
// request file or a log. Only the row (an HMAC of the code under TRY_ROOM_KEY) is committed.
// Codes are 9 characters from 31 letters and digits with no 0, O, 1, I or L (about 44 bits),
// read out as three groups of three.
import { createHmac, randomInt } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { parseArgs } from 'node:util';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const MAX_HOURS = 3;
const MAX_PER_HOUR = 60;

function fail(message) {
  console.error(`try-room-code: ${message}`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    id: { type: 'string' },
    start: { type: 'string' },
    hours: { type: 'string', default: '2' },
    'per-hour': { type: 'string', default: '60' },
  },
});

const keyFile = process.env.TRY_ROOM_KEY_FILE?.trim() ?? '';
if (!keyFile) fail('set TRY_ROOM_KEY_FILE to a file holding the API project\'s TRY_ROOM_KEY');
let key = '';
try {
  if ((statSync(keyFile).mode & 0o077) !== 0) fail(`${keyFile} must be readable by its owner only (chmod 600)`);
  key = readFileSync(keyFile, 'utf8').trim();
} catch {
  fail(`can't read ${keyFile}`);
}
if (key.length < 32) fail('the key file must hold the API project\'s TRY_ROOM_KEY (at least 32 characters)');
if (!values.id || !/^[a-z0-9-]{3,40}$/.test(values.id)) fail('--id is required: lowercase letters, digits and dashes, e.g. 2026-11-03-a');
const start = Date.parse(values.start ?? '');
if (Number.isNaN(start)) fail('--start is required, an ISO time with its zone, e.g. 2026-11-03T18:00:00-08:00');
const hours = Number(values.hours);
if (!(hours > 0 && hours <= MAX_HOURS)) fail(`--hours must be more than 0 and at most ${MAX_HOURS}`);
const perHour = Number(values['per-hour']);
if (!Number.isInteger(perHour) || perHour < 1 || perHour > MAX_PER_HOUR) fail(`--per-hour must be a whole number from 1 to ${MAX_PER_HOUR}`);

const code = Array.from({ length: 9 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('');
const codeMac = createHmac('sha256', key).update(code).digest('hex');
const row = {
  id: values.id,
  codeMac,
  start: new Date(start).toISOString(),
  end: new Date(start + hours * 3_600_000).toISOString(),
  perHour,
};

console.log(`Code for the host (send privately, don't save it anywhere): ${code.slice(0, 3)}-${code.slice(3, 6)}-${code.slice(6)}`);
console.log('Row for TRY_ROOMS in web/src/lib/tryRooms.ts:');
console.log(`  ${JSON.stringify(row)},`);
