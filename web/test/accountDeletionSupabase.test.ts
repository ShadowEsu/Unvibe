import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { SupabaseStore } from '../src/data/supabaseStore';
import { TeamHasMembersError } from '../src/data/teamHasMembers';
import { supabaseAuthIdentities, vercelBlobBetaDownloads } from '../src/lib/accountDeletionServices';

// The Supabase and Vercel Blob boundaries of account deletion, against fake HTTP servers: the real
// supabase-js client and SupabaseStore; no network, no database.
const URL_BASE = 'https://deletion.supabase.test';

const USER_ID = '7d3c0e0a-52b4-4c1e-9f5a-1b2c3d4e5f60';

interface Seen { method: string; path: string; body: unknown }

/** A fetch that records every request and answers from `route` (path → response). */
function fakeFetch(route: (request: Request, url: URL) => Response | Promise<Response>): { fetcher: typeof fetch; seen: Seen[] } {
  const seen: Seen[] = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const text = request.method === 'GET' || request.method === 'HEAD' ? '' : await request.clone().text();
    seen.push({ method: request.method, path: `${url.pathname}${url.search}`, body: text ? JSON.parse(text) : null });
    return route(request, url);
  }) as typeof fetch;
  return { fetcher, seen };
}

test('SupabaseStore.eraseAccount is one transaction (one RPC) and deletes no table row by itself', async () => {
  const { fetcher, seen } = fakeFetch(() => new Response(null, { status: 204 }));
  await new SupabaseStore(URL_BASE, 'key', fetcher).eraseAccount(USER_ID);
  assert.deepEqual(seen, [{ method: 'POST', path: '/rest/v1/rpc/erase_account_data', body: { p_user_id: USER_ID } }]);
});

test('SupabaseStore.eraseAccount maps the Teams refusal and reports every other failure', async () => {
  const refused = fakeFetch(() => Response.json({ code: 'P0001', message: 'team_has_members', details: null, hint: null }, { status: 400 }));
  await assert.rejects(new SupabaseStore(URL_BASE, 'key', refused.fetcher).eraseAccount(USER_ID), TeamHasMembersError);
  const failed = fakeFetch(() => Response.json({ code: '57014', message: 'canceling statement due to statement timeout' }, { status: 500 }));
  await assert.rejects(new SupabaseStore(URL_BASE, 'key', failed.fetcher).eraseAccount(USER_ID), /Could not delete account data: canceling statement/);
});

test('SupabaseStore.beginAccountDeletion maps the Teams refusal (nothing recorded) and reports every other failure', async () => {
  const hash = createHash('sha256').update('app-token').digest('hex');
  const refused = fakeFetch(() => Response.json({ code: 'P0001', message: 'team_has_members', details: null, hint: null }, { status: 400 }));
  await assert.rejects(new SupabaseStore(URL_BASE, 'key', refused.fetcher).beginAccountDeletion(USER_ID, undefined, hash), TeamHasMembersError);
  const failed = fakeFetch(() => Response.json({ code: '57014', message: 'canceling statement due to statement timeout' }, { status: 500 }));
  await assert.rejects(new SupabaseStore(URL_BASE, 'key', failed.fetcher).beginAccountDeletion(USER_ID, undefined, hash), /Could not start account deletion: canceling statement/);
});

test('SupabaseStore.addressReusedSinceDeletion asks account_deletion_address_reused (the SQL rule) and reports read errors', async () => {
  const held = fakeFetch(() => Response.json(true));
  assert.equal(await new SupabaseStore(URL_BASE, 'key', held.fetcher).addressReusedSinceDeletion(USER_ID, 'again@account.test'), true);
  assert.deepEqual(held.seen, [{ method: 'POST', path: '/rest/v1/rpc/account_deletion_address_reused', body: { p_user_id: USER_ID, p_email: 'again@account.test' } }]);
  assert.equal(await new SupabaseStore(URL_BASE, 'key', fakeFetch(() => Response.json(false)).fetcher).addressReusedSinceDeletion(USER_ID, 'again@account.test'), false);
  const failed = fakeFetch(() => Response.json({ code: '57014', message: 'canceling statement due to statement timeout' }, { status: 500 }));
  await assert.rejects(new SupabaseStore(URL_BASE, 'key', failed.fetcher).addressReusedSinceDeletion(USER_ID, 'again@account.test'), /Could not check the address/);
});

test('SupabaseStore sweep reads: started rows past the cutoff, least recently updated first, capped; the count is stale_account_deletions', async () => {
  const STARTED = '2026-10-27T09:00:00+00:00';
  const listed = fakeFetch(() => Response.json([{ user_id: USER_ID, state: 'started', step: 'app_data', email: 'leaving@account.test', beta_downloads: 'failed', started_at: STARTED }]));
  const before = Date.now();
  assert.deepEqual(await new SupabaseStore(URL_BASE, 'key', listed.fetcher).staleAccountDeletions(3_600_000, 10), [
    { userId: USER_ID, state: 'started', step: 'app_data', email: 'leaving@account.test', betaDownloads: 'failed', startedAt: STARTED },
  ]);
  const url = new URL(`${URL_BASE}${listed.seen[0].path}`);
  assert.equal(url.pathname, '/rest/v1/account_deletions');
  assert.equal(url.searchParams.get('state'), 'eq.started');
  assert.equal(url.searchParams.get('order'), 'updated_at.asc');
  assert.equal(url.searchParams.get('limit'), '10');
  const cutoff = Date.parse(String(url.searchParams.get('started_at')).replace(/^lt\./, ''));
  assert.ok(cutoff <= before - 3_600_000 + 1000 && cutoff >= before - 3_600_000 - 1000, url.search);
  const counted = fakeFetch(() => Response.json(3));
  assert.equal(await new SupabaseStore(URL_BASE, 'key', counted.fetcher).staleAccountDeletionCount(7 * 86_400_000), 3);
  assert.deepEqual(counted.seen, [{ method: 'POST', path: '/rest/v1/rpc/stale_account_deletions', body: { p_older_than: '604800 seconds' } }]);
  const failed = fakeFetch(() => Response.json({ code: '57014', message: 'canceling statement due to statement timeout' }, { status: 500 }));
  await assert.rejects(new SupabaseStore(URL_BASE, 'key', failed.fetcher).staleAccountDeletions(3_600_000, 10), /Could not list stale account deletions/);
  await assert.rejects(new SupabaseStore(URL_BASE, 'key', failed.fetcher).staleAccountDeletionCount(3_600_000), /Could not count stale account deletions/);
});

test('SupabaseStore.touchAccountDeletion writes updated_at only, and only on a started row', async () => {
  const { fetcher, seen } = fakeFetch(() => new Response(null, { status: 204 }));
  await new SupabaseStore(URL_BASE, 'key', fetcher).touchAccountDeletion(USER_ID);
  assert.equal(seen.length, 1);
  assert.equal(seen[0].method, 'PATCH');
  const url = new URL(`${URL_BASE}${seen[0].path}`);
  assert.equal(url.pathname, '/rest/v1/account_deletions');
  assert.equal(url.searchParams.get('user_id'), `eq.${USER_ID}`);
  assert.equal(url.searchParams.get('state'), 'eq.started');
  assert.deepEqual(Object.keys(seen[0].body as Record<string, unknown>), ['updated_at'], 'started_at, the clocks\' column, is not written');
  const failed = fakeFetch(() => Response.json({ code: '57014', message: 'canceling statement due to statement timeout' }, { status: 500 }));
  await assert.rejects(new SupabaseStore(URL_BASE, 'key', failed.fetcher).touchAccountDeletion(USER_ID), /Could not touch account deletion/);
});

test('SupabaseStore deletion state: begin, lookup by token hash, done', async () => {
  const hash = createHash('sha256').update('app-token').digest('hex');
  const STARTED = '2026-10-27T09:00:00+00:00';
  const { fetcher, seen } = fakeFetch((request, url) => {
    if (url.pathname === '/rest/v1/rpc/begin_account_deletion') return Response.json([{ state: 'started', step: 'started', email: 'leaving@account.test', beta_downloads: null, started_at: STARTED }]);
    if (url.pathname === '/rest/v1/account_deletions' && request.method === 'GET') return Response.json([{ user_id: USER_ID, state: 'done', step: 'done', email: null, beta_downloads: 'failed', started_at: STARTED }]);
    return new Response(null, { status: 204 });
  });
  const store = new SupabaseStore(URL_BASE, 'key', fetcher);
  assert.deepEqual(await store.beginAccountDeletion(USER_ID, 'Leaving@Account.test', hash), { userId: USER_ID, state: 'started', step: 'started', email: 'leaving@account.test', startedAt: STARTED });
  assert.deepEqual(seen[0].body, { p_user_id: USER_ID, p_email: 'Leaving@Account.test', p_token_hash: hash });
  assert.deepEqual(await store.accountDeletionForToken(hash), { userId: USER_ID, state: 'done', step: 'done', betaDownloads: 'failed', startedAt: STARTED });
  assert.ok(decodeURIComponent(seen[1].path).includes(`token_hashes=cs.{${hash}}`), seen[1].path);
  await store.finishAccountDeletion(USER_ID);
  assert.equal(seen[2].method, 'PATCH');
  assert.ok(seen[2].path.includes('user_id=eq.') && seen[2].path.includes('state=eq.started'), seen[2].path);
  assert.deepEqual({ ...(seen[2].body as Record<string, unknown>), done_at: 'set', updated_at: 'set' }, { state: 'done', step: 'done', email: null, done_at: 'set', updated_at: 'set' });
});

test('before the migration is applied no deletion can exist; any other read error is reported', async () => {
  const missing = fakeFetch(() => Response.json({ code: 'PGRST205', message: "Could not find the table 'public.account_deletions' in the schema cache" }, { status: 404 }));
  assert.equal(await new SupabaseStore(URL_BASE, 'key', missing.fetcher).accountDeletion(USER_ID), null);
  const denied = fakeFetch(() => Response.json({ code: '42501', message: 'permission denied for table account_deletions' }, { status: 403 }));
  await assert.rejects(new SupabaseStore(URL_BASE, 'key', denied.fetcher).accountDeletion(USER_ID), /permission denied/);
});

test('Supabase Auth delete: only GoTrue\'s user_not_found counts as already gone', async () => {
  const answer = (response: () => Response) => supabaseAuthIdentities(URL_BASE, 'key', fakeFetch(response).fetcher);
  const ok = fakeFetch(() => Response.json({ id: USER_ID, aud: 'authenticated', role: '', app_metadata: {}, user_metadata: {}, created_at: '' }));
  assert.equal(await supabaseAuthIdentities(URL_BASE, 'key', ok.fetcher).deleteUser(USER_ID), 'deleted');
  assert.deepEqual(ok.seen.map((s) => `${s.method} ${s.path}`), [`DELETE /auth/v1/admin/users/${USER_ID}`]);
  assert.equal(await answer(() => Response.json({ code: 404, error_code: 'user_not_found', msg: 'User not found' }, { status: 404 })).deleteUser(USER_ID), 'not_found');
  // A 404 from something other than GoTrue (wrong URL, proxy, gateway) proves nothing.
  await assert.rejects(answer(() => new Response('<html>Not Found</html>', { status: 404, headers: { 'content-type': 'text/html' } })).deleteUser(USER_ID));
  await assert.rejects(answer(() => Response.json({ message: 'no Route matched with those values' }, { status: 404 })).deleteUser(USER_ID));
  await assert.rejects(answer(() => Response.json({ code: 500, error_code: 'unexpected_failure', msg: 'Database error deleting user' }, { status: 500 })).deleteUser(USER_ID));
});

/** The site's record encryption (marketing/src/lib/waitlistCrypto.ts), for building fixtures. */
function encryptRecord(value: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', createHash('sha256').update(`unvibe-waitlist-storage-v1:${secret}`).digest(), iv);
  cipher.setAAD(Buffer.from('unvibe-waitlist-v1'));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), ciphertext: ciphertext.toString('base64') });
}

const BLOB_ENV = { BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_store123_notarealtoken', WAITLIST_ADMIN_TOKEN: 'site-secret-for-tests' } as unknown as NodeJS.ProcessEnv;

function fakeBlob(records: Record<string, unknown>, options: { secret?: string; failList?: boolean; failDelete?: boolean } = {}) {
  const urls = Object.keys(records).map((name) => `https://store123.private.blob.vercel-storage.com/beta-downloads/item/${name}.enc`);
  return fakeFetch((request, url) => {
    assert.equal(request.headers.get('authorization'), `Bearer ${BLOB_ENV.BLOB_READ_WRITE_TOKEN}`);
    if (url.host === 'vercel.com' && url.pathname === '/api/blob' && request.method === 'GET') {
      if (options.failList) return Response.json({ error: { code: 'service_unavailable' } }, { status: 503 });
      assert.equal(request.headers.get('x-vercel-blob-store-id'), 'store123');
      assert.equal(url.searchParams.get('prefix'), 'beta-downloads/item/');
      // Two pages, so the cursor is followed.
      const page = url.searchParams.get('cursor') === 'next' ? urls.slice(1) : urls.slice(0, 1);
      return Response.json({ blobs: page.map((u) => ({ url: u, pathname: new URL(u).pathname.slice(1) })), hasMore: !url.searchParams.get('cursor'), cursor: 'next' });
    }
    if (url.host === 'vercel.com' && url.pathname === '/api/blob/delete') {
      return options.failDelete ? Response.json({ error: { code: 'unknown_error' } }, { status: 500 }) : Response.json({});
    }
    const name = url.pathname.split('/').pop()?.replace('.enc', '') ?? '';
    return new Response(encryptRecord(records[name], options.secret ?? BLOB_ENV.WAITLIST_ADMIN_TOKEN as string));
  });
}

test('beta-download records: every release of this email is deleted, nobody else\'s', async () => {
  const blob = fakeBlob({
    a: { email: 'leaving@account.test', release: '0.9.0', firstName: 'A' },
    b: { email: 'someone.else@account.test', release: '0.9.0', firstName: 'B' },
    c: { email: 'Leaving@Account.test', release: '1.0.0', firstName: 'A' },
  });
  assert.equal(await vercelBlobBetaDownloads(BLOB_ENV, blob.fetcher).deleteForEmail('leaving@account.test'), 'deleted');
  const deletes = blob.seen.filter((s) => s.path === '/api/blob/delete');
  // Each page's matches go before the next page is listed.
  assert.deepEqual(deletes.map((s) => s.body), [
    { urls: ['https://store123.private.blob.vercel-storage.com/beta-downloads/item/a.enc'] },
    { urls: ['https://store123.private.blob.vercel-storage.com/beta-downloads/item/c.enc'] },
  ]);
});

test('beta-download records: reads run 8 at a time, and a page\'s matches are deleted before the next page is read', async () => {
  const base = 'https://store123.private.blob.vercel-storage.com/beta-downloads/item/';
  const firstPage = Array.from({ length: 20 }, (_, index) => `p1-${index}`);
  const owner = (name: string) => (name === 'p1-3' || name === 'p2-0' ? 'leaving@account.test' : `other-${name}@account.test`);
  let inFlight = 0;
  let mostInFlight = 0;
  const blob = fakeFetch(async (_request, url) => {
    if (url.host === 'vercel.com' && url.pathname === '/api/blob') {
      const names = url.searchParams.get('cursor') === 'next' ? ['p2-0', 'p2-1'] : firstPage;
      return Response.json({ blobs: names.map((name) => ({ url: `${base}${name}.enc`, pathname: `beta-downloads/item/${name}.enc` })), hasMore: !url.searchParams.get('cursor'), cursor: 'next' });
    }
    if (url.host === 'vercel.com' && url.pathname === '/api/blob/delete') return Response.json({});
    const name = url.pathname.split('/').pop()?.replace('.enc', '') ?? '';
    // The second page's last record can't be read: the scan stops there.
    if (name === 'p2-1') return new Response('unavailable', { status: 503 });
    inFlight += 1;
    mostInFlight = Math.max(mostInFlight, inFlight);
    // Every worker's read starts before any finishes, so the count shows how many run at once.
    await Promise.resolve();
    inFlight -= 1;
    return new Response(encryptRecord({ email: owner(name), release: '1.0.0' }, BLOB_ENV.WAITLIST_ADMIN_TOKEN as string));
  });
  await assert.rejects(vercelBlobBetaDownloads(BLOB_ENV, blob.fetcher).deleteForEmail('leaving@account.test'), /Blob read failed: 503/);
  assert.equal(mostInFlight, 8);
  const order = blob.seen.map((s) => (s.path.startsWith('/api/blob/delete') ? 'delete' : s.path.startsWith('/api/blob?') ? 'list' : 'read'));
  const deleteAt = order.indexOf('delete');
  assert.ok(deleteAt > 0 && deleteAt < order.lastIndexOf('list'), order.join(','));
  // The scan that stopped on page 2 already removed the page 1 match; the next scan has one record fewer.
  assert.deepEqual(blob.seen.filter((s) => s.path === '/api/blob/delete').map((s) => s.body), [{ urls: [`${base}p1-3.enc`] }]);
});

test('beta-download records: once one read fails, no new read starts and nothing is deleted', async () => {
  const base = 'https://store123.private.blob.vercel-storage.com/beta-downloads/item/';
  const names = Array.from({ length: 20 }, (_, index) => `r-${index}`);
  // Every read but the failing one waits here until the failure has surfaced.
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const blob = fakeFetch(async (_request, url) => {
    if (url.host === 'vercel.com' && url.pathname === '/api/blob') {
      return Response.json({ blobs: names.map((name) => ({ url: `${base}${name}.enc`, pathname: `beta-downloads/item/${name}.enc` })), hasMore: false });
    }
    if (url.host === 'vercel.com' && url.pathname === '/api/blob/delete') return Response.json({});
    const name = url.pathname.split('/').pop()?.replace('.enc', '') ?? '';
    if (name === 'r-0') return new Response('unavailable', { status: 503 });
    await gate;
    return new Response(encryptRecord({ email: 'leaving@account.test', release: '1.0.0' }, BLOB_ENV.WAITLIST_ADMIN_TOKEN as string));
  });
  await assert.rejects(vercelBlobBetaDownloads(BLOB_ENV, blob.fetcher).deleteForEmail('leaving@account.test'), /Blob read failed: 503/);
  release();
  // Let the workers still holding a read finish; without the stop they would go on to read the rest.
  // setImmediate drains the event loop (no wall-clock wait): the reads settle through I/O callbacks.
  for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setImmediate(resolve));
  const reads = blob.seen.filter((s) => !s.path.startsWith('/api/blob'));
  assert.ok(reads.length <= 8, `reads: ${reads.length}`);
  assert.equal(blob.seen.filter((s) => s.path.startsWith('/api/blob?')).length, 1, 'one list call');
  assert.equal(blob.seen.filter((s) => s.path === '/api/blob/delete').length, 0, 'fails closed: nothing deleted');
});

test('beta-download records: no credentials is not_configured outside production (and no request); any failure throws', async () => {
  const none = fakeFetch(() => { throw new Error('no request expected'); });
  for (const nodeEnv of [undefined, 'development', 'test']) {
    assert.equal(await vercelBlobBetaDownloads({ NODE_ENV: nodeEnv } as unknown as NodeJS.ProcessEnv, none.fetcher).deleteForEmail('leaving@account.test'), 'not_configured');
  }
  // In production a missing setting is a failure, so the row is not marked done with its email cleared.
  const production = { NODE_ENV: 'production' } as unknown as NodeJS.ProcessEnv;
  for (const env of [production, { ...production, BLOB_READ_WRITE_TOKEN: BLOB_ENV.BLOB_READ_WRITE_TOKEN }, { ...production, WAITLIST_ADMIN_TOKEN: BLOB_ENV.WAITLIST_ADMIN_TOKEN }]) {
    await assert.rejects(vercelBlobBetaDownloads(env, none.fetcher).deleteForEmail('leaving@account.test'), /Blob is not configured/);
  }
  assert.equal(none.seen.length, 0);
  const record = { a: { email: 'leaving@account.test', release: '1.0.0' } };
  await assert.rejects(vercelBlobBetaDownloads(BLOB_ENV, fakeBlob(record, { failList: true }).fetcher).deleteForEmail('leaving@account.test'), /Blob list failed: 503/);
  await assert.rejects(vercelBlobBetaDownloads(BLOB_ENV, fakeBlob(record, { failDelete: true }).fetcher).deleteForEmail('leaving@account.test'), /Blob delete failed: 500/);
  // A record that does not decrypt might be this person's: stop rather than report it deleted.
  await assert.rejects(vercelBlobBetaDownloads(BLOB_ENV, fakeBlob(record, { secret: `other-${randomUUID()}` }).fetcher).deleteForEmail('leaving@account.test'));
});

test('beta-download records: without an address the outcome is no_email, not deleted, and nothing is read', async () => {
  const none = fakeFetch(() => { throw new Error('no request expected'); });
  for (const email of [undefined, '', '   ']) {
    assert.equal(await vercelBlobBetaDownloads(BLOB_ENV, none.fetcher).deleteForEmail(email), 'no_email');
    assert.equal(await vercelBlobBetaDownloads({} as NodeJS.ProcessEnv, none.fetcher).deleteForEmail(email), 'no_email');
  }
  assert.equal(none.seen.length, 0);
});
