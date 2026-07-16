import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { stagingConfig } from './staging-guard';

const config = stagingConfig();
if (!config.allowDestructive) throw new Error('RLS suite creates and removes disposable users. Set STAGING_ALLOW_DESTRUCTIVE_TESTS=true.');
const admin = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false } });
const stamp = Date.now();
const password = `Unvibe-test-${randomUUID()}Aa1!`;
const emails = [`rls-a-${stamp}@example.test`, `rls-b-${stamp}@example.test`];
const ids: string[] = [];

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function directClient(email: string) {
  const client = createClient(config.supabaseUrl, config.anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

try {
  for (const email of emails) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw error ?? new Error('Disposable auth user was not created.');
    ids.push(data.user.id);
    const { error: userError } = await admin.from('users').insert({ id: data.user.id, email });
    if (userError) throw userError;
  }
  for (let index = 0; index < ids.length; index += 1) {
    const { error } = await admin.from('events').insert({
      id: `rls-${stamp}-${index}`,
      user_id: ids[index],
      ts: new Date().toISOString(),
      event_type: 'explanation_completed',
      local_date: new Date().toISOString().slice(0, 10),
      timezone: 'UTC', scope: 'selection', level: 'intermediate', outcome: 'understood',
      concept: `rls-concept-${index}`, lines: 1,
    });
    if (error) throw error;
    const { error: skillError } = await admin.rpc('rebuild_user_skills', { p_user_id: ids[index] });
    if (skillError) throw skillError;
  }

  const clients = [await directClient(emails[0]), await directClient(emails[1])];
  for (let index = 0; index < clients.length; index += 1) {
    const client = clients[index];
    const other = ids[1 - index];
    const { data: ownUser, error: ownUserError } = await client.from('users').select('id');
    assert(!ownUserError && ownUser?.length === 1 && ownUser[0].id === ids[index], `User ${index} did not see exactly its own profile.`);
    const { data: events, error: eventError } = await client.from('events').select('user_id');
    assert(!eventError && events?.length === 1 && events[0].user_id === ids[index], `User ${index} event isolation failed.`);
    const { data: otherEvents, error: otherError } = await client.from('events').select('id').eq('user_id', other);
    assert(!otherError && otherEvents?.length === 0, `User ${index} read another user's event.`);
    const { data: skills, error: skillError } = await client.from('skills').select('user_id');
    assert(!skillError && skills?.length === 1 && skills[0].user_id === ids[index], `User ${index} skill isolation failed.`);
    const { error: writeError } = await client.from('events').insert({
      id: randomUUID(), user_id: ids[index], ts: new Date().toISOString(), local_date: new Date().toISOString().slice(0, 10),
      timezone: 'UTC', scope: 'selection', level: 'intermediate', outcome: 'reviewed', lines: 0,
    });
    assert(Boolean(writeError), `User ${index} unexpectedly gained direct event write access.`);
    for (const table of ['tokens', 'device_codes']) {
      const { error } = await client.from(table).select('*').limit(1);
      assert(Boolean(error), `User ${index} unexpectedly read server-only ${table}.`);
    }
  }

  const absentResources: string[] = [];
  for (const table of ['projects', 'notes', 'saved_explanations', 'subscriptions']) {
    const { error } = await admin.from(table).select('*', { head: true, count: 'exact' });
    if (error) absentResources.push(table);
  }
  console.log(JSON.stringify({ ok: true, tested: ['users', 'events', 'skills', 'tokens', 'device_codes'], notImplemented: absentResources }, null, 2));
} finally {
  for (const id of ids) {
    await admin.from('users').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id);
  }
}
