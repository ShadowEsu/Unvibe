import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';

const port = 8799;
const base = `http://127.0.0.1:${port}`;
const server = spawn('node_modules/.bin/next', ['dev', '-p', String(port)], {
  cwd: new URL('../web', import.meta.url),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    NODE_ENV: 'development', APP_ENV: 'development', UNCODE_ALLOW_MEMORY_STORE: 'true',
    SUPABASE_URL: '', SUPABASE_SERVICE_ROLE_KEY: '', ANTHROPIC_API_KEY: '',
  },
});
let logs = '';
server.stdout.on('data', (chunk) => { logs += chunk; });
server.stderr.on('data', (chunk) => { logs += chunk; });

async function waitReady() {
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    try { if ((await fetch(base)).status < 500) return; } catch { /* starting */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Local server did not become ready.\n${logs.slice(-4000)}`);
}

async function json(path, init) {
  const response = await fetch(`${base}${path}`, init);
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${await response.text()}`);
  return response.json();
}

try {
  await waitReady();
  const account = await json('/api/v1/auth/signin', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `smoke-${Date.now()}@example.test` }),
  });
  const auth = { authorization: `Bearer ${account.token}` };
  const event = { id: randomUUID(), ts: new Date().toISOString(), scope: 'selection', level: 'beginner', outcome: 'understood', concept: 'smoke', lines: 1 };
  await json('/api/v1/events', { method: 'POST', headers: { ...auth, 'content-type': 'application/json' }, body: JSON.stringify({ events: [event] }) });
  const history = await json('/api/v1/history?limit=1', { headers: auth });
  if (history.events?.[0]?.id !== event.id) throw new Error('History pagination did not return the event.');
  await json('/api/v1/account', { method: 'DELETE', headers: auth });
  const replay = await fetch(`${base}/api/v1/account`, { headers: auth });
  if (replay.status !== 401) throw new Error(`Deleted token replay returned ${replay.status}.`);
  console.log('Local API smoke passed: sign-in, write, paged restore, delete, and token invalidation.');
} finally {
  if (server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((resolve) => server.once('exit', resolve));
  }
}
