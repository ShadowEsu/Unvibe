import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevicePoll, DEVICE_CODE_LIFETIME_MS, DEVICE_TIMED_OUT, type DevicePollDeps } from '../src/main/devicePoll';

const settle = () => new Promise((resolve) => setImmediate(resolve));
const code = (userCode: string) => ({ deviceCode: `secret-${userCode}`, userCode, interval: 2 });

/** A server whose code is approved when `approve()` is called; records every redeem and every sign-in. */
function server(now: () => number) {
  const redeems: string[] = [];
  const signedIn: string[] = [];
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
    approved: async (token, stillCurrent) => { if (stillCurrent()) signedIn.push(token); },
    ended: (message) => { ended.push(message); },
  };
  return {
    deps, redeems, signedIn, ended,
    approve: (deviceCode: string) => { approvedCode = deviceCode; },
    holdRedeems: () => { let release!: () => void; hold = new Promise((r) => { release = r; }); return () => { hold = null; release(); }; },
  };
}

test('a code whose card closed is no longer polled, so approving it in a browser signs nobody in', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const s = server(Date.now);
  const poll = createDevicePoll(s.deps);
  poll.start(code('ABCD-1234'), 'https://unvibe.test/activate?user_code=ABCD-1234');
  t.mock.timers.tick(2000); await settle();
  assert.equal(s.redeems.length, 1);

  assert.equal(poll.cancel('ABCD-1234'), true);
  assert.equal(poll.verificationUrl(), null, 'Open browser has no link to reopen');
  s.approve('secret-ABCD-1234');
  t.mock.timers.tick(20_000); await settle();
  assert.deepEqual([s.redeems.length, s.signedIn, s.ended], [1, [], []]);
});

test('an approval already on its way when the card closes signs nobody in', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const s = server(Date.now);
  const poll = createDevicePoll(s.deps);
  poll.start(code('ABCD-1234'), 'https://unvibe.test/a');
  s.approve('secret-ABCD-1234');
  const release = s.holdRedeems();
  t.mock.timers.tick(2000); await settle();
  poll.cancel('ABCD-1234');
  release(); await settle(); await settle();
  assert.deepEqual(s.signedIn, []);
});

test('a card closing never drops a newer code another card started, and quitting drops whatever is waiting', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const s = server(Date.now);
  const poll = createDevicePoll(s.deps);
  poll.start(code('OLD1-0000'), 'https://unvibe.test/old');
  poll.start(code('NEW2-0000'), 'https://unvibe.test/new');
  assert.equal(poll.cancel('OLD1-0000'), false);
  assert.equal(poll.verificationUrl(), 'https://unvibe.test/new');
  t.mock.timers.tick(2000); await settle();
  assert.deepEqual(s.redeems, ['secret-NEW2-0000'], 'only the newest code is polled');
  assert.equal(poll.cancel(), true);
  t.mock.timers.tick(10_000); await settle();
  assert.equal(s.redeems.length, 1);
});

test('a slow answer is never overlapped by the next tick, and an approved code signs in once', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  const s = server(Date.now);
  const poll = createDevicePoll(s.deps);
  poll.start(code('ABCD-1234'), 'https://unvibe.test/a');
  const release = s.holdRedeems();
  t.mock.timers.tick(2000); await settle();
  t.mock.timers.tick(2000); await settle();
  t.mock.timers.tick(2000); await settle();
  assert.equal(s.redeems.length, 1, 'still the first redeem');
  s.approve('secret-ABCD-1234');
  release(); await settle(); await settle();
  t.mock.timers.tick(2000); await settle();
  assert.deepEqual(s.signedIn, ['token-for-secret-ABCD-1234']);
  t.mock.timers.tick(10_000); await settle();
  assert.deepEqual([s.signedIn.length, poll.verificationUrl()], [1, null], 'polling stopped after the sign-in');
});

test('a code nobody approves ends after ten minutes with the timed-out message', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let clock = 0;
  const s = server(() => clock);
  const poll = createDevicePoll(s.deps);
  poll.start(code('ABCD-1234'), 'https://unvibe.test/a');
  clock = DEVICE_CODE_LIFETIME_MS + 1;
  t.mock.timers.tick(2000); await settle();
  assert.deepEqual([s.ended, poll.verificationUrl()], [[DEVICE_TIMED_OUT], null]);
});
