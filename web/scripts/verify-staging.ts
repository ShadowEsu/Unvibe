import { spawnSync } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { stagingConfig } from './staging-guard';

const config = stagingConfig();
const db = createClient(config.supabaseUrl, config.serviceRoleKey, { auth: { persistSession: false } });
const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];

const root = await fetch(config.webBaseUrl, { redirect: 'manual' });
checks.push({ name: 'web reachable', ok: root.status >= 200 && root.status < 500, detail: `HTTP ${root.status}` });
const device = await fetch(`${config.webBaseUrl}/api/v1/auth/device`, { method: 'POST' });
checks.push({ name: 'device endpoint', ok: device.ok, detail: `HTTP ${device.status}` });
const migration = await db.rpc('history_page', { p_user_id: crypto.randomUUID(), p_limit: 1, p_cursor_ts: null, p_cursor_id: null });
checks.push({ name: 'pagination migration', ok: !migration.error, detail: migration.error?.message });
const skills = await db.from('skills').select('id', { head: true, count: 'exact' });
checks.push({ name: 'skills migration', ok: !skills.error, detail: skills.error?.message });

if (config.allowDestructive) {
  for (const [name, script] of [['two-user RLS', 'scripts/rls-staging.ts'], ['account deletion', 'scripts/account-deletion-staging.ts']] as const) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', script], { stdio: 'inherit', env: process.env });
    checks.push({ name, ok: result.status === 0 });
  }
} else {
  checks.push({ name: 'destructive suites', ok: false, detail: 'SKIPPED: set STAGING_ALLOW_DESTRUCTIVE_TESTS=true for a release gate.' });
}

console.log(JSON.stringify({ environment: 'staging', generatedAt: new Date().toISOString(), checks }, null, 2));
if (checks.some((check) => !check.ok)) process.exit(1);
