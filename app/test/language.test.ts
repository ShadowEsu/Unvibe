import assert from 'node:assert/strict';
import test from 'node:test';
import { detectLanguage, guessLanguage } from '../src/core/language';

test('language detection trusts file metadata over an ambiguous snippet', () => {
  const code = 'const std::string label = "ready";';
  assert.deepEqual(detectLanguage(code, '/workspace/src/status.cpp'), {
    language: 'cpp',
    source: 'file-path',
  });
});

test('language detection covers common native and script extensions', () => {
  assert.equal(detectLanguage('', 'main.c').language, 'c');
  assert.equal(detectLanguage('', 'main.hpp').language, 'cpp');
  assert.equal(detectLanguage('', 'src/app.tsx').language, 'typescriptreact');
  assert.equal(detectLanguage('', 'scripts/release.sh').language, 'shell');
  assert.equal(detectLanguage('', 'database/query.sql').language, 'sql');
});

test('content fallback uses unknown instead of a confident false label', () => {
  assert.equal(guessLanguage('just a fragment without syntax'), 'unknown');
  assert.deepEqual(detectLanguage('just a fragment without syntax'), {
    language: 'unknown',
    source: 'unknown',
  });
});
