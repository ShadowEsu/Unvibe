import assert from 'node:assert/strict';
import { createHash, randomInt } from 'node:crypto';
import test from 'node:test';
import { formatPromoCode, normalisePromoCode, PROMO_ALPHABET, PROMO_CODE_LENGTH, promoCodeHash } from '../src/lib/promoCode';

const CODE = '0123456789ABCDEF';

test('the alphabet is Crockford base32: 32 symbols, no I, L, O or U', () => {
  assert.equal(PROMO_ALPHABET.length, 32);
  assert.equal(new Set(PROMO_ALPHABET).size, 32);
  for (const missing of 'ILOU') assert.ok(!PROMO_ALPHABET.includes(missing));
  assert.equal(PROMO_CODE_LENGTH * Math.log2(PROMO_ALPHABET.length), 80);
});

test('normalise: upper case, spaces and hyphens dropped, O→0, I and L→1', () => {
  assert.equal(normalisePromoCode('0123-4567-89AB-CDEF'), CODE);
  assert.equal(normalisePromoCode(' 0123 4567  89ab-cdef '), CODE);
  assert.equal(normalisePromoCode('o123-4567-89ab-cdef'), CODE);
  assert.equal(normalisePromoCode('0i23-4567-89AB-CDEF'), CODE);
  assert.equal(normalisePromoCode('0l23-4567-89AB-CDEF'), CODE);
  assert.equal(normalisePromoCode('0123\t4567\n89AB--CDEF'), CODE);
});

test('normalise rejects anything that is not 16 Crockford characters', () => {
  for (const bad of [
    '', '0123-4567-89AB', '0123-4567-89AB-CDEF-0', '0123-4567-89AB-CDEU', '0123_4567_89AB_CDEF',
    '0123.4567.89AB.CDEF', 'ÀBCD-EFGH-JKMN-PQRS', `${CODE}${' '.repeat(60)}`,
  ]) assert.equal(normalisePromoCode(bad), null, bad);
  for (const notString of [undefined, null, 42, { code: CODE }, [CODE]]) assert.equal(normalisePromoCode(notString), null);
});

test('hash is lowercase hex sha256 of "unvibe-promo:" + the normalised code', () => {
  const expected = createHash('sha256').update(`unvibe-promo:${CODE}`).digest('hex');
  assert.equal(promoCodeHash(CODE), expected);
  assert.match(promoCodeHash(CODE), /^[0-9a-f]{64}$/);
  assert.notEqual(promoCodeHash(CODE), createHash('sha256').update(CODE).digest('hex'));
  const typed = normalisePromoCode('o123 4567 89ab cdef');
  assert.ok(typed);
  assert.equal(promoCodeHash(typed), expected);
});

test('format shows XXXX-XXXX-XXXX-XXXX and round-trips through normalise', () => {
  assert.equal(formatPromoCode(CODE), '0123-4567-89AB-CDEF');
  for (let i = 0; i < 50; i += 1) {
    const code = Array.from({ length: PROMO_CODE_LENGTH }, () => PROMO_ALPHABET[randomInt(32)]).join('');
    assert.equal(normalisePromoCode(formatPromoCode(code)), code);
  }
});
