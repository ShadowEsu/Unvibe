import test from 'node:test';
import assert from 'node:assert/strict';
import { browserOpenedFor, deviceBrowserReducer, DEVICE_BROWSER_START, type DeviceBrowserEvent } from '../src/renderer/shared/deviceBrowser';

const A = 'https://unvibe.site/activate?user_code=AAAA-1111';
const B = 'https://unvibe.site/activate?user_code=BBBB-2222';
const opened = (...events: DeviceBrowserEvent[]) => browserOpenedFor(events.reduce(deviceBrowserReducer, DEVICE_BROWSER_START));

test('the browser line reads "did not open" only for a failure of the link on screen', () => {
  // The code arrives and the browser opens: nothing is reported.
  assert.equal(opened({ type: 'code', url: A }), true);
  // The browser fails after the code is shown.
  assert.equal(opened({ type: 'code', url: A }, { type: 'failed', url: A }), false);
  // The browser fails at once, before the code's reply arrives.
  assert.equal(opened({ type: 'failed', url: A }, { type: 'code', url: A }), false);
});

test('a Retry\'s new link is never marked by the old link\'s failure, whenever it lands', () => {
  // The old link failed before the Retry.
  assert.equal(opened({ type: 'code', url: A }, { type: 'failed', url: A }, { type: 'code', url: B }), true);
  // The old link's failure arrives late, after the new link is on screen.
  assert.equal(opened({ type: 'code', url: A }, { type: 'code', url: B }, { type: 'failed', url: A }), true);
  // The new link fails too.
  assert.equal(opened({ type: 'code', url: A }, { type: 'code', url: B }, { type: 'failed', url: B }), false);
});

test('opening the link by hand wins over a failure of the same link, in either order', () => {
  assert.equal(opened({ type: 'code', url: A }, { type: 'failed', url: A }, { type: 'opened', url: A }), true);
  // The automatic open was still pending when the person pressed Open browser; it fails later.
  assert.equal(opened({ type: 'code', url: A }, { type: 'opened', url: A }, { type: 'failed', url: A }), true);
  // Opening the old link by hand doesn't cover the new link's failure.
  assert.equal(opened({ type: 'code', url: A }, { type: 'opened', url: A }, { type: 'code', url: B }, { type: 'failed', url: B }), false);
});
