import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BETA_INSTALL_TAG } from "./betaInstallScript";
import { DOWNLOAD_SIZES } from "./downloadMeta";

describe("download sizes", () => {
  it("belong to the release the site links, so serving a new tag fails here until the sizes move with it", () => {
    assert.equal(DOWNLOAD_SIZES.tag, BETA_INSTALL_TAG);
  });
});
