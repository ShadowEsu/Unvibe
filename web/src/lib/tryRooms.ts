import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Group sessions ("Rooms"): a room shares one network, so the per-network cap of Try it
 * (TRY_PER_IP_PER_HOUR) would stop it after a few members. A room's host gives members a code;
 * inside the room's window, requests with that code count against the room's own hourly bucket
 * instead. The site-wide daily cap still applies.
 *
 * Only sha256 hashes of the codes are committed, never the codes. A leaked code is good only
 * until its window ends and only up to its cap.
 */
export type TryRoom = {
  /** Short label, e.g. "2026-11-03-a". Never shown to members. */
  id: string;
  /** sha256 hex of the normalized code (see `normalizeRoomCode`). */
  codeSha256: string;
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

/** Codes are typed by people: ignore case, spaces and dashes. */
export function normalizeRoomCode(code: string): string {
  return code.toUpperCase().replace(/[\s-]+/g, '');
}

function sha256Hex(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * The open room for this code at `now`, or null. Anything that isn't a short string, an unknown
 * code, a closed window, or a row that breaks the window or cap limits gives null, and the
 * request then counts as an ordinary visitor's.
 */
export function openRoom(code: unknown, now: Date, rooms: readonly TryRoom[] = TRY_ROOMS): TryRoom | null {
  if (typeof code !== 'string') return null;
  const normalized = normalizeRoomCode(code);
  if (normalized.length < 6 || normalized.length > 32) return null;
  const given = Buffer.from(sha256Hex(normalized), 'hex');
  for (const room of rooms) {
    const expected = Buffer.from(room.codeSha256, 'hex');
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
  return sha256Hex(`unvibe-try-room:${room.id}`).slice(0, 32);
}
