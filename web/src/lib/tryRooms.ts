import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Group sessions ("Rooms"): a room shares one network, so the per-network cap of Try it
 * (TRY_PER_IP_PER_HOUR) would stop it after a few members. A room's host gives members a code;
 * inside the room's window, requests with that code count against the room's own hourly bucket
 * instead. The site-wide daily cap still applies.
 *
 * The repository is public, and a code people can say out loud is short, so a plain hash of it
 * would give the code away. Each row holds an HMAC-SHA256 of the code under TRY_ROOM_KEY, a server
 * secret that is never committed (Security R-M1). Without the key no code opens a room.
 * `web/scripts/try-room-code.mjs` makes a random code and its row; the code goes to the host
 * privately and never into git, a PR, a request file or a log.
 */
export type TryRoom = {
  /** Short label, e.g. "2026-11-03-a". Never shown to members. */
  id: string;
  /** HMAC-SHA256 hex of the normalized code under TRY_ROOM_KEY (see `roomCodeMac`). */
  codeMac: string;
  /** ISO times; the code works from `start` until just before `end`. */
  start: string;
  end: string;
  /** Requests per rolling hour for the whole room. */
  perHour: number;
};

/** Scheduled rooms. Add a row per round; remove rows once their window has passed. */
export const TRY_ROOMS: readonly TryRoom[] = [];

/** Longest window a room may have, so a forgotten row can't stay open. */
export const TRY_ROOM_MAX_HOURS = 3;
/** Highest hourly cap a room may have. */
export const TRY_ROOM_MAX_PER_HOUR = 60;
/** Shortest key accepted: 32 characters (the script asks for 32 random bytes, 64 hex). */
const MIN_KEY_LENGTH = 32;

/** Codes are typed by people: ignore case, spaces and dashes. */
export function normalizeRoomCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]+/g, '');
}

/** The server secret rooms are keyed with, or null when it is missing or too short. */
export function roomKey(): string | null {
  const key = process.env.TRY_ROOM_KEY?.trim() ?? '';
  return key.length >= MIN_KEY_LENGTH ? key : null;
}

/** HMAC-SHA256 hex of the normalized code under `key`: the value a room row stores. */
export function roomCodeMac(code: string, key: string): string {
  return createHmac('sha256', key).update(normalizeRoomCode(code)).digest('hex');
}

/**
 * The open room for this code at `now`, or null. No key, anything that isn't a string of 8 to 32
 * characters, an unknown code, a closed window, or a row that breaks the window or cap limits gives
 * null, and the request then counts as an ordinary visitor's.
 */
export function openRoom(
  code: unknown,
  now: Date,
  rooms: readonly TryRoom[] = TRY_ROOMS,
  key: string | null = roomKey(),
): TryRoom | null {
  if (!key || typeof code !== 'string') return null;
  const normalized = normalizeRoomCode(code);
  if (normalized.length < 8 || normalized.length > 32) return null;
  const given = Buffer.from(roomCodeMac(normalized, key), 'hex');
  for (const room of rooms) {
    const expected = Buffer.from(room.codeMac, 'hex');
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) continue;
    const start = Date.parse(room.start);
    const end = Date.parse(room.end);
    const open = now.getTime() >= start && now.getTime() < end;
    const sane = end > start && end - start <= TRY_ROOM_MAX_HOURS * 3_600_000 &&
      Number.isInteger(room.perHour) && room.perHour >= 1 && room.perHour <= TRY_ROOM_MAX_PER_HOUR;
    return open && sane ? room : null;
  }
  return null;
}

/**
 * The room's bucket in `try_requests`: 32 lowercase hex characters, the shape
 * `reserve_try_request` requires, from a prefix that visitor hashes never use.
 */
export function roomBucket(room: TryRoom): string {
  return createHash('sha256').update(`unvibe-try-room:${room.id}`).digest('hex').slice(0, 32);
}
