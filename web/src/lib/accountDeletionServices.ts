/**
 * The two places outside the database that account deletion has to clear: the Supabase Auth
 * identity and the site's beta-download records in Vercel Blob. DELETE /api/v1/account calls them
 * through accountDeletionServices(); tests replace the members with fakes.
 */
import { createDecipheriv, createHash } from 'node:crypto';
import { createClient, isAuthApiError } from '@supabase/supabase-js';
import type { BetaDownloadCleanup } from '@/data/types';

export interface AuthIdentities {
  /** 'not_found' only when Supabase Auth itself answers user_not_found. Every other failure throws. */
  deleteUser(userId: string): Promise<'deleted' | 'not_found'>;
}

export interface BetaDownloadRecords {
  /**
   * Deletes every record for the email. 'no_email' without an address; 'not_configured' when a
   * deployment outside production has no Blob credentials (in production that throws). Throws on any failure.
   */
  deleteForEmail(email: string | undefined): Promise<BetaDownloadCleanup>;
}

export function supabaseAuthIdentities(url: string, serviceRoleKey: string, fetcher?: typeof fetch): AuthIdentities {
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false }, ...(fetcher ? { global: { fetch: fetcher } } : {}) });
  return {
    async deleteUser(userId) {
      const { error } = await client.auth.admin.deleteUser(userId);
      if (!error) return 'deleted';
      // A 404 alone proves nothing (a proxy or a wrong URL answers 404 too); GoTrue names the case.
      if (isAuthApiError(error) && error.status === 404 && error.code === 'user_not_found') return 'not_found';
      throw new Error(`Supabase Auth delete failed: ${error.status ?? 'no status'} ${error.code ?? error.name}`);
    },
  };
}

const BLOB_API = 'https://vercel.com/api/blob';
/** Where the site keeps one encrypted record per (release, email); see the site's betaDownloadStore. */
const BETA_DOWNLOAD_PREFIX = 'beta-downloads/item/';
/**
 * Records read at once. The scan has no saved position (a cursor would need a new column), so a
 * run cut off by the sweep's budget starts again; reading in parallel makes a full scan about this
 * many times shorter, so far larger stores finish inside one run.
 */
const BLOB_READ_CONCURRENCY = 8;

/** The site's record encryption (waitlistCrypto): AES-256-GCM, key sha256("unvibe-waitlist-storage-v1:" + secret). */
function decryptRecord(payload: string, secret: string): unknown {
  const parsed = JSON.parse(payload) as { version?: unknown; iv?: unknown; tag?: unknown; ciphertext?: unknown };
  if (parsed.version !== 1 || typeof parsed.iv !== 'string' || typeof parsed.tag !== 'string' || typeof parsed.ciphertext !== 'string') {
    throw new Error('Beta-download record has an unsupported format.');
  }
  const key = createHash('sha256').update(`unvibe-waitlist-storage-v1:${secret}`).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(parsed.iv, 'base64'));
  decipher.setAAD(Buffer.from('unvibe-waitlist-v1'));
  decipher.setAuthTag(Buffer.from(parsed.tag, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(parsed.ciphertext, 'base64')), decipher.final()]).toString('utf8');
  return JSON.parse(plain) as unknown;
}

/**
 * Record paths hash the release with the email, so the records of one email cannot be named
 * directly: every record is read and the matching ones are deleted. A record that cannot be read
 * or decrypted stops the step (it might be this person's). Each page's matches are deleted before
 * the next page is listed, so a scan that stops partway keeps what it removed and the next scan
 * has those records fewer to read.
 */
export function vercelBlobBetaDownloads(env: NodeJS.ProcessEnv = process.env, fetcher: typeof fetch = fetch): BetaDownloadRecords {
  return {
    async deleteForEmail(email) {
      // No address captured: nothing was looked up, and the row must not claim the records are gone.
      const target = email?.trim().toLowerCase();
      if (!target) return 'no_email';
      const token = env.BLOB_READ_WRITE_TOKEN?.trim();
      const secret = env.WAITLIST_ADMIN_TOKEN?.trim();
      if (!token || !secret) {
        // In production the site's records can exist even when this deployment cannot read them: a missing setting
        // fails the step, so the row stays started with its email for the sweep and the 30-day path.
        // Same production check as getStore (src/data/store.ts).
        if (env.NODE_ENV === 'production') throw new Error('Blob is not configured: BLOB_READ_WRITE_TOKEN or WAITLIST_ADMIN_TOKEN is missing.');
        return 'not_configured';
      }
      // Same headers as the @vercel/blob SDK: the store id is the fourth part of a read-write token.
      const headers = { authorization: `Bearer ${token}`, 'x-api-version': '12', 'x-vercel-blob-store-id': token.split('_')[3] ?? '' };
      let cursor: string | undefined;
      do {
        const query = new URLSearchParams({ prefix: BETA_DOWNLOAD_PREFIX, limit: '1000', ...(cursor ? { cursor } : {}) });
        const listed = await fetcher(`${BLOB_API}?${query}`, { headers, cache: 'no-store' });
        if (!listed.ok) throw new Error(`Blob list failed: ${listed.status}`);
        const page = (await listed.json()) as { blobs?: Array<{ url: string; pathname: string }>; cursor?: string; hasMore?: boolean };
        const records = (page.blobs ?? []).filter((blob) => blob.pathname.endsWith('.enc'));
        const matched: boolean[] = [];
        let next = 0;
        // Set by the first failed read: the other workers start no new read, and the page's delete
        // never runs because Promise.all rejects.
        let stopped = false;
        const readRecords = async (): Promise<void> => {
          try {
            while (!stopped && next < records.length) {
              const index = next;
              next += 1;
              const location = new URL(records[index].url);
              location.searchParams.set('cache', '0');
              const read = await fetcher(location, { headers: { authorization: `Bearer ${token}` }, cache: 'no-store' });
              if (!read.ok) throw new Error(`Blob read failed: ${read.status}`);
              const record = decryptRecord(await read.text(), secret) as { email?: unknown };
              matched[index] = typeof record.email === 'string' && record.email.trim().toLowerCase() === target;
            }
          } catch (error) {
            stopped = true;
            throw error;
          }
        };
        await Promise.all(Array.from({ length: Math.min(BLOB_READ_CONCURRENCY, records.length) }, readRecords));
        const matches = records.filter((_, index) => matched[index]).map((blob) => blob.url);
        if (matches.length > 0) {
          const deleted = await fetcher(`${BLOB_API}/delete`, {
            method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ urls: matches }),
          });
          if (!deleted.ok) throw new Error(`Blob delete failed: ${deleted.status}`);
        }
        cursor = page.hasMore ? page.cursor : undefined;
      } while (cursor);
      return 'deleted';
    },
  };
}

interface AccountDeletionServices {
  auth: AuthIdentities;
  betaDownloads: BetaDownloadRecords;
}

let cached: AccountDeletionServices | undefined;

export function accountDeletionServices(): AccountDeletionServices {
  if (!cached) {
    const url = process.env.SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    cached = {
      // Without Supabase (the memory store in dev and tests) no Auth identity exists to delete.
      auth: url && key ? supabaseAuthIdentities(url, key) : { deleteUser: async () => 'not_found' },
      betaDownloads: vercelBlobBetaDownloads(),
    };
  }
  return cached;
}
