import test from 'node:test';
import assert from 'node:assert/strict';
import { SseParser } from '../src/core/sse';

test('parses complete events', () => {
  const p = new SseParser();
  const evs = p.feed('data: {"type":"token","text":"hi"}\n\ndata: {"type":"done","model":"m","mock":true}\n\n');
  assert.equal(evs.length, 2);
  assert.deepEqual(evs[0], { type: 'token', text: 'hi' });
  assert.equal(evs[1].type, 'done');
});

test('buffers events split across chunks', () => {
  const p = new SseParser();
  assert.equal(p.feed('data: {"type":"token","te').length, 0);
  const evs = p.feed('xt":"ab"}\n\n');
  assert.equal(evs.length, 1);
  assert.deepEqual(evs[0], { type: 'token', text: 'ab' });
});

test('skips malformed events without dying', () => {
  const p = new SseParser();
  const evs = p.feed('data: {broken\n\ndata: {"type":"token","text":"ok"}\n\n');
  assert.equal(evs.length, 1);
  assert.deepEqual(evs[0], { type: 'token', text: 'ok' });
});
