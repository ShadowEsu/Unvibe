import assert from 'node:assert/strict';
import test from 'node:test';
import { signInReturnFailed } from '../src/lib/oauthReturn';

// QA 31 Oct: after Cancel at Google, api.unvibe.site/activate showed the form again with no message.
test('Cancel at Google (access_denied in query and hash, as Supabase sends it) is a failed sign-in', () => {
  assert.equal(signInReturnFailed('?error=access_denied&error_description=', '#error=access_denied&sb='), true);
});

test('an unknown provider error in the hash only, or an expired email link in the query only, is a failed sign-in', () => {
  assert.equal(signInReturnFailed('', '#error=server_error&error_code=unexpected_failure&error_description=Something+broke'), true);
  assert.equal(signInReturnFailed('?error_code=otp_expired', ''), true);
});

test('a normal visit, a device code link or a sign-in code is not a failed sign-in', () => {
  for (const [search, hash] of [['', ''], ['?user_code=ABCD-EFGH', ''], ['?code=0123456789abcdef0123', '']]) {
    assert.equal(signInReturnFailed(search, hash), false, `${search}${hash}`);
  }
});
