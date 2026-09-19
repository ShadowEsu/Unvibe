import test from 'node:test';
import assert from 'node:assert/strict';
import { analyticsPayloadSafe, formatCitation } from '../src/knowledge/citations';

test('citations stay inspectable without inventing sources', () => {
  assert.equal(formatCitation({ type: 'file', ref: 'auth/session.ts' }), 'file:auth/session.ts');
});

test('analytics payloads reject source-shaped keys', () => {
  assert.equal(analyticsPayloadSafe({ event: 'change_brief_opened', files: 3 }), true);
  assert.equal(analyticsPayloadSafe({ code: 'secret()' }), false);
});
