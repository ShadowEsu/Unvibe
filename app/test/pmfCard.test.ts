import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { PmfCard, type PmfCardModel } from '../src/renderer/widget/pmfCard';
import { PMF_SECRET_BLOCKED } from '../src/core/pmf';

const noop = () => {};

function markup(model: Partial<PmfCardModel>): string {
  const full: PmfCardModel = {
    draft: { q1: 'very', q2: '', q3: 'sk-proj-flagged', q4: '' },
    stage: 'form',
    error: '',
    installId: '',
    ...model,
  };
  return renderToStaticMarkup(createElement(PmfCard, { model: full, onChange: noop, onSend: noop, onDismiss: noop, onClose: noop }));
}

function sendLabel(html: string): string | undefined {
  return html.match(/<button type="button" class="btn"[^>]*>([^<]*)<\/button>/)?.[1];
}

test('a secret block shows the message under the flagged answer, tied to it for screen readers', () => {
  const html = markup({ error: PMF_SECRET_BLOCKED, errorField: 'q3' });
  const field = html.match(/<textarea[^>]*aria-invalid="true"[^>]*>/g) ?? [];
  assert.equal(field.length, 1, 'only the flagged answer is marked invalid');
  assert.match(field[0]!, /aria-describedby="pmf-error-q3"/);
  const message = html.indexOf('id="pmf-error-q3"');
  assert.ok(message > html.indexOf(field[0]!), 'the message comes after the flagged field');
  assert.ok(message < html.indexOf('pmf-card__consent'), 'and before the consent line, not at the bottom');
  assert.equal(html.split('That looks like a key or password.').length - 1, 1, 'shown once');
  assert.equal(sendLabel(html), 'Send', 'the button says Send: the answer needs changing, not a retry');
});

test('a network failure shows the message by the buttons and offers Try again', () => {
  const html = markup({ error: 'Could not send. Your answers are still here, so you can try again.', retry: true });
  assert.doesNotMatch(html, /aria-invalid/);
  assert.match(html, /<p class="pmf-card__error" role="alert">Could not send\./);
  assert.equal(sendLabel(html), 'Try again');
});

test('any other refusal keeps the button as Send', () => {
  assert.equal(sendLabel(markup({ error: 'Your answers are a little too long. Shorten them and try again.' })), 'Send');
  assert.equal(sendLabel(markup({})), 'Send');
});
