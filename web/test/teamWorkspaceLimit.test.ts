import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GET as listWorkspaces, POST as createWorkspace } from '../app/api/v1/workspaces/route';
import { getStore } from '../src/data/store';
import { SupabaseBillingStore } from '../src/billing/supabaseBillingStore';
import { TeamWorkspaceLimitError } from '../src/billing/teamWorkspaceLimit';

// Real route + memory stores.
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SERVICE_ROLE_KEY;

async function signedIn(): Promise<Record<string, string>> {
  const account = await getStore().signIn(`owner-${crypto.randomUUID()}@workspaces.test`);
  return { authorization: `Bearer ${account.token}` };
}

function create(headers: Record<string, string>, name: string): Promise<Response> {
  return createWorkspace(new Request('http://localhost/api/v1/workspaces', { method: 'POST', headers, body: JSON.stringify({ name }) }));
}

async function teamCount(headers: Record<string, string>): Promise<number> {
  const body = await (await listWorkspaces(new Request('http://localhost/api/v1/workspaces', { headers }))).json() as { workspaces: Array<{ type: string }> };
  return body.workspaces.filter((workspace) => workspace.type === 'team').length;
}

test('an owner can create 10 team workspaces; the 11th is a 409 and adds no row, and other owners are unaffected', async () => {
  const owner = await signedIn();
  for (let i = 1; i <= 10; i += 1) assert.equal((await create(owner, `Team ${i}`)).status, 201, `team workspace ${i}`);

  const refused = await create(owner, 'Team 11');
  assert.equal(refused.status, 409);
  assert.equal((await refused.json() as { error: string }).error, 'team_workspace_limit');
  assert.equal(await teamCount(owner), 10);

  const other = await signedIn();
  assert.equal((await create(other, 'Their team')).status, 201);
  assert.equal(await teamCount(other), 1);
  assert.equal((await create(owner, 'Team 11 again')).status, 409, 'another owner\'s workspace does not free a slot');
});

test('the Supabase store turns create_team_workspace\'s cap exception into TeamWorkspaceLimitError', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.pathname !== '/rest/v1/rpc/create_team_workspace') throw new Error(`Unexpected request: ${url.pathname}`);
    return Response.json({ code: 'P0001', details: null, hint: null, message: 'Team workspace limit reached' }, { status: 400 });
  }) as typeof fetch;
  try {
    await assert.rejects(new SupabaseBillingStore('https://billing.supabase.test', 'service-key').createTeamWorkspace('user-1', 'Team 11'), TeamWorkspaceLimitError);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
