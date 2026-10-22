import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { SupabaseStore } from '../src/data/supabaseStore';
import { EventOwnershipError } from '../src/data/eventOwnership';
import { getStore } from '../src/data/store';
import { POST as postEvents } from '../app/api/v1/events/route';
import { GET as getHistory } from '../app/api/v1/history/route';
import type { IncomingEvent } from '../src/data/types';

type Row = Record<string, unknown> & { id: string; user_id: string; ts: string };

/**
 * A small PostgREST stand-in for the events table: eq/in filters, ts/id ordering, offset/limit and
 * the 1,000-row response cap Supabase projects apply by default. Everything above it is the real
 * supabase-js client and SupabaseStore.
 */
function fakeEventsTable(rows: Row[], options: { failWrites?: boolean; failReads?: boolean; failDeletes?: boolean } = {}) {
  const writes: string[] = [];
  const reads = { requests: 0, rowsServed: 0 };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET';
    const table = url.pathname.replace('/rest/v1/', '');
    if (method === 'DELETE') {
      if (options.failDeletes) return Response.json({ message: 'delete failed' }, { status: 500 });
      writes.push(`DELETE ${table}`);
      return new Response(null, { status: 204 });
    }
    assert.equal(table, 'events', `unexpected table ${table}`);
    if (method === 'POST') {
      if (options.failWrites) return Response.json({ message: 'column "local_date" does not exist' }, { status: 400 });
      writes.push('POST events');
      const body: unknown = JSON.parse(String(init?.body));
      for (const incoming of Array.isArray(body) ? body : [body]) {
        // Rows come from SupabaseStore.upsertEvents in this same test; the fake trusts their shape.
        const row = incoming as Row;
        const index = rows.findIndex((existing) => existing.id === row.id);
        if (index >= 0) rows[index] = { ...rows[index], ...row };
        else rows.push(row);
      }
      return new Response(null, { status: 201 });
    }
    if (options.failReads) return Response.json({ message: 'statement timeout' }, { status: 500 });
    let result = rows.slice();
    for (const [key, value] of url.searchParams) {
      if (['select', 'order', 'offset', 'limit'].includes(key)) continue;
      if (value.startsWith('eq.')) result = result.filter((row) => String(row[key]) === value.slice(3));
      else if (value.startsWith('neq.')) result = result.filter((row) => String(row[key]) !== value.slice(4));
      else if (value.startsWith('in.(')) {
        const wanted = new Set(value.slice(4, -1).split(',').map((item) => item.replace(/^"|"$/g, '')));
        result = result.filter((row) => wanted.has(String(row[key])));
      } else throw new Error(`unsupported filter ${key}=${value}`);
    }
    const order = url.searchParams.get('order') ?? '';
    const keys = order.split(',').filter(Boolean).map((part) => part.split('.'));
    result.sort((a, b) => {
      for (const [column, direction] of keys) {
        const cmp = String(a[column]).localeCompare(String(b[column]));
        if (cmp) return direction === 'desc' ? -cmp : cmp;
      }
      return 0;
    });
    const offset = Number(url.searchParams.get('offset') ?? 0);
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 1000), 1000);
    const page = result.slice(offset, offset + limit);
    reads.requests += 1;
    reads.rowsServed += page.length;
    return Response.json(page);
  };
  return { fetcher, writes, reads };
}

function eventRow(userId: string, index: number): Row {
  const ts = new Date(Date.UTC(2026, 0, 1) + index * 60_000).toISOString();
  return { id: randomUUID(), user_id: userId, ts, scope: 'selection', level: 'beginner', outcome: 'understood', project: 'Unvibe' };
}

function incoming(id: string = randomUUID()): IncomingEvent {
  return { id, ts: '2026-10-22T08:00:00.000Z', scope: 'selection', level: 'beginner', outcome: 'understood' };
}

test('a failed event write is an error, so the app keeps its outbox instead of losing the events', async () => {
  const { fetcher } = fakeEventsTable([], { failWrites: true });
  const store = new SupabaseStore('https://events.supabase.test', 'service-key', fetcher);
  await assert.rejects(store.upsertEvents(randomUUID(), [incoming()]), /local_date/);
});

test('an event id owned by another account is refused and never moved to the caller', async () => {
  const owner = randomUUID();
  const intruder = randomUUID();
  const existing = eventRow(owner, 0);
  const rows = [existing];
  const { fetcher, writes } = fakeEventsTable(rows);
  const store = new SupabaseStore('https://events.supabase.test', 'service-key', fetcher);
  await assert.rejects(store.upsertEvents(intruder, [incoming(), incoming(existing.id)]), EventOwnershipError);
  assert.deepEqual(writes, [], 'nothing from the refused batch is written');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].user_id, owner);
  // The owner can still update their own event.
  await store.upsertEvents(owner, [{ ...incoming(existing.id), outcome: 'needs_review' }]);
  assert.equal(rows[0].outcome, 'needs_review');
  assert.equal(rows[0].user_id, owner);
});

test('profile and history include every event past the 1,000-row response cap, newest first', async () => {
  const user = randomUUID();
  const rows = Array.from({ length: 1205 }, (_, index) => eventRow(user, index));
  const newest = rows[rows.length - 1];
  const { fetcher } = fakeEventsTable(rows);
  const store = new SupabaseStore('https://events.supabase.test', 'service-key', fetcher);
  assert.equal((await store.profile(user)).totalReviews, 1205);
  const first = await store.historyPage(user, 200);
  assert.equal(first.events[0]?.id, newest.id);
  const seen = new Set(first.events.map((event) => event.id));
  let cursor = first.nextCursor;
  while (cursor) {
    const page = await store.historyPage(user, 200, cursor);
    for (const event of page.events) seen.add(event.id);
    cursor = page.nextCursor;
  }
  assert.equal(seen.size, 1205);
});

test('one /history page reads only that page from the database, not the whole history', async () => {
  const user = randomUUID();
  const rows = Array.from({ length: 10_000 }, (_, index) => eventRow(user, index));
  const { fetcher, reads } = fakeEventsTable(rows);
  const store = new SupabaseStore('https://events.supabase.test', 'service-key', fetcher);
  const page = await store.historyPage(user, 200, '400');
  assert.equal(reads.requests, 1);
  assert.ok(reads.rowsServed <= 201, `served ${reads.rowsServed} rows for a 200-row page`);
  assert.deepEqual(page.events.map((event) => event.id), rows.slice().reverse().slice(400, 600).map((row) => row.id));
  assert.equal(page.nextCursor, '600');
  const last = await store.historyPage(user, 200, '9900');
  assert.equal(last.events.length, 100);
  assert.equal(last.nextCursor, undefined);
});

test('a failed history read is an error, not an empty learning record', async () => {
  const { fetcher } = fakeEventsTable([], { failReads: true });
  const store = new SupabaseStore('https://events.supabase.test', 'service-key', fetcher);
  await assert.rejects(store.profile(randomUUID()), /statement timeout/);
  await assert.rejects(store.historyPage(randomUUID(), 10), /statement timeout/);
});

test('account deletion reports a database failure instead of claiming success', async () => {
  const { fetcher } = fakeEventsTable([], { failDeletes: true });
  const store = new SupabaseStore('https://events.supabase.test', 'service-key', fetcher);
  await assert.rejects(store.deleteAccount(randomUUID()), /delete failed/);
});

test('POST /events answers 409 for another account\'s event id and leaves that account\'s history intact', async () => {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const owner = await getStore().signIn(`owner-${randomUUID()}@events.test`);
  const intruder = await getStore().signIn(`intruder-${randomUUID()}@events.test`);
  const shared = incoming();
  const post = (token: string, events: IncomingEvent[]) => postEvents(new Request('http://localhost/api/v1/events', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ events }),
  }));
  assert.equal((await post(owner.token, [shared])).status, 200);
  const refused = await post(intruder.token, [{ ...shared, outcome: 'needs_review' }]);
  assert.equal(refused.status, 409);
  const history = async (token: string) => {
    const response = await getHistory(new Request('http://localhost/api/v1/history', { headers: { authorization: `Bearer ${token}` } }));
    const body: unknown = await response.json();
    assert.ok(body !== null && typeof body === 'object' && 'events' in body && Array.isArray(body.events));
    return body.events;
  };
  assert.deepEqual((await history(owner.token)).map((event: { id: string; outcome: string }) => [event.id, event.outcome]), [[shared.id, 'understood']]);
  assert.deepEqual(await history(intruder.token), []);
});
