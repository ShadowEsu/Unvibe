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
