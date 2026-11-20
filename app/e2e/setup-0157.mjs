// The 0.1.57 setup's real-device rows that need no hosted AI (unvibe-app, requests/unvibe-qa/20261119-1814-…; draft
// #372 a9844bef, build-only run 44661013774). Run by real-device-test.yml (input rc0157=setup, ai off) on the Mac and
// on Windows. The laptop walks draw no window chrome (Xvfb), so these are the 1:1 captures Design §9 asks for:
//   Row 1 (Mac, 1180 × 780, light and dark): 1:1 crops of the top-left corner (traffic lights, Back, the bar's start)
//     and the top-right (the bar's end, "n / 4"). Pass: Back's chevron centred at x 94 on the lights' row (y 20) and
//     clear of the green light; the bar starts at 128 and ends at W-84; the counter ends 32 from the right.
//   Row 2 (Windows 11, 100 % and 150 %): the same two corners. Pass: Back's centre at x 26; the bar starts at 60 and
//     ends 210 from the right; the counter ends 154 from the right, clear of the caption buttons. The top row drags the
//     window, and Back still clicks (the real pointer). 150 % is Chromium's --force-device-scale-factor=1.5 on the
//     runner's 100 % display, not the Windows display setting (that needs a sign-out); the report says so.
//   Setup opens maximized on a first run (windows.ts createCompanion, `maximize: !onboarded`), so the corners are taken
//     maximized, then the window is restored as a person would (Windows: dragging the top row restores it under the
//     pointer; Mac: Window › Zoom) and the light corners taken again at the restored size. The drag row runs on the
//     restored window, pressing near the bar's right end (clear of the Island at the screen's top centre), and Back is
//     clicked only where it is on the screen. On the Mac a control comes first: the same drag on a Finder window.
//   Row 5 (fresh install): Skip → step 3 → Explain my clipboard, with code on the clipboard. Pass: the panel opens on
//     the agreement, and nothing is sent.
//   Row 4 (step 3, empty clipboard): Explain my clipboard shows "Your clipboard is empty. Copy some code first, then
//     try again." under the paste box. The message needs the agreement (before it nothing is read at all, so nothing
//     can be found empty), so the clipboard is emptied and checked first, then the row-5 agreement is given: that
//     reads the clipboard for a confirm sheet (nothing is sent before Explain), finds it empty and says so. Then
//     Explain my clipboard is pressed once more, the row as asked.
//   Row 3 (Mac, step 2): ⌘U by mistake, then ⌃U. Pass: only ⌃U starts an explanation. Before any agreement ⌃U opens
//     the panel on it and reads nothing, so this row is checked without the explanation's hosted call.
// The same row on the Mac also drags the top row and clicks Back (not asked; reported as its own row). The double-click
// row (step 2's "Explain this code" twice stays on 2 / 4) needs the sample's hosted call and is not here.
//
// NO hosted-AI call: "Explain this code" (step 2) is never pressed and no key but ⌘U and ⌃U is typed into the window
// (step 2's focus is that button, which only Return or Space press); the confirm sheet's Explain is never pressed; the
// app's net log is checked for AI paths (a PASS row). The agreement row 4 gives is in the run's own profile (qa- id,
// pre-flagged), after row 3.
//
// Env: UNVIBE_EXE, SHOTS_DIR, UNVIBE_OS (mac | windows; linux for a local run), SETUP57_PROFILE (base path; each
//      launch adds its own suffix) + SETUP57_ID (a qa- id the workflow pre-flags and flags again after), NETLOG_DIR
//      (outside SHOTS_DIR), API_HOST (default api.unvibe.site), MOUSE (the Mac's mouse helper, mouse.swift),
//      UNVIBE_APP_DIR (local run only).
import { launchApp } from './cdp-launch.mjs';
import { apiRequests, keepSummaryAndDrop, netLogArg } from './netlog.mjs';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

const exe = process.env.UNVIBE_EXE;
const appDir = process.env.UNVIBE_APP_DIR;
const os = process.env.UNVIBE_OS ?? (process.platform === 'darwin' ? 'mac' : process.platform === 'win32' ? 'windows' : 'linux');
const out = path.resolve(process.env.SHOTS_DIR ?? 'setup-0157');
const host = process.env.API_HOST ?? 'api.unvibe.site';
const netDir = path.resolve(process.env.NETLOG_DIR ?? mkdtempSync(path.join(tmpdir(), 'unvibe-setup0157-netlog-')));
if (!exe) throw new Error('Set UNVIBE_EXE');
if (process.env.QA_AI_OK === '1') throw new Error('setup-0157.mjs makes no hosted-AI call: run it with ai off');
if (os === 'mac' && !process.env.MOUSE) throw new Error('Set MOUSE (the Mac mouse helper) for the real-pointer rows');
if (`${netDir}${path.sep}`.startsWith(`${out}${path.sep}`)) throw new Error('NETLOG_DIR must be outside SHOTS_DIR: the raw net log is never uploaded');
mkdirSync(out, { recursive: true });
mkdirSync(netDir, { recursive: true });

const report = [];
let n = 0;
const line = (s) => { report.push(s); console.log(s); };
const log = (ok, step, detail = '') => line(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? `: ${detail}` : ''}`);
const note = (step, detail = '') => line(`NOTE  ${step}${detail ? `: ${detail}` : ''}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (e) => String(e?.message ?? e).split('\n')[0];
const r1 = (v) => Math.round(v * 10) / 10;
const near = (a, b, tol = 0.5) => a !== null && a !== undefined && Math.abs(a - b) <= tol;
async function waitFor(fn, ms = 5000, every = 250) {
  const t = Date.now();
  for (;;) {
    const v = await fn();
    if (v || Date.now() - t > ms) return v;
    await sleep(every);
  }
}
const file = (label, ext = 'png') => path.join(out, `${os}-${String(++n).padStart(2, '0')}-${label}.${ext}`);
const ps = (script) => execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8', timeout: 60000 }).trim();

// --- The screen --------------------------------------------------------------------------------------------------
/** The whole screen, for context next to each 1:1 crop. */
function desktop(label) {
  const f = file(`desktop-${label}`);
  try {
    if (os === 'mac') execFileSync('screencapture', ['-x', f]);
    else if (os === 'windows') ps(`Add-Type -AssemblyName System.Windows.Forms,System.Drawing; Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();' -Name D -Namespace W; [void][W.D]::SetProcessDPIAware(); $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save('${f}')`);
    else execFileSync('import', ['-window', 'root', f]);
  } catch (e) { note(`desktop still ${label}`, `not taken (${short(e)})`); }
}
/** A screen rectangle in device pixels, saved as it is (1:1: no scaling). */
function grab(f, x, y, w, h) {
  if (os === 'mac') execFileSync('screencapture', ['-x', `-R${x},${y},${w},${h}`, f]);
  else if (os === 'windows') ps(`Add-Type -AssemblyName System.Drawing; Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();' -Name D -Namespace W; [void][W.D]::SetProcessDPIAware(); $bmp=New-Object System.Drawing.Bitmap ${w},${h}; [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen(${x},${y},0,0,$bmp.Size); $bmp.Save('${f}')`);
  else execFileSync('import', ['-window', 'root', '-crop', `${w}x${h}+${x}+${y}`, '+repage', f]);
}
/**
 * Both runners start at 1024 × 768. Windows is too narrow there for the window at 150 %, and the Mac can't show the
 * restored 1180 × 780 window (Row 1's size): ask for 1920 × 1080 on Windows and the Mac's smallest mode of at least
 * 1280 × 860, and report it.
 */
function wideScreen() {
  if (os === 'mac') {
    try { note('Screen', execFileSync(process.env.MOUSE, ['display', '1280', '860'], { encoding: 'utf8', timeout: 30000 }).trim()); } catch (e) { note('Screen', `the mode was not changed (${short(e)})`); }
    return;
  }
  if (os !== 'windows') return;
  try {
    const result = ps([
      'Add-Type @"',
      'using System; using System.Runtime.InteropServices;',
      'public class Disp {',
      '  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)] public struct DEVMODE {',
      '    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmDeviceName;',
      '    public short dmSpecVersion; public short dmDriverVersion; public short dmSize; public short dmDriverExtra; public int dmFields;',
      '    public int dmPositionX; public int dmPositionY; public int dmDisplayOrientation; public int dmDisplayFixedOutput;',
      '    public short dmColor; public short dmDuplex; public short dmYResolution; public short dmTTOption; public short dmCollate;',
      '    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string dmFormName;',
      '    public short dmLogPixels; public int dmBitsPerPel; public int dmPelsWidth; public int dmPelsHeight; public int dmDisplayFlags; public int dmDisplayFrequency;',
      '    public int dmICMMethod; public int dmICMIntent; public int dmMediaType; public int dmDitherType; public int dmReserved1; public int dmReserved2; public int dmPanningWidth; public int dmPanningHeight;',
      '  }',
      '  [DllImport("user32.dll")] public static extern int EnumDisplaySettings(string d, int m, ref DEVMODE dm);',
      '  [DllImport("user32.dll")] public static extern int ChangeDisplaySettings(ref DEVMODE dm, int f);',
      '}',
      '"@',
      '$dm = New-Object Disp+DEVMODE; $dm.dmSize = [Runtime.InteropServices.Marshal]::SizeOf($dm)',
      '[void][Disp]::EnumDisplaySettings($null, -1, [ref]$dm); $was = "$($dm.dmPelsWidth)x$($dm.dmPelsHeight)"',
      '$dm.dmPelsWidth = 1920; $dm.dmPelsHeight = 1080; $dm.dmFields = 0x80000 -bor 0x100000',
      '$r = [Disp]::ChangeDisplaySettings([ref]$dm, 0)',
      'Add-Type -AssemblyName System.Windows.Forms; $b = [System.Windows.Forms.SystemInformation]::VirtualScreen',
      '"was $was; ChangeDisplaySettings 1920x1080 returned $r; screen now $($b.Width)x$($b.Height)"',
    ].join('\n'));
    note('Screen', result);
  } catch (e) { note('Screen', `1920 × 1080 not set (${short(e)})`); }
}

// --- PNG pixels (8-bit grey or colour, with or without alpha, not interlaced: what screencapture, .NET and ImageMagick
// write) ------------------------------------------------------------------------------------------------------------
function readPng(f) {
  const b = readFileSync(f);
  let p = 8;
  let w = 0, h = 0, depth = 0, type = 0, lace = 0;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const kind = b.toString('ascii', p + 4, p + 8);
    const data = b.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; lace = data[12]; }
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[type];
  if (depth !== 8 || !bpp || lace) throw new Error(`PNG ${path.basename(f)}: depth ${depth} type ${type} interlace ${lace} not read`);
  const stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const up = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = raw[src + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += up;
      else if (filter === 3) v += (a + up) >> 1;
      else if (filter === 4) {
        const q = a + up - c;
        const pa = Math.abs(q - a), pb = Math.abs(q - up), pc = Math.abs(q - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  const grey = type === 0 || type === 4;
  return { w, h, rgb: (x, y) => { const i = y * stride + x * bpp; return grey ? [px[i], px[i], px[i]] : [px[i], px[i + 1], px[i + 2]]; } };
}
const lum = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
/**
 * Pixels of a crop that match `test`, in the window's CSS px (crop pixel / scale + the crop's CSS origin), within a
 * CSS box. Returns the bounding box and centroid, or null.
 */
function find(img, k, origin, box, test) {
  let n = 0, sx = 0, sy = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const x0 = Math.max(0, Math.floor((box.x0 - origin.x) * k)), x1 = Math.min(img.w, Math.ceil((box.x1 - origin.x) * k));
  const y0 = Math.max(0, Math.floor((box.y0 - origin.y) * k)), y1 = Math.min(img.h, Math.ceil((box.y1 - origin.y) * k));
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    if (!test(img.rgb(x, y))) continue;
    n++; sx += x; sy += y;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  if (!n) return null;
  const css = (v, o) => r1(v / k + o);
  return { n, cx: css(sx / n + 0.5, origin.x), cy: css(sy / n + 0.5, origin.y), left: css(minX, origin.x), right: css(maxX + 1, origin.x), top: css(minY, origin.y), bottom: css(maxY + 1, origin.y) };
}
/** First pixel along a CSS row, from `from` towards `to`, that differs from the background by more than `d`. */
function edge(img, k, origin, y, from, to, bg, d) {
  const py = Math.round((y - origin.y) * k);
  const step = from < to ? 1 : -1;
  for (let x = Math.round((from - origin.x) * k); step > 0 ? x < (to - origin.x) * k : x > (to - origin.x) * k; x += step) {
    if (x < 0 || x >= img.w) continue;
    if (Math.abs(lum(img.rgb(x, py)) - bg) > d) return r1(x / k + origin.x + (step > 0 ? 0 : 1 / k));
  }
  return null;
}

// --- The operating system's pointer (as rc-0154.mjs) ---------------------------------------------------------------
let winScale = 1;
const ptrScript = path.join(tmpdir(), 'unvibe-setup0157-pointer.ps1');
if (os === 'windows') writeFileSync(ptrScript, [
  'param([string]$op, [int]$x1, [int]$y1, [int]$x2, [int]$y2, [int]$n)',
  'Add-Type @"',
  'using System; using System.Runtime.InteropServices;',
  'public class Ptr {',
  '  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();',
  '  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);',
  '  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);',
  '}',
  '"@',
  '[void][Ptr]::SetProcessDPIAware()',
  'if ($op -eq "move") { [void][Ptr]::SetCursorPos($x1, $y1) }',
  'if ($op -eq "click") { [void][Ptr]::SetCursorPos($x1, $y1); Start-Sleep -Milliseconds 120; for ($i = 0; $i -lt $n; $i++) { [Ptr]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 30; [Ptr]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60 } }',
  'if ($op -eq "drag") {',
  '  [void][Ptr]::SetCursorPos($x1, $y1); Start-Sleep -Milliseconds 120',
  '  [Ptr]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 80',
  '  for ($i = 1; $i -le 24; $i++) { [void][Ptr]::SetCursorPos([int]($x1 + ($x2 - $x1) * $i / 24), [int]($y1 + ($y2 - $y1) * $i / 24)); Start-Sleep -Milliseconds 20 }',
  '  [Ptr]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)',
  '}',
].join('\r\n'));
const px = (v) => String(Math.round(v * (os === 'windows' ? winScale : 1)));
const pointer = {
  drag(x1, y1, x2, y2) {
    if (os === 'mac') execFileSync(process.env.MOUSE, ['drag', px(x1), px(y1), px(x2), px(y2)]);
    else if (os === 'windows') execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ptrScript, 'drag', px(x1), px(y1), px(x2), px(y2), '1']);
    else {
      execFileSync('xdotool', ['mousemove', px(x1), px(y1), 'sleep', '0.12', 'mousedown', '1', 'sleep', '0.08']);
      for (let i = 1; i <= 24; i++) execFileSync('xdotool', ['mousemove', px(x1 + (x2 - x1) * i / 24), px(y1 + (y2 - y1) * i / 24), 'sleep', '0.02']);
      execFileSync('xdotool', ['mouseup', '1']);
    }
  },
  click(x, y) {
    if (os === 'mac') execFileSync(process.env.MOUSE, ['click', px(x), px(y), '1']);
    else if (os === 'windows') execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ptrScript, 'click', px(x), px(y), '0', '0', '1']);
    else execFileSync('xdotool', ['mousemove', px(x), px(y), 'sleep', '0.12', 'click', '1']);
  },
};

// --- The clipboard ---------------------------------------------------------------------------------------------------
// A local Linux run has no clipboard tool: Xvfb's clipboard starts with no owner (empty) and stays so. Row 5 doesn't
// need code copied (before the agreement nothing is read); there it's a note.
const SAMPLE = 'const qaSetupRow = [1, 2, 3].map((n) => n * 2);';
function setClipboard(text) {
  if (os === 'mac') execFileSync('pbcopy', { input: text });
  else if (os === 'windows') {
    if (text) execFileSync('powershell', ['-NoProfile', '-Command', '[Console]::In.ReadToEnd() | Set-Clipboard'], { input: text });
    else ps('Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::Clear()');
  } else if (text) note('Clipboard', 'a local Linux run copies nothing (no clipboard tool); the clipboard stays empty');
}
function readClipboard() {
  if (os === 'mac') return execFileSync('pbpaste', { encoding: 'utf8' });
  if (os === 'windows') return ps('Get-Clipboard -Raw');
  return '';
}

// --- One launch ------------------------------------------------------------------------------------------------------
const base = process.env.SETUP57_PROFILE ?? mkdtempSync(path.join(tmpdir(), 'unvibe-setup0157-'));
const installId = process.env.SETUP57_ID ?? `qa-setup0157-local-${Date.now()}`;
const baseEnv = { ...process.env };
for (const key of Object.keys(baseEnv)) {
  if (/^(UNVIBE_ADMIN_STATS_TOKEN|UNVIBE_QA_FLAG_TOKEN|GITHUB_TOKEN|GH_TOKEN|ACTIONS_.*|UNVIBE_USER_DATA|MOUSE)$/.test(key)) delete baseEnv[key];
}
const appArgs = [...(appDir ? [appDir] : []), ...(os === 'linux' ? ['--use-mock-keychain'] : [])];
const netlogs = [];
let version = '?';

const measure = (page) => page.evaluate(() => {
  const rect = (s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const b = e.getBoundingClientRect();
    return { x: b.x, y: b.y, w: b.width, h: b.height, right: b.right, bottom: b.bottom, cx: b.x + b.width / 2, cy: b.y + b.height / 2 };
  };
  const region = (s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).getPropertyValue('-webkit-app-region') || getComputedStyle(e).webkitAppRegion || '' : null; };
  return {
    W: innerWidth, H: innerHeight, dpr: devicePixelRatio, screenX, screenY, outerW: outerWidth, outerH: outerHeight,
    availX: screen.availLeft, availY: screen.availTop, availW: screen.availWidth, availH: screen.availHeight,
    mac: Boolean(document.querySelector('.onboard--mac')),
    count: document.querySelector('.onboard__count')?.textContent ?? '',
    back: rect('.onboard__back'), glyph: rect('.onboard__back svg'), progress: rect('.onboard__progress'), counter: rect('.onboard__count'),
    topRegion: region('.onboard__top'), backRegion: region('.onboard__back'),
    theme: document.documentElement.dataset.theme ?? '', background: getComputedStyle(document.body).backgroundColor,
  };
});
/** The window's top-left on the screen, in the units the pointer and the grabs use (Mac: points from the window server). */
async function origin(page, m) {
  if (os === 'mac') {
    const f = execFileSync(process.env.MOUSE, ['frame', 'Unvibe'], { encoding: 'utf8' }).trim().split(/\s+/).map(Number);
    return { x: f[0], y: f[1], w: f[2], h: f[3], source: 'window server frame' };
  }
  const s = m ?? await measure(page);
  return { x: s.screenX, y: s.screenY, w: s.W, h: s.H, source: 'window.screenX/Y' };
}
function front(app) {
  if (os !== 'mac') return;
  try {
    execFileSync('osascript', ['-e', `tell application "System Events" to set frontmost of (first process whose unix id is ${app.process.pid}) to true`], { timeout: 15000 });
  } catch (e) { note('Bring Unvibe to the front', short(e)); }
}

/**
 * Row 3 (Mac): on step 2, ⌘U by mistake, then ⌃U; only ⌃U may open the explanation. Typed with System Events into
 * Unvibe in front (step 2's focus is "Explain this code", which only Return or Space press). No agreement exists yet,
 * so ⌃U opens the panel on the agreement and reads nothing (core/consent.ts reviewCapture): that's the explanation's
 * start without its hosted call. The panel is closed with Not now after.
 */
async function cmdThenCtrlU(app, companion) {
  if (os !== 'mac') return;
  const key = (mod) => execFileSync('osascript', ['-e', `tell application "System Events" to keystroke "u" using ${mod} down`], { timeout: 15000 });
  const widget = () => app.windows().find((w) => w.url().includes('widget.html') && !w.isClosed());
  const shown = async () => { const w = widget(); return w ? w.evaluate(() => document.visibilityState === 'visible' && Boolean(document.querySelector('.ob'))).catch(() => false) : false; };
  front(app);
  await sleep(800);
  const before = await shown();
  key('command');
  await sleep(3000);
  const afterCmd = await shown();
  const countCmd = (await measure(companion)).count;
  key('control');
  const opened = await waitFor(shown, 10000);
  const panel = widget();
  const phase = () => panel.evaluate(() => [...(document.querySelector('.ob')?.classList ?? [])].filter((c) => c.startsWith('ob--')).join(' ')).catch(() => '?');
  const view = opened ? (await waitFor(async () => { const v = await phase(); return /\bob--boot\b/.test(v) ? '' : v; }, 6000)) || await phase() : '';
  const countCtrl = (await measure(companion)).count;
  await sleep(1200);
  desktop('mac-row3-after-ctrl-u');
  log(!before && !afterCmd && opened && countCmd.startsWith('2 /') && countCtrl.startsWith('2 /'), 'Row 3 (Mac): step 2, ⌘U by mistake, then ⌃U: only ⌃U starts an explanation',
    `panel before ${before}; after ⌘U (3 s) ${afterCmd}, count "${countCmd}"; after ⌃U ${opened}${opened ? `, view "${view}"` : ' (not in 10 s)'}, count "${countCtrl}". With no agreement yet the panel asks for it and reads nothing; the explanation itself (1 hosted call) is not made here`);
  if (panel) await panel.locator('.consent-form__actions button.ghost').click({ timeout: 5000 }).catch(() => {});
  await sleep(1000);
}

/** Rows 1/2: both corners, measured in the page and in 1:1 crops of the screen. */
async function corners(app, page, tag) {
  front(app);
  await sleep(900);
  const m = await measure(page);
  const o = await origin(page, m);
  const k = m.dpr; // device px per CSS px (the Mac runner's display is 1x; Windows 150 % is the forced scale)
  const W = m.W;
  const want = m.mac ? { back: 94, start: 128, end: 84, count: 32 } : { back: 26, start: 60, end: 210, count: 154 };
  const cropW = 360, cropH = 48;
  const tl = file(`${tag}-top-left-1to1`);
  const tr = file(`${tag}-top-right-1to1`);
  const dev = (v) => Math.round(v * (os === 'mac' ? 1 : k));
  grab(tl, dev(o.x), dev(o.y), os === 'mac' ? cropW : dev(cropW), os === 'mac' ? cropH : dev(cropH));
  grab(tr, dev(o.x + W - cropW), dev(o.y), os === 'mac' ? cropW : dev(cropW), os === 'mac' ? cropH : dev(cropH));
  desktop(tag);
  const dom = `W ${r1(W)} × H ${r1(m.H)}, devicePixelRatio ${m.dpr}, theme ${m.theme} (${m.background}), count "${m.count}"; Back glyph centre (${r1(m.glyph?.cx)}, ${r1(m.glyph?.cy)}), button [${r1(m.back?.x)}, ${r1(m.back?.y)}, ${r1(m.back?.w)}, ${r1(m.back?.h)}]; bar ${r1(m.progress?.x)}..${r1(m.progress?.right)} (W-${r1(W - m.progress?.right)}) at y ${r1(m.progress?.y)}; counter ends W-${r1(W - m.counter?.right)}; app-region top "${m.topRegion}", Back "${m.backRegion}"; window at (${o.x}, ${o.y}) by ${o.source}`;
  note(`Corners ${tag}: the page`, dom);
  log(near(m.glyph?.cx, want.back) && near(m.glyph?.cy, 20) && near(m.progress?.x, want.start) && near(W - m.progress?.right, want.end) && near(W - m.counter?.right, want.count),
    `Row ${m.mac ? 1 : 2} ${tag}: the top bar's places in the page`,
    `Back's centre (${r1(m.glyph?.cx)}, ${r1(m.glyph?.cy)}) (want (${want.back}, 20)); bar ${r1(m.progress?.x)}..W-${r1(W - m.progress?.right)} (want ${want.start}..W-${want.end}); counter ends W-${r1(W - m.counter?.right)} (want W-${want.count})`);
  log(/drag/.test(m.topRegion) && /no-drag/.test(m.backRegion), `Row ${m.mac ? 1 : 2} ${tag}: the top row is a drag region and Back is not`, `top "${m.topRegion}", Back "${m.backRegion}"`);

  // The crops, read back: where the lights or caption buttons, Back's ink, the bar and the counter really are.
  try {
    const a = readPng(tl), b = readPng(tr);
    const ka = a.w / cropW, kb = b.w / cropW;
    const oa = { x: 0, y: 0 }, ob = { x: W - cropW, y: 0 };
    const bgA = lum(a.rgb(Math.round((want.start - 10) * ka), Math.round(38 * ka)));
    const bgB = lum(b.rgb(Math.round((cropW - want.end + 12) * kb), Math.round(38 * kb)));
    const ink = (bg) => (c) => Math.abs(lum(c) - bg) > 60;
    const backInk = find(a, ka, oa, { x0: m.back.x, x1: m.back.right, y0: m.back.y, y1: m.back.bottom }, ink(bgA));
    const barStart = edge(a, ka, oa, 20, m.back.right + 2, want.start + 60, bgA, 6);
    const barEnd = edge(b, kb, ob, 20, W - want.end + 20, W - want.end - 80, bgB, 6);
    const countInk = find(b, kb, ob, { x0: W - want.count - 60, x1: W - want.count + 4, y0: 8, y1: 32 }, ink(bgB));
    const crops = `crops ${a.w}×${a.h} and ${b.w}×${b.h} px for ${cropW}×${cropH} CSS px (scale ${r1(ka)})`;
    if (m.mac) {
      const green = find(a, ka, oa, { x0: 0, x1: 120, y0: 0, y1: 40 }, ([r, g, bl]) => g > 140 && g - r > 60 && g - bl > 40);
      const red = find(a, ka, oa, { x0: 0, x1: 120, y0: 0, y1: 40 }, ([r, g, bl]) => r > 200 && r - g > 80 && r - bl > 80);
      note(`Corners ${tag}: the crops`, `${crops}; red light ${red ? `${red.left}..${red.right}, centre y ${red.cy}` : 'not found'}; green light ${green ? `${green.left}..${green.right}, centre y ${green.cy}` : 'not found'}; Back's ink ${backInk ? `${backInk.left}..${backInk.right}, centre (${backInk.cx}, ${backInk.cy})` : 'not found'}; bar from ${barStart} to ${barEnd} (W-${barEnd === null ? '?' : r1(W - barEnd)}); counter ink ends ${countInk ? `W-${r1(W - countInk.right)}` : 'not found'}`);
      if (!green) log(false, `Row 1 ${tag}: Back clear of the green light, on the lights' row (the crop)`, 'no green light in the crop: the lights are not drawn in colour (is the window in front?)');
      else log(Boolean(backInk) && backInk.left > green.right && Math.abs(backInk.cy - green.cy) <= 1.5,
        `Row 1 ${tag}: Back clear of the green light, on the lights' row (the crop)`,
        `green light ends at ${green.right}, Back's ink starts at ${backInk?.left} (${backInk ? r1(backInk.left - green.right) : '?'} px clear); lights' centre y ${green.cy}, Back's ${backInk?.cy}`);
    } else {
      const caption = find(b, kb, ob, { x0: W - 150, x1: W, y0: 4, y1: 36 }, ink(bgB));
      note(`Corners ${tag}: the crops`, `${crops}; Back's ink ${backInk ? `${backInk.left}..${backInk.right}, centre (${backInk.cx}, ${backInk.cy})` : 'not found'}; bar from ${barStart} to ${barEnd} (W-${barEnd === null ? '?' : r1(W - barEnd)}); counter ink ends ${countInk ? `W-${r1(W - countInk.right)}` : 'not found'}; caption buttons' first ink at ${caption ? `W-${r1(W - caption.left)}` : 'not found'}`);
      if (os === 'windows') log(Boolean(caption) && Boolean(countInk) && countInk.right < caption.left,
        `Row 2 ${tag}: the counter clear of the caption buttons (the crop)`,
        `counter ink ends W-${countInk ? r1(W - countInk.right) : '?'}, the caption buttons' first ink at W-${caption ? r1(W - caption.left) : '?'}`);
    }
  } catch (e) { note(`Corners ${tag}: the crops`, `not read (${short(e)})`); }
  return m;
}

/** Setup opens maximized on a first run (windows.ts createCompanion, `maximize: !onboarded`): the window fills the work area. */
const filled = (m) => m.outerW >= m.availW - 2 && m.outerH >= m.availH - 2;
/** Where the drags press: on the bar 60 px from its right end, 32 px down; clear of the Island at the screen's top centre. */
const pressAt = (m, o) => ({ x: o.x + m.progress.right - 60, y: o.y + 32 });

/**
 * The maximized first-run window restored as a person would: on Windows by dragging its top row (Windows restores a
 * maximized window when its caption is dragged, under the pointer), on the Mac by Window › Zoom (a zoomed Mac window
 * only moves when dragged). Returns true when the window changed state.
 */
async function restore(app, page, tag) {
  const m0 = await measure(page);
  const o0 = await origin(page, m0);
  note(`Row 2 ${tag}: the window first`, `${filled(m0) ? 'maximized (fills the work area)' : 'not maximized'}: ${r1(m0.outerW)} × ${r1(m0.outerH)} at (${o0.x}, ${o0.y}); the work area ${m0.availW} × ${m0.availH} at (${m0.availX}, ${m0.availY})`);
  if (!filled(m0)) return false;
  front(app);
  if (os === 'mac') {
    try {
      execFileSync('osascript', ['-e', `tell application "System Events" to tell (first process whose unix id is ${app.process.pid}) to click menu item "Zoom" of menu "Window" of menu bar 1`], { timeout: 15000 });
    } catch (e) { note(`Row 2 ${tag}: Window › Zoom`, short(e)); }
  } else {
    const p = pressAt(m0, o0);
    pointer.drag(p.x, p.y, p.x + 120, p.y + 90);
  }
  await sleep(1500);
  const m1 = await measure(page);
  const o1 = await origin(page, m1);
  const ok = !filled(m1);
  log(ok, `Row 2 ${tag}: the maximized window restored ${os === 'mac' ? 'by Window › Zoom' : 'by dragging its top row (real pointer, +120, +90)'}`,
    `${r1(m0.outerW)} × ${r1(m0.outerH)} at (${o0.x}, ${o0.y}) → ${r1(m1.outerW)} × ${r1(m1.outerH)} at (${o1.x}, ${o1.y})`);
  return ok;
}

/** Row 2's drag and click with the real pointer: the top row moves the (restored) window, Back still clicks. */
async function dragAndBack(page, tag) {
  const m = await measure(page);
  const before = await origin(page, m);
  const from = pressAt(m, before);
  pointer.drag(from.x, from.y, from.x + 60, from.y + 40);
  await sleep(1200);
  const after = await origin(page);
  const moved = { x: r1(after.x - before.x), y: r1(after.y - before.y) };
  log(near(moved.x, 60, 4) && near(moved.y, 40, 4), `Row 2 ${tag}: the top row drags the window (real pointer)`,
    `${filled(m) ? 'maximized' : 'not maximized'} ${r1(m.outerW)} × ${r1(m.outerH)}; pressed on the bar 60 px from its right end, 32 px down, moved by (+60, +40): the window went (${before.x}, ${before.y}) → (${after.x}, ${after.y}), by (${moved.x}, ${moved.y})`);
  const m2 = await measure(page);
  const countBefore = m2.count;
  const back = { x: after.x + m2.glyph.cx, y: after.y + m2.glyph.cy };
  const inside = back.x >= m2.availX && back.y >= m2.availY && back.x < m2.availX + m2.availW && back.y < m2.availY + m2.availH;
  if (!inside) {
    log(false, `Row 2 ${tag}: Back still clicks (real pointer, in the drag row)`, `not clicked: Back's centre (${r1(back.x)}, ${r1(back.y)}) is off the work area (harness)`);
    desktop(`${tag}-after-drag`);
    return;
  }
  pointer.click(back.x, back.y);
  const backed = await waitFor(async () => (await measure(page)).count.startsWith('1 /'), 5000);
  const countAfter = (await measure(page)).count;
  log(backed, `Row 2 ${tag}: Back still clicks (real pointer, in the drag row)`, `clicked at (${r1(back.x)}, ${r1(back.y)}); count "${countBefore}" → "${countAfter}"`);
  desktop(`${tag}-after-drag-and-back`);
  if (backed) {
    await page.locator('.onboard__primary').click();
    await page.locator('.onboard__count').filter({ hasText: '2 /' }).waitFor({ timeout: 8000 });
  }
}

async function launch(tag, extraArgs = []) {
  const P = `${base}-${tag}`;
  mkdirSync(P, { recursive: true });
  if (!existsSync(path.join(P, 'unvibe-store.json'))) writeFileSync(path.join(P, 'unvibe-store.json'), JSON.stringify({ installId, loginPromptAsked: true }));
  const net = path.join(netDir, `netlog-setup0157-${tag}.json`);
  netlogs.push({ tag, file: net });
  const app = await launchApp({ exe, userData: P, env: { ...baseEnv, UNVIBE_USER_DATA: P }, timeout: 90000, args: [...appArgs, ...extraArgs, netLogArg(net)] });
  const companion = await app.windowWith('companion.html', 60000);
  if (!companion) throw new Error('the main window did not open');
  await companion.waitForLoadState('domcontentloaded');
  version = (await companion.evaluate(() => window.unvibe.appInfo())).version;
  await companion.locator('.onboard__count').waitFor({ timeout: 20000 });
  await toStep2(companion);
  return { app, companion, P };
}
/** Step 1 → step 2 ("Let's go"; nothing typed: a blank answer sends nothing). Step 2's "Explain this code" is never pressed. */
async function toStep2(companion) {
  await companion.locator('.onboard__count').waitFor({ timeout: 20000 });
  await companion.locator('.onboard__primary').filter({ hasText: "Let's go" }).click();
  await companion.locator('.onboard__count').filter({ hasText: '2 /' }).waitFor({ timeout: 8000 });
  await sleep(1500); // Vibe's line types out; the stills wait for the whole line
}
/**
 * The theme, as a launch with it would draw setup: main gets the setting (it recolours the Windows caption buttons),
 * and the main window reloads, because setup reads the setting only when it mounts (no setting reaches it mid-setup).
 * Setup starts again from step 1 on the reload (nothing is saved before its end), so it's walked back to step 2.
 */
async function theme(companion, value) {
  await companion.evaluate((v) => window.unvibe.setSettings({ theme: v }), value);
  await companion.reload();
  await companion.waitForLoadState('domcontentloaded');
  await toStep2(companion);
  const now = await companion.evaluate(() => document.documentElement.dataset.theme ?? '');
  if (now !== value) throw new Error(`the theme is "${now}" after setting ${value} and reloading`);
}

// --- The runs ----------------------------------------------------------------------------------------------------------
wideScreen();
// The Mac's control for Row 2 (unvibe-app's read of run 44663887449): the same real-pointer drag on a Finder window's
// title bar. If Finder doesn't move either, it's the pointer, not Unvibe. The Finder window is closed with ⌘W after.
if (os === 'mac') {
  try {
    // An empty folder of its own, so the still shows no files of the runner's.
    const empty = mkdtempSync(path.join(tmpdir(), 'unvibe-qa-finder-control-'));
    execFileSync('open', ['-a', 'Finder', empty]);
    await sleep(2500);
    const f0 = execFileSync(process.env.MOUSE, ['frame', 'Finder'], { encoding: 'utf8' }).trim().split(/\s+/).map(Number);
    const p = { x: f0[0] + f0[2] / 2, y: f0[1] + 14 };
    pointer.drag(p.x, p.y, p.x + 60, p.y + 40);
    await sleep(1200);
    const f1 = execFileSync(process.env.MOUSE, ['frame', 'Finder'], { encoding: 'utf8' }).trim().split(/\s+/).map(Number);
    desktop('finder-control');
    log(near(f1[0] - f0[0], 60, 4) && near(f1[1] - f0[1], 40, 4), 'Row 2 control (Mac): the same real-pointer drag moves a Finder window by its title bar',
      `Finder ${f0[2]} × ${f0[3]} at (${f0[0]}, ${f0[1]}), pressed at (${p.x}, ${p.y}), moved by (+60, +40): now (${f1[0]}, ${f1[1]}), by (${f1[0] - f0[0]}, ${f1[1] - f0[1]})`);
    execFileSync('osascript', ['-e', 'tell application "System Events" to keystroke "w" using command down'], { timeout: 15000 });
    await sleep(800);
  } catch (e) { log(false, 'Row 2 control (Mac): a Finder window drag', `not run (${short(e)})`); }
}
const runs = os === 'windows' ? [{ tag: '100', args: [] }, { tag: '150', args: ['--force-device-scale-factor=1.5'] }] : [{ tag: os === 'mac' ? 'mac' : 'local', args: [] }];
let consentProfile = null;
for (const run of runs) {
  let app = null;
  try {
    const l = await launch(run.tag, run.args);
    app = l.app;
    const { companion } = l;
    const first = await measure(companion);
    winScale = first.dpr;
    note(`Launch ${run.tag}`, `Unvibe ${version}; window ${r1(first.W)} × ${r1(first.H)} CSS px at devicePixelRatio ${first.dpr}${run.args.length ? ` (${run.args.join(' ')})` : ''}`);
    if (first.theme !== 'light') await theme(companion, 'light');
    await corners(app, companion, `${run.tag}-light`);
    if (run.tag !== '150') {
      await theme(companion, 'dark');
      await corners(app, companion, `${run.tag}-dark`);
      await theme(companion, 'light');
      await sleep(900);
    }
    await cmdThenCtrlU(app, companion);
    if (await restore(app, companion, run.tag)) await corners(app, companion, `${run.tag}-restored-light`);
    front(app);
    await dragAndBack(companion, run.tag);
    if (run.tag === '150') continue;

    // Row 5: a fresh install (no agreement), Skip → step 3 → Explain my clipboard with code copied.
    await companion.locator('.onboard__quiet').filter({ hasText: 'Skip for now' }).click();
    await companion.locator('.onboard__count').filter({ hasText: '3 /' }).waitFor({ timeout: 8000 });
    await sleep(800);
    setClipboard(SAMPLE);
    const label = (await companion.locator('.onboard__primary').textContent())?.trim();
    if (label !== 'Explain my clipboard') throw new Error(`step 3's primary is "${label}", not Explain my clipboard`);
    await companion.locator('.onboard__primary').click();
    const panel = await app.windowWith('widget.html', 15000);
    const view = panel ? await waitFor(async () => panel.evaluate(() => {
      const ob = document.querySelector('.ob');
      return ob ? [...ob.classList].filter((c) => c.startsWith('ob--')).join(' ') : '';
    }).catch(() => ''), 10000) : '';
    const consentForm = panel ? await panel.locator('.consent-form').count() : 0;
    const sentSoFar = apiRequests(netlogs.at(-1).file, host).filter((q) => q.method === 'POST' && /^\/api\/v1\/(reviews|comprehension|previews)\b/.test(q.path)).length;
    await sleep(1500); // the panel and Vibe's line settle
    if (panel) await panel.screenshot({ path: file(`${run.tag}-row5-panel-agreement`) }).catch(() => {});
    await companion.screenshot({ path: file(`${run.tag}-row5-companion-step3`) });
    log(Boolean(panel) && /aiConsent/.test(view) && consentForm === 1 && sentSoFar === 0, 'Row 5: fresh install, Skip → step 3 → Explain my clipboard: the panel asks for the agreement first, nothing sent',
      `panel ${panel ? `open, view "${view}", agreement form ${consentForm}` : 'did not open in 15 s'}; POSTs to /reviews, /comprehension or /previews so far ${sentSoFar}`);
    if (!panel || consentForm !== 1) continue;

    // Row 4: the clipboard emptied (and checked), then the agreement: its clipboard read finds nothing and says so.
    setClipboard('');
    const held = readClipboard();
    if (held.trim()) { log(false, 'Row 4: empty clipboard', `the clipboard could not be emptied (${held.length} characters left); the agreement is not given`); continue; }
    for (const box of await panel.locator('.consent-form input[type=checkbox]').all()) await box.check();
    await panel.locator('.consent-form__actions button:not(.ghost)').click();
    consentProfile = l.P;
    const message = companion.locator('.paste-target__error');
    const shownAfterAgree = await message.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    note('Row 4 (after the agreement): the agreement\'s clipboard read, with the clipboard empty', shownAfterAgree ? `the message shows: "${(await message.textContent())?.trim()}"` : 'no message in 15 s');
    // The row as asked: Explain my clipboard, with the agreement given and the clipboard still empty. With the
    // agreement this press reads the clipboard and would explain what it finds, so it's checked empty right before.
    await waitFor(async () => (await companion.locator('.onboard__primary').textContent())?.trim() === 'Explain my clipboard', 8000);
    const still = readClipboard();
    if (still.trim()) { log(false, 'Row 4: empty clipboard', `the clipboard is no longer empty (${still.length} characters); not pressed`); continue; }
    await companion.locator('.onboard__primary').click();
    await message.waitFor({ state: 'detached', timeout: 3000 }).catch(() => {});
    const shown = await message.waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
    const text = shown ? (await message.textContent())?.trim() : '';
    const place = await companion.evaluate(() => {
      const box = document.querySelector('.paste-target__box')?.getBoundingClientRect();
      const err = document.querySelector('.paste-target__error')?.getBoundingClientRect();
      return box && err ? { boxBottom: box.bottom, errTop: err.top, boxX: [box.left, box.right], errX: [err.left, err.right] } : null;
    });
    await sleep(1500);
    await companion.screenshot({ path: file(`${run.tag}-row4-clipboard-empty`) });
    desktop(`${run.tag}-row4`);
    const phases = panel ? await panel.evaluate(() => [...(document.querySelector('.ob')?.classList ?? [])].filter((c) => c.startsWith('ob--')).join(' ')).catch(() => '?') : '?';
    log(text === 'Your clipboard is empty. Copy some code first, then try again.' && Boolean(place) && place.errTop >= place.boxBottom,
      'Row 4: step 3, empty clipboard: Explain my clipboard shows the message under the paste box',
      `"${text}"; paste box bottom ${place ? r1(place.boxBottom) : '?'}, message top ${place ? r1(place.errTop) : '?'}; the clipboard was empty when pressed (checked); panel view now "${phases}"`);
  } catch (e) {
    log(false, `Launch ${run.tag}`, `stopped: ${short(e)}`);
    desktop(`${run.tag}-stopped`);
  } finally {
    await app?.close().catch(() => {});
    await sleep(2000);
  }
}

// --- No hosted-AI call ---------------------------------------------------------------------------------------------
const requests = netlogs.flatMap(({ tag, file: f }) => keepSummaryAndDrop(f, host, path.join(out, `netlog-setup0157-${os}-${tag}.txt`)));
const ai = requests.filter((q) => q.method === 'POST' && /^\/api\/v1\/(reviews|comprehension|previews)\b/.test(q.path));
log(ai.length === 0, 'No hosted-AI call: nothing explained, asked or quizzed',
  `the app's net logs: ${requests.length} request(s) to ${host}, ${ai.length} POST(s) to /reviews, /comprehension or /previews; "Explain this code" and the confirm sheet's Explain never pressed${consentProfile ? '; the agreement was given in the run\'s own profile for row 4' : ''}`);
writeFileSync(path.join(out, `report-setup0157-${os}.txt`), `Unvibe ${version}: 0.1.57 setup rows (${os}), no hosted AI\n\n${report.join('\n')}\n`);
process.exit(report.some((l) => l.startsWith('FAIL')) ? 1 : 0);
