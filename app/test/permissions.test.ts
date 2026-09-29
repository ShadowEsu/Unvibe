import test from 'node:test';
import assert from 'node:assert/strict';
import { allowPermission, isSafeExternalUrl, isTrustedSenderUrl } from '../src/core/permissions';

test('only bundled pages are trusted IPC senders', () => {
  assert.equal(isTrustedSenderUrl('file:///Applications/Unvibe.app/Contents/Resources/app/dist/renderer/widget/widget.html'), true);
  assert.equal(isTrustedSenderUrl('https://evil.example/'), false);
  assert.equal(isTrustedSenderUrl(''), false);
  assert.equal(isTrustedSenderUrl(undefined), false);
});

test('renderer permissions allow clipboard writes and audio only', () => {
  const page = 'file:///app/widget.html';
  assert.equal(allowPermission('clipboard-sanitized-write', page), true);
  assert.equal(allowPermission('media', page, ['audio']), true);
  assert.equal(allowPermission('media', page, ['audio', 'video']), false);
  assert.equal(allowPermission('media', page, []), false);
  assert.equal(allowPermission('geolocation', page), false);
  assert.equal(allowPermission('notifications', page), false);
  assert.equal(allowPermission('clipboard-sanitized-write', 'https://evil.example/'), false);
});

test('only https and mailto links open externally', () => {
  assert.equal(isSafeExternalUrl('https://unvibe.site/help'), true);
  assert.equal(isSafeExternalUrl('mailto:support@unvibe.site'), true);
  assert.equal(isSafeExternalUrl('http://insecure.example'), false);
  assert.equal(isSafeExternalUrl('file:///etc/passwd'), false);
  assert.equal(isSafeExternalUrl('javascript:alert(1)'), false);
});
