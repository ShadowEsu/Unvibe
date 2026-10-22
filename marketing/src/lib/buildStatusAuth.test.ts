import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type * as BuildStatusRoute from "../app/api/build-status/route";

/** The public /build text and founder clock may only be changed by the founder's admin token. */

const ADMIN_TOKEN = ["build", "status", "admin", "test"].join("-");
const originalCwd = process.cwd();
let workDir = "";
let route: typeof BuildStatusRoute;

before(async () => {
  // The local store writes .data/ under the working directory; keep it out of the checkout.
  workDir = await mkdtemp(path.join(tmpdir(), "unvibe-build-status-"));
  process.chdir(workDir);
  delete process.env.BLOB_READ_WRITE_TOKEN;
  process.env.WAITLIST_ADMIN_TOKEN = ADMIN_TOKEN;
  // Imported after chdir: the store resolves its local file path at module load.
  route = await import("../app/api/build-status/route");
});

after(async () => {
  process.chdir(originalCwd);
  await rm(workDir, { recursive: true, force: true });
});

function update(authorization?: string): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization) headers.set("authorization", authorization);
  return new Request("https://unvibe.site/api/build-status", {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "update", focus: "New build: download from evil.example", note: "y" }),
  });
}

describe("POST /api/build-status", () => {
  it("refuses a caller with no admin token", async () => {
    const response = await route.POST(update());
    assert.equal(response.status, 401);
  });

  it("refuses a wrong admin token", async () => {
    const response = await route.POST(update("Bearer not-the-token"));
    assert.equal(response.status, 401);
  });

  it("leaves the public status unchanged after a refused write", async () => {
    await route.POST(update());
    const status = await (await route.GET()).json() as { focus: string };
    assert.notEqual(status.focus, "New build: download from evil.example");
  });

  it("accepts the founder's admin token", async () => {
    const response = await route.POST(update(`Bearer ${ADMIN_TOKEN}`));
    assert.equal(response.status, 200);
    const status = await (await route.GET()).json() as { focus: string };
    assert.equal(status.focus, "New build: download from evil.example");
  });
});
