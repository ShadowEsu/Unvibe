// Builds the D5 selection helper for this system into native/dist (packaged by electron-builder as
// resources/selection-watch, package.json build.mac/win.extraResources). macOS: a universal binary from Swift
// (Xcode's swiftc). Windows: clang (LLVM ships on GitHub's Windows images) or, failing that, MSVC's cl.
// Elsewhere there is no helper, and the Unvibe button stays unavailable.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'dist');
mkdirSync(out, { recursive: true });
const run = (cmd, args) => execFileSync(cmd, args, { stdio: 'inherit' });

if (process.platform === 'darwin') {
  const src = path.join(here, 'selection-watch', 'mac', 'main.swift');
  const parts = [];
  for (const arch of ['arm64', 'x86_64']) {
    const part = path.join(out, `unvibe-selection-watch-${arch}`);
    run('xcrun', ['swiftc', '-O', '-target', `${arch}-apple-macos11.0`, '-o', part, src]);
    parts.push(part);
  }
  const bin = path.join(out, 'unvibe-selection-watch');
  run('lipo', ['-create', '-output', bin, ...parts]);
  for (const part of parts) rmSync(part);
  run('lipo', ['-info', bin]);
} else if (process.platform === 'win32') {
  const src = path.join(here, 'selection-watch', 'win', 'main.c');
  const bin = path.join(out, 'unvibe-selection-watch.exe');
  try {
    run('clang', ['-O2', '-Wall', '-o', bin, src, '-luser32']);
  } catch {
    run('cl', ['/nologo', '/O2', '/W3', `/Fe:${bin}`, src, 'user32.lib']);
  }
} else {
  console.log('selection helper: none on this system');
}
