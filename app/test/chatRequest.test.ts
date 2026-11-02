import test from 'node:test';
import assert from 'node:assert/strict';
import { chatAskRequest } from '../src/renderer/companion/chatRequest';

test('the Chat panel sends its conversation stamp with every question', () => {
  const earlier = [
    { role: 'user' as const, content: 'What does map do?', ts: '2026-10-26T10:00:00.000Z' },
    { role: 'assistant' as const, content: 'It transforms each item.', ts: '2026-10-26T10:00:01.000Z' },
  ];
  assert.deepEqual(chatAskRequest(earlier, 'And filter?', 4), {
    messages: [
      { role: 'user', content: 'What does map do?' },
      { role: 'assistant', content: 'It transforms each item.' },
    ],
    question: 'And filter?',
    wipeGeneration: 4,
  });
  // Generation 0 (no wipe yet on this computer) is a real stamp and is sent.
  assert.equal(chatAskRequest([], 'Hi', 0).wipeGeneration, 0);
  // Before the stamp is known, nothing is sent and main answers as before.
  assert.equal(chatAskRequest([], 'Hi', null).wipeGeneration, undefined);
});
