import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { POST as signIn } from '../app/api/v1/auth/signin/route';
import { POST as signUp } from '../app/api/v1/auth/signup/route';

// Email-only sign-in takes over any account by address, so no env setting may open it on a
// production build or a Vercel deployment. Real routes, memory store.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

const routes = [['signin', signIn], ['signup', signUp]] as const;
const post = (route: (req: Request) => Promise<Response>, email: string) =>
  route(new Request('http://localhost/api/v1/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) }));

async function withEnv(env: Record<string, string | undefined>, run: () => Promise<void>): Promise<void> {
  const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
  const apply = (values: Record<string, string | undefined>) => {
    for (const [k, v] of Object.entries(values)) { if (v === undefined) delete process.env[k]; else Object.assign(process.env, { [k]: v }); }
  };
  apply(env);
  try { await run(); } finally { apply(saved); }
}

for (const [name, route] of routes) {
  test(`${name}: a production build refuses email sign-in even with the old opt-in flag`, async () => {
    await withEnv({ NODE_ENV: 'production', VERCEL: undefined, UNCODE_ALLOW_DEV_EMAIL_AUTH: 'true' }, async () => {
      const res = await post(route, `prod-${randomUUID()}@auth.test`);
      assert.equal(res.status, 501);
      assert.equal(res.headers.get('set-cookie'), null);
    });
  });

  test(`${name}: any Vercel deployment refuses email sign-in, even a non-production build`, async () => {
    await withEnv({ NODE_ENV: 'development', VERCEL: '1', UNCODE_ALLOW_DEV_EMAIL_AUTH: 'true' }, async () => {
      assert.equal((await post(route, `vercel-${randomUUID()}@auth.test`)).status, 501);
    });
  });

  test(`${name}: local development still signs in by email`, async () => {
    await withEnv({ NODE_ENV: 'development', VERCEL: undefined, UNCODE_ALLOW_DEV_EMAIL_AUTH: undefined }, async () => {
      const res = await post(route, `dev-${randomUUID()}@auth.test`);
      assert.equal(res.status, 200);
      assert.match(res.headers.get('set-cookie') ?? '', /=/);
    });
  });
}
