import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { app, net } from './electronStub';

// The store lives under userData; give this file its own so nothing else is touched.
const userData = mkdtempSync(path.join(tmpdir(), 'unvibe-service-messages-'));
app.getPath = (): string => userData;

import { claimGiftCode } from '../src/main/backend';
import { store } from '../src/main/store';
import { askStudyAssistant } from '../src/main/studyQuiz';

/** What the service answers next: a JSON refusal, or an SSE stream of these events. */
let answer: { status: number; body: unknown } | { events: unknown[] } = { status: 200, body: {} };
net.fetch = async (): Promise<Response> => {
  if ('events' in answer) {
    return new Response(answer.events.map((ev) => `data: ${JSON.stringify(ev)}\n\n`).join(''), { headers: { 'content-type': 'text/event-stream' } });
  }
  return Response.json(answer.body, { status: answer.status });
};

/** Messages the service could send that must never reach the screen as they are. */
const HOSTILE: Array<[string, unknown]> = [
  ['an object', { html: '<img src=x onerror=alert(1)>' }],
  ['an array', ['a', 'b']],
  ['a number', 42],
  ['a blank string', '   '],
];

test('a refused gift code shows the service\'s message only as a capped string', async () => {
  for (const status of [400, 409]) {
    answer = { status, body: { error: 'invalid_code', message: `  ${'g'.repeat(1_000)}  ` } };
    await assert.rejects(claimGiftCode('session-token', 'GIFTCODE12345678'), { message: 'g'.repeat(300) }, `${status}: capped`);
    for (const [name, message] of HOSTILE) {
      answer = { status, body: { error: 'invalid_code', message } };
      await assert.rejects(claimGiftCode('session-token', 'GIFTCODE12345678'), { message: 'That gift code could not be used.' }, `${status}: ${name}`);
    }
  }
});

test('a study answer stream that ends in an error shows its message only as a capped string', async () => {
  store().wipeEverything();
  store().recordReview({
    id: 'lesson-1', ts: new Date().toISOString(), eventType: 'explanation_completed', localDate: new Date().toISOString().slice(0, 10),
    timezone: 'UTC', scope: 'selection', level: 'beginner', outcome: 'reviewed', lines: 1, code: 'const total = a + b;',
  });
  answer = { events: [{ type: 'error', message: ` ${'e'.repeat(1_000)} ` }] };
  const capped = await askStudyAssistant({ eventId: 'lesson-1', question: 'Why add them?' });
  assert.equal(capped.ok ? '' : capped.error, 'e'.repeat(300));
  for (const [name, message] of HOSTILE) {
    answer = { events: [{ type: 'error', message }] };
    const result = await askStudyAssistant({ eventId: 'lesson-1', question: 'Why add them?' });
    assert.equal(result.ok ? '' : result.error, 'The assistant could not answer.', name);
  }
});
