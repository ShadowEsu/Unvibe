import test from 'node:test';
import assert from 'node:assert/strict';
import { scanText, hasBlocking } from '../src/core/secretFilter';

test('blocks known credential patterns', () => {
  const findings = scanText('const key = "AKIAIOSFODNN7EXAMPLE";', 'x.ts');
  assert.ok(hasBlocking(findings));
  assert.ok(findings.every((f) => !f.masked.includes('AKIAIOSFODNN7EXAMPLE')));
});

test('clean code produces no findings', () => {
  const findings = scanText('function add(a: number, b: number) { return a + b; }', 'x.ts');
  assert.equal(findings.length, 0);
});

test('blocks modern provider keys and connection strings', () => {
  const samples: Array<[string, string]> = [
    ['openai-key', `const k = "sk-proj-${'a1B2'.repeat(12)}";`],
    ['anthropic-key', `ANTHROPIC="sk-ant-api03-${'Zx9_'.repeat(10)}"`],
    ['stripe-restricted-key', `rk_live_${'4eC39HqLyjWDarjtT1zdp7dc'}`],
    ['stripe-webhook-secret', `whsec_${'abcdEFGH1234'.repeat(3)}`],
    ['gitlab-token', `token: glpat-${'xY7_'.repeat(6)}`],
    ['npm-token', `//registry.npmjs.org/:_authToken=npm_${'A1b2C3d4E5'.repeat(3)}abcdef`],
    ['huggingface-token', `hf_${'QwErTy'.repeat(6)}`],
    ['sendgrid-key', `SG.${'a'.repeat(22)}.${'B'.repeat(43)}`],
    ['google-oauth-secret', `GOCSPX-${'k9_Lm'.repeat(6)}`],
    ['digitalocean-token', `dop_v1_${'ab12'.repeat(16)}`],
    ['shopify-token', `shpat_${'0f'.repeat(16)}`],
    ['database-url-password', 'DATABASE_URL=postgres://admin:hunter2secret@db.example.com:5432/app'],
    ['azure-storage-key', `DefaultEndpointsProtocol=https;AccountName=x;AccountKey=${'Ab12'.repeat(22)}==`],
  ];
  for (const [rule, line] of samples) {
    const findings = scanText(line, 'x.env');
    assert.ok(findings.some((f) => f.rule === rule && f.severity === 'block'), `expected ${rule} to block`);
    assert.ok(findings.every((f) => !f.masked.includes(line.slice(-12))), `${rule} must be masked`);
  }
});

test('does not flag ordinary code that merely looks similar', () => {
  const clean = [
    'const task = "sk-learn is a Python library";',
    'const url = "postgres://localhost/app";',
    'import { shape } from "./shapes";',
  ];
  for (const line of clean) {
    assert.equal(hasBlocking(scanText(line, 'x.ts')), false, line);
  }
});
