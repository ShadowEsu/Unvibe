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
