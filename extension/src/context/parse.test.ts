import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractImports, detectLanguage } from './parse';

test('extracts TS/JS imports', () => {
  const src = `import { a } from './a';\nimport b from 'b';\nconst c = require('c');\nconst x = 1;`;
  const imports = extractImports(src);
  assert.equal(imports.length, 3);
  assert.equal(imports.includes("import { a } from './a';"), true);
});

test('extracts Python imports', () => {
  const src = `from os import path\nimport sys\nx = 1`;
  const imports = extractImports(src);
  assert.equal(imports.includes('from os import path'), true);
  assert.equal(imports.includes('import sys'), true);
});

test('de-duplicates and ignores non-imports', () => {
  const src = `import a from 'a';\nimport a from 'a';\nconst y = 2;`;
  const imports = extractImports(src);
  assert.equal(imports.length, 1);
});

test('detectLanguage maps common extensions', () => {
  assert.equal(detectLanguage('src/foo.ts'), 'typescript');
  assert.equal(detectLanguage('a/b/c.py'), 'python');
  assert.equal(detectLanguage('main.go'), 'go');
  assert.equal(detectLanguage('noext'), 'unknown');
  assert.equal(detectLanguage(undefined), 'unknown');
});
