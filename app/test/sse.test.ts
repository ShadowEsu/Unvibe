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

test('parses CRLF (\\r\\n\\r\\n) event separators per the SSE spec', () => {
  const p = new SseParser();
  const evs = p.feed('data: {"type":"token","text":"crlf"}\r\n\r\ndata: {"type":"done","model":"m","mock":false}\r\n\r\n');
  assert.equal(evs.length, 2);
  assert.deepEqual(evs[0], { type: 'token', text: 'crlf' });
  assert.equal(evs[1].type, 'done');
});

test('parses a CRLF event stream split mid-line across chunks', () => {
  const p = new SseParser();
  assert.equal(p.feed('data: {"type":"token","text":"he').length, 0);
  const evs = p.feed('llo"}\r\n\r\n');
  assert.equal(evs.length, 1);
  assert.deepEqual(evs[0], { type: 'token', text: 'hello' });
});

test('parses data: payloads without the optional leading space', () => {
  const p = new SseParser();
  const evs = p.feed('data:{"type":"token","text":"nospace"}\n\n');
  assert.equal(evs.length, 1);
  assert.deepEqual(evs[0], { type: 'token', text: 'nospace' });
});
