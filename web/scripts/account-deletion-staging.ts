import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { stagingConfig } from './staging-guard';

const config = stagingConfig();
if (!config.allowDestructive) throw new Error('Deletion verification requires STAGING_ALLOW_DESTRUCTIVE_TESTS=true.');
const db = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false } });
const userId = randomUUID();
const token = randomUUID();

async function count(table: string): Promise<number> {
  const { count: value, error } = await db.from(table).select('*', { count: 'exact', head: true }).eq('user_id', userId);
  if (error) throw error;
  return value ?? 0;
}

try {
  let result = await db.from('users').insert({ id: userId, email: `delete-${Date.now()}@example.test` });
  if (result.error) throw result.error;
  result = await db.from('tokens').insert({ token, user_id: userId });
  if (result.error) throw result.error;
  result = await db.from('events').insert({
    id: `delete-${randomUUID()}`, user_id: userId, ts: new Date().toISOString(),
    event_type: 'explanation_completed', local_date: new Date().toISOString().slice(0, 10), timezone: 'UTC',
    scope: 'selection', level: 'beginner', outcome: 'needs_review', concept: 'deletion-test', lines: 1,
  });
  if (result.error) throw result.error;
  result = await db.from('consent_log').insert({ user_id: userId, repository: 'disposable/test', action: 'granted' });
  if (result.error) throw result.error;
  const rebuilt = await db.rpc('rebuild_user_skills', { p_user_id: userId });
  if (rebuilt.error) throw rebuilt.error;

  const response = await fetch(`${config.webBaseUrl}/api/v1/account`, { method: 'DELETE', headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Deletion endpoint returned ${response.status}.`);
  const checks = await Promise.all(['events', 'tokens', 'device_codes', 'consent_log', 'skills'].map(count));
  const { count: users, error } = await db.from('users').select('*', { count: 'exact', head: true }).eq('id', userId);
  if (error) throw error;
  if ((users ?? 0) !== 0 || checks.some((value) => value !== 0)) throw new Error('Deletion left database records behind.');
  const replay = await fetch(`${config.webBaseUrl}/api/v1/account`, { headers: { authorization: `Bearer ${token}` } });
  if (replay.status !== 401) throw new Error(`Deleted token remained usable (${replay.status}).`);
  console.log(JSON.stringify({ ok: true, userRemoved: true, childRowsRemoved: true, tokenRevoked: true }, null, 2));
} finally {
  await db.from('users').delete().eq('id', userId);
}
