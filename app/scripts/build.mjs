import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync, readdirSync } from 'node:fs';

const testsOnly = process.argv.includes('--tests');

if (testsOnly) {
  rmSync('dist-test', { recursive: true, force: true });
  await build({
    entryPoints: readdirSync('test')
      .filter((f) => f.endsWith('.test.ts'))
      .map((f) => `test/${f}`),
    outdir: 'dist-test',
    bundle: true,
    platform: 'node',
    format: 'cjs',
    target: 'node20',
  });
  process.exit(0);
}

rmSync('dist', { recursive: true, force: true });

// Release builds can bake a default backend via UNVIBE_BACKEND / RELEASE_BACKEND.
// Dev stays on localhost unless the process env overrides.
const bakedBackend =
  process.env.UNVIBE_BACKEND ||
  process.env.RELEASE_BACKEND ||
  'http://localhost:8788';

// Main process + preload (node/cjs, electron external)
await build({
  entryPoints: { 'main/main': 'src/main/main.ts', 'preload/preload': 'src/preload/preload.ts' },
  outdir: 'dist',
  outExtension: { '.js': '.cjs' },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node20',
  external: ['electron'],
  define: {
    __UNVIBE_BACKEND_DEFAULT__: JSON.stringify(bakedBackend),
  },
});

// Renderers (browser/iife) + static html/css
for (const name of ['bar', 'widget', 'companion']) {
  await build({
    entryPoints: [`src/renderer/${name}/${name}.tsx`],
    outfile: `dist/renderer/${name}/${name}.js`,
    bundle: true,
    platform: 'browser',
    format: 'iife',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  mkdirSync(`dist/renderer/${name}`, { recursive: true });
  for (const ext of ['html', 'css']) {
    cpSync(`src/renderer/${name}/${name}.${ext}`, `dist/renderer/${name}/${name}.${ext}`);
  }
}
mkdirSync('dist/assets', { recursive: true });
for (const f of ['icon.png', 'icon.icns', 'icon.ico', 'trayTemplate.png']) {
  try {
    cpSync(`build/${f}`, `dist/assets/${f}`);
  } catch {
    /* optional until icons exist */
  }
}
console.log('build ok');
console.log('default backend:', bakedBackend);
