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

test('SupabaseStore deletion state: begin, lookup by token hash, done', async () => {
  const hash = createHash('sha256').update('app-token').digest('hex');
  const { fetcher, seen } = fakeFetch((request, url) => {
    if (url.pathname === '/rest/v1/rpc/begin_account_deletion') return Response.json([{ state: 'started', step: 'started', email: 'leaving@account.test' }]);
    if (url.pathname === '/rest/v1/account_deletions' && request.method === 'GET') return Response.json([{ user_id: USER_ID, state: 'done', step: 'done', email: null }]);
    return new Response(null, { status: 204 });
  });
  const store = new SupabaseStore(URL_BASE, 'key', fetcher);
  assert.deepEqual(await store.beginAccountDeletion(USER_ID, 'Leaving@Account.test', hash), { userId: USER_ID, state: 'started', step: 'started', email: 'leaving@account.test' });
  assert.deepEqual(seen[0].body, { p_user_id: USER_ID, p_email: 'Leaving@Account.test', p_token_hash: hash });
  assert.deepEqual(await store.accountDeletionForToken(hash), { userId: USER_ID, state: 'done', step: 'done' });
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
  assert.deepEqual(deletes.map((s) => s.body), [{ urls: [
    'https://store123.private.blob.vercel-storage.com/beta-downloads/item/a.enc',
    'https://store123.private.blob.vercel-storage.com/beta-downloads/item/c.enc',
  ] }]);
});

test('beta-download records: no credentials is not_configured (and no request); any failure throws', async () => {
  const none = fakeFetch(() => { throw new Error('no request expected'); });
  assert.equal(await vercelBlobBetaDownloads({} as NodeJS.ProcessEnv, none.fetcher).deleteForEmail('leaving@account.test'), 'not_configured');
  assert.equal(none.seen.length, 0);
  const record = { a: { email: 'leaving@account.test', release: '1.0.0' } };
  await assert.rejects(vercelBlobBetaDownloads(BLOB_ENV, fakeBlob(record, { failList: true }).fetcher).deleteForEmail('leaving@account.test'), /Blob list failed: 503/);
  await assert.rejects(vercelBlobBetaDownloads(BLOB_ENV, fakeBlob(record, { failDelete: true }).fetcher).deleteForEmail('leaving@account.test'), /Blob delete failed: 500/);
  // A record that does not decrypt might be this person's: stop rather than report it deleted.
  await assert.rejects(vercelBlobBetaDownloads(BLOB_ENV, fakeBlob(record, { secret: `other-${randomUUID()}` }).fetcher).deleteForEmail('leaving@account.test'));
});
