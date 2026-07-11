import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText, hasBlocking, shannonEntropy } from './secretFilter';

test('flags an AWS access key id as blocking', () => {
  const findings = scanText('const k = "AKIAIOSFODNN7EXAMPLE";', 'a.ts');
  assert.equal(findings.some((f) => f.rule === 'aws-access-key-id' && f.severity === 'block'), true);
  assert.equal(hasBlocking(findings), true);
});

test('flags a private key header as blocking', () => {
  const findings = scanText('-----BEGIN RSA PRIVATE KEY-----', 'id.pem');
  assert.equal(findings.some((f) => f.rule === 'private-key'), true);
  assert.equal(hasBlocking(findings), true);
});

test('flags a secret assignment as blocking', () => {
  const findings = scanText('apiKey = "sk_prod_9f8a7b6c5d4e3f2a1b0c"', 'cfg.ts');
  assert.equal(hasBlocking(findings), true);
});

test('flags a GitHub token', () => {
  const token = 'ghp_' + 'a'.repeat(36);
  const findings = scanText(`token: ${token}`, 'env.ts');
  assert.equal(findings.some((f) => f.rule === 'github-token'), true);
});

test('does not flag ordinary code', () => {
  const code = 'function add(a, b) {\n  return a + b;\n}\nconst total = add(1, 2);';
  const findings = scanText(code, 'math.ts');
  assert.equal(findings.length, 0);
  assert.equal(hasBlocking(findings), false);
});

test('does not block on a git commit hash (low-symbol hex)', () => {
  const findings = scanText('rev = 356a192b7913b04c54574d18c28d46e6395428ab', 'v.ts');
  assert.equal(hasBlocking(findings), false);
});

test('surfaces a high-entropy random string as suspect (not block)', () => {
  const random = 'k7Qz2R9pLmN4xW8vB1cD6yH0tJ3sF5gA7uE';
  const findings = scanText(`const blob = "${random}";`, 'blob.ts');
  assert.equal(findings.some((f) => f.severity === 'suspect'), true);
  assert.equal(hasBlocking(findings), false);
});

test('masking never reveals the full secret', () => {
  const findings = scanText('const k = "AKIAIOSFODNN7EXAMPLE";', 'a.ts');
  assert.equal(findings[0].masked.includes('AKIAIOSFODNN7EXAMPLE'), false);
  assert.equal(findings[0].masked.includes('*'), true);
});

test('shannonEntropy: uniform random > repeated char', () => {
  assert.equal(shannonEntropy('aaaaaaaa') < 1, true);
  assert.equal(shannonEntropy('a7Qz2R9pLmN4xW8v') > 3, true);
});
