import assert from "node:assert/strict";
import { test } from "node:test";
import { BETA_INSTALL_TAG } from "@/lib/betaInstallScript";
import { DOWNLOAD_FILES as COUNTED_FILES } from "@/lib/downloadCounter";
import { DOWNLOAD_FILES, macArch, pickDownload } from "@/lib/downloadPick";

const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const LINUX = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";

test("Windows gets the Windows file; Macs and everything else get a Mac file, Apple silicon by default", () => {
  assert.equal(pickDownload(WINDOWS, 0, {}), "windows");
  assert.equal(pickDownload(MAC, 0, {}), "mac-arm");
  assert.equal(pickDownload(LINUX, 0, {}), "mac-arm");
});

test("Intel Macs are picked from the client hint or the WebGL renderer", () => {
  assert.equal(pickDownload(MAC, 0, { uaArchitecture: "x86" }), "mac-intel");
  assert.equal(pickDownload(MAC, 0, { uaArchitecture: "arm", webglRenderer: "Intel Iris" }), "mac-arm");
  assert.equal(pickDownload(MAC, 0, { webglRenderer: "ANGLE (Intel Inc., Intel(R) Iris(TM) Plus Graphics 655, OpenGL 4.1)" }), "mac-intel");
  assert.equal(pickDownload(MAC, 0, { webglRenderer: "AMD Radeon Pro 560X OpenGL Engine" }), "mac-intel");
  assert.equal(pickDownload(MAC, 0, { webglRenderer: "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)" }), "mac-arm");
  // Safari masks the GPU as "Apple GPU" on every Mac, so it stays on the default.
  assert.equal(macArch({ webglRenderer: "Apple GPU" }), "arm");
});

test("phones and iPads get no file; ?os= forces one", () => {
  assert.equal(pickDownload(IPHONE, 5, {}), null);
  assert.equal(pickDownload(MAC, 5, {}), null);
  assert.equal(pickDownload(IPHONE, 5, {}, "win"), "windows");
  assert.equal(pickDownload(WINDOWS, 0, {}, "mac"), "mac-arm");
});

test("every file is a counted link that redirects to an asset of the release the site serves", () => {
  const release = `https://github.com/ShadowEsu/Unvibe/releases/download/${BETA_INSTALL_TAG}/`;
  const counted = { "mac-arm": "mac", "mac-intel": "mac-intel", windows: "windows" } as const;
  for (const [pick, file] of Object.entries(counted) as [keyof typeof counted, (typeof counted)[keyof typeof counted]][]) {
    assert.equal(DOWNLOAD_FILES[pick].url, `/download/${file}`);
    assert.ok(COUNTED_FILES[file].url.startsWith(release), COUNTED_FILES[file].url);
  }
  assert.match(COUNTED_FILES.mac.url, /mac-arm64\.dmg$/);
  assert.match(COUNTED_FILES["mac-intel"].url, /mac-x64\.dmg$/);
  assert.match(COUNTED_FILES.windows.url, /win-x64.*\.exe$/);
});
