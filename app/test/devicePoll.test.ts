import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createDevicePoll, DEVICE_CODE_LIFETIME_MS, DEVICE_TIMED_OUT, type DevicePollDeps } from '../src/main/devicePoll';
import { createCardDeviceCode } from '../src/renderer/shared/deviceCodeCard';

const settle = () => new Promise((resolve) => setImmediate(resolve));
const code = (userCode: string) => ({ deviceCode: `secret-${userCode}`, userCode, interval: 2 });
/** The page that showed the code (main passes its webContents). */
const page = () => new EventEmitter();

/** A server whose code is approved when `approve()` is called; records every redeem, sign-in and ended session. */
function server(now: () => number) {
  const redeems: string[] = [];
  const signedIn: string[] = [];
  const abandoned: string[] = [];
  const ended: string[] = [];
  let approvedCode = '';
  let hold: Promise<void> | null = null;
  const deps: DevicePollDeps = {
    now,
    redeem: async (deviceCode) => {
      redeems.push(deviceCode);
      if (hold) await hold;
      return deviceCode === approvedCode ? { token: `token-for-${deviceCode}` } : null;
    },
    approved: async (token, stillCurrent) => {
      if (!stillCurrent()) return false;
      signedIn.push(token);
      return true;
    },
    abandoned: (token) => { abandoned.push(token); },
    ended: (message) => { ended.push(message); },
  };
  return {
    deps, redeems, signedIn, abandoned, ended,
    approve: (deviceCode: string) => { approvedCode = deviceCode; },
    holdRedeems: () => { let release!: () => void; hold = new Promise((r) => { release = r; }); return () => { hold = null; release(); }; },
  };
}

test('a code whose card closed is no longer polled, so approving it in a browser signs nobody in', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const s = server(Date.now);
  const poll = createDevicePoll(s.deps);
  poll.start(code('ABCD-1234'), 'https://unvibe.test/activate?user_code=ABCD-1234', page());
  t.mock.timers.tick(2000); await settle();
  assert.equal(s.redeems.length, 1);

  assert.equal(poll.cancel('ABCD-1234'), true);
  assert.equal(poll.verificationUrl(), null, 'Open browser has no link to reopen');
  s.approve('secret-ABCD-1234');
  t.mock.timers.tick(20_000); await settle();
  assert.deepEqual([s.redeems.length, s.signedIn, s.ended], [1, [], []]);
});

for (const event of ['destroyed', 'did-start-loading', 'render-process-gone']) {
  test(`the page that showed the code going away (${event}: Mac close or ⌘W, a reload, a crash) drops it with no card cleanup`, async (t) => {
    t.mock.timers.enable({ apis: ['setInterval'] });
    const s = server(Date.now);
    const poll = createDevicePoll(s.deps);
    const owner = page();
    poll.start(code('ABCD-1234'), 'https://unvibe.test/a', owner);
    owner.emit(event);
    s.approve('secret-ABCD-1234');
    t.mock.timers.tick(20_000); await settle();
    assert.deepEqual([s.redeems, s.signedIn, poll.owner()], [[], [], null]);
  });
}

test('a later code is not dropped by the page of an earlier one, and the earlier page holds no listeners', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const s = server(Date.now);
  const poll = createDevicePoll(s.deps);
  const first = page();
  const second = page();
  poll.start(code('OLD1-0000'), 'https://unvibe.test/old', first);
  poll.start(code('NEW2-0000'), 'https://unvibe.test/new', second);
  assert.equal(first.listenerCount('destroyed'), 0);
  first.emit('destroyed');
  assert.equal(poll.cancel('OLD1-0000'), false, 'a card never drops a newer code');
  assert.equal(poll.verificationUrl(), 'https://unvibe.test/new');
  t.mock.timers.tick(2000); await settle();
  assert.deepEqual(s.redeems, ['secret-NEW2-0000']);
  assert.equal(poll.cancel(), true, 'quitting drops whatever is waiting');
  assert.equal(second.listenerCount('destroyed'), 0);
});

test('an approval already on its way when the card closes signs nobody in, and its session is ended', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const s = server(Date.now);
  const poll = createDevicePoll(s.deps);
  poll.start(code('ABCD-1234'), 'https://unvibe.test/a', page());
  s.approve('secret-ABCD-1234');
  const release = s.holdRedeems();
  t.mock.timers.tick(2000); await settle();
  poll.cancel('ABCD-1234');
  release(); await settle(); await settle();
  assert.deepEqual([s.signedIn, s.abandoned], [[], ['token-for-secret-ABCD-1234']]);
});

test('a slow answer is never overlapped by the next tick, and an approved code signs in once', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const s = server(Date.now);
  const poll = createDevicePoll(s.deps);
  poll.start(code('ABCD-1234'), 'https://unvibe.test/a', page());
  const release = s.holdRedeems();
  t.mock.timers.tick(2000); await settle();
  t.mock.timers.tick(2000); await settle();
  t.mock.timers.tick(2000); await settle();
  assert.equal(s.redeems.length, 1, 'still the first redeem');
  s.approve('secret-ABCD-1234');
  release(); await settle(); await settle();
  t.mock.timers.tick(2000); await settle();
  assert.deepEqual([s.signedIn, s.abandoned], [['token-for-secret-ABCD-1234'], []]);
  t.mock.timers.tick(10_000); await settle();
  assert.deepEqual([s.signedIn.length, poll.verificationUrl()], [1, null], 'polling stopped after the sign-in');
});

test('a code nobody approves ends after ten minutes with the timed-out message', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let clock = 0;
  const s = server(() => clock);
  const poll = createDevicePoll(s.deps);
  poll.start(code('ABCD-1234'), 'https://unvibe.test/a', page());
  clock = DEVICE_CODE_LIFETIME_MS + 1;
  t.mock.timers.tick(2000); await settle();
  assert.deepEqual([s.ended, poll.verificationUrl()], [[DEVICE_TIMED_OUT], null]);
});

test('a card drops its waiting code when it closes, and a code that arrives after it closed is dropped at once', () => {
  const dropped: string[] = [];
  const card = createCardDeviceCode((userCode) => dropped.push(userCode));
  card.opened();
  card.arrived('ABCD-1234');
  card.closed();
  assert.deepEqual(dropped, ['ABCD-1234']);

  // Continue with Google, then the card closes before the server's code arrives (seconds on a cold server).
  const late = createCardDeviceCode((userCode) => dropped.push(userCode));
  late.opened();
  late.closed();
  late.arrived('LATE-0000');
  assert.deepEqual(dropped, ['ABCD-1234', 'LATE-0000']);

  // A sign-in that finished or failed has nothing left to drop.
  const finished = createCardDeviceCode((userCode) => dropped.push(userCode));
  finished.opened();
  finished.arrived('DONE-0000');
  finished.ended();
  finished.closed();
  assert.deepEqual(dropped, ['ABCD-1234', 'LATE-0000']);
});
