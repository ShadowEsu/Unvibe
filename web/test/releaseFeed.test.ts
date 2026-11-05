import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { GET } from '../app/api/v1/releases/route';

// The desktop app's update feed (ledger 453): GitHub's unauthenticated limit is 60 an hour per IP,
// so the list is served from our CDN. Only what the updater reads, only assets from our releases,
// and a GitHub failure must never be cached or look like "no update".
const previousFetch = globalThis.fetch;
const DOWNLOAD = 'https://github.com/ShadowEsu/Unvibe/releases/download/app-v0.1.50';
const requests: Array<{ url: string; init?: RequestInit }> = [];

function upstream(respond: () => Response | Promise<Response>): void {
  requests.length = 0;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return respond();
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = previousFetch;
});

const githubRelease = {
  url: 'https://api.github.com/repos/ShadowEsu/Unvibe/releases/1',
  id: 1,
  tag_name: 'app-v0.1.50',
  name: 'Unvibe 0.1.50',
  draft: false,
  prerelease: false,
  html_url: 'https://github.com/ShadowEsu/Unvibe/releases/tag/app-v0.1.50',
  body: 'notes',
  author: { login: 'ShadowEsu', id: 7 },
  assets: [
    { id: 11, name: 'Unvibe-0.1.50-arm64.dmg', size: 100, download_count: 3, uploader: { login: 'bot' }, browser_download_url: `${DOWNLOAD}/Unvibe-0.1.50-arm64.dmg` },
    { id: 12, name: 'SHA256SUMS-mac.txt', size: 1, browser_download_url: `${DOWNLOAD}/SHA256SUMS-mac.txt` },
  ],
};

test('the feed fetches the repository release list and keeps only the fields the updater reads, with CDN caching', async () => {
  upstream(() => Response.json([githubRelease]));
  const res = await GET();
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'public, s-maxage=300, stale-while-revalidate=600');
  assert.deepEqual(await res.json(), [
    {
      tag_name: 'app-v0.1.50',
      draft: false,
      html_url: 'https://github.com/ShadowEsu/Unvibe/releases/tag/app-v0.1.50',
      assets: [
        { name: 'Unvibe-0.1.50-arm64.dmg', browser_download_url: `${DOWNLOAD}/Unvibe-0.1.50-arm64.dmg` },
        { name: 'SHA256SUMS-mac.txt', browser_download_url: `${DOWNLOAD}/SHA256SUMS-mac.txt` },
      ],
    },
  ]);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.github.com/repos/ShadowEsu/Unvibe/releases?per_page=8');
  const headers = new Headers(requests[0].init?.headers);
  assert.ok(headers.get('user-agent'), 'GitHub refuses requests without a User-Agent');
  assert.equal(headers.get('authorization'), null, 'no token is sent');
});

test('assets outside this repository\'s release downloads are dropped, including dot-segment escapes', async () => {
  upstream(() => Response.json([{
    ...githubRelease,
    assets: [
      { name: 'Unvibe-0.1.50-arm64.dmg', browser_download_url: `${DOWNLOAD}/Unvibe-0.1.50-arm64.dmg` },
      { name: 'Unvibe-0.1.50-x64.dmg', browser_download_url: 'https://evil.example/ShadowEsu/Unvibe/releases/download/app-v0.1.50/Unvibe-0.1.50-x64.dmg' },
      { name: 'Unvibe-0.1.50.exe', browser_download_url: 'https://github.com/someone-else/Unvibe/releases/download/app-v0.1.50/Unvibe-0.1.50.exe' },
      { name: 'Unvibe-0.1.50-portable.exe', browser_download_url: `${DOWNLOAD}/../../../../attacker/repo/releases/download/x/Unvibe-0.1.50-portable.exe` },
      { name: 'Unvibe-0.1.50-http.dmg', browser_download_url: 'http://github.com/ShadowEsu/Unvibe/releases/download/app-v0.1.50/Unvibe-0.1.50-http.dmg' },
      { name: 'no-url.dmg' },
    ],
  }]));
  const res = await GET();
  assert.equal(res.status, 200);
  const [release] = (await res.json()) as Array<{ assets: Array<{ name: string }> }>;
  assert.deepEqual(release.assets.map((a) => a.name), ['Unvibe-0.1.50-arm64.dmg']);
});

test('assets are bound to their own release: another tag\'s folder, a subfolder or a query string is dropped', async () => {
  upstream(() => Response.json([{
    ...githubRelease,
    assets: [
      { name: 'Unvibe-0.1.50-arm64.dmg', browser_download_url: `${DOWNLOAD}/Unvibe-0.1.50-arm64.dmg` },
      { name: 'Unvibe-0.1.40-win-x64-setup.exe', browser_download_url: 'https://github.com/ShadowEsu/Unvibe/releases/download/app-v0.1.40/Unvibe-0.1.40-win-x64-setup.exe' },
      { name: 'SHA256SUMS-windows.txt', browser_download_url: 'https://github.com/ShadowEsu/Unvibe/releases/download/app-v0.1.40/SHA256SUMS-windows.txt' },
      { name: 'nested.dmg', browser_download_url: `${DOWNLOAD}/sub/nested.dmg` },
      { name: 'query.dmg', browser_download_url: `${DOWNLOAD}/query.dmg?x=1` },
      { name: 'tag-page.dmg', browser_download_url: 'https://github.com/ShadowEsu/Unvibe/releases/tag/app-v0.1.50/tag-page.dmg' },
    ],
  }]));
  const res = await GET();
  assert.equal(res.status, 200);
  const [release] = (await res.json()) as Array<{ assets: Array<{ name: string }> }>;
  assert.deepEqual(release.assets.map((a) => a.name), ['Unvibe-0.1.50-arm64.dmg']);
});

test('a release whose page is not its own tag\'s page on this repository is dropped; an escaped tag still matches', async () => {
  const escaped = {
    ...githubRelease,
    tag_name: 'v1.2.3+mac',
    html_url: 'https://github.com/ShadowEsu/Unvibe/releases/tag/v1.2.3%2Bmac',
    assets: [{ name: 'Unvibe-1.2.3-mac-arm64.dmg', browser_download_url: 'https://github.com/ShadowEsu/Unvibe/releases/download/v1.2.3%2Bmac/Unvibe-1.2.3-mac-arm64.dmg' }],
  };
  upstream(() => Response.json([
    { ...githubRelease, tag_name: 'v9.9.9', html_url: 'https://github.com/ShadowEsu/Unvibe/releases/tag/app-v0.1.50' },
    { ...githubRelease, html_url: 'https://evil.example/ShadowEsu/Unvibe/releases/tag/app-v0.1.50' },
    { ...githubRelease, html_url: 'https://github.com/someone-else/Unvibe/releases/tag/app-v0.1.50' },
    { ...githubRelease, html_url: 'https://github.com/ShadowEsu/Unvibe/releases/tag/app-v0.1.50/extra' },
    escaped,
  ]));
  const res = await GET();
  assert.equal(res.status, 200);
  const body = (await res.json()) as Array<{ tag_name: string; html_url: string; assets: Array<{ browser_download_url: string }> }>;
  assert.deepEqual(body.map((r) => r.tag_name), ['v1.2.3+mac']);
  assert.equal(body[0].html_url, escaped.html_url);
  assert.deepEqual(body[0].assets.map((a) => a.browser_download_url), [escaped.assets[0].browser_download_url]);
});

for (const [label, respond] of [
  ['a rate-limited GitHub (403)', () => Response.json({ message: 'API rate limit exceeded' }, { status: 403 })],
  ['a GitHub server error (500)', () => new Response('boom', { status: 500 })],
  ['a body that is not JSON', () => new Response('<html>', { status: 200 })],
  ['a JSON body that is not a list', () => Response.json({ message: 'Not Found' })],
  ['a network failure', () => Promise.reject(new TypeError('fetch failed'))],
] as const) {
  test(`${label} is a 502 that is never cached, not an empty list`, async () => {
    upstream(respond);
    const res = await GET();
    assert.equal(res.status, 502);
    assert.equal(res.headers.get('cache-control'), 'no-store');
    const body = await res.json();
    assert.ok(!Array.isArray(body), 'an error is never shaped like a release list');
    assert.equal(typeof body.error, 'string');
  });
}
