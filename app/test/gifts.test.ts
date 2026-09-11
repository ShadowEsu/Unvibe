import test from 'node:test';
import assert from 'node:assert/strict';
import { specialCharForEmail } from '../src/main/giftCode';

test('gift code matches the waitlist SPECIAL CHAR for the same email', () => {
  assert.equal(specialCharForEmail('Preston@Unvibe.site').length, 8);
  assert.equal(specialCharForEmail('Preston@Unvibe.site'), specialCharForEmail('preston@unvibe.site'));
  assert.notEqual(specialCharForEmail('preston@unvibe.site'), specialCharForEmail('other@unvibe.site'));
});
