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
  const { asked, fetchImpl } = network(() => Response.json([release('1.2.3')]));
  const info = await checkForUpdate(true, fetchImpl);
  assert.deepEqual(asked, [FEED]);
  assert.equal(info.available, true);
  assert.equal(info.latest, '1.2.3');
  assert.equal(info.url, `${DOWNLOAD}/v1.2.3/Unvibe-1.2.3-mac-arm64.dmg`);
  assert.equal(info.notesUrl, 'https://github.com/ShadowEsu/Unvibe/releases/tag/v1.2.3');
});

for (const [label, feed] of [
  ['a 502 from the feed', () => Response.json({ error: 'release_feed_unavailable' }, { status: 502 })],
  ['a 404 from the feed (an API without the route)', () => new Response('Not found', { status: 404 })],
  ['a feed body that is not JSON', () => new Response('<html>captive portal</html>', { status: 200 })],
  ['a feed body that is JSON but not a list', () => Response.json({ releases: [release('1.2.3')] })],
  ['a feed that cannot be reached', () => Promise.reject(new TypeError('fetch failed'))],
] as Array<[string, Responder]>) {
  test(`${label} falls back to GitHub`, async () => {
    const { asked, fetchImpl } = network(feed);
    const info = await checkForUpdate(true, fetchImpl);
    assert.deepEqual(asked, [FEED, GITHUB]);
    assert.equal(info.latest, '0.9.0', 'the answer comes from GitHub\'s list');
    assert.equal(info.url, `${DOWNLOAD}/v0.9.0/Unvibe-0.9.0-mac-arm64.dmg`);
  });
}

test('a feed that hangs is given up on after 5 seconds, then GitHub answers', async () => {
  const hang: Responder = (init) => new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(init.signal?.reason)));
  const { asked, fetchImpl } = network(hang);
  const started = Date.now();
  const info = await checkForUpdate(true, fetchImpl);
  const waited = Date.now() - started;
  assert.deepEqual(asked, [FEED, GITHUB]);
  assert.equal(info.latest, '0.9.0');
  assert.ok(waited >= 4500 && waited < 7500, `gave up on the feed after ${waited} ms`);
});

test('when the feed and GitHub both fail, the check fails instead of reporting no update', async () => {
  const { asked, fetchImpl } = network(
    () => new Response('bad gateway', { status: 502 }),
    () => Response.json({ message: 'API rate limit exceeded' }, { status: 403 }),
  );
  await assert.rejects(checkForUpdate(true, fetchImpl), /Update check failed \(403\)/);
  assert.deepEqual(asked, [FEED, GITHUB]);
});

test('a feed release whose download is outside the repository is still refused before anything is downloaded', async () => {
  const workRoot = mkdtempSync(path.join(tmpdir(), 'unvibe-feed-lock-'));
  try {
    for (const assetUrl of [
      'https://evil.example/ShadowEsu/Unvibe/releases/download/v1.2.3/Unvibe-1.2.3-mac-arm64.dmg',
      `${DOWNLOAD}/v1.2.3/../../../../attacker/repo/releases/download/x/Unvibe-1.2.3-mac-arm64.dmg`,
    ]) {
      const { fetchImpl } = network(() => Response.json([release('1.2.3', assetUrl)]));
      const info = await checkForUpdate(true, fetchImpl);
      assert.equal(info.url, assetUrl, 'the feed picked this download');
      const downloads: string[] = [];
      const result = await prepareUpdate(info, {
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
