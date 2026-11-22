import test from 'node:test';
import assert from 'node:assert/strict';
import { net } from './electronStub';
import { networkFetch } from '../src/main/backend';

/** Electron's path fails with `message`; count what reaches Node's fetch. */
function failElectron(message: string): { nodeCalls: () => number; restore: () => void } {
  const electronFetch = net.fetch;
  const nodeFetch = globalThis.fetch;
  let calls = 0;
  net.fetch = async () => { throw new Error(message); };
  globalThis.fetch = (async () => { calls += 1; return new Response('{}'); }) as typeof fetch;
  return { nodeCalls: () => calls, restore: () => { net.fetch = electronFetch; globalThis.fetch = nodeFetch; } };
}

const post: RequestInit = { method: 'POST', body: '{"code":"x"}', headers: { 'content-type': 'application/json' } };

// Real messages from Electron's net.fetch (probed on Electron for 0.1.55): a server that read the request and then
// dropped the socket gives ERR_EMPTY_RESPONSE; a refused port or an unknown name never reaches a server.
for (const message of ['net::ERR_EMPTY_RESPONSE', 'net::ERR_CONNECTION_RESET', 'net::ERR_CONNECTION_CLOSED', 'net::ERR_TIMED_OUT', 'some other failure']) {
  test(`an explanation whose request may have reached the server (${message}) is not sent a second time`, async () => {
    const probe = failElectron(message);
    try {
      await assert.rejects(networkFetch('https://unvibe.test/api/v1/review', post), { message });
      assert.equal(probe.nodeCalls(), 0);
    } finally {
      probe.restore();
    }
  });
}

for (const message of ['net::ERR_NAME_NOT_RESOLVED', 'net::ERR_CONNECTION_REFUSED', 'net::ERR_PROXY_CONNECTION_FAILED', 'net::ERR_CERT_AUTHORITY_INVALID', 'net::ERR_INTERNET_DISCONNECTED']) {
  test(`an explanation that never left the computer (${message}) is tried once more on Node's network`, async () => {
    const probe = failElectron(message);
    try {
      assert.equal((await networkFetch('https://unvibe.test/api/v1/review', post)).status, 200);
      assert.equal(probe.nodeCalls(), 1);
    } finally {
      probe.restore();
    }
  });
}

test('a GET is tried once more on Node\'s network whatever the failure, and a lowercase post is still a POST', async () => {
  const probe = failElectron('net::ERR_EMPTY_RESPONSE');
  try {
    assert.equal((await networkFetch('https://unvibe.test/api/v1/usage', {})).status, 200);
    assert.equal((await networkFetch('https://unvibe.test/api/v1/usage', { method: 'get' })).status, 200);
    assert.equal(probe.nodeCalls(), 2);
    await assert.rejects(networkFetch('https://unvibe.test/api/v1/review', { ...post, method: 'post' }));
    assert.equal(probe.nodeCalls(), 2);
  } finally {
    probe.restore();
  }
});
