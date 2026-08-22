import assert from "node:assert/strict";
import test from "node:test";
import {
  BUILD_STATUS_STORAGE_ERROR,
  BUILD_STATUS_STORAGE_ERROR_CODE,
  founderActionFailureMessage,
} from "./buildStatusError";

test("founder storage failures have a clear, provider-neutral recovery message", () => {
  assert.equal(
    founderActionFailureMessage(503, { code: BUILD_STATUS_STORAGE_ERROR_CODE }),
    BUILD_STATUS_STORAGE_ERROR,
  );
});

test("founder authorization failures do not expose implementation details", () => {
  assert.equal(
    founderActionFailureMessage(401, { error: "unexpected internal detail" }),
    "That founder passcode is incorrect.",
  );
});
