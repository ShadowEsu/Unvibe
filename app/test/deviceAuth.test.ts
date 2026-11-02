import assert from 'node:assert/strict';
import test from 'node:test';
import { deviceVerificationUrl } from '../src/core/deviceAuth';

const API = 'https://api.unvibe.site';

test('device auth preserves the activation path and encodes only the user code', () => {
  assert.equal(
    deviceVerificationUrl('https://api.unvibe.site/activate?source=desktop', 'A B+C', API),
    'https://api.unvibe.site/activate?source=desktop&user_code=A+B%2BC',
  );
});

test('device auth refuses a non-HTTPS verification page', () => {
  assert.throws(() => deviceVerificationUrl('http://localhost:8787/activate', 'ABC123', 'http://localhost:8787'), /HTTPS/);
});

test('device auth opens only the activate page on the API the app signs in with', () => {
  assert.equal(deviceVerificationUrl('https://api.unvibe.site/activate/', 'ABC123', `${API}/`), 'https://api.unvibe.site/activate/?user_code=ABC123');
  for (const elsewhere of [
    'https://evil.example/activate', // another host
    'https://unvibe.site/activate', // the site, not the API
    'https://api.unvibe.site.evil.example/activate', // a lookalike suffix
    'https://api.unvibe.site:8443/activate', // another port
    'https://user@evil.example/activate', // userinfo trick
    'https://api.unvibe.site/oauth/callback', // right host, wrong page
    'https://api.unvibe.site/activate/../account', // normalises to /account
    'https://api.unvibe.site/activate-evil', // a longer path that only starts with /activate
    'https://api.unvibe.site/activate/x', // a page under /activate
  ]) {
    assert.throws(() => deviceVerificationUrl(elsewhere, 'ABC123', API), /not on Unvibe's service/, elsewhere);
  }
});
