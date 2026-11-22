import assert from 'node:assert/strict';
import { test } from 'node:test';
import { POST } from '../app/api/v1/reviews/route';
import { buildSystemPrompt, buildUserPrompt, wantsSuggestedFixes } from '../src/ai/prompt';
import type { ReviewRequestPayload } from '../src/ai/protocol';
import { ANTHROPIC_HOST, anthropicAnswer, spendMeterRpc } from './anthropicStub';

const base: ReviewRequestPayload = { scope: 'selection', level: 'beginner', context: { language: 'typescript', projectStructure: [], imports: [], code: 'const x = 1;' } };
const short: ReviewRequestPayload = { ...base, detail: 'short' };

/** Every kind of request the app sends: the flag may change only the short selection explanation. */
const kinds: Array<[string, ReviewRequestPayload]> = [
  ['short', short],
  ['short, explain differently', { ...short, variant: 'different' }],
  ['full', base],
  ['full, expert', { ...base, detail: 'full', level: 'expert' }],
  ['follow-up', { ...short, question: 'why?' }],
  ['more detail', { ...base, detail: 'full', shortAnswer: 'It sets x to 1.' }],
  ['diff', { ...base, scope: 'diff', detail: 'short' }],
];

test('without suggestFixes, and with it false, every prompt is the same as before', () => {
  for (const [name, payload] of kinds) {
    for (const off of [{ suggestFixes: false }, { suggestFixes: undefined }]) {
      assert.equal(buildSystemPrompt({ ...payload, ...off }), buildSystemPrompt(payload), `${name} system`);
      assert.equal(buildUserPrompt({ ...payload, ...off }), buildUserPrompt(payload), `${name} user`);
    }
    assert.doesNotMatch(buildSystemPrompt(payload), /Suggested fixes/, name);
  }
});

test('suggestFixes only works on a short selection explanation, and only as true', () => {
  assert.equal(wantsSuggestedFixes({ ...short, suggestFixes: true }), true);
  assert.equal(wantsSuggestedFixes({ ...short, variant: 'different', suggestFixes: true }), true);
  for (const [name, payload] of kinds.filter(([kind]) => !kind.startsWith('short'))) {
    assert.equal(wantsSuggestedFixes({ ...payload, suggestFixes: true }), false, name);
    assert.equal(buildSystemPrompt({ ...payload, suggestFixes: true }), buildSystemPrompt(payload), `${name} system`);
    assert.equal(buildUserPrompt({ ...payload, suggestFixes: true }), buildUserPrompt(payload), `${name} user`);
  }
  // A value that slipped past validation still turns nothing on.
  for (const odd of ['true', 1, {}] as unknown[]) {
    assert.equal(buildSystemPrompt({ ...short, suggestFixes: odd as boolean }), buildSystemPrompt(short), String(odd));
  }
});

test('the Suggested fixes section: at the end, at most 3 bullets, an honest empty answer, no rewritten code', () => {
  const system = buildSystemPrompt({ ...short, suggestFixes: true });
  // The short answer's own rules all stay, in order; the section is added after them.
  const before = buildSystemPrompt(short).split('\n');
  const after = system.split('\n');
  let at = 0;
  for (const line of after) if (line === before[at]) at += 1;
  assert.equal(at, before.length, 'every line of the short prompt is still there, in order');
  assert.match(system, /"### Suggested fixes", then at most 3 bullets/);
  assert.match(system, /names the line or construct, what could go wrong there, and the change to consider/);
  assert.match(system, /"Nothing to fix that I can see\."/);
  assert.match(system, /No rewritten code and no code blocks in this section\. A one-line change in single backticks is fine\./);
  assert.match(system, /never invent one to fill the list/);
  assert.match(system, /Never say a fix was made/);
  assert.ok(system.indexOf('Suggested fixes') > system.indexOf('"Not sure:"'), 'after the Not sure rule');
  assert.match(buildUserPrompt({ ...short, suggestFixes: true }), /## Task\nSay what this code does in 2 to 4 plain sentences, then end with the Suggested fixes section\.$/);
});

test('the review route accepts suggestFixes only as a boolean, and gives a short answer with fixes the larger budget', async () => {
  const previousEnv = { ...process.env };
  const previousFetch = globalThis.fetch;
  process.env.UNVIBE_TRIAL_TOKEN = 'local-trial-token-abcdefghijklmnop';
  process.env.SUPABASE_URL = 'https://fixes.supabase.test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'local-service-key';
  process.env.ANTHROPIC_API_KEY = 'local-anthropic-key';
  delete process.env.ENABLE_MOCK_AI;
  const calls: Array<{ max_tokens: number; system: string }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.hostname === ANTHROPIC_HOST) {
      const body = JSON.parse(String(init?.body)) as { max_tokens: number; system: unknown };
      calls.push({ max_tokens: body.max_tokens, system: JSON.stringify(body.system) });
      return anthropicAnswer(init, 'It sets x to 1.');
    }
    const meter = spendMeterRpc(url);
    if (meter) return meter;
    if (url.pathname === '/rest/v1/trial_installs') {
      return init?.method === 'POST' ? new Response(null, { status: 201 }) : Response.json([{ started_at: new Date().toISOString() }]);
    }
    if (url.pathname === '/rest/v1/rpc/trial_reserve') return Response.json(1);
    if (url.pathname === '/rest/v1/trial_counters') return Response.json([{ used: 1 }]);
    if (url.pathname === '/rest/v1/trial_activation') return new Response(null, { status: 201 });
    throw new Error(`Unexpected request: ${url.pathname}`);
  }) as typeof fetch;
  const post = (body: unknown, install: string) => POST(new Request('http://localhost/api/v1/reviews', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.UNVIBE_TRIAL_TOKEN}`, 'x-unvibe-install-id': install },
    body: JSON.stringify(body),
  }));
  try {
    for (const odd of ['true', 1, null, [], {}]) {
      const res = await post({ ...short, suggestFixes: odd }, 'fixes-odd');
      assert.equal(res.status, 400, JSON.stringify(odd));
      assert.equal(((await res.json()) as { error: string }).error, 'invalid_suggest_fixes');
    }
    assert.equal(calls.length, 0, 'a refused request reaches no model');
    for (const [flag, install] of [[true, 'fixes-on'], [false, 'fixes-off']] as const) {
      assert.match(await (await post({ ...short, suggestFixes: flag }, install)).text(), /"type":"done"/, String(flag));
    }
    assert.match(await (await post({ ...base, detail: 'full', suggestFixes: true }, 'fixes-full')).text(), /"type":"done"/);
    // Literal numbers on purpose: each budget is the meter's worst-case hold, a cost claim (Security SHOULD-U116b).
    assert.deepEqual(calls.map((call) => call.max_tokens), [800, 400, 2048]);
    assert.match(calls[0]!.system, /Suggested fixes/);
    assert.doesNotMatch(calls[1]!.system, /Suggested fixes/);
    assert.doesNotMatch(calls[2]!.system, /Suggested fixes/, 'a full answer ignores the flag');
  } finally {
    process.env = previousEnv;
    globalThis.fetch = previousFetch;
  }
});
