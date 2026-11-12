import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, rmSync, readdirSync, writeFileSync } from 'node:fs';

const testsOnly = process.argv.includes('--tests');
const releaseBackend = process.env.UNVIBE_BACKEND?.trim() ?? '';
const releaseTrialToken = process.env.UNVIBE_TRIAL_TOKEN?.trim() ?? '';
const releaseFullProduct = process.env.UNVIBE_FULL_PRODUCT === '1';

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
    // Main-process modules import Electron; tests get a recording stand-in instead of the real binary.
    alias: { electron: './test/electronStub.ts' },
    define: {
      'process.env.UNVIBE_RELEASE_BACKEND': JSON.stringify(''),
      'process.env.UNVIBE_RELEASE_TRIAL_TOKEN': JSON.stringify(''),
      'process.env.UNVIBE_RELEASE_FULL_PRODUCT': JSON.stringify(''),
    },
  });
  process.exit(0);
}

rmSync('dist', { recursive: true, force: true });

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
    'process.env.UNVIBE_RELEASE_BACKEND': JSON.stringify(releaseBackend),
    'process.env.UNVIBE_RELEASE_TRIAL_TOKEN': JSON.stringify(releaseTrialToken),
    'process.env.UNVIBE_RELEASE_FULL_PRODUCT': JSON.stringify(releaseFullProduct ? '1' : ''),
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
  cpSync(`src/renderer/${name}/${name}.html`, `dist/renderer/${name}/${name}.html`);
  const tokens = readFileSync('src/renderer/shared/tokens.css', 'utf8');
  const rings = readFileSync('src/renderer/shared/usageRings.css', 'utf8');
  const buddy = readFileSync('src/renderer/shared/buddy.css', 'utf8');
  const vibeBubble = readFileSync('src/renderer/shared/vibeBubble.css', 'utf8');
  const pasteTarget = readFileSync('src/renderer/shared/pasteTarget.css', 'utf8');
  const shortcutGuide = readFileSync('src/renderer/shared/shortcutGuide.css', 'utf8');
  const consentForm = readFileSync('src/renderer/shared/consentForm.css', 'utf8');
  const css = readFileSync(`src/renderer/${name}/${name}.css`, 'utf8');
  // The companion's v3 design layer loads last so it wins over the older layers; the 0.1.51 redesign (app-0151.css) after v7.
  const v3 = name === 'companion' ? `\n${readFileSync('src/renderer/companion/v3.css', 'utf8')}\n${readFileSync('src/renderer/companion/v5.css', 'utf8')}\n${readFileSync('src/renderer/companion/v7.css', 'utf8')}\n${readFileSync('src/renderer/companion/app-0151.css', 'utf8')}` : '';
  // The round 3 flat looks (shared/look.css, keyed on html[data-look]) load last in every window.
  const look = readFileSync('src/renderer/shared/look.css', 'utf8');
  writeFileSync(`dist/renderer/${name}/${name}.css`, `${readFileSync('src/renderer/shared/fonts.css', 'utf8')}\n${tokens}\n${rings}\n${buddy}\n${vibeBubble}\n${pasteTarget}\n${shortcutGuide}\n${consentForm}\n${css}${v3}\n${look}`);
  for (const file of readdirSync(`src/renderer/${name}`).filter((f) => /\.(png|webp|ttf|woff2?|txt)$/i.test(f))) {
    cpSync(`src/renderer/${name}/${file}`, `dist/renderer/${name}/${file}`);
  }
}
// Bundled fonts so the interface never depends on a font CDN: one shared copy that every window's
// stylesheet reaches as ../fonts/. Each family's OFL.txt and FONTS.md travel with the files into the
// packaged app (package.json "files": dist/**), as OFL §2 requires.
cpSync('src/renderer/shared/fonts', 'dist/renderer/fonts', { recursive: true });
// Licences for code drawn into the renderer (the inlined Lucide icons, ISC) ship beside it the same way.
cpSync('src/renderer/shared/licences', 'dist/renderer/licences', { recursive: true });
mkdirSync('dist/assets', { recursive: true });
// Spectral icon set (Design spectral/icon): the app icon, the macOS menu-bar template and the Windows tray, each
// with an @2x that Electron picks on HiDPI.
for (const f of ['icon.png', 'icon.icns', 'trayTemplate.png', 'trayTemplate@2x.png', 'tray.png', 'tray@2x.png']) {
  try {
    cpSync(`build/${f}`, `dist/assets/${f}`);
  } catch {
    /* optional until icons exist */
  }
}
console.log('build ok');
