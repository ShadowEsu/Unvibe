import test from 'node:test';
import assert from 'node:assert/strict';
import { openToken, sealToken, type TokenCipher } from '../src/core/tokenVault';

function cipher(available: boolean): TokenCipher {
  return {
    isEncryptionAvailable: () => available,
    encryptString: (value) => Buffer.from(`sealed:${value}`, 'utf8'),
    decryptString: (value) => value.toString('utf8').replace(/^sealed:/, ''),
  };
}

test('secure token round-trips through the OS cipher', () => {
  const sealed = sealToken('private-session', cipher(true));
  assert.notEqual(Buffer.from(sealed, 'base64').toString('utf8'), 'private-session');
  assert.equal(openToken(sealed, cipher(true)), 'private-session');
});

test('token persistence fails closed when OS encryption is unavailable', () => {
  assert.throws(
    () => sealToken('private-session', cipher(false)),
    /Secure account storage is unavailable/,
  );
});
