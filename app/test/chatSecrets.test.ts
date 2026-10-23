import test from 'node:test';
import assert from 'node:assert/strict';
import { askChat, askStudyAssistant } from '../src/main/studyQuiz';
import { hasBlocking, scanReviewPayload } from '../src/core/secretFilter';
import type { ReviewRequestPayload } from '../src/core/protocol';
import { netCalls } from './electronStub';

// Built at runtime so the repository secret scan never sees a key-shaped literal.
const STRIPE_LINE = 'STRIPE_SECRET_KEY=' + 'sk_' + 'live_' + 'a1B2c3D4e5'.repeat(4);
const DB_LINE = 'DB_PASSWORD=' + 'Tr0ub4dor&3horse!';

function watchFetch(): { calls: string[]; restore: () => void } {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    calls.push(String(input instanceof Request ? input.url : input));
    throw new Error('Network is disabled in tests.');
  }) as typeof fetch;
  netCalls.length = 0;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

test('Chat refuses a message that contains a secret and sends nothing', async () => {
  const net = watchFetch();
  try {
    const result = await askChat({ question: `why does this fail?\n${STRIPE_LINE}` });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, 'secret');
    assert.deepEqual(net.calls, []);
    assert.deepEqual(netCalls, []);
  } finally {
    net.restore();
  }
});

test('Chat refuses when an earlier message in the conversation contains a secret', async () => {
  const net = watchFetch();
  try {
    const result = await askChat({
      messages: [{ role: 'user', content: DB_LINE }, { role: 'assistant', content: 'That sets the database password.' }],
      question: 'And what does the next line do?',
    });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, 'secret');
    assert.deepEqual(net.calls, []);
    assert.deepEqual(netCalls, []);
  } finally {
    net.restore();
  }
});

test('Study follow-up refuses a question that contains a secret and sends nothing', async () => {
  const net = watchFetch();
  try {
    const result = await askStudyAssistant({ eventId: 'any', question: `is this safe? ${DB_LINE}` });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, 'secret');
    assert.deepEqual(net.calls, []);
    assert.deepEqual(netCalls, []);
  } finally {
    net.restore();
  }
});

test('a follow-up question on an explanation goes through the secret filter', () => {
  const payload: ReviewRequestPayload = {
    scope: 'selection',
    level: 'intermediate',
    context: { language: 'ts', projectStructure: [], imports: [], code: 'const a = 1;' },
    question: `what about ${STRIPE_LINE}`,
  };
  const findings = scanReviewPayload(payload);
  assert.ok(hasBlocking(findings));
  assert.ok(findings.some((f) => f.file === 'question'));
});
