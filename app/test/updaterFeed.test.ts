import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkForUpdate, prepareUpdate } from '../src/main/updater';

/**
 * The update check asks Unvibe's cached release feed first (GitHub's unauthenticated limit is 60 an
 * hour per IP), and on any feed failure asks GitHub exactly as before. The feed only picks the
 * release: a download it names still has to pass the same lock as one GitHub names.
 */
const FEED = 'https://api.unvibe.site/api/v1/releases';
const GITHUB = 'https://api.github.com/repos/ShadowEsu/Unvibe/releases?per_page=8';
const DOWNLOAD = 'https://github.com/ShadowEsu/Unvibe/releases/download';

function release(version: string, assetUrl = `${DOWNLOAD}/v${version}/Unvibe-${version}-mac-arm64.dmg`) {
  return {
    tag_name: `v${version}`,
    draft: false,
    html_url: `https://github.com/ShadowEsu/Unvibe/releases/tag/v${version}`,
    assets: [{ name: `Unvibe-${version}-mac-arm64.dmg`, browser_download_url: assetUrl }],
  };
}

type Responder = (init: RequestInit) => Response | Promise<Response>;

/** A fetch that answers the feed and GitHub separately and records which was asked, in order. */
function network(feed: Responder, github: Responder = () => Response.json([release('0.9.0')])) {
  const asked: string[] = [];
  const fetchImpl = async (url: string, init: RequestInit): Promise<Response> => {
    asked.push(url);
    if (url === FEED) return feed(init);
    if (url === GITHUB) return github(init);
    throw new Error(`Unexpected request: ${url}`);
  };
  return { asked, fetchImpl };
}

// pickAsset reads the running platform; CI runs on Linux, which has no installer to pick.
const realPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
const realArch = Object.getOwnPropertyDescriptor(process, 'arch')!;
beforeEach(() => {
  Object.defineProperty(process, 'platform', { ...realPlatform, value: 'darwin' });
  Object.defineProperty(process, 'arch', { ...realArch, value: 'arm64' });
});
afterEach(() => {
  Object.defineProperty(process, 'platform', realPlatform);
  Object.defineProperty(process, 'arch', realArch);
});

test('a working feed decides the update and GitHub is not asked', async () => {
  const { asked, fetchImpl } = network((init) => {
    assert.ok(init.signal instanceof AbortSignal && !init.signal.aborted, 'the feed request carries its own timeout');
    return Response.json([release('1.2.3')]);
  });
  const info = await checkForUpdate(true, { fetchImpl });
  assert.deepEqual(asked, [FEED]);
  assert.equal(info.available, true);
  assert.equal(info.latest, '1.2.3');
  assert.equal(info.url, `${DOWNLOAD}/v1.2.3/Unvibe-1.2.3-mac-arm64.dmg`);
  assert.equal(info.notesUrl, 'https://github.com/ShadowEsu/Unvibe/releases/tag/v1.2.3');
});

const malformed = { ...release('1.2.3'), assets: [{ name: 'Unvibe-1.2.3-mac-arm64.dmg' }] };
for (const [label, feed] of [
  ['a 502 from the feed', () => Response.json({ error: 'release_feed_unavailable' }, { status: 502 })],
  ['a 404 from the feed (an API without the route)', () => new Response('Not found', { status: 404 })],
  ['a feed body that is not JSON', () => new Response('<html>captive portal</html>', { status: 200 })],
  ['a feed body that is JSON but not a list', () => Response.json({ releases: [release('1.2.3')] })],
  ['a feed list holding an empty object', () => Response.json([{}])],
  ['a feed list where one release among good ones has an asset without a URL', () => Response.json([release('1.2.4'), malformed])],
  ['a feed list where one release has a string for draft', () => Response.json([release('1.2.4'), { ...release('1.2.3'), draft: 'false' }])],
  ['a feed that cannot be reached', () => Promise.reject(new TypeError('fetch failed'))],
] as Array<[string, Responder]>) {
  test(`${label} falls back to GitHub`, async () => {
    const { asked, fetchImpl } = network(feed);
    const info = await checkForUpdate(true, { fetchImpl });
    assert.deepEqual(asked, [FEED, GITHUB]);
    assert.equal(info.latest, '0.9.0', 'the answer comes from GitHub\'s list');
    assert.equal(info.url, `${DOWNLOAD}/v0.9.0/Unvibe-0.9.0-mac-arm64.dmg`);
  });
}

test('a feed that does not answer before its timeout is given up on, then GitHub answers', async () => {
  const timeout = new AbortController();
  let askedWhenTimedOut: string[] = [];
  const { asked, fetchImpl } = network((init) => {
    assert.equal(init.signal, timeout.signal, 'the feed request is bounded by the timeout signal');
    // Executor form: the app's lib is ES2022, which has no Promise.withResolvers.
    const pending = new Promise<Response>((_, reject) => {
      timeout.signal.addEventListener('abort', () => {
        askedWhenTimedOut = [...asked];
        reject(timeout.signal.reason);
      });
    });
    queueMicrotask(() => timeout.abort(new DOMException('The operation was aborted due to timeout', 'TimeoutError')));
    return pending;
  });
  const info = await checkForUpdate(true, { fetchImpl, feedSignal: timeout.signal });
  assert.deepEqual(askedWhenTimedOut, [FEED], 'GitHub is not asked while the feed is still pending');
  assert.deepEqual(asked, [FEED, GITHUB]);
  assert.equal(info.latest, '0.9.0');
});

test('when the feed and GitHub both fail, the check fails instead of reporting no update', async () => {
  const { asked, fetchImpl } = network(
    () => new Response('bad gateway', { status: 502 }),
    () => Response.json({ message: 'API rate limit exceeded' }, { status: 403 }),
  );
  await assert.rejects(checkForUpdate(true, { fetchImpl }), /Update check failed \(403\)/);
  assert.deepEqual(asked, [FEED, GITHUB]);
});

test('an older build labelled with a newer tag is not offered, from the feed or from GitHub (Windows has no version check after download)', async () => {
  Object.defineProperty(process, 'platform', { ...realPlatform, value: 'win32' });
  Object.defineProperty(process, 'arch', { ...realArch, value: 'x64' });
  const relabelled = {
    ...release('9.9.9'),
    assets: [
      { name: 'Unvibe-0.1.40-win-x64-setup.exe', browser_download_url: `${DOWNLOAD}/v0.1.40/Unvibe-0.1.40-win-x64-setup.exe` },
      { name: 'SHA256SUMS-windows.txt', browser_download_url: `${DOWNLOAD}/v0.1.40/SHA256SUMS-windows.txt` },
    ],
  };
  const fromFeed = network(() => Response.json([relabelled]));
  assert.deepEqual(await checkForUpdate(true, { fetchImpl: fromFeed.fetchImpl }), { available: false, current: '0.0.0-test' });
  assert.deepEqual(fromFeed.asked, [FEED], 'the feed answered; the release was skipped, not the feed');

  const fromGitHub = network(() => new Response('bad gateway', { status: 502 }), () => Response.json([relabelled]));
  assert.deepEqual(await checkForUpdate(true, { fetchImpl: fromGitHub.fetchImpl }), { available: false, current: '0.0.0-test' });
  assert.deepEqual(fromGitHub.asked, [FEED, GITHUB]);
});

test('a download in its own release folder is matched against the tag as decoded, so an escaped tag still counts', async () => {
  const tagged = {
    ...release('1.2.3'),
    tag_name: 'v1.2.3+mac',
    assets: [{ name: 'Unvibe-1.2.3-mac-arm64.dmg', browser_download_url: `${DOWNLOAD}/v1.2.3%2Bmac/Unvibe-1.2.3-mac-arm64.dmg` }],
  };
  const { fetchImpl } = network(() => Response.json([tagged]));
  const info = await checkForUpdate(true, { fetchImpl });
  assert.equal(info.available, true);
  assert.equal(info.url, `${DOWNLOAD}/v1.2.3%2Bmac/Unvibe-1.2.3-mac-arm64.dmg`);
});

test('a feed release whose download is outside the repository is not offered, and the download lock still refuses it', async () => {
  const workRoot = mkdtempSync(path.join(tmpdir(), 'unvibe-feed-lock-'));
  try {
    for (const assetUrl of [
      'https://evil.example/ShadowEsu/Unvibe/releases/download/v1.2.3/Unvibe-1.2.3-mac-arm64.dmg',
      `${DOWNLOAD}/v1.2.3/../../../../attacker/repo/releases/download/v1.2.3/Unvibe-1.2.3-mac-arm64.dmg`,
    ]) {
      const { asked, fetchImpl } = network(() => Response.json([release('1.2.3', assetUrl)]));
      assert.deepEqual(await checkForUpdate(true, { fetchImpl }), { available: false, current: '0.0.0-test' });
      assert.deepEqual(asked, [FEED]);
      // Even if a release with this address were offered, the unchanged lock refuses it before any download.
      const downloads: string[] = [];
      const result = await prepareUpdate({ available: true, current: '0.0.0-test', latest: '1.2.3', url: assetUrl }, {
        platform: 'darwin',
        pid: 1,
        macTarget: path.join(workRoot, 'Unvibe.app'),
        workRoot,
        fetchImpl: async (url) => {
          downloads.push(url);
          throw new Error('nothing may be downloaded');
        },
      });
      assert.deepEqual(result, { ok: false, error: 'Refusing to download an update from an unexpected address.' });
      assert.deepEqual(downloads, []);
    }
  } finally {
    rmSync(workRoot, { recursive: true, force: true });
  }
});
