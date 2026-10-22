import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clearDeviceCode, pendingDeviceCode, saveDeviceCode } from '../src/lib/deviceCode';

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

const T0 = 1_800_000_000_000;

test('a code that arrived in a link is marked and taken out of the address bar', () => {
  assert.deepEqual(pendingDeviceCode('?user_code=abcd1234&utm_source=app', memoryStorage(), T0), { code: 'ABCD1234', fromLink: true, cleanSearch: '?utm_source=app' });
  assert.deepEqual(pendingDeviceCode('?device=wxyz9876', memoryStorage(), T0), { code: 'WXYZ9876', fromLink: true, cleanSearch: '' });
});

test('a link code is still a link code after the Google redirect or in the emailed sign-in link tab', () => {
  const storage = memoryStorage();
  const first = pendingDeviceCode('?user_code=ABCD1234', storage, T0);
  saveDeviceCode(first.code, first.fromLink, storage, T0 + 1_000);
  // Supabase sends the person back to /activate?code=<oauth code>, which is never a device code.
  assert.deepEqual(pendingDeviceCode('?code=oauth-exchange-code-1234567890', storage, T0 + 60_000), { code: 'ABCD1234', fromLink: true, cleanSearch: null });
});

test('a typed code gets no link warning', () => {
  const storage = memoryStorage();
  saveDeviceCode(' abcd1234 ', false, storage, T0);
  assert.deepEqual(pendingDeviceCode('', storage, T0), { code: 'ABCD1234', fromLink: false, cleanSearch: null });
});

test('a remembered code expires, and is forgotten once approved', () => {
  const storage = memoryStorage();
  pendingDeviceCode('?user_code=ABCD1234', storage, T0);
  assert.equal(pendingDeviceCode('', storage, T0 + 16 * 60_000).code, '');
  pendingDeviceCode('?user_code=ABCD1234', storage, T0);
  clearDeviceCode(storage);
  assert.deepEqual(pendingDeviceCode('', storage, T0), { code: '', fromLink: false, cleanSearch: null });
});

test('blocked storage still shows the code from the link', () => {
  const blocked = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  assert.deepEqual(pendingDeviceCode('?user_code=ABCD1234', blocked, T0), { code: 'ABCD1234', fromLink: true, cleanSearch: '' });
  assert.deepEqual(pendingDeviceCode('', blocked, T0), { code: '', fromLink: false, cleanSearch: null });
});
