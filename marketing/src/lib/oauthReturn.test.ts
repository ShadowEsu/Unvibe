import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { signInReturnFailed, withoutSignInError } from "./oauthReturn";

// QA 31 Oct: after Cancel at Google the page showed the form again with no message.
describe("a sign-in that comes back with an error", () => {
  it("is seen for Cancel at Google (access_denied in query and hash, as Supabase sends it)", () => {
    assert.equal(signInReturnFailed("?error=access_denied&error_description=", "#error=access_denied&sb="), true);
  });

  it("is seen for an unknown provider error, in the hash only or the query only", () => {
    assert.equal(signInReturnFailed("", "#error=server_error&error_code=unexpected_failure&error_description=Something+broke"), true);
    assert.equal(signInReturnFailed("?error_code=otp_expired", ""), true);
  });

  it("is not seen on a normal visit, a device code link, a promo link or a sign-in code", () => {
    for (const [search, hash] of [["", ""], ["?user_code=ABCD-EFGH", ""], ["?promo=CALHACKS-1234", ""], ["?code=0123456789abcdef0123", ""]]) {
      assert.equal(signInReturnFailed(search, hash), false, `${search}${hash}`);
    }
  });

  it("cleans the error keys out of the address and keeps the rest", () => {
    assert.equal(withoutSignInError("?error=access_denied&error_description=&sb="), "");
    assert.equal(withoutSignInError("?promo=CALHACKS-1234&error=access_denied&error_code=x"), "?promo=CALHACKS-1234");
  });
});
