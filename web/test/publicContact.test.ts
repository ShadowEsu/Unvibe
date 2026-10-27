import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const TEXT = /\.(?:tsx?|jsx?|mjs|css|html?|txt|md|json|svg)$/;

function files(dir: string): string[] {
  return readdirSync(join(process.cwd(), dir), { recursive: true })
    .map((entry) => join(dir, String(entry)))
    .filter((path) => TEXT.test(path) && statSync(join(process.cwd(), path)).isFile());
}

test('the web app names no personal inbox in pages, API routes, libraries or public files', () => {
  const offenders = [...files('app'), ...files('src'), ...files('public')]
    .filter((path) => /preston@/i.test(readFileSync(join(process.cwd(), path), 'utf8')));
  assert.deepEqual(offenders, []);
});
