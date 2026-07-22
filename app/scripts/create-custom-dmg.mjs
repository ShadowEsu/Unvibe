import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

function fail(message) {
  throw new Error(`custom DMG: ${message}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: 'utf8', ...options });
  if (result.status !== 0) {
    fail(`${basename(command)} failed\n${result.stderr || result.stdout || ''}`.trim());
  }
  return result.stdout;
}

const appPath = resolve(process.argv[2] || 'release/mac-arm64/Unvibe.app');
const outputPath = resolve(process.argv[3] || 'release/Unvibe-0.1.0-arm64-unsigned.dmg');
const backgroundPath = resolve(process.argv[4] || 'build/dmg-background.png');
const volumeIconPath = resolve('build/icon.icns');
const volumeName = 'Install Unvibe';

if (!existsSync(appPath)) fail(`app bundle does not exist: ${appPath}`);
if (!existsSync(backgroundPath)) fail(`background does not exist: ${backgroundPath}`);
if (!existsSync(volumeIconPath)) fail(`volume icon does not exist: ${volumeIconPath}`);

const work = mkdtempSync(join(tmpdir(), 'unvibe-custom-dmg-'));
const stage = join(work, 'stage');
const writableDmg = join(work, 'Unvibe-layout.dmg');
const mountPath = join('/Volumes', volumeName);
let device = '';

try {
  if (existsSync(mountPath)) fail(`${mountPath} is already mounted; eject it and retry.`);
  mkdirSync(join(stage, '.background'), { recursive: true });
  run('/usr/bin/ditto', [appPath, join(stage, 'Unvibe.app')]);
  cpSync(backgroundPath, join(stage, '.background', 'dmg-background.png'));
  cpSync(volumeIconPath, join(stage, '.VolumeIcon.icns'));
  symlinkSync('/Applications', join(stage, 'Applications'));

  run('/usr/bin/hdiutil', [
    'create', '-ov', '-format', 'UDRW', '-fs', 'APFS',
    '-volname', volumeName, '-srcfolder', stage, writableDmg,
  ]);
  const attachOutput = run('/usr/bin/hdiutil', ['attach', '-readwrite', '-noverify', '-noautoopen', writableDmg]);
  device = attachOutput.match(/^\/dev\/disk\d+/m)?.[0] || '';
  if (!device || !existsSync(mountPath)) fail('mounted image could not be identified.');

  const appleScript = join(work, 'layout.applescript');
  writeFileSync(appleScript, `
set installerBackground to (POSIX file "${mountPath}/.background/dmg-background.png") as alias
tell application "Finder"
  tell disk "${volumeName}"
    open
    set current view of container window to icon view
    set toolbar visible of container window to false
    set statusbar visible of container window to false
    set bounds of container window to {400, 150, 1180, 710}
    tell icon view options of container window
      set arrangement to not arranged
      set icon size to 88
      set text size to 12
      set background picture to installerBackground
    end tell
    set position of item "Unvibe.app" to {230, 290}
    set position of item "Applications" to {550, 290}
    update without registering applications
    delay 2
    close container window
    delay 1
    open
    delay 1
  end tell
end tell
`);
  run('/usr/bin/osascript', [appleScript]);
  run('/usr/bin/SetFile', ['-a', 'C', mountPath], { stdio: 'ignore' });
  run('/usr/bin/hdiutil', ['detach', device]);
  device = '';

  mkdirSync(dirname(outputPath), { recursive: true });
  rmSync(outputPath, { force: true });
  const outputBase = outputPath.endsWith('.dmg') ? outputPath.slice(0, -4) : outputPath;
  run('/usr/bin/hdiutil', ['convert', writableDmg, '-ov', '-format', 'UDZO', '-imagekey', 'zlib-level=9', '-o', outputBase]);
  console.log(`Custom drag-to-Applications DMG: ${outputPath}`);
} finally {
  if (device) spawnSync('/usr/bin/hdiutil', ['detach', '-force', device], { stdio: 'ignore' });
  rmSync(work, { recursive: true, force: true });
}
