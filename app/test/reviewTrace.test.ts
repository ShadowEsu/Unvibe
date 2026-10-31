import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewTraceLine } from '../src/core/reviewTrace';

const LINE = /^\[unvibe-review\] id=[A-Za-z0-9:_-]+ status=(\d+|none) first_token_ms=(\d+|none) total_ms=\d+ outcome=(done|timeout|error|aborted|consent)$/;

test('a finished request reports the server id, status and timings in the harness format', () => {
  const line = reviewTraceLine({ id: 'iad1::pdx1::t529x-1793483078817-477dea5dc78d', status: 200, firstTokenMs: 1840.6, totalMs: 7012, outcome: 'done' });
  assert.equal(line, '[unvibe-review] id=iad1::pdx1::t529x-1793483078817-477dea5dc78d status=200 first_token_ms=1841 total_ms=7012 outcome=done');
});

test('a stall with no response and no words still prints one parseable line', () => {
  const line = reviewTraceLine({ id: null, status: null, firstTokenMs: null, totalMs: 30004, outcome: 'timeout' });
  assert.equal(line, '[unvibe-review] id=none status=none first_token_ms=none total_ms=30004 outcome=timeout');
});

test('a header value cannot add lines or fields to the log', () => {
  const line = reviewTraceLine({ id: 'abc\n[unvibe-review] id=x outcome=done status=999', status: 502, firstTokenMs: null, totalMs: 12, outcome: 'error' });
  assert.equal(line.split('\n').length, 1);
  assert.match(line, LINE);
  assert.equal(line.match(/outcome=/g)?.length, 1);
});

test('an over-long id is capped', () => {
  const line = reviewTraceLine({ id: 'a'.repeat(500), status: 200, firstTokenMs: 5, totalMs: 6, outcome: 'done' });
  assert.match(line, LINE);
  assert.ok(line.length < 220);
});
