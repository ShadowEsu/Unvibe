import assert from 'node:assert/strict';
import test from 'node:test';
import { capGiftUsed, giftCodeFromEmail, randomGiftCode } from '../src/main/gift';

test('gift code from email matches the waitlist 8 character hash', () => {
  const code = giftCodeFromEmail('Preston@unvibe.site');
  assert.equal(code.length, 8);
  assert.match(code, /^[a-f0-9]{8}$/);
  assert.equal(code, giftCodeFromEmail('preston@unvibe.site'));
});

test('random gift code is 8 letters and numbers', () => {
  const code = randomGiftCode(Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]));
  assert.equal(code.length, 8);
  assert.match(code, /^[A-HJ-NP-Z2-9]{8}$/);
});

test('gift used is capped at five', () => {
  assert.equal(capGiftUsed(-2), 0);
  assert.equal(capGiftUsed(3.9), 3);
  assert.equal(capGiftUsed(12), 5);
});
