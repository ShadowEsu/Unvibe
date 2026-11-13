import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

// The windows load nothing from the network by themselves: opening one must not tell Google (fonts)
// or anyone else the user's IP address. Every file they load ships in the app (Security, QA M6).
// The bundled test runs from dist-test/, so the sources are one level up.
const RENDERER = path.resolve(__dirname, '../src/renderer');
// Keywords and schemes a renderer CSP may allow. No host, no https:, no wildcard.
const CSP_ALLOWED: Record<string, true> = { "'self'": true, "'none'": true, 'data:': true };
const REMOTE = String.raw`(?:https?:)?\/\/`;
const REMOTE_REFERENCES = [
  new RegExp(String.raw`\b(?:href|src|srcset)\s*=\s*["']?\s*${REMOTE}`, 'gi'),
  new RegExp(String.raw`@import\s+(?:url\(\s*)?["']?\s*${REMOTE}`, 'gi'),
  new RegExp(String.raw`url\(\s*["']?\s*${REMOTE}`, 'gi'),
];

function rendererFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return rendererFiles(full);
    return /\.(html|css)$/i.test(entry.name) ? [full] : [];
  });
}

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split('\n').length;
}

test('renderer html and css load nothing from a remote origin, and every CSP allows no host', () => {
  const files = rendererFiles(RENDERER);
  assert.ok(files.some((f) => f.endsWith('.html')) && files.some((f) => f.endsWith('.css')), `no renderer files under ${RENDERER}`);
  const problems: string[] = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const name = path.relative(RENDERER, file);
    for (const pattern of REMOTE_REFERENCES) {
      for (const match of text.matchAll(pattern)) {
        problems.push(`${name}:${lineOf(text, match.index ?? 0)} remote reference: ${text.slice(match.index, (match.index ?? 0) + 90).split('\n')[0]}`);
      }
    }
    if (!file.endsWith('.html')) continue;
    const policies = [...text.matchAll(/<meta\b[^>]*>/gi)]
      .filter((meta) => /http-equiv\s*=\s*["']content-security-policy["']/i.test(meta[0]))
      .map((meta) => ({ at: lineOf(text, meta.index ?? 0), content: /\bcontent\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(meta[0]) }));
    if (policies.length === 0) problems.push(`${name}: no Content-Security-Policy meta`);
    for (const { at, content } of policies) {
      if (!content) {
        problems.push(`${name}:${at} CSP meta without content`);
        continue;
      }
      const directives = (content[1] ?? content[2]).split(';').map((d) => d.trim().split(/\s+/));
      // Without default-src 'none', anything the policy doesn't name (a font or style added from code)
      // would load from anywhere.
      if (!directives.some(([directiveName, ...sources]) => directiveName === 'default-src' && sources.join(' ') === "'none'")) {
        problems.push(`${name}:${at} CSP has no default-src 'none'`);
      }
      for (const [directiveName, ...sources] of directives) {
        for (const source of sources.filter((s) => CSP_ALLOWED[s] !== true)) {
          problems.push(`${name}:${at} CSP ${directiveName} allows ${source}`);
        }
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('every bundled font fonts.css points at ships in shared/fonts', () => {
  // build.mjs copies shared/fonts/ to dist/renderer/fonts/, and fonts.css is read from
  // dist/renderer/<window>/, so "../fonts/x" is shared/fonts/x. A missing file falls back to a system font.
  const css = readFileSync(path.join(RENDERER, 'shared/fonts.css'), 'utf8');
  const urls = [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)].map((m) => m[1]);
  // Spectral bundles one typeface (JetBrains Mono); an empty list would make the check below pass vacuously.
  assert.ok(urls.length >= 1, `expected the bundled font urls, found ${urls.length}`);
  const missing = urls.filter((url) => !url.startsWith('../fonts/') || !existsSync(path.join(RENDERER, 'shared/fonts', url.slice('../fonts/'.length))));
  assert.deepEqual(missing, []);
});
