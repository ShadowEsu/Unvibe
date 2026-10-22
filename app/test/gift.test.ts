import assert from 'node:assert/strict';
import test from 'node:test';
import { capGiftUsed, giftCodeFromInput } from '../src/main/gift';

test('gift code is read from a bare code or a shared link', () => {
  assert.equal(giftCodeFromInput('  Ab3_x-9QzLmN0pR7  '), 'Ab3_x-9QzLmN0pR7');
  assert.equal(giftCodeFromInput('https://unvibe.site/?ref=Ab3_x-9QzLmN0pR7'), 'Ab3_x-9QzLmN0pR7');
  assert.equal(giftCodeFromInput('https://unvibe.site/?utm_source=x&ref=Ab3_x-9QzLmN0pR7'), 'Ab3_x-9QzLmN0pR7');
});

test('old 8 character codes and junk are not gift codes', () => {
  assert.equal(giftCodeFromInput('deadbeef'), '');
  assert.equal(giftCodeFromInput('https://unvibe.site/?ref=deadbeef'), '');
  assert.equal(giftCodeFromInput('not a link'), '');
  assert.equal(giftCodeFromInput('Ab3_x-9QzLmN0pR7!'), '');
});

test('gift used is capped at five', () => {
  assert.equal(capGiftUsed(-2), 0);
  assert.equal(capGiftUsed(3.9), 3);
  assert.equal(capGiftUsed(12), 5);
});
