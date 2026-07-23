import assert from 'node:assert/strict';
import test from 'node:test';
import { createWebAppPayload, findSecret } from './webAppReview';

test('web app blocks credential-like selections before a request', () => {
  assert.deepEqual(findSecret('const key = "ghp_abcdefghijklmnopqrstuvwxyz123456";'), { label: 'GitHub token' });
  assert.match((createWebAppPayload({ code: 'password = "correct-horse-battery-staple"', language: 'python', level: 'new' }) as { error: string }).error, /will not be sent/);
});

test('web app builds a bounded selection payload', () => {
  const value = createWebAppPayload({ code: 'const answer = 42;', language: 'typescript', fileName: 'answer.ts', level: 'beginner' });
  assert.ok(!('error' in value));
  if ('error' in value) return;
  assert.equal(value.context.primaryFile, 'answer.ts');
  assert.equal(value.context.selection.endLine, 1);
});
