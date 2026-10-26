import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { DeletionNotice } from '../src/renderer/companion/deletionNotice';

function markup(message: string): string {
  return renderToStaticMarkup(createElement(DeletionNotice, { message }));
}

test('the service note after a deletion is shown as a status line', () => {
  const html = markup('Your account and app data are deleted. Any beta-download records will be removed within 30 days.');
  assert.equal(html, '<p class="login__card-copy" role="status">Your account and app data are deleted. Any beta-download records will be removed within 30 days.</p>');
});

test('markup in the note shows as text and never becomes HTML', () => {
  const html = markup('<img src=x onerror=alert(1)><b>done</b>');
  assert.doesNotMatch(html, /<img|<b>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;&lt;b&gt;done&lt;\/b&gt;/);
});

test('with no note, nothing is shown and the sign-in screen is unchanged', () => {
  assert.equal(markup(''), '');
});
