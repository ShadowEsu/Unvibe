// D5 #366 (the Unvibe button), real-device rows on a Mac and a Windows runner, with VS Code and the real pointer (the
// OS's own mouse events: mouse.swift's CGEvents on the Mac, mouse_event on Windows). The lists this answers:
// unvibe-app's README "Not verified yet" (agents/unvibe-app/evidence/d5-bubble/README.md L42-48), Security's
// real-machine checks and N6 (requests/security/20261119-1703-security-unvibe-app-pr366-d5-bubble-s1.md §3, L89-93),
// and Design's real-device captures (requests/unvibe-app/20261119-1659-design-s1-d5-bubble-366.md L48-55).
//
// Launch A (Mac and Windows 100 %), a new qa- profile, setup skipped, the main window minimized, VS Code maximized:
//   A1 (Mac) no new permission prompt when the button is turned on: the on-screen windows before and after (and after
//      the press, A4), with Unvibe's Accessibility reset by the workflow first (a clean Mac); the helper is running.
//   A2 a real drag in VS Code shows the button: mouse-up → button in the page, ms, 5 times (the brief's target
//      ≤ 150 ms; the first one also creates the window); the button (its own box in its page, 32 px) placed 8 px
//      right of the mouse-up, centred on it. It leaves 3.5-4.5 s after the mouse-up untouched (round 1; 4 s from the
//      show, unvibe-app) and on a click elsewhere
//      (rounds 2-5). Placing, hovering and pressing go by the button's box: on Windows its window was 64×64 px.
//   A2b the old invisible strip: clicks 20 px right of, below, and right of and below the button land in VS Code
//      (its selection goes, its caret moves there) while the button shows; on Windows the button's window is
//      clipped to the button (GetWindowRgnBox = its 32 px box; GetWindowRect stays 64×64, unvibe-app 438db5df).
//      Windows turns MouseKeys on first so the VM shows a cursor (unvibe-app's idea); the reads say whether it did.
//   A3 a gutter line-drag: a drag down the line numbers selects whole lines, a real selection, so the button shows
//      (lead 2026-11-20, #366 5fa3fbaf). Every press first settles on its point (three small moves, 300 ms). The
//      harness reads the cursor as the helper does before the press and 40 ms after it: Windows GetCursorInfo
//      (flags, NULL handle, I-beam), Mac NSCursor.currentSystem's hot spot and image size against NSCursor.iBeam's,
//      and secure input (mouse.swift).
//   A3b a drag that isn't a selection: VS Code's scrollbar slider, 60 px down (then back) → no button.
//   A3 race (unvibe-app, #366 5b34c779): rest on the gutter, move onto text and press within 16 ms → the button;
//      rest on text, move onto the scrollbar slider and press within 16 ms, drag it → none.
//      A3b and the races are judged only when the cursor reads found a cursor, otherwise NOT TESTABLE (the helpers'
//      "can't say" branch shows the button by design, lead 2026-11-20), and a "no button" row only after A2 showed
//      the button.
//   A4 hover → the pill after 150 ms; 1:1 crops of the button and the pill over VS Code (light), corners transparent
//      (the mouse-up on plain background: on the Mac's 1280 px screen, right of a short row between short rows);
//      a press opens the panel on the agreement (no agreement in this profile: nothing is read) and sends nothing.
//      The press row lists the helper's lines (down, press, app) and the pointer events the button's page saw.
//   A5 stacking: that panel focused, then VS Code clicked (Mac: and activated by name, since synthesized clicks don't
//      move activation on macOS 26+), and the panel fades (its own row; NOT TESTABLE if the header click never gave the
//      panel focus); then a selection whose button lands over the panel's edge: the button is in front (window order)
//      and takes the pointer (hover → pill over the panel). Its geometry is read once it has settled.
//   A6 the flip at the screen's right edge: the button and the pill grow left of the mouse-up.
//   A7 dark: Unvibe and VS Code dark, the button and the pill again (crops, transparent corners).
//   A8 idle CPU of Unvibe's processes over 60 s with the button on (ghost hidden), then 60 s with it off.
// Launch B (Windows): --force-device-scale-factor=1.5 (Chromium's scale on the runner's 100 % display; the Windows
//   setting needs a sign-out): a real drag shows the button, with see-through corners (PASS/FAIL); its size and place
//   (GetWindowRect and the page's) are a NOTE, since a forced scale is not a Windows display scale.
// Launch C (Mac and Windows), the API host blocked in the hosts file for the whole launch (no byte reaches the server;
//   the file is put back byte for byte and checked), the agreement given in the run's own profile:
//   D5-a first (Security's MUST): the runner's own request gets no answer, the resolver gives only 0.0.0.0 / :: or no
//      address (Windows answers a 0.0.0.0 line with ENOENT), dscacheutil 0.0.0.0 on the Mac, and the app's net log so
//      far has no answered request; else launch C stops there, with no agreement and no press.
//   C1 N6: VS Code's password prompt (a development extension's showInputBox({ password: true })), double-clicked.
//      Mac: no button (secure input). Windows: the button may show (Security N6); pressed with Quick look off, then
//      on: nothing of the box reaches the clipboard or the panel, and nothing is sent; the Island is out of its working
//      phases by +6 s after that empty press, then idle (a 10 s timeline; lead 2026-11-20), and the clipboard is the
//      sentinel again (+4 s and +10 s reads; Security SHOULD-366c/d).
//   C2 Quick look on: a selection, the button, the card (its request fails at the block), Esc closes it, VS Code keeps
//      focus, and the next Esc reaches VS Code (its find box closes): Unvibe let go of Esc (SHOULD-366a).
// Every launch also runs a second copy of the installed helper and keeps its own press lines (#366 8ec57712: beam,
//   known, and secure on a Mac), so each row shows what the helper itself read; they decide A3 and the races.
//
// NO hosted-AI call: launches A and B have no agreement, so a press reads nothing (core/consent.ts reviewCapture);
// launch C runs behind the hosts block. The app's net logs are summarised (time, method, path, status) and deleted.
import { launchApp } from './cdp-launch.mjs';
import { apiRequests, keepSummaryAndDrop, netLogArg } from './netlog.mjs';
import { readPng, rgbDiff } from './png.mjs';
import { chromium } from 'playwright';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { lookup } from 'node:dns/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';

const exe = process.env.UNVIBE_EXE;
const os = process.env.UNVIBE_OS ?? (process.platform === 'darwin' ? 'mac' : 'windows');
const out = path.resolve(process.env.SHOTS_DIR ?? 'd5');
const host = process.env.API_HOST ?? 'api.unvibe.site';
const TMP = process.env.RUNNER_TEMP ?? tmpdir();
const netDir = path.resolve(process.env.NETLOG_DIR ?? mkdtempSync(path.join(tmpdir(), 'unvibe-d5-netlog-')));
const code = process.env.VSCODE; // Mac: the `code` CLI; Windows: Code.exe
const codeData = process.env.VSCODE_DATA ?? path.join(TMP, 'd5-vscode');
const base = process.env.D5_PROFILE ?? mkdtempSync(path.join(tmpdir(), 'unvibe-d5-'));
const installId = process.env.D5_ID ?? `qa-d5-local-${Date.now()}`;
if (!exe) throw new Error('UNVIBE_EXE is not set');
if (!code) throw new Error('VSCODE is not set');
if (os !== 'mac' && os !== 'windows') throw new Error('the Unvibe button exists on a Mac and on Windows only');
if (process.env.QA_AI_OK === '1') throw new Error('d5-button.mjs makes no hosted-AI call: run it with ai off');
mkdirSync(out, { recursive: true });
mkdirSync(netDir, { recursive: true });

const report = [];
let n = 0;
const line = (s) => { report.push(s); console.log(s); };
const log = (ok, step, detail = '') => line(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? `: ${detail}` : ''}`);
const note = (step, detail = '') => line(`NOTE  ${step}${detail ? `: ${detail}` : ''}`);
/** A row the runner can't judge, with the reason (counted apart from PASS and FAIL). */
const untestable = (step, detail) => line(`NOT TESTABLE  ${step}: ${detail}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const short = (e) => String(e?.message ?? e).split('\n')[0];
const r1 = (v) => Math.round(v * 10) / 10;
const near = (a, b, tol) => a !== null && a !== undefined && Math.abs(a - b) <= tol;
async function waitFor(fn, ms = 5000, every = 100) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    const v = await fn().catch(() => null);
    if (v) return v;
    await sleep(every);
  }
  return null;
}
const file = (label, ext = 'png') => path.join(out, `${os}-${String(++n).padStart(2, '0')}-${label}.${ext}`);
const ps = (script, input) => execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8', timeout: 60000, ...(input === undefined ? {} : { input }) }).trim();
const osa = (script) => execFileSync('osascript', ['-e', script], { encoding: 'utf8', timeout: 20000 }).trim();
const sha = (f) => createHash('sha256').update(readFileSync(f)).digest('hex');

// --- The screen (as setup-0157.mjs) -----------------------------------------------------------------------------
const DPI_AWARE = `Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();' -Name D -Namespace W; [void][W.D]::SetProcessDPIAware()`;
function desktop(label) {
  const f = file(`desktop-${label}`);
  try {
    if (os === 'mac') execFileSync('screencapture', ['-x', f]);
    else ps(`Add-Type -AssemblyName System.Windows.Forms,System.Drawing; ${DPI_AWARE}; $b=[System.Windows.Forms.SystemInformation]::VirtualScreen; $bmp=New-Object System.Drawing.Bitmap $b.Width,$b.Height; [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen($b.Left,$b.Top,0,0,$bmp.Size); $bmp.Save('${f}')`);
  } catch (e) { note(`desktop still ${label}`, `not taken (${short(e)})`); }
  return f;
}
/** A screen rectangle in device pixels (Mac: the runner's 1x display, so points), saved as it is. */
function grab(f, x, y, w, h) {
  [x, y, w, h] = [x, y, w, h].map(Math.round);
  if (os === 'mac') execFileSync('screencapture', ['-x', `-R${x},${y},${w},${h}`, f]);
  else ps(`Add-Type -AssemblyName System.Drawing; ${DPI_AWARE}; $bmp=New-Object System.Drawing.Bitmap ${w},${h}; [System.Drawing.Graphics]::FromImage($bmp).CopyFromScreen(${x},${y},0,0,$bmp.Size); $bmp.Save('${f}')`);
  return f;
}
/** The screen in pointer units (Mac points, Windows physical px), read after wideScreen(); the pointer refuses points
 * outside it (run 44668914881: drags at x ≥ 1868 on a 1920-wide screen were clamped to its edge). */
let SCREEN = null;
function wideScreen() {
  if (os === 'mac') {
    // 1280 × 960, the mode setup-0157's runs used: at 1600 × 900, screencapture said "could not create image from
    // display" and the app's windows stopped painting (run 44668914881).
    try {
      const said = execFileSync(process.env.MOUSE, ['display', '1280', '900'], { encoding: 'utf8', timeout: 30000 }).trim();
      note('Screen', said);
      const m = /now (\d+)x(\d+)/.exec(said);
      if (m) SCREEN = { w: Number(m[1]), h: Number(m[2]) };
    } catch (e) { note('Screen', `the mode was not changed (${short(e)})`); }
    return;
  }
  try {
    const said = ps([
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
      '$dm.dmPelsWidth = 1920; $dm.dmPelsHeight = 1080; $dm.dmFields = 0x80000 -bor 0x100000',
      '$r = [Disp]::ChangeDisplaySettings([ref]$dm, 0)',
      'Add-Type -AssemblyName System.Windows.Forms; $b = [System.Windows.Forms.SystemInformation]::VirtualScreen',
      '"ChangeDisplaySettings 1920x1080 returned $r; screen now $($b.Width)x$($b.Height)"',
    ].join('\n'));
    note('Screen', said);
    const m = /now (\d+)x(\d+)/.exec(said);
    if (m) SCREEN = { w: Number(m[1]), h: Number(m[2]) };
  } catch (e) { note('Screen', `1920 × 1080 not set (${short(e)})`); }
}

// --- The pointer and the keyboard (screen units: Mac points, Windows physical px) -------------------------------
const ptrScript = path.join(TMP, 'unvibe-d5-pointer.ps1');
if (os === 'windows') writeFileSync(ptrScript, [
  'param([string]$op, [int]$x1, [int]$y1, [int]$x2, [int]$y2, [int]$n, [int]$x3 = 0, [int]$y3 = 0)',
  'Add-Type @"',
  'using System; using System.Runtime.InteropServices;',
  'public class Ptr {',
  '  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();',
  '  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);',
  '  [DllImport("user32.dll")] public static extern void mouse_event(uint f, uint dx, uint dy, uint d, UIntPtr e);',
  '  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }',
  '  [StructLayout(LayoutKind.Sequential)] public struct CURSORINFO { public int cbSize; public int flags; public IntPtr hCursor; public POINT pt; }',
  '  [DllImport("user32.dll")] public static extern bool GetCursorInfo(ref CURSORINFO ci);',
  '  [DllImport("user32.dll")] public static extern IntPtr LoadCursor(IntPtr h, int id);',
  '  // The global cursor as the helper reads it (lead 2026-11-20): GetCursorInfo ok, flags (1 = CURSOR_SHOWING,',
  '  // 2 = CURSOR_SUPPRESSED), whether hCursor is NULL, and whether it is the shared I-beam (IDC_IBEAM 32513).',
  '  public static string Cur() { var ci = new CURSORINFO(); ci.cbSize = Marshal.SizeOf(ci); bool ok = GetCursorInfo(ref ci); return "ok=" + (ok ? 1 : 0) + " flags=" + ci.flags + " null=" + (ci.hCursor == IntPtr.Zero ? 1 : 0) + " ibeam=" + (ci.hCursor != IntPtr.Zero && ci.hCursor == LoadCursor(IntPtr.Zero, 32513) ? 1 : 0); }',
  '  public static void To(int x, int y) { SetCursorPos(x, y); mouse_event(1, 0, 0, 0, UIntPtr.Zero); }',
  '  // The race: the move and the press back to back in this process; returns the ms between them.',
  '  public static double MoveAndPress(int x, int y) { var sw = System.Diagnostics.Stopwatch.StartNew(); SetCursorPos(x, y); mouse_event(1, 0, 0, 0, UIntPtr.Zero); mouse_event(2, 0, 0, 0, UIntPtr.Zero); return sw.Elapsed.TotalMilliseconds; }',
  '  // MouseKeys on (MKF_MOUSEKEYSON | MKF_AVAILABLE) gives a VM with no mouse a pointing device, so Windows shows a',
  '  // cursor (unvibe-app 2026-11-20, untested). SPI_SETMOUSEKEYS 0x37, SPIF_SENDCHANGE only (not saved).',
  '  [StructLayout(LayoutKind.Sequential)] public struct MOUSEKEYS { public uint cbSize, dwFlags, iMaxSpeed, iTimeToMaxSpeed, iCtrlSpeed, dwReserved1, dwReserved2; }',
  '  [DllImport("user32.dll")] public static extern bool SystemParametersInfo(uint a, uint b, ref MOUSEKEYS mk, uint f);',
  '  public static string MouseKeys() { var mk = new MOUSEKEYS(); mk.cbSize = (uint)Marshal.SizeOf(mk); mk.dwFlags = 3; mk.iMaxSpeed = 10; mk.iTimeToMaxSpeed = 1000; return "mousekeys=" + (SystemParametersInfo(0x37, mk.cbSize, ref mk, 2) ? 1 : 0); }',
  '}',
  '"@',
  '[void][Ptr]::SetProcessDPIAware()',
  '# The settle: three small moves onto the start point, then 300 ms, so the app under it has set its cursor (unvibe-app).',
  'function Settle([int]$x, [int]$y) { [Ptr]::To($x - 2, $y); Start-Sleep -Milliseconds 60; [Ptr]::To($x + 2, $y); Start-Sleep -Milliseconds 60; [Ptr]::To($x, $y); Start-Sleep -Milliseconds 300 }',
  'function Steps([int]$ax, [int]$ay, [int]$bx, [int]$by) { for ($i = 1; $i -le 24; $i++) { [Ptr]::To([int]($ax + ($bx - $ax) * $i / 24), [int]($ay + ($by - $ay) * $i / 24)); Start-Sleep -Milliseconds 20 } }',
  'if ($op -eq "move") { [Ptr]::To($x1, $y1) }',
  'if ($op -eq "mousekeys") { "before: $([Ptr]::Cur())"; [Ptr]::MouseKeys(); [Ptr]::To($x1, $y1); Start-Sleep -Milliseconds 300; "after: $([Ptr]::Cur())" }',
  'if ($op -eq "click") { Settle $x1 $y1; "press: $([Ptr]::Cur())"; for ($i = 0; $i -lt $n; $i++) { [Ptr]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 30; [Ptr]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60 } }',
  'if ($op -eq "drag") {',
  '  Settle $x1 $y1; $before = [Ptr]::Cur()',
  '  [Ptr]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 40; $at40 = [Ptr]::Cur(); Start-Sleep -Milliseconds 40',
  '  Steps $x1 $y1 $x2 $y2',
  '  [Ptr]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)',
  '  "press: $before at40: $at40"',
  '  [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()',
  '}',
  '# The race (unvibe-app): rest at (x1, y1), then move to (x2, y2) and press at once, drag to (x3, y3), release.',
  'if ($op -eq "race") {',
  '  Settle $x1 $y1; $rest = [Ptr]::Cur()',
  '  $gap = [Ptr]::MoveAndPress($x2, $y2)',
  '  Start-Sleep -Milliseconds 40; $at40 = [Ptr]::Cur()',
  '  Steps $x2 $y2 $x3 $y3',
  '  [Ptr]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)',
  '  "rest: $rest gap=$([Math]::Round($gap, 2)) at40: $at40"',
  '  [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()',
  '}',
].join('\r\n'));
const S = (v) => String(Math.round(v));
const winPtr = (...args) => execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ptrScript, ...args], { encoding: 'utf8', timeout: 30000 }).trim();
function onScreen(...pts) {
  if (!SCREEN) return;
  for (const [x, y] of pts) if (!(x >= 0 && y >= 0 && x < SCREEN.w && y < SCREEN.h)) throw new Error(`harness: (${Math.round(x)}, ${Math.round(y)}) is off the ${SCREEN.w}×${SCREEN.h} screen; nothing pressed`);
}
const pointer = {
  /** What the harness itself read before the last press (Windows: the global cursor is the I-beam, 1 or 0). */
  last: '',
  /** When the last drag, race or click started (ms since 1970): the helper's own press lines from then on are its. */
  t0: 0,
  /** A settle on (x1, y1), a press, a move to (x2, y2), a release; returns the release time (ms since 1970, this
   * machine's clock). */
  drag(x1, y1, x2, y2) {
    onScreen([x1, y1], [x2, y2]);
    pointer.t0 = Date.now();
    const printed = os === 'mac'
      ? execFileSync(process.env.MOUSE, ['drag', S(x1), S(y1), S(x2), S(y2)], { encoding: 'utf8' }).trim()
      : winPtr('drag', S(x1), S(y1), S(x2), S(y2), '1');
    pointer.last = printed.split(/\s+/).slice(0, -1).join(' ');
    return Number(printed.split(/\s+/).pop());
  },
  /** unvibe-app's race: the pointer rests on (x0, y0), then moves to (x1, y1) and presses at once (the gap is printed),
   * drags to (x2, y2) and releases. Returns { up, said } (Windows: the I-beam at rest and 40 ms after the press). */
  race(x0, y0, x1, y1, x2, y2) {
    onScreen([x0, y0], [x1, y1], [x2, y2]);
    pointer.t0 = Date.now();
    const printed = os === 'mac'
      ? execFileSync(process.env.MOUSE, ['race', S(x0), S(y0), S(x1), S(y1), S(x2), S(y2)], { encoding: 'utf8' }).trim()
      : winPtr('race', S(x0), S(y0), S(x1), S(y1), '1', S(x2), S(y2));
    const said = printed.split(/\s+/).slice(0, -1).join(' ');
    return { up: Number(printed.split(/\s+/).pop()), said, gap: Number(/gap=([\d.]+)/.exec(said)?.[1] ?? NaN) };
  },
  click(x, y, count = 1) {
    onScreen([x, y]);
    pointer.t0 = Date.now();
    pointer.last = os === 'mac'
      ? execFileSync(process.env.MOUSE, ['click', S(x), S(y), String(count)], { encoding: 'utf8' }).trim()
      : winPtr('click', S(x), S(y), '0', '0', String(count));
  },
  move(x, y) {
    onScreen([x, y]);
    if (os === 'mac') execFileSync(process.env.MOUSE, ['move', S(x), S(y)]);
    else winPtr('move', S(x), S(y), '0', '0', '1');
  },
};

// --- The helper's own reads (#366 8ec57712, 5fa3fbaf): after each left press it prints {"e":"press", x, y, beam,
// known [, mx, my, secure, cursor on a Mac]}, what its I-beam read saw (x/y the event's point, mx/my the pointer at
// +40 ms, cursor the system cursor's geometry: hot, size, aspect, rel, agree), and the Mac helper prints one
// {"e":"beamref","cursor":{..}} at start (NSCursor.iBeam's geometry). Unvibe's main drops those lines. A second copy of
// the installed helper, stdin open, run by the harness for the launch, lets the report show them (unvibe-app
// 2026-11-20: two helpers only watch). Kept: ready, beamref, press, select, down/right/scroll (points) and app (the
// front app's bundle id or exe name: unvibe-app's run-5 read, an `app` naming Unvibe hid the button before the press
// landed). Numbers are coerced, the gesture and app id must look like one; the helper reads no text.
const helperFile = exe ? (os === 'mac'
  ? path.join(path.dirname(exe), '..', 'Resources', 'selection-watch', 'unvibe-selection-watch')
  : path.join(path.dirname(exe), 'resources', 'selection-watch', 'unvibe-selection-watch.exe')) : '';
let shadow = null;
function startShadow(tag) {
  if (shadow) return;
  if (!helperFile || !existsSync(helperFile)) { note(`The helper's own reads (${tag})`, `no helper at ${helperFile || '?'}`); return; }
  const child = spawn(helperFile, [], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true, shell: false });
  const lines = [];
  createInterface({ input: child.stdout }).on('line', (l) => {
    let e;
    try { e = JSON.parse(l); } catch { return; }
    const num = (v) => (v === undefined ? undefined : Number(v));
    if (e?.e === 'press') lines.push({ t: Date.now(), e: 'press', x: num(e.x), y: num(e.y), mx: num(e.mx), my: num(e.my), beam: num(e.beam), known: num(e.known), secure: num(e.secure), cursor: geo(e.cursor) });
    else if (e?.e === 'select') lines.push({ t: Date.now(), e: 'select', x: num(e.x), y: num(e.y), g: /^(drag|double|triple)$/.test(e.g) ? e.g : '?' });
    else if (e?.e === 'down' || e?.e === 'right' || e?.e === 'scroll') lines.push({ t: Date.now(), e: e.e, x: num(e.x), y: num(e.y) });
    else if (e?.e === 'app') lines.push({ t: Date.now(), e: 'app', app: /^[\w .-]{1,80}$/.test(String(e.app)) ? String(e.app) : '?' });
    else if (e?.e === 'ready') lines.push({ t: Date.now(), e: 'ready' });
    else if (e?.e === 'beamref') lines.push({ t: Date.now(), e: 'beamref', cursor: geo(e.cursor) });
  });
  child.on('error', () => {});
  shadow = { child, lines };
  note(`The helper's own reads (${tag})`, `a second copy of ${path.basename(helperFile)} runs for this launch (pid ${child.pid}), its lines kept`);
}
function stopShadow(tag) {
  if (!shadow) return;
  const n = (k) => shadow.lines.filter((l) => l.e === k).length;
  const ref = shadow.lines.find((l) => l.e === 'beamref');
  note(`The helper's own reads (${tag}): totals`, `ready ${n('ready')}, down ${n('down')}, press ${n('press')}, select ${n('select')}, app ${n('app')}${ref ? `; beamref (NSCursor.iBeam):${ref.cursor || ' none'}` : ''}`);
  try { shadow.child.stdin.end(); } catch {}
  shadow.child.kill();
  shadow = null;
}
/** The helper's own lines from `since` to `until`, in order ("down at x,y, press at x,y (pointer mx,my) beam=1 known=1
 * secure=0 cursor …, select drag at x,y, app com.unvibe.app"); '' with no shadow helper. Lines are stamped when node
 * reads them, so callers read after an await that follows the press. */
const helperSaid = (since, until = Date.now()) => {
  if (!shadow) return '';
  const got = shadow.lines.filter((l) => l.t >= since && l.t <= until && l.e !== 'ready' && l.e !== 'beamref');
  const at = (l) => (l.x !== undefined ? ` at ${l.x},${l.y}` : '');
  const one = (l) => {
    if (l.e === 'press') return `press${at(l)}${l.mx !== undefined ? ` (pointer ${l.mx},${l.my})` : ''} beam=${l.beam} known=${l.known}${l.secure !== undefined ? ` secure=${l.secure}` : ''}${l.cursor ?? ''}`;
    if (l.e === 'select') return `select ${l.g}${at(l)}`;
    if (l.e === 'app') return `app ${l.app}`;
    return `${l.e}${at(l)}`;
  };
  return got.length ? got.map(one).join(', ') : 'no line';
};
/** A helper cursor object as text, numbers only: " cursor hot 12,11 size 24x24 aspect 0.4 rel 0.5/0.5 agree 0.91". */
function geo(c) {
  if (!c || typeof c !== 'object') return '';
  if (c.none) return ' cursor none';
  const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : '?');
  const pair = (v, sep) => (Array.isArray(v) ? `${n(v[0])}${sep}${n(v[1])}` : '?');
  return ` cursor hot ${pair(c.hot, ',')} size ${pair(c.size, 'x')} aspect ${n(c.aspect)} rel ${pair(c.rel, '/')}${c.agree !== undefined ? ` agree ${n(c.agree)}` : ''}`;
}
/** What the harness read around a press, and what the helper itself read (when its copy runs). */
const readsText = (harness, since) => [harness && `the harness read ${harness}`, shadow && `the helper read ${helperSaid(since)}`].filter(Boolean).join('; ');
/** Keys typed into whatever is in front, as a person would (System Events / SendKeys). */
const keys = {
  escape() { if (os === 'mac') osa('tell application "System Events" to key code 53'); else ps("Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('{ESC}')"); },
  find() { if (os === 'mac') osa('tell application "System Events" to keystroke "f" using command down'); else ps("Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^f')"); },
  /** Unvibe's shortcut (the default: Control+U on a Mac, Ctrl+Alt+U on Windows). */
  unvibe() { if (os === 'mac') osa('tell application "System Events" to keystroke "u" using control down'); else ps("Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^%u')"); },
};

// --- The clipboard ------------------------------------------------------------------------------------------------
function setClipboard(text) {
  if (os === 'mac') execFileSync('pbcopy', { input: text });
  else execFileSync('powershell', ['-NoProfile', '-Command', '[Console]::In.ReadToEnd() | Set-Clipboard'], { input: text });
}
const readClipboard = () => (os === 'mac' ? execFileSync('pbpaste', { encoding: 'utf8' }) : ps('Get-Clipboard -Raw') ?? '');

// --- Windows on the screen, front to back --------------------------------------------------------------------------
const zScript = path.join(TMP, 'unvibe-d5-windows.ps1');
if (os === 'windows') writeFileSync(zScript, [
  'Add-Type @"',
  'using System; using System.Collections.Generic; using System.Runtime.InteropServices;',
  'public class Z {',
  '  public delegate bool EnumProc(IntPtr h, IntPtr l);',
  '  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);',
  '  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);',
  '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);',
  '  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }',
  '  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);',
  '  // The region a window really has (SetWindowRgn, Electron setShape): 0 error / no region, 1 empty, 2 simple, 3 complex;',
  '  // its box is relative to the window rect (unvibe-app 438db5df: the ghost clipped to 32×32 inside a 64×64 window).',
  '  [DllImport("user32.dll")] public static extern int GetWindowRgnBox(IntPtr h, out RECT r);',
  '  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();',
  '  public static List<string> All() {',
  '    var o = new List<string>();',
  '    EnumWindows((h, l) => { if (IsWindowVisible(h)) { uint p; GetWindowThreadProcessId(h, out p); RECT r; GetWindowRect(h, out r); RECT g; int t = GetWindowRgnBox(h, out g); if (r.R > r.L && r.B > r.T) o.Add(p + "\\t" + r.L + " " + r.T + " " + (r.R - r.L) + " " + (r.B - r.T) + "\\t" + t + " " + g.L + " " + g.T + " " + (g.R - g.L) + " " + (g.B - g.T)); } return true; }, IntPtr.Zero);',
  '    return o;',
  '  }',
  '}',
  '"@',
  '[void][Z]::SetProcessDPIAware()',
  'foreach ($l in [Z]::All()) { $f = $l.Split("`t"); $p = [int]$f[0]; $name = (Get-Process -Id $p -ErrorAction SilentlyContinue).ProcessName; "$p`t$name`t0`t$($f[1])`t$($f[2])" }',
].join('\r\n'));
/** Every visible window, front to back: { pid, owner, layer, x, y, w, h } (Mac points, Windows physical px); on
 * Windows also `rgn`: the window's region box relative to it ({ type, x, y, w, h }; type 0 = no region). */
function screenWindows() {
  const text = os === 'mac'
    ? execFileSync(process.env.MOUSE, ['list'], { encoding: 'utf8' })
    : execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', zScript], { encoding: 'utf8', timeout: 60000 });
  return text.split(/\r?\n/).filter(Boolean).map((l) => {
    const [pid, owner, layer, rect, region] = l.split('\t');
    const [x, y, w, h] = (rect ?? '').split(' ').map(Number);
    const [type, rx, ry, rw, rh] = (region ?? '').split(' ').map(Number);
    return { pid: Number(pid), owner: owner ?? '', layer: Number(layer), x, y, w, h, rgn: region ? { type, x: rx, y: ry, w: rw, h: rh } : null };
  });
}
/** Windows: the button's own window (Unvibe's, at the page's window position) with its region, or null. */
function ghostWindow(app, g) {
  if (os !== 'windows') return null;
  const pids = new Set(processTree(app.process.pid).map((p) => p.pid));
  return screenWindows().filter((w) => pids.has(w.pid) && Math.abs(w.x - g.x) <= 2 && Math.abs(w.y - g.y) <= 2).sort((a, b) => a.w * a.h - b.w * b.h)[0] ?? null;
}
const rgnText = (w) => (!w ? 'its window not found' : `GetWindowRect ${w.w}×${w.h}; region ${w.rgn?.type === 2 || w.rgn?.type === 3 ? `${w.rgn.w}×${w.rgn.h} at +${w.rgn.x},+${w.rgn.y} (type ${w.rgn.type})` : `none (type ${w.rgn?.type ?? '?'})`}`);

// --- Processes and CPU ---------------------------------------------------------------------------------------------
/** Unvibe's process tree (the main process and every child, the helper too) with its CPU seconds so far. */
function processTree(rootPid) {
  let all;
  if (os === 'mac') {
    all = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,time=,comm='], { encoding: 'utf8' }).split('\n').filter(Boolean).map((l) => {
      const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(l);
      if (!m) return null;
      const parts = m[3].split(':').map(Number);
      const cpu = parts.reduce((acc, v) => acc * 60 + v, 0);
      return { pid: Number(m[1]), ppid: Number(m[2]), cpu, name: path.basename(m[4]) };
    }).filter(Boolean);
  } else {
    const json = ps('Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,KernelModeTime,UserModeTime | ConvertTo-Json -Compress');
    all = JSON.parse(json).map((p) => ({ pid: p.ProcessId, ppid: p.ParentProcessId, cpu: (Number(p.KernelModeTime) + Number(p.UserModeTime)) / 1e7, name: p.Name }));
  }
  const tree = new Map();
  const add = (pid) => { for (const p of all) if ((p.pid === pid || p.ppid === pid) && !tree.has(p.pid)) { tree.set(p.pid, p); if (p.pid !== pid) add(p.pid); } };
  add(rootPid);
  return [...tree.values()];
}
const isHelper = (p) => /unvibe-selection-watch/i.test(p.name);
async function cpuOver(app, seconds) {
  const a = processTree(app.process.pid);
  const t0 = Date.now();
  await sleep(seconds * 1000);
  const b = processTree(app.process.pid);
  const wall = (Date.now() - t0) / 1000;
  const rows = b.map((p) => ({ ...p, used: p.cpu - (a.find((q) => q.pid === p.pid)?.cpu ?? p.cpu) }));
  const pct = (sec) => r1((sec / wall) * 1000) / 10; // % of one core, 2 decimals
  const total = rows.reduce((s, p) => s + p.used, 0);
  const helper = rows.filter(isHelper).reduce((s, p) => s + p.used, 0);
  return { wall: r1(wall), total: pct(total), helper: pct(helper), helperRunning: b.some(isHelper), detail: rows.map((p) => `${p.name}#${p.pid} ${pct(p.used)} %`).join(', ') };
}

// --- The API host blocked in the hosts file (launch C) --------------------------------------------------------------
const HOSTS = os === 'mac' ? '/etc/hosts' : 'C:\\Windows\\System32\\drivers\\etc\\hosts';
const HOSTS_ORIG = path.join(TMP, 'hosts.d5.orig');
const MARK = '# unvibe-qa-d5';
let hostsBefore = null;
function blockApi() {
  hostsBefore = sha(HOSTS);
  const lines = `\n0.0.0.0 ${host} ${MARK}\n:: ${host} ${MARK}\n`;
  if (os === 'mac') {
    execFileSync('sudo', ['-n', 'cp', HOSTS, HOSTS_ORIG]);
    execFileSync('sudo', ['-n', 'tee', '-a', HOSTS], { input: lines, stdio: ['pipe', 'ignore', 'inherit'] });
    execFileSync('sudo', ['-n', 'dscacheutil', '-flushcache']);
    execFileSync('sudo', ['-n', 'killall', '-HUP', 'mDNSResponder']);
  } else {
    writeFileSync(HOSTS_ORIG, readFileSync(HOSTS));
    writeFileSync(HOSTS, Buffer.concat([readFileSync(HOSTS), Buffer.from(lines.replace(/\n/g, '\r\n'))]));
    execFileSync('ipconfig', ['/flushdns'], { stdio: 'ignore' });
  }
  note('The API host blocked for launch C', `${host} → 0.0.0.0 and :: in ${HOSTS} (marked "${MARK}"); sha256 before ${hostsBefore}`);
}
function unblockApi() {
  if (!hostsBefore) return;
  if (os === 'mac') {
    execFileSync('sudo', ['-n', 'cp', HOSTS_ORIG, HOSTS]);
    execFileSync('sudo', ['-n', 'dscacheutil', '-flushcache']);
    execFileSync('sudo', ['-n', 'killall', '-HUP', 'mDNSResponder']);
    execFileSync('sudo', ['-n', 'rm', '-f', HOSTS_ORIG]);
  } else {
    writeFileSync(HOSTS, readFileSync(HOSTS_ORIG));
    execFileSync('ipconfig', ['/flushdns'], { stdio: 'ignore' });
    execFileSync('powershell', ['-NoProfile', '-Command', `Remove-Item -Force '${HOSTS_ORIG}'`]);
  }
  const now = sha(HOSTS);
  log(now === hostsBefore && !readFileSync(HOSTS, 'utf8').includes(MARK), 'The hosts file is back byte for byte after launch C', `sha256 before ${hostsBefore}, now ${now}`);
  hostsBefore = null;
}

// --- VS Code ---------------------------------------------------------------------------------------------------------
// The sample: 40 lines of plain code, long enough that a drag on any line starts on text and the editor fills.
const SAMPLE = Array.from({ length: 40 }, (_, i) => {
  const k = i + 1;
  return k % 4 === 0
    ? `const row${k} = items${k}.filter((item) => item.ready && item.size > ${k}).map((item) => ({ ...item, label: \`row ${k}: \${item.name}\`, weight: item.size * ${k} }));`
    : `function step${k}(value, limit = ${k * 10}) { return value > limit ? limit : value + ${k}; } // row ${k}`;
}).join('\n') + '\n';
const sampleDir = path.join(TMP, 'd5-sample');
mkdirSync(sampleDir, { recursive: true });
const sampleFile = path.join(sampleDir, 'rows.js');
writeFileSync(sampleFile, SAMPLE);
// The development extension for N6: VS Code's own password prompt (showInputBox with password: true).
const extDir = path.join(TMP, 'd5-password-prompt');
mkdirSync(extDir, { recursive: true });
writeFileSync(path.join(extDir, 'package.json'), JSON.stringify({
  name: 'qa-password-prompt', publisher: 'unvibe-qa', version: '0.0.1', engines: { vscode: '^1.80.0' },
  main: './extension.js', activationEvents: ['onStartupFinished'],
}, null, 2));
// The word in the prompt is made up per run (no secret anywhere); the rows check it never reaches the clipboard or
// Unvibe.
const PROMPT_WORD = `qaword${Date.now().toString(36)}`;
writeFileSync(path.join(extDir, 'extension.js'), [
  "const vscode = require('vscode');",
  '// N6: a password prompt in VS Code itself, holding a made-up word.',
  `exports.activate = () => { void vscode.window.showInputBox({ password: true, prompt: 'QA password prompt (N6)', value: '${PROMPT_WORD}', ignoreFocusOut: true }); };`,
  'exports.deactivate = () => {};',
].join('\n'));

const settingsFile = path.join(codeData, 'User', 'settings.json');
function vsSettings(theme) {
  mkdirSync(path.dirname(settingsFile), { recursive: true });
  writeFileSync(settingsFile, JSON.stringify({
    'window.zoomLevel': 0,
    'window.newWindowDimensions': 'maximized',
    'window.restoreWindows': 'none',
    'workbench.colorTheme': theme === 'dark' ? 'Default Dark Modern' : 'Default Light Modern',
    'workbench.startupEditor': 'none',
    'workbench.tips.enabled': false,
    'workbench.enableExperiments': false,
    'workbench.secondarySideBar.defaultVisibility': 'hidden',
    'workbench.welcomePage.walkthroughs.openOnInstall': false,
    'security.workspace.trust.enabled': false,
    'telemetry.telemetryLevel': 'off',
    'update.mode': 'none',
    'extensions.ignoreRecommendations': true,
    'chat.commandCenter.enabled': false,
    'chat.disableAIFeatures': true,
    'editor.minimap.enabled': false,
    'editor.wordWrap': 'off',
    'breadcrumbs.enabled': false,
    // Plain editor background around the button for the crops' see-through corners: no current-line band, no
    // highlighted repeats of the selected word, a caret that doesn't blink.
    'editor.renderLineHighlight': 'none',
    'editor.occurrencesHighlight': 'off',
    'editor.selectionHighlight': false,
    'editor.cursorBlinking': 'solid',
  }, null, 2));
}
const PORT = 9339;
let vs = null; // { browser, page }
async function openVsCode(extraArgs = []) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  for (const key of Object.keys(env)) if (/^(UNVIBE_|GITHUB_TOKEN|GH_TOKEN|ACTIONS_)/.test(key)) delete env[key];
  spawn(code, ['--user-data-dir', codeData, '--extensions-dir', path.join(codeData, 'extensions'), '--new-window', `--remote-debugging-port=${PORT}`, ...extraArgs, sampleFile], { stdio: 'ignore', detached: true, env }).unref();
  const browser = await waitFor(() => chromium.connectOverCDP(`http://127.0.0.1:${PORT}`), 90000, 1000);
  if (!browser) throw new Error('VS Code did not open its debug port');
  const page = await waitFor(async () => browser.contexts().flatMap((c) => c.pages()).find((p) => /workbench/.test(p.url())), 60000, 500);
  if (!page) throw new Error('no VS Code window');
  await page.locator('.monaco-editor .view-line').first().waitFor({ timeout: 60000 });
  vs = { browser, page };
  // VS Code places and maximizes its window after its first paint: run 44668914881 read the origin at (1815, 35) on
  // a 1920-wide screen, and every drag went off screen. Wait until two reads 1 s apart agree and the content starts
  // inside the screen's left half and top quarter (maximized).
  let prev = null;
  const placed = await waitFor(async () => {
    const o = await vsOrigin();
    const same = prev && o.x === prev.x && o.y === prev.y && o.k === prev.k;
    prev = o;
    const inside = !SCREEN || (o.x >= -16 && o.x < SCREEN.w / 2 && o.y >= -16 && o.y < SCREEN.h / 4);
    return same && inside ? o : null;
  }, 30000, 1000);
  note('VS Code placed', placed ? `content at (${placed.x}, ${placed.y}), ×${r1(placed.k)}${SCREEN ? ` on ${SCREEN.w}×${SCREEN.h}` : ''}` : `not settled in 30 s (last read (${prev?.x}, ${prev?.y}))`);
  return vs;
}
async function closeVsCode() {
  await vs?.browser.close().catch(() => {});
  vs = null;
  try {
    if (os === 'mac') execFileSync('pkill', ['-f', 'Visual Studio Code.app/Contents/MacOS/']);
    else execFileSync('taskkill', ['/IM', 'Code.exe', '/T', '/F'], { stdio: 'ignore' });
  } catch { /* not running */ }
  await sleep(3000);
}
/** VS Code's content origin on the screen and its CSS → screen scale. */
async function vsOrigin() {
  const inner = await vs.page.evaluate(() => ({ iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio }));
  if (os === 'mac') {
    const frameOf = (owner) => { try { return execFileSync(process.env.MOUSE, ['frame', owner], { encoding: 'utf8' }).trim(); } catch { return ''; } };
    const owner = ['Code', 'Visual Studio Code', 'Electron'].find((o) => frameOf(o));
    if (!owner) throw new Error('no on-screen VS Code window');
    const [x, y, w] = frameOf(owner).split(/\s+/).map(Number);
    return { x, y, k: w / inner.iw };
  }
  const xy = ps([
    'Add-Type @"',
    'using System; using System.Runtime.InteropServices;',
    'public class C { [StructLayout(LayoutKind.Sequential)] public struct P { public int X, Y; }',
    '  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref P p);',
    '  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }',
    '"@',
    '[void][C]::SetProcessDPIAware()',
    '$w = Get-Process Code -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1',
    '$p = New-Object C+P; [void][C]::ClientToScreen($w.MainWindowHandle, [ref]$p); "$($p.X) $($p.Y)"',
  ].join('\n')).split(/\s+/).map(Number);
  return { x: xy[0], y: xy[1], k: inner.dpr };
}
/** The editor's code lines (screen units): each line's text start and end, its centre y, and its line-number box. */
async function vsLines() {
  const o = await vsOrigin();
  const g = await vs.page.evaluate(() => {
    const lines = [...document.querySelectorAll('.monaco-editor .view-lines .view-line')].map((l) => {
      const r = l.getBoundingClientRect();
      const spans = [...l.querySelectorAll('span > span')];
      const a = spans[0]?.getBoundingClientRect();
      const z = spans.at(-1)?.getBoundingClientRect();
      return { top: r.top, h: r.height, left: a?.left ?? r.left, right: z?.right ?? r.right, text: l.textContent };
    }).sort((a, b) => a.top - b.top);
    const numbers = [...document.querySelectorAll('.monaco-editor .margin-view-overlays .line-numbers')].map((l) => {
      const r = l.getBoundingClientRect();
      return { top: r.top, h: r.height, left: r.left, right: r.right, n: Number(l.textContent) };
    });
    const ed = document.querySelector('.monaco-editor .overflow-guard')?.getBoundingClientRect();
    return { lines, numbers, editor: ed ? { left: ed.left, top: ed.top, right: ed.right, bottom: ed.bottom } : null, theme: document.querySelector('.monaco-workbench')?.classList.contains('vs-dark') ? 'dark' : 'light' };
  });
  const S2 = (x, y) => ({ x: o.x + x * o.k, y: o.y + y * o.k });
  return {
    o,
    theme: g.theme,
    editor: g.editor && { ...S2(g.editor.left, g.editor.top), right: o.x + g.editor.right * o.k, bottom: o.y + g.editor.bottom * o.k },
    lines: g.lines.filter((l) => l.text.trim()).map((l) => ({ y: o.y + (l.top + l.h / 2) * o.k, left: o.x + l.left * o.k, right: o.x + l.right * o.k, text: l.text })),
    numbers: g.numbers.map((l) => ({ y: o.y + (l.top + l.h / 2) * o.k, x: o.x + ((l.left + l.right) / 2) * o.k, n: l.n })),
  };
}
const vsSelected = () => vs.page.evaluate(() => document.querySelectorAll('.monaco-editor .selected-text').length);
/** VS Code's caret on the screen (screen units): the primary cursor's middle, or null. */
async function vsCaret() {
  const o = await vsOrigin();
  const c = await vs.page.evaluate(() => { const r = document.querySelector('.monaco-editor .cursors-layer .cursor')?.getBoundingClientRect(); return r && r.height ? { x: r.left, y: r.top + r.height / 2, h: r.height } : null; });
  return c ? { x: o.x + c.x * o.k, y: o.y + c.y * o.k, h: c.h * o.k } : null;
}
/** VS Code's editor scrollbar slider (screen units): its centre and height, or null. */
async function vsSlider() {
  const o = await vsOrigin();
  const r = await vs.page.evaluate(() => { const s = document.querySelector('.monaco-editor .scrollbar.vertical .slider')?.getBoundingClientRect(); return s && s.height && s.width ? { x: s.left + s.width / 2, y: s.top + s.height / 2, h: s.height } : null; });
  return r ? { x: o.x + r.x * o.k, y: o.y + r.y * o.k, h: r.h * o.k } : null;
}
/** The slider dragged back to where it was (`s0`, before a drag), then the editor's top line compared with `top0`. */
async function sliderBack(s0, top0) {
  const s = await vsSlider();
  if (s && Math.abs(s.y - s0.y) > 0.5) pointer.drag(s.x, s.y, s.x, s0.y);
  await sleep(300);
  const top = Math.min(...(await vsLines()).numbers.map((x) => x.n));
  return top === top0 ? `scrolled back (top line ${top})` : `NOT scrolled back: top line ${top}, was ${top0}`;
}

// --- Unvibe -------------------------------------------------------------------------------------------------------
const baseEnv = { ...process.env };
for (const key of Object.keys(baseEnv)) {
  if (/^(UNVIBE_ADMIN_STATS_TOKEN|UNVIBE_QA_FLAG_TOKEN|GITHUB_TOKEN|GH_TOKEN|ACTIONS_.*|UNVIBE_USER_DATA|MOUSE|VSCODE.*)$/.test(key)) delete baseEnv[key];
}
const netlogs = [];
let version = '?';
let scale = 1; // Unvibe's DIP → physical px on Windows (launch B: 1.5)
async function launch(tag, extraArgs = []) {
  const P = `${base}-${tag}`;
  mkdirSync(P, { recursive: true });
  if (!existsSync(path.join(P, 'unvibe-store.json'))) writeFileSync(path.join(P, 'unvibe-store.json'), JSON.stringify({ installId, loginPromptAsked: true }));
  const net = path.join(netDir, `netlog-d5-${tag}.json`);
  netlogs.push({ tag, file: net });
  const app = await launchApp({ exe, userData: P, env: { ...baseEnv, UNVIBE_USER_DATA: P }, timeout: 90000, args: [...extraArgs, netLogArg(net)] });
  const companion = await app.windowWith('companion.html', 60000);
  if (!companion) throw new Error('the main window did not open');
  await companion.waitForLoadState('domcontentloaded');
  version = (await companion.evaluate(() => window.unvibe.appInfo())).version;
  // Setup skipped as a person does (Let's go, then Skip for now until it ends); nothing typed, nothing sent. Each
  // step waits for either its Skip for now or the setup's end: on the Mac (runs 44668914881 and 44671864693) the
  // setup had already ended when the loop still looked for one more Skip for now and timed out.
  await companion.locator('.onboard__count').first().waitFor({ timeout: 20000 });
  const onboard = companion.locator('.onboard');
  const skip = companion.getByRole('button', { name: 'Skip for now', exact: true });
  for (let i = 0; i < 8 && await onboard.count(); i++) {
    const primary = companion.locator('.onboard__primary');
    if (((await primary.textContent().catch(() => '')) ?? '').includes("Let's go")) await primary.click();
    else {
      // A failed wait never settles its leg (no unhandled rejection after the race); the timer gives 'none'.
      const never = new Promise(() => {});
      const next = await Promise.race([
        skip.waitFor({ state: 'visible', timeout: 10000 }).then(() => 'skip', () => never),
        onboard.waitFor({ state: 'detached', timeout: 10000 }).then(() => 'gone', () => never),
        sleep(10500).then(() => 'none'),
      ]);
      if (next === 'gone') break;
      if (next === 'none') {
        const step = ((await onboard.first().innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
        throw new Error(`setup step ${i + 1} shows no Skip for now in 10 s: "${step}"`);
      }
      await skip.click({ timeout: 5000 });
    }
    await sleep(900);
  }
  await onboard.waitFor({ state: 'detached', timeout: 10000 });
  await companion.evaluate(() => window.unvibe.setSettings({ theme: 'light', startAnimation: false }));
  await sleep(800);
  note(`Launch ${tag}`, `Unvibe ${version}${extraArgs.length ? ` (${extraArgs.join(' ')})` : ''}; setup skipped`);
  return { app, companion };
}
/** The main window out of the way, as a person does: Window › Minimize on a Mac, its minimize button on Windows. */
async function minimize(app, companion) {
  if (os === 'mac') {
    try {
      osa(`tell application "System Events" to tell (first process whose unix id is ${app.process.pid}) to set frontmost to true`);
      await sleep(500);
      osa(`tell application "System Events" to tell (first process whose unix id is ${app.process.pid}) to click menu item "Minimize" of menu "Window" of menu bar 1`);
    } catch (e) { note('Minimize the main window', short(e)); }
  } else {
    const m = await companion.evaluate(() => ({ x: screenX, y: screenY, w: outerWidth }));
    pointer.click((m.x + m.w - 115) * scale, (m.y + 20) * scale);
  }
  // Chromium keeps visibilityState "visible" for a minimized window on Windows (run 44668914881's still shows it
  // minimized); there the window sits at Windows' minimized position, x −32000.
  const hidden = await waitFor(async () => (await companion.evaluate(() => document.visibilityState === 'hidden' || screenX <= -10000)), 5000);
  note('The main window minimized', hidden ? 'yes' : 'no (it may cover VS Code)');
}
const ghostPage = (app) => app.windows().find((w) => /\/ghost\.html/.test(w.url()) && !w.isClosed()) ?? null;
const panelPage = (app) => app.windows().find((w) => /\/widget\.html/.test(w.url()) && !w.isClosed()) ?? null;
const barPage = (app) => app.windows().find((w) => /\/bar\.html/.test(w.url()) && !w.isClosed()) ?? null;
/** The button's window: what it shows and where (screen units), and `b`, the button's (or the card's) own box. On
 * Windows the window was 64×64 px around a 32 px button at its top-left (run 44671864693), so rows that place,
 * hover or press go by `b`, not by the window. */
async function ghost(app) {
  const g = ghostPage(app);
  if (!g) return null;
  const s = await g.evaluate(() => {
    const b = document.querySelector('.ghost');
    const q = document.querySelector('.quick');
    // The laid-out box (offsetWidth/Height: no transform), around the drawn box's centre. Run 44673965024 read the
    // drawn box mid-entrance (30.1, 31.1, 29.5 px: the button scales in), so the size varied by round.
    const el = b ?? q;
    const r = el?.getBoundingClientRect();
    const ow = el?.offsetWidth ?? 0;
    const oh = el?.offsetHeight ?? 0;
    return {
      shown: Boolean(b || q), pill: Boolean(b?.classList.contains('ghost--pill')), flipped: Boolean(b?.classList.contains('ghost--flipped')),
      quick: Boolean(q), quickText: q ? q.innerText : '', x: screenX, y: screenY, w: outerWidth, h: outerHeight, t: Date.now(), log: window.__qaLog ?? null, ev: window.__qaEv ?? null,
      b: r ? { x: screenX + r.left + r.width / 2 - ow / 2, y: screenY + r.top + r.height / 2 - oh / 2, w: ow, h: oh, drawn: r.width } : null,
    };
  }).catch(() => null);
  if (!s) return null;
  const k = os === 'windows' ? scale : 1;
  const b = s.b ? { x: s.b.x * k, y: s.b.y * k, w: s.b.w * k, h: s.b.h * k, drawn: s.b.drawn * k } : null;
  return { ...s, x: s.x * k, y: s.y * k, w: s.w * k, h: s.h * k, b };
}
/** A row near index `i` and a mouse-up x right of its text whose surroundings are the editor's plain background: right
 * of every code line on screen when there's room for the pill (240 px) before the editor's right edge; otherwise
 * (the Mac's 1280 px screen: the long rows reach ~1100 px) the first row from `i` whose two neighbours are short rows
 * too, with the mouse-up 12 px right of the longest of the three. Run 44677798585 (Mac A4) put the button right of
 * a short row under a long one: the long row's glyphs sat at the button's top corners. */
const plainEnd = (L, i) => {
  const x = Math.max(...L.lines.map((l) => l.right)) + 40;
  const room = (L.editor?.right ?? SCREEN?.w ?? Infinity) - 300;
  if (x <= room) return { row: L.lines[i], x };
  const longest = Math.max(...L.lines.map((l) => l.right));
  for (let j = Math.max(1, i); j < L.lines.length - 1; j++) {
    const three = [L.lines[j - 1], L.lines[j], L.lines[j + 1]];
    const end = Math.max(...three.map((l) => l.right));
    if (end + 60 < longest) return { row: L.lines[j], x: end + 12 };
  }
  return { row: L.lines[i], x: L.lines[i].right + 2 };
};
/** The cursor reads found a cursor the helper can judge. The helper's own press lines decide when present (known=1
 * on every press); otherwise the harness's: Windows CURSOR_SHOWING with a handle, Mac NSCursor.currentSystem not nil
 * (both helpers count "can't say" as text). */
const cursorReadable = (said) => {
  const own = [...String(said).matchAll(/press at [^;]*? beam=\d known=(\d)/g)];
  if (own.length) return own.every(([, k]) => k === '1');
  if (os === 'mac') {
    const reads = [...String(said).matchAll(/(hot=\S+|cur=none)/g)];
    return reads.length > 0 && reads.every(([r]) => r.startsWith('hot='));
  }
  const reads = [...String(said).matchAll(/flags=(\d+) null=(\d)/g)];
  return reads.length > 0 && reads.every(([, f, n]) => (Number(f) & 1) === 1 && n === '0');
};
/** The middle of the button's own box (the window's when the page gave none). */
const mid = (g) => (g.b ? { x: g.b.x + g.b.w / 2, y: g.b.y + g.b.h / 2 } : { x: g.x + g.w / 2, y: g.y + g.h / 2 });
/** Records each show and hide in the button's page with its time, and each pointer event that reaches the page (type,
 * time, the target's class: Mac A4 run 44677798585, a press on the button that opened nothing). Read only; listeners
 * in the capture phase, passive, never stopping anything; installed once the page exists. */
async function watchGhost(app) {
  await ghostPage(app)?.evaluate(() => {
    if (window.__qaLog) return;
    window.__qaLog = [];
    window.__qaEv = [];
    const mark = () => {
      const s = Boolean(document.querySelector('.ghost, .quick'));
      const l = window.__qaLog;
      if (!l.length || l[l.length - 1].s !== s) l.push({ s, t: Date.now() });
    };
    new MutationObserver(mark).observe(document.getElementById('root'), { childList: true, subtree: true, attributes: true });
    mark();
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'focus', 'blur']) {
      window.addEventListener(type, (e) => {
        const ev = window.__qaEv;
        const on = e.target === window ? 'window' : String(e.target?.getAttribute?.('class') ?? e.target?.nodeName ?? '');
        if (ev.length < 400) ev.push({ type, t: Date.now(), on: on.slice(0, 40) });
      }, { capture: true, passive: true });
    }
  }).catch(() => {});
}
/** The pointer events that reached the button's page from `since`: "pointerdown@+12 ms (ghost)…", or 'none'. */
const pageEvents = (g, since) => {
  if (!g?.ev) return 'not watched';
  const got = g.ev.filter((e) => e.t >= since);
  return got.length ? got.map((e) => `${e.type}@+${e.t - since} ms${e.on ? ` (${e.on})` : ''}`).join(', ') : 'none';
};
const shownAt = (g, since) => g?.log?.find((e) => e.s && e.t >= since)?.t ?? null;
const hiddenAt = (g, since) => g?.log?.find((e) => !e.s && e.t >= since)?.t ?? null;
const waitShown = (app, ms = 3000) => waitFor(async () => { const g = await ghost(app); return g?.shown ? g : null; }, ms, 10);
const waitHidden = (app, ms = 3000) => waitFor(async () => { const g = await ghost(app); return g && !g.shown ? g : null; }, ms, 20);
const aiPosts = (launchTag) => apiRequests(netlogs.find((l) => l.tag === launchTag).file, host).filter((q) => q.method === 'POST' && /^\/api\/v1\/(reviews|comprehension|previews)\b/.test(q.path));
/** A 1:1 crop of the button (its own box in its page: the button, the pill or the card) with 8 px around it, and
 * whether its corners are see-through: the colour just inside each corner of the box equals the colour 3 px beside
 * the box on the same row. Beside, not diagonally out: in run 44673965024's dark pill crop a light box (a tooltip, by
 * its look) sat just below the pill, under the diagonal sample (0/0/0/224). The box, not the window: on Windows the window is 64×64
 * around a 32 px button (run 44671864693). */
function cropGhost(label, s) {
  const g = s.b ?? s;
  const m = Math.round(8 * (os === 'windows' ? scale : 1));
  const f = grab(file(label), g.x - m, g.y - m, g.w + 2 * m, g.h + 2 * m);
  const img = readPng(f);
  const inside = [[m + 1, m + 1], [m + Math.round(g.w) - 2, m + 1], [m + 1, m + Math.round(g.h) - 2], [m + Math.round(g.w) - 2, m + Math.round(g.h) - 2]];
  const outside = [[m - 3, m + 1], [m + Math.round(g.w) + 2, m + 1], [m - 3, m + Math.round(g.h) - 2], [m + Math.round(g.w) + 2, m + Math.round(g.h) - 2]];
  const diffs = inside.map((p, i) => rgbDiff(img.rgb(...p), img.rgb(...outside[i])));
  return { f, size: `${img.w}×${img.h}`, sha: sha(f).slice(0, 12), clear: diffs.every((d) => d <= 24), diffs };
}
/**
 * Hover the shown button until the pill opens and crop the pill; then the pointer off it (to `rest`) and crop the
 * button at rest. Hover comes first: a hovered button doesn't leave, and its 4 s start again when the pointer leaves,
 * so the slower Windows captures can't outlast it.
 */
async function pillThenButton(app, g, label, rest) {
  // Run 44675654106's A6 (Windows) saw no pill after one move onto the flipped button (run 3's opened). A person's
  // hover is many moves: if the pill isn't open after 1.2 s, the pointer moves 1 px and back, then waits again.
  const m = mid(g);
  pointer.move(m.x, m.y);
  const open = async () => { const s = await ghost(app); return s?.pill ? s : null; };
  let pill = await waitFor(open, 1200, 20);
  let nudged = false;
  if (!pill) {
    nudged = true;
    pointer.move(m.x + 1, m.y + 1);
    await sleep(60);
    pointer.move(m.x, m.y);
    pill = await waitFor(open, 1500, 20);
  }
  await sleep(250);
  const cp = pill ? cropGhost(`${label}-pill-1to1`, await ghost(app)) : null;
  pointer.move(rest.x, rest.y);
  const back = await waitFor(async () => { const s = await ghost(app); return s?.shown && !s.pill ? s : null; }, 2000, 20);
  await sleep(200);
  const cb = back ? cropGhost(`${label}-button-1to1`, await ghost(app)) : null;
  return { pill, cp, back, cb, nudged };
}
const crops = (r) => `${r.nudged ? `pill ${r.pill ? 'opened after a 1 px nudge' : 'not open after a 1 px nudge either'}; ` : ''}button crop ${r.cb ? `${r.cb.size} sha ${r.cb.sha} (corner diffs ${r.cb.diffs.join('/')})` : 'none (gone)'}; pill crop ${r.cp ? `${r.cp.size} sha ${r.cp.sha} (${r.cp.diffs.join('/')})` : 'none'}`;

// --- Launch A: the button in VS Code --------------------------------------------------------------------------------
async function runA(app, companion, tag) {
  const L = await vsLines();
  if (L.lines.length < 20) throw new Error(`VS Code shows ${L.lines.length} code lines`);
  note(`VS Code (${tag})`, `${L.theme}; content at (${L.o.x}, ${L.o.y}), CSS → screen ×${r1(L.o.k)}; ${L.lines.length} code lines on screen; editor ${L.editor ? `${Math.round(L.editor.x)}..${Math.round(L.editor.right)} × ${Math.round(L.editor.y)}..${Math.round(L.editor.bottom)}` : '?'}`);
  // VS Code in front, as a person clicks into it.
  pointer.click(L.lines[0].right + 60, L.lines[0].y);
  await sleep(600);

  // A1: turning the button on (Settings, the main window) starts the helper; on a Mac, no permission prompt.
  const before = os === 'mac' ? screenWindows() : [];
  const settingsOn = await companion.evaluate(() => window.unvibe.setBubble('ghost', true));
  await sleep(6000);
  const helperOn = processTree(app.process.pid).filter(isHelper);
  log(settingsOn.ghost === true && settingsOn.preview === false && helperOn.length === 1, `A1 ${tag}: the button turned on in Settings starts the helper (Quick look stays off)`,
    `settings ghost ${settingsOn.ghost}, preview ${settingsOn.preview}, available ${settingsOn.available}; helper processes ${helperOn.map((p) => `${p.name}#${p.pid}`).join(', ') || 'none'}`);
  if (os === 'mac') {
    const after = screenWindows();
    const owners = new Set(before.map((w) => w.owner));
    const fresh = after.filter((w) => !owners.has(w.owner) && !/^(Unvibe|Code|Visual Studio Code|Electron)$/.test(w.owner));
    desktop(`${tag}-button-on`);
    log(fresh.length === 0, `A1 ${tag}: no new permission prompt when the helper starts (Unvibe's Accessibility reset first)`,
      fresh.length ? `new windows: ${fresh.map((w) => `${w.owner} ${w.w}×${w.h} at (${w.x}, ${w.y})`).join('; ')}` : `no window of a new owner (${after.length} on screen); still desktop-${tag}-button-on`);
  }

  // A2: five drags; latency and placement. Round 1 leaves by itself (4 s), the others on a click elsewhere.
  const rounds = [];
  for (const [i, li] of [3, 6, 9, 12, 15].entries()) {
    const row = (await vsLines()).lines[li];
    const from = { x: row.left + 2, y: row.y };
    const to = { x: Math.min(row.right - 2, from.x + 420), y: row.y };
    const since = Date.now();
    const up = pointer.drag(from.x, from.y, to.x, to.y);
    const g = await waitShown(app, 3000);
    if (i === 0) await watchGhost(app);
    const g2 = g ? await ghost(app) : null;
    // Round 1: the page's show/hide log is installed only after the button first shows (the window is created then),
    // so its first mark is the install time, not the show: round 1 uses the poll time.
    const precise = i === 0 ? null : shownAt(g2, since);
    const latency = g ? (precise ?? g.t) - up : null;
    const r = { round: i + 1, line: li + 1, up, latency, how: precise ? 'page' : 'poll', selected: await vsSelected(), said: readsText(pointer.last, pointer.t0) };
    if (g) {
      const b = (g2 ?? g).b ?? g;
      r.dx = r1(b.x - to.x); r.cy = r1(b.y + b.h / 2 - to.y); r.size = `${r1(b.w)}×${r1(b.h)}${b.drawn !== undefined && !near(b.drawn, b.w, 0.5) ? ` (drawn ${r1(b.drawn)} at that moment)` : ''}`; r.bw = b.w; r.win = `${r1(g.w)}×${r1(g.h)} at mouse-up x + ${r1(g.x - to.x)}, y ${r1(g.y - to.y)}`;
      if (i === 0) {
        const gone = await waitHidden(app, 7000);
        const g3 = await ghost(app);
        const hidT = hiddenAt(g3, since) ?? gone?.t ?? null;
        // From the mouse-up (the same clock): GHOST_IDLE_MS (4 s) runs from main's show, which comes after it
        // (unvibe-app run-5 read: expect 3.5-4.5 s).
        r.leave = hidT ? `left by itself ${hidT - up} ms after the mouse-up` : 'still shown after 7 s';
        r.idleMs = hidT ? hidT - up : null;
      } else {
        const clickAt = Date.now();
        pointer.click(L.lines[1].right + 80, L.lines[1].y);
        const gone = await waitHidden(app, 2000);
        r.leave = gone ? `left on a click elsewhere (${(hiddenAt(await ghost(app), clickAt) ?? gone.t) - clickAt} ms after the click call)` : 'still shown 2 s after a click elsewhere';
        r.clickOk = Boolean(gone);
      }
    }
    rounds.push(r);
    await sleep(500);
  }
  const shown = rounds.filter((r) => r.latency !== null);
  const warm = shown.filter((r) => r.round > 1).map((r) => r.latency).sort((a, b) => a - b);
  const median = warm.length ? warm[Math.floor((warm.length - 1) / 2)] : null;
  for (const r of rounds) note(`A2 ${tag} round ${r.round}`, `${r.latency === null ? `line ${r.line}: no button in 3 s (VS Code selection boxes ${r.selected})` : `line ${r.line}: button ${r.latency} ms after mouse-up (${r.how}); the button ${r.size} at mouse-up x + ${r.dx}, its centre ${r.cy} from the mouse-up's y (its window ${r.win}); ${r.leave}`}${r.said ? `; ${r.said}` : ''}`);
  log(shown.length === rounds.length, `A2 ${tag}: a real drag in VS Code shows the button (5 of 5)`, `${shown.length} of ${rounds.length}`);
  log(median !== null && median <= 150, `A2 ${tag}: mouse-up → button within the brief's 150 ms (median of rounds 2-5)`,
    `rounds 2-5: ${warm.join(', ')} ms (median ${median}); round 1 (the window is created): ${rounds[0].latency ?? '-'} ms. Measured from the release event's time to the button's node in its page (MutationObserver), same clock`);
  const k0 = os === 'windows' ? scale : 1;
  const placedOk = shown.length > 0 && shown.every((r) => near(r.dx, 8 * k0, 1.5) && near(r.cy, 0, 1.5) && near(r.bw, 32 * k0, 1.5));
  log(placedOk, `A2 ${tag}: the button (${32 * k0} px) sits 8 px right of the mouse-up, centred on it (its own box in its page)`, shown.map((r) => `${r.size} +${r.dx}/${r.cy}`).join(', '));
  log(rounds[0].idleMs !== null && rounds[0].idleMs >= 3500 && rounds[0].idleMs <= 4500, `A2 ${tag}: an untouched button leaves about 4 s after it shows (3.5-4.5 s after the mouse-up)`, rounds[0].leave ?? 'not shown');
  log(rounds.slice(1).every((r) => r.clickOk), `A2 ${tag}: a click elsewhere hides the button`, rounds.slice(1).map((r) => r.leave ?? 'not shown').join('; '));

  // A2b (lead, unvibe-app 2026-11-20): on Windows the button's window stays 64×64 (GetWindowRect) around a 32 px button;
  // 438db5df clips it to the button with a window region. Clicks 20 px right of, below, and right of and below the
  // button (the old invisible strip) have to land in VS Code: its selection goes and its caret moves there. The
  // button is measured by its own box in its page and, on Windows, by the window's region (GetWindowRgnBox).
  const strips = [];
  for (const [where, li, ox, oy] of [['right of', 17, 20, 0], ['below', 18, 0, 20], ['right of and below', 21, 20, 20]]) {
    const Ls = await vsLines();
    const rowT = Ls.lines[li];
    const toT = { x: Math.min(rowT.right - 2, rowT.left + 420), y: rowT.y };
    pointer.drag(rowT.left + 2, rowT.y, toT.x, toT.y);
    const gt = await waitShown(app, 3000);
    if (!gt?.b) { strips.push({ where, ok: false, text: `no button for the drag on line ${li + 1}` }); continue; }
    const k1 = os === 'windows' ? scale : 1;
    if (strips.length === 0 && os === 'windows') {
      const w = ghostWindow(app, gt);
      const clipped = Boolean(w?.rgn && (w.rgn.type === 2 || w.rgn.type === 3) && near(w.x + w.rgn.x, gt.b.x, 1.5) && near(w.y + w.rgn.y, gt.b.y, 1.5) && near(w.rgn.w, gt.b.w, 1.5) && near(w.rgn.h, gt.b.h, 1.5));
      log(clipped, `A2 ${tag}: the button's window is clipped to the button (its region = the button's ${r1(32 * k1)} px box)`,
        `${rgnText(w)}${w ? ` at (${w.x}, ${w.y})` : ''}; the button ${r1(gt.b.w)}×${r1(gt.b.h)} at (${r1(gt.b.x)}, ${r1(gt.b.y)})`);
    }
    const at = { x: gt.b.x + gt.b.w + (ox ? ox * k1 : -gt.b.w / 2), y: gt.b.y + gt.b.h + (oy ? oy * k1 : -gt.b.h / 2) };
    const lineAt = Ls.lines.reduce((best, l) => (Math.abs(l.y - at.y) < Math.abs(best.y - at.y) ? l : best), Ls.lines[0]);
    const selBefore = await vsSelected();
    const shownAtClick = Boolean((await ghost(app))?.shown);
    pointer.click(at.x, at.y);
    await sleep(600);
    const selAfter = await vsSelected();
    const caret = await vsCaret();
    const gone = await waitHidden(app, 2000);
    const onLine = Boolean(caret) && Math.abs(caret.y - lineAt.y) <= caret.h * 0.75;
    const atX = Boolean(caret) && (lineAt.right < at.x + 12 || Math.abs(caret.x - at.x) <= 12);
    strips.push({
      where, ok: shownAtClick && selBefore > 0 && selAfter === 0 && onLine && atX,
      text: `click (${Math.round(at.x)}, ${Math.round(at.y)}) with the button ${shownAtClick ? 'shown' : 'already gone (row not proven)'}: the button ${r1(gt.b.w)}×${r1(gt.b.h)} at (${r1(gt.b.x)}, ${r1(gt.b.y)}) in a ${r1(gt.w)}×${r1(gt.h)} window; selection boxes ${selBefore} → ${selAfter}; caret ${caret ? `(${Math.round(caret.x)}, ${Math.round(caret.y)})` : 'not found'}, the clicked line's y ${Math.round(lineAt.y)}; button ${gone ? 'gone' : 'still shown'}; panel ${panelPage(app) ? 'open' : 'none'}`,
    });
    pointer.click(L.lines[1].right + 80, L.lines[1].y);
    await waitHidden(app, 2000);
    const opened = panelPage(app);
    if (opened) await opened.locator('button[aria-label="Close"], .ob-close').first().click({ timeout: 3000 }).catch(() => {});
  }
  for (const s of strips) log(s.ok, `A2b ${tag}: a click 20 px ${s.where} the button lands in VS Code (its selection goes, its caret moves there)`, s.text);

  const why = os === 'mac' ? 'NSCursor.currentSystem gave no cursor' : 'GetCursorInfo: not CURSOR_SHOWING, or no handle';
  // A3: a gutter line-drag selects whole lines, a real selection: the button shows (lead 2026-11-20, #366 5fa3fbaf).
  const Ln = await vsLines();
  const nums = Ln.numbers.filter((x) => x.n >= 18 && x.n <= 22).sort((a, b) => a.n - b.n);
  if (nums.length >= 2) {
    pointer.click(Ln.lines[1].right + 80, Ln.lines[1].y);
    await sleep(400);
    pointer.drag(nums[0].x, nums[0].y, nums.at(-1).x, nums.at(-1).y);
    const harness = pointer.last;
    const t0 = pointer.t0;
    const sel = await vsSelected();
    const g = await waitShown(app, 1500);
    const said = readsText(harness, t0);
    log(sel > 0 && Boolean(g), `A3 ${tag}: a line-drag in VS Code's line-number gutter (whole lines selected) shows the button`,
      `VS Code selection boxes ${sel}; button ${g ? `shown at (${r1(g.x)}, ${r1(g.y)})` : 'not shown in 1.5 s'}; drag ${Math.round(nums[0].x)},${Math.round(nums[0].y)} → ${Math.round(nums.at(-1).x)},${Math.round(nums.at(-1).y)}${said ? `; ${said}` : ''}`);
  } else log(false, `A3 ${tag}: the gutter line-drag`, 'line numbers 18-22 not found on screen');

  // A3b: a drag that isn't a selection (lead 2026-11-20): VS Code's editor scrollbar slider, 60 px down, then back.
  {
    const L0 = await vsLines();
    pointer.click(L0.lines[1].right + 80, L0.lines[1].y);
    await waitHidden(app, 2000);
    await sleep(300);
    const top0 = Math.min(...L0.numbers.map((x) => x.n));
    const s = await vsSlider();
    if (!s) log(false, `A3b ${tag}: a scrollbar drag`, "VS Code's editor shows no scrollbar slider");
    else {
      pointer.drag(s.x, s.y, s.x, s.y + 60);
      const harness = pointer.last;
      const t0 = pointer.t0;
      const sel = await vsSelected();
      const g = await waitShown(app, 1500);
      const said = readsText(harness, t0);
      const back = await sliderBack(s, top0);
      const detail = `slider at (${r1(s.x)}, ${r1(s.y)}), ${r1(s.h)} tall, dragged 60 px down; VS Code selection boxes ${sel}; button ${g ? `shown at (${r1(g.x)}, ${r1(g.y)})` : 'not shown in 1.5 s'}; ${back}${said ? `; ${said}` : ''}`;
      if (shown.length === 0) untestable(`A3b ${tag}: a scrollbar drag`, `the button never showed for a real drag on text in A2, so "no button" here proves nothing; ${detail}`);
      else if (cursorReadable(said)) log(sel === 0 && !g, `A3b ${tag}: a drag on VS Code's scrollbar (not a selection) shows no button`, detail);
      else untestable(`A3b ${tag}: a scrollbar drag`, `the runner shows no cursor (${why}), so the helper takes its "can't say" branch (shows, by design: lead 2026-11-20); ${detail}`);
    }
  }

  // A3 race (unvibe-app, #366 5b34c779: the helpers read the I-beam 40 ms after the press): the pointer rests on one
  // side, then moves and presses within 16 ms, before the editor has changed its cursor.
  //   gutter → text: rests on line 25's number, presses at its text start, drags along it → the button shows;
  //   text → scrollbar: rests on line 28's text, presses on the scrollbar slider, drags it 40 px → no button.
  for (const [kind, li, ln, want] of [['gutter → text', 24, 25, true], ['text → scrollbar', 27, 28, false]]) {
    const Lr = await vsLines();
    const row = Lr.lines[li];
    const num = Lr.numbers.find((x) => x.n === ln);
    if (!row || !num) { log(false, `A3 race ${tag} ${kind}`, `line ${ln} or its number not on screen`); continue; }
    pointer.click(Lr.lines[1].right + 80, Lr.lines[1].y);
    await waitHidden(app, 2000);
    await sleep(300);
    const top0 = Math.min(...Lr.numbers.map((x) => x.n));
    const s = want ? null : await vsSlider();
    if (!want && !s) { log(false, `A3 race ${tag} ${kind}`, "VS Code's editor shows no scrollbar slider"); continue; }
    const race = want
      ? pointer.race(num.x, num.y, row.left + 2, row.y, Math.min(row.right - 2, row.left + 300), row.y)
      : pointer.race(row.left + 40, row.y, s.x, s.y, s.x, s.y + 40);
    const t0 = pointer.t0;
    const sel = await vsSelected();
    const g = await waitShown(app, 1500);
    const said = readsText(race.said, t0);
    const back = want ? '' : `; ${await sliderBack(s, top0)}`;
    const detail = `${said}; VS Code selection boxes ${sel}; button ${g ? `shown at (${r1(g.x)}, ${r1(g.y)}) ${g.t - race.up} ms after the release` : 'not shown in 1.5 s'}${back}`;
    if (!want && shown.length === 0) untestable(`A3 race ${tag}: ${kind}`, `the button never showed for a real drag on text in A2, so "no button" here proves nothing; ${detail}`);
    else if (cursorReadable(said)) log(race.gap <= 16 && (want ? sel > 0 : sel === 0) && Boolean(g) === want, `A3 race ${tag}: ${kind}, the press within 16 ms of the move, ${want ? 'shows the button' : 'shows no button'}`, detail);
    else untestable(`A3 race ${tag}: ${kind}`, `the runner shows no cursor at rest or 40 ms after the press, so the helper can't read it there; ${detail}`);
  }
  pointer.click(L.lines[1].right + 80, L.lines[1].y);
  await waitHidden(app, 2000);

  // A4: hover → pill; crops; press → the panel on the agreement, nothing read or sent.
  pointer.click(L.lines[1].right + 80, L.lines[1].y);
  await sleep(400);
  // The mouse-up on the editor's plain background: the button's window and the pill land there, so its corners are
  // compared with the same plain colour (run 44671864693: over text glyphs, the corner pixels differed though the
  // window was see-through).
  const { row, x: endX } = plainEnd(L, 20);
  const to = { x: endX, y: row.y };
  pointer.drag(row.left + 2, row.y, to.x, to.y);
  let g = await waitShown(app, 3000);
  if (!g) { log(false, `A4 ${tag}: hover, crops and press`, `no button for the drag on line ${L.lines.indexOf(row) + 1}`); return; }
  const r = await pillThenButton(app, g, `${tag}-light`, { x: to.x, y: to.y + 60 });
  log(Boolean(r.pill) && (r.pill.b?.w ?? r.pill.w) > (g.b?.w ?? g.w), `A4 ${tag}: hovering the button opens the pill`, r.pill ? `the button ${r1(g.b?.w ?? g.w)}×${r1(g.b?.h ?? g.h)} → the pill ${r1(r.pill.b?.w ?? r.pill.w)}×${r1(r.pill.b?.h ?? r.pill.h)}, grown ${near(r.pill.b?.x ?? r.pill.x, g.b?.x ?? g.x, 1.5) ? 'right' : 'left'}; hovered at the button's middle (${Math.round(mid(g).x)}, ${Math.round(mid(g).y)})` : `no pill in 2 s (hovered at the button's middle (${Math.round(mid(g).x)}, ${Math.round(mid(g).y)}))`);
  log(Boolean(r.cb?.clear) && Boolean(r.cp?.clear), `A4 ${tag}: 1:1 crops over VS Code light, corners see-through`, crops(r));
  if (!r.back) { log(false, `A4 ${tag}: the press`, 'the button was gone when the pointer left the pill'); return; }
  const before2 = os === 'mac' ? screenWindows() : [];
  const sentBefore = aiPosts('a').length;
  const pressAt = Date.now();
  pointer.click(mid(r.back).x, mid(r.back).y);
  const harnessP = pointer.last;
  const t0P = pointer.t0;
  const panel = await waitFor(async () => panelPage(app), 8000, 100);
  let view = '';
  if (panel) await waitFor(async () => { view = await panel.evaluate(() => [...(document.querySelector('.ob')?.classList ?? [])].filter((c) => c.startsWith('ob--')).join(' ')).catch(() => ''); return /aiConsent/.test(view); }, 8000);
  const form = panel ? await panel.locator('.consent-form').count() : 0;
  const after = await ghost(app);
  // What reached what (Mac run 44677798585: no panel, the button gone): the helper's down/press/app lines, the
  // pointer events the button's page saw, and when the button hid, all from the press.
  const saidP = readsText(harnessP, t0P);
  const hidP = hiddenAt(after, pressAt);
  const trail = `the button's page saw ${pageEvents(after, pressAt)}; the button hid ${hidP ? `${hidP - pressAt} ms after the click call` : 'not (log)'}${saidP ? `; ${saidP}` : ''}`;
  await sleep(1200);
  desktop(`${tag}-press-agreement`);
  log(Boolean(panel) && /aiConsent/.test(view) && form === 1 && !after?.shown && aiPosts('a').length === sentBefore,
    `A4 ${tag}: pressing the button opens the panel on the agreement (the Control+U path, nothing read or sent)`,
    `panel ${panel ? `view "${view}", agreement form ${form}` : 'did not open in 8 s'}; button ${after?.shown ? 'still shown' : 'gone'}; AI POSTs ${aiPosts('a').length}; ${trail}`);
  if (os === 'mac') {
    const owners = new Set(before2.map((w) => w.owner));
    const fresh = screenWindows().filter((w) => !owners.has(w.owner) && !/^(Unvibe|Code|Visual Studio Code|Electron)$/.test(w.owner));
    log(fresh.length === 0, `A1 ${tag}: no permission prompt after the press either`, fresh.length ? fresh.map((w) => `${w.owner} ${w.w}×${w.h}`).join('; ') : 'no window of a new owner');
  }
  if (!panel) return;

  // A5: stacking over the faded panel.
  const pm = await panel.evaluate(() => { const h = document.querySelector('.ob-head')?.getBoundingClientRect(); return { x: screenX, y: screenY, w: outerWidth, h: outerHeight, head: h ? { x: h.left + h.width / 2, y: h.top + h.height / 2 } : null }; });
  const k = os === 'windows' ? scale : 1;
  const P = { x: pm.x * k, y: pm.y * k, w: pm.w * k, h: pm.h * k };
  if (pm.head) pointer.click(P.x + pm.head.x * k, P.y + pm.head.y * k); // the panel focused, as a person clicks it
  await sleep(500);
  // Whether that click made the panel the focused window (Mac run 44679910340: the panel never faded; it fades on
  // the window's blur, windows.ts buildWidgetWindow, so a panel that never had focus can't fade).
  const focusedAfterHead = await panel.evaluate(() => document.hasFocus()).catch(() => null);
  const L2 = await vsLines();
  // A click in VS Code that can't land on the panel: a line above or below it, at its text's start.
  const away = L2.lines.find((l) => l.y < P.y - 20 || l.y > P.y + P.h + 20) ?? L2.lines[0];
  const elsewhere = () => pointer.click(away.left + 30, away.y);
  elsewhere(); // back into VS Code: the panel loses focus
  // macOS 26+: a synthesized click on the panel activates Unvibe, and later synthesized clicks don't move activation
  // until an app switch (unvibe-app, run 44679910340: the panel never lost focus). A person's click would; here VS Code
  // is brought to the front by name, as an app switch does.
  if (os === 'mac') osa('tell application "Visual Studio Code" to activate');
  const faded = await waitFor(async () => { const o = await panel.evaluate(() => Number(getComputedStyle(document.querySelector('.ob')).opacity)); return o < 0.5 ? o : null; }, 3000, 100);
  const focusedAfterAway = await panel.evaluate(() => document.hasFocus()).catch(() => null);
  const focusNote = `panel focused after the header click ${focusedAfterHead}, after the click into VS Code${os === 'mac' ? ' and its activation' : ''} ${focusedAfterAway}`;
  // The fade, its own row (lead 2026-11-20): it happens on the panel window's blur, so it is judged only when the header
  // click gave the panel focus; a panel that never had focus has nothing to lose.
  const fadeRow = `A5 ${tag}: the panel fades once it has lost focus (a click into VS Code)`;
  const fadeDetail = `opacity ${faded !== null ? r1(faded) : 'stayed at or above 0.5 for 3 s'}; ${focusNote}`;
  if (faded !== null || focusedAfterHead === true) log(faded !== null, fadeRow, fadeDetail);
  else untestable(fadeRow, `the header click didn't give the panel focus (document.hasFocus() ${focusedAfterHead}), so there was no blur to fade on; ${fadeDetail}`);
  // A selection whose button lands over the panel's edge: ending 12 px left of the panel (the button covers its left
  // 28 px), or, if no line has room there, ending 20 px inside its right edge (the button covers its right 12 px).
  const besideLeft = L2.lines.find((l) => l.y > P.y + 30 && l.y < P.y + P.h - 30 && P.x - 12 - (l.left + 2) > 40);
  const besideRight = L2.lines.find((l) => l.y > P.y + 30 && l.y < P.y + P.h - 30 && l.left + 2 < P.x - 4 && P.x + P.w - 20 - (l.left + 2) > 40);
  const target = besideLeft ?? besideRight;
  if (!target) {
    log(false, `A5 ${tag}: the button over the panel`, `no code line beside the panel (panel ${Math.round(P.w)}×${Math.round(P.h)} at (${Math.round(P.x)}, ${Math.round(P.y)})); not run (harness)`);
  } else {
    const edge = besideLeft ? 'left' : 'right';
    const end = { x: besideLeft ? P.x - 12 : P.x + P.w - 20, y: target.y };
    pointer.drag(target.left + 2, target.y, end.x, end.y);
    const gs0 = await waitShown(app, 3000);
    // The first poll that sees the button can come before its window has moved (Mac run 44679910340: (804, 470), A4's
    // spot, while the still showed it at the drag's end): the geometry is read again once it has settled.
    if (gs0) await sleep(400);
    const gs = gs0 ? ((await ghost(app)) ?? gs0) : null;
    if (!gs) log(false, `A5 ${tag}: the button over the panel`, `no button for the drag ending at the panel's ${edge} edge (panel faded: ${faded ?? 'no'}; ${focusNote})`);
    else {
      const gb = gs.b ?? gs;
      const firstSeen = `first seen at (${r1((gs0.b ?? gs0).x)}, ${r1((gs0.b ?? gs0).y)}), settled at (${r1(gb.x)}, ${r1(gb.y)}) for the mouse-up at (${r1(end.x)}, ${r1(end.y)})`;
      const lo = Math.max(gb.x, P.x);
      const hi = Math.min(gb.x + gb.w, P.x + P.w);
      const overlap = hi - lo;
      // The pointer onto the part of the button that is over the panel first (a hovered button stays), then the
      // window order and the stills while it shows the pill.
      pointer.move((lo + hi) / 2, gb.y + gb.h / 2);
      const hovered = await waitFor(async () => { const s = await ghost(app); return s?.pill ? s : null; }, 2000, 20);
      const pids = new Set(processTree(app.process.pid).map((p) => p.pid));
      const own = screenWindows().filter((w) => pids.has(w.pid));
      const gi = own.findIndex((w) => near(w.y, gs.y, 2) && near(w.h, gs.h, 2) && (near(w.x, gs.x, 2) || near(w.x + w.w, gs.x + gs.w, 2)));
      const pi = own.findIndex((w) => near(w.x, P.x, 2) && near(w.w, P.w, 2));
      desktop(`${tag}-over-faded-panel`);
      const crop = grab(file(`${tag}-over-faded-panel-1to1`), gs.x - 32, gs.y - 16, (hovered?.w ?? gs.w) + 64, gs.h + 32);
      const opacity = await panel.evaluate(() => Number(getComputedStyle(document.querySelector('.ob')).opacity));
      log(gi !== -1 && pi !== -1 && gi < pi && overlap > 0 && Boolean(hovered),
        `A5 ${tag}: the button stays in front of the open panel and takes the pointer there`,
        `panel opacity ${faded !== null ? r1(faded) : 'not faded'} (with the pointer on the button ${r1(opacity)}; ${focusNote}); button ${r1(gb.w)}×${r1(gb.h)} at (${r1(gb.x)}, ${r1(gb.y)}) (its window ${r1(gs.w)}×${r1(gs.h)}; ${firstSeen}), ${r1(overlap)} px over the panel's ${edge} edge (panel ${Math.round(P.w)}×${Math.round(P.h)} at (${Math.round(P.x)}, ${Math.round(P.y)})); hover over the overlap → ${hovered ? `pill ${r1(hovered.b?.w ?? hovered.w)} wide` : 'no pill in 2 s'}; window order: button ${gi}, panel ${pi} of Unvibe's ${own.length} (0 = front); crop sha ${sha(crop).slice(0, 12)}`);
    }
  }
  elsewhere();
  await waitHidden(app, 2000);
  await panel.locator('.consent-form__actions button.ghost').click({ timeout: 5000 }).catch(() => {});
  await sleep(1000);

  // A6: the flip at the screen's right edge.
  const area = await companion.evaluate(() => ({ x: screen.availLeft, w: screen.availWidth }));
  const right = (area.x + area.w) * k;
  const L3 = await vsLines();
  const rowF = L3.lines[4];
  const endF = { x: right - 30, y: rowF.y };
  pointer.drag(rowF.left + 2, rowF.y, endF.x, endF.y);
  const gf = await waitShown(app, 3000);
  if (!gf) log(false, `A6 ${tag}: the flip at the right edge`, `no button for the drag ending at x ${Math.round(endF.x)} (work area right ${Math.round(right)})`);
  else {
    const r = await pillThenButton(app, gf, `${tag}-flipped`, { x: endF.x, y: endF.y + 60 });
    const fb = gf.b ?? gf;
    const pb = r.pill ? (r.pill.b ?? r.pill) : null;
    const gap = endF.x - (fb.x + fb.w);
    log(gf.flipped && near(gap, 8 * k, 1.5) && Boolean(pb) && near(pb.x + pb.w, fb.x + fb.w, 1.5),
      `A6 ${tag}: at the right edge the button flips left of the mouse-up and the pill grows left`,
      `mouse-up x ${Math.round(endF.x)} (work area right ${Math.round(right)}); button ${r1(fb.w)}×${r1(fb.h)} at x ${r1(fb.x)}, ${r1(gap)} px left of the mouse-up, flipped ${gf.flipped} (its window ${r1(gf.w)}×${r1(gf.h)} at x ${r1(gf.x)}); pill ${pb ? `${r1(pb.w)} wide, right edge ${r1(pb.x + pb.w)}` : 'none'}; ${crops(r)}`);
  }
  pointer.click(L3.lines[1].right + 80, L3.lines[1].y);
  await waitHidden(app, 2000);

  // A7: dark. Unvibe's theme set in Settings; the button's page reads it when it loads, so it's reloaded. VS Code dark.
  await companion.evaluate(() => window.unvibe.setSettings({ theme: 'dark' }));
  await ghostPage(app)?.reload().catch(() => {});
  vsSettings('dark');
  await sleep(3000);
  const L4 = await vsLines();
  const { row: rowD, x: endD } = plainEnd(L4, 8);
  const toD = { x: endD, y: rowD.y };
  pointer.drag(rowD.left + 2, rowD.y, toD.x, toD.y);
  const gd = await waitShown(app, 3000);
  if (!gd) log(false, `A7 ${tag}: the button and the pill over VS Code dark`, 'no button');
  else {
    const theme = await ghostPage(app).evaluate(() => document.documentElement.dataset.theme);
    const r = await pillThenButton(app, gd, `${tag}-dark`, { x: toD.x, y: toD.y + 60 });
    log(L4.theme === 'dark' && theme === 'dark' && Boolean(r.cb?.clear) && Boolean(r.cp?.clear), `A7 ${tag}: 1:1 crops over VS Code dark, corners see-through`,
      `VS Code ${L4.theme}, the button's page ${theme}; ${crops(r)}`);
  }
  pointer.click(L4.lines[1].right + 80, L4.lines[1].y);
  await waitHidden(app, 2000);
  await companion.evaluate(() => window.unvibe.setSettings({ theme: 'light' }));
  await ghostPage(app)?.reload().catch(() => {});
  vsSettings('light');
  await sleep(2000);

  // A8: idle CPU, the button on (hidden) then off; the pointer resting in the editor.
  pointer.move(L4.lines[10].left + 100, L4.lines[10].y);
  await sleep(3000);
  const on = await cpuOver(app, 60);
  await companion.evaluate(() => window.unvibe.setBubble('ghost', false));
  await sleep(3000);
  const off = await cpuOver(app, 60);
  note(`A8 ${tag}: idle CPU over ${on.wall} s, the button on`, `Unvibe ${on.total} % of one core, the helper ${on.helper} %; ${on.detail}`);
  note(`A8 ${tag}: idle CPU over ${off.wall} s, the button off`, `Unvibe ${off.total} %, helper running: ${off.helperRunning}; ${off.detail}`);
  log(on.helperRunning && !off.helperRunning, `A8 ${tag}: idle CPU measured with the button on and off (the helper runs only while it's on)`,
    `on: Unvibe ${on.total} % (helper ${on.helper} %); off: Unvibe ${off.total} %. The brief asks for the numbers; no limit is set`);
}

// --- Launch B (Windows): the DIP conversion at 150 % ------------------------------------------------------------------
async function runB(app, companion) {
  const L = await vsLines();
  pointer.click(L.lines[0].right + 60, L.lines[0].y);
  await companion.evaluate(() => window.unvibe.setBubble('ghost', true));
  await sleep(5000);
  const { row, x: endC } = plainEnd(L, 10);
  const to = { x: endC, y: row.y };
  pointer.drag(row.left + 2, row.y, to.x, to.y);
  const g = await waitShown(app, 3000);
  if (!g) { log(false, 'B 150: the button at 150 %', 'no button'); return; }
  const gb = g.b ?? g;
  const dx = gb.x - to.x;
  const cy = gb.y + gb.h / 2 - to.y;
  // The window's own rectangle and region (GetWindowRect, GetWindowRgnBox; physical px), next to the button's box.
  const rect = ghostWindow(app, g);
  const r = await pillThenButton(app, g, '150', { x: to.x, y: to.y + 80 });
  desktop('150-button');
  log(Boolean(r.cb?.clear) && Boolean(r.cp?.clear), 'B 150: under a forced 150 % the button shows for a real drag, with see-through corners', crops(r));
  note('B 150: size and place under --force-device-scale-factor=1.5 (not a Windows display scale, so no PASS/FAIL; expected 32 DIP × 1.5 = 48 px, 8 DIP = 12 px right)',
    `mouse-up (${Math.round(to.x)}, ${Math.round(to.y)}) physical; the button ${r1(gb.w)}×${r1(gb.h)} at mouse-up x + ${r1(dx)}, its centre ${r1(cy)} from its y (its box in its page × 1.5); the window: ${rgnText(rect)}${rect ? ` at (${rect.x}, ${rect.y})` : ''}, the page's outer size × 1.5 ${r1(g.w)}×${r1(g.h)}; pill ${r.pill ? `${r1(r.pill.b?.w ?? r.pill.w)}×${r1(r.pill.b?.h ?? r.pill.h)}` : 'none'}`);
  pointer.click(L.lines[1].right + 80, L.lines[1].y);
  await waitHidden(app, 2000);
}

// --- Launch C: behind the hosts block, with the agreement ---------------------------------------------------------------
async function giveAgreement(app) {
  keys.unvibe();
  const panel = await waitFor(async () => panelPage(app), 8000, 100);
  if (!panel) throw new Error('the shortcut opened no panel');
  await panel.locator('.consent-form').waitFor({ timeout: 8000 });
  for (const box of await panel.locator('.consent-form input[type=checkbox]').all()) await box.check();
  await panel.locator('.consent-form__actions button:not(.ghost)').click();
  const gone = await panel.locator('.consent-form').waitFor({ state: 'detached', timeout: 8000 }).then(() => true).catch(() => false);
  if (!gone) throw new Error('the agreement form is still there after Agree');
  note('C: the agreement given in this run\'s profile', 'in the panel the shortcut opened (before the agreement the shortcut reads nothing)');
  return panel;
}
/**
 * MUST-D5a (Security, 20 Nov 03:33Z): before the agreement, the block is shown to hold, or launch C stops here with
 * nothing given or pressed. (a) The runner's own GET /api/v1/health gets no answer, the resolver (getaddrinfo, which
 * reads the hosts file) gives only 0.0.0.0 / ::, and on the Mac dscacheutil shows 0.0.0.0; (b) launch C's net log so
 * far has no request to the host with an answer.
 */
async function blockHolds() {
  let runner;
  try {
    const res = await fetch(`https://${host}/api/v1/health`, { signal: AbortSignal.timeout(10000) });
    runner = `HTTP ${res.status}`;
  } catch (e) { runner = `no answer (${short(e.cause ?? e)})`; }
  const addrs = await lookup(host, { all: true }).then((a) => a.map((x) => x.address)).catch((e) => [`lookup failed (${e.code ?? short(e)})`]);
  // Windows answers a 0.0.0.0 hosts line with "no address" (getaddrinfo ENOENT, run 44668914881): that counts as
  // blocked too, with (a) the runner's request unanswered and (b) the app's below (Security's accepted delta).
  const resolverOk = addrs.length > 0 && addrs.every((a) => a === '0.0.0.0' || a === '::' || /^lookup failed \((ENOTFOUND|ENOENT|EAI_NONAME)\)$/.test(a));
  let dns = '';
  let dnsOk = true;
  if (os === 'mac') {
    try { dns = execFileSync('dscacheutil', ['-q', 'host', '-a', 'name', host], { encoding: 'utf8', timeout: 15000 }).trim().replace(/\s+/g, ' '); } catch (e) { dns = `dscacheutil failed (${short(e)})`; }
    const v4 = [...dns.matchAll(/ip_address: (\S+)/g)].map((m) => m[1]);
    const v6 = [...dns.matchAll(/ipv6_address: (\S+)/g)].map((m) => m[1]);
    dnsOk = v4.length > 0 && v4.every((a) => a === '0.0.0.0') && v6.every((a) => a === '::');
  }
  const seen = apiRequests(netlogs.find((l) => l.tag === 'c').file, host);
  const answered = seen.filter((q) => q.status);
  const ok = runner.startsWith('no answer') && resolverOk && dnsOk && answered.length === 0;
  log(ok, 'D5-a: the block holds before the agreement (otherwise launch C stops here: no agreement, no press)',
    `the runner's own GET /api/v1/health: ${runner}; getaddrinfo: ${addrs.join(', ')}${os === 'mac' ? `; dscacheutil: ${dns}` : ''}; the app's net log so far: ${seen.length} request(s) to ${host} (${seen.map((q) => `${q.method} ${q.path} ${q.status || 'no answer'}`).join(', ') || 'none'}), with an answer ${answered.length}`);
  return ok;
}
async function runC(app, companion) {
  if (!(await blockHolds())) return;
  await companion.evaluate(() => window.unvibe.setBubble('ghost', true));
  // The agreement first, before VS Code's password prompt is up, with the pointer at the screen's bottom right so the
  // panel opens there, away from the prompt and the code.
  await closeVsCode();
  const area = await companion.evaluate(() => ({ x: screen.availLeft, y: screen.availTop, w: screen.availWidth, h: screen.availHeight }));
  pointer.move((area.x + area.w - 240) * scale, (area.y + area.h - 240) * scale);
  const agreePanel = await giveAgreement(app);
  // VS Code again, now with the development extension's password prompt.
  vsSettings('light');
  await openVsCode([`--extensionDevelopmentPath=${extDir}`]);
  await sleep(2000);
  // C1: N6, the password prompt.
  const box = await waitFor(async () => {
    const r = await vs.page.evaluate(() => { const i = document.querySelector('.quick-input-widget input[type="password"]'); if (!i || !i.offsetWidth) return null; const b = i.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    return r;
  }, 30000, 500);
  if (!box) log(false, 'C1 N6: VS Code\'s password prompt', 'the development extension\'s prompt did not show in 30 s');
  else {
    const o = await vsOrigin();
    const at = { x: o.x + (box.x + Math.min(box.w / 3, 120)) * o.k, y: o.y + (box.y + box.h / 2) * o.k };
    setClipboard('qa-d5-sentinel');
    // The control: a double-click on a word of the code (the prompt stays open: ignoreFocusOut) shows the button, so
    // "no button" over the prompt below is about the prompt, not the double-click.
    const Lc = await vsLines();
    const word = Lc.lines.find((l) => l.y > o.y + (box.y + box.h) * o.k + 120) ?? Lc.lines.at(-1);
    pointer.click(word.left + 20, word.y, 2);
    const harnessC = pointer.last;
    const t0C = pointer.t0;
    const gc = await waitShown(app, 2500);
    const saidC = readsText(harnessC, t0C);
    log(Boolean(gc), 'C1 control: a double-click on a word of the code shows the button', `${gc ? `at (${r1(gc.x)}, ${r1(gc.y)}) for the double-click at (${Math.round(word.left + 20)}, ${Math.round(word.y)})` : 'no button in 2.5 s'}${saidC ? `; ${saidC}` : ''}`);
    pointer.click(word.left + 4, word.y);
    await waitHidden(app, 2000);
    pointer.click(at.x, at.y, 2);
    const g = await waitShown(app, 2500);
    desktop('n6-password-double-click');
    if (os === 'mac') {
      if (!gc && !g) untestable('C1 N6 (Mac): the password prompt', 'the C1 control (a double-click on code) showed no button either, so "no button" here proves nothing');
      else log(!g, 'C1 N6 (Mac): a double-click in VS Code\'s password prompt shows no button (secure input)', g ? `button shown at (${r1(g.x)}, ${r1(g.y)}); not pressed` : 'no button in 2.5 s');
    } else if (!g) {
      note('C1 N6 (Windows): a double-click in VS Code\'s password prompt', 'no button in 2.5 s');
    } else {
      note('C1 N6 (Windows): a double-click in VS Code\'s password prompt shows the button', `at (${r1(g.x)}, ${r1(g.y)}); Security N6: allowed for editors, as long as nothing of the box is read or sent`);
      for (const quick of [false, true]) {
        await companion.evaluate((q) => window.unvibe.setBubble('preview', q), quick);
        await sleep(500);
        const g1 = (await ghost(app)) ?? g;
        if (!g1.shown) { pointer.click(at.x, at.y, 2); await waitShown(app, 2500); }
        const g2 = await ghost(app);
        const posts = aiPosts('c').length;
        pointer.click(mid(g2).x, mid(g2).y);
        // The Island for 10 s after the press (Security SHOULD-366c, unvibe-app 2026-11-20): with the agreement given,
        // an empty capture shows Issue, then idle; never a working phase ("Reading") at +4 s. The timeline tells a
        // slow empty capture (leaves Reading after a few seconds) from a stuck one (#374). The clipboard is read at
        // +4 s and at +10 s (Security SHOULD-366d: it is empty while a capture runs).
        const WORKING = /^(loading|working|contextualizing|searching|analyzing|thinking|generating|finalizing)$/;
        const phase = async () => ((await barPage(app)?.evaluate(() => [...(document.querySelector('[class*="island--phase-"]')?.classList ?? [])].find((c) => c.startsWith('island--phase-')) ?? '').catch(() => '')) ?? '').replace('island--phase-', '');
        const t0 = Date.now();
        const seen = [];
        let clip4 = null;
        while (Date.now() - t0 < 10000) {
          const p = await phase();
          const t = Date.now() - t0;
          if (!seen.length || seen.at(-1).p !== p) seen.push({ t, p });
          if (clip4 === null && t >= 4000) clip4 = readClipboard();
          await sleep(100);
        }
        const phaseAt = (ms) => [...seen].reverse().find((e) => e.t <= ms)?.p ?? '';
        const p1 = phaseAt(1000);
        const p4 = phaseAt(4000);
        const p6 = phaseAt(6000);
        const pEnd = seen.at(-1)?.p ?? '';
        const timeline = seen.map((e) => `${e.p || '?'} @${(e.t / 1000).toFixed(1)} s`).join(' → ');
        const clip = readClipboard();
        const bar = (await barPage(app)?.evaluate(() => document.body.innerText).catch(() => '')) ?? '';
        const card = (await ghost(app))?.quickText ?? '';
        const pv = panelPage(app);
        const panelText = pv ? await pv.evaluate(() => document.body.innerText).catch(() => '') : '';
        desktop(`n6-press-quick-${quick ? 'on' : 'off'}`);
        log(!clip.includes(PROMPT_WORD) && !String(clip4 ?? '').includes(PROMPT_WORD) && !panelText.includes(PROMPT_WORD) && !card.includes(PROMPT_WORD) && aiPosts('c').length === posts,
          `C1 N6 (Windows): pressing it over the password prompt (Quick look ${quick ? 'on' : 'off'}) reads nothing of the box and sends nothing`,
          `clipboard at +4 s "${String(clip4 ?? '').slice(0, 40)}", at +10 s "${clip.slice(0, 40)}" (the sentinel ${clip.trim() === 'qa-d5-sentinel' ? 'is back' : 'is NOT back'}: Security SHOULD-366d); the Island says "${bar.replace(/\s+/g, ' ').trim().slice(0, 120)}"; card "${card.replace(/\s+/g, ' ').trim().slice(0, 140)}"; AI POST attempts ${aiPosts('c').length - posts}`);
        // Lead 2026-11-20 (#366 8ec57712 keeps both Windows copy waits at 32 tries): Issue or idle by +6 s, then idle.
        log(Boolean(p6) && !WORKING.test(p6) && pEnd === 'idle', `C1 N6 (Windows): after the empty press (Quick look ${quick ? 'on' : 'off'}) the Island is out of its working phases by +6 s, then idle`,
          `+1 s "${p1 || '?'}", +4 s "${p4 || '?'}", +6 s "${p6 || '?'}", +10 s "${pEnd || '?'}"; for 10 s: ${timeline}`);
        if (quick) keys.escape(); // the card's Esc (Unvibe holds it only while the card shows); off: nothing to close
        await sleep(800);
      }
      await companion.evaluate(() => window.unvibe.setBubble('preview', false));
    }
    // The prompt closed (Esc in VS Code), then the agreement panel out of the way.
    pointer.click(at.x, at.y);
    keys.escape();
    await sleep(800);
  }
  await agreePanel.locator('button[aria-label="Close"], .ob-close').first().click({ timeout: 3000 }).catch(() => {});

  // C2: Quick look on; the card; Esc; VS Code keeps focus and gets the next Esc.
  await companion.evaluate(() => window.unvibe.setBubble('preview', true));
  await sleep(800);
  const L2 = await vsLines();
  const row = L2.lines[6];
  pointer.click(L2.lines[1].right + 80, L2.lines[1].y);
  await sleep(400);
  pointer.drag(row.left + 2, row.y, Math.min(row.right - 2, row.left + 300), row.y);
  const g = await waitShown(app, 3000);
  if (!g) { log(false, 'C2 Quick look: Esc', 'no button'); return; }
  pointer.click(mid(g).x, mid(g).y);
  const card = await waitFor(async () => { const s = await ghost(app); return s?.quick && !/Explaining/.test(s.quickText) ? s : null; }, 20000, 200);
  const cardNow = card ?? await ghost(app);
  desktop('quick-card');
  const cardText = (cardNow?.quickText ?? '').replace(/\s+/g, ' ').trim();
  keys.escape();
  const closed = await waitFor(async () => { const s = await ghost(app); return s && !s.shown ? s : null; }, 2000, 20);
  const focus = await vs.page.evaluate(() => ({ has: document.hasFocus(), editor: Boolean(document.activeElement?.closest('.monaco-editor')) }));
  keys.find();
  const found = await waitFor(async () => (await vs.page.locator('.find-widget.visible').count()) > 0, 3000);
  keys.escape();
  const findClosed = found ? await waitFor(async () => (await vs.page.locator('.find-widget.visible').count()) === 0, 3000) : null;
  log(Boolean(cardNow?.quick) && Boolean(closed) && focus.has && Boolean(found) && Boolean(findClosed),
    'C2 Quick look: Esc closes the card, VS Code keeps focus, and the next Esc reaches VS Code (Unvibe let go of Esc)',
    `card "${cardText.slice(0, 160)}"; after Esc: card ${closed ? 'closed' : 'still shown'}; VS Code focused ${focus.has} (editor ${focus.editor}); its find box ${found ? 'opened' : 'did not open'}, then Esc ${findClosed ? 'closed it' : 'did not close it'}`);
  await companion.evaluate(() => window.unvibe.setBubble('preview', false));
}

// --- The runs ----------------------------------------------------------------------------------------------------------
wideScreen();
if (os === 'windows') {
  // Run 44671864693: GetCursorInfo found no showing cursor on the runner, so the I-beam rows couldn't be judged.
  try { note('The runner\'s cursor, MouseKeys turned on', winPtr('mousekeys', '960', '540', '0', '0', '1').split(/\r?\n/).join('; ')); } catch (e) { note('The runner\'s cursor', `MouseKeys not set (${short(e)})`); }
}
vsSettings('light');
let failedLaunch = false;
const plan = os === 'windows' ? ['a', 'b', 'c'] : ['a', 'c'];
for (const tag of plan) {
  let app = null;
  try {
    if (tag === 'c') {
      if (os === 'mac') {
        // Quick look reads the selection the way Control+U does (System Events ⌘C): Accessibility back on for Unvibe,
        // as the install step grants it (A1 ran with it reset).
        execFileSync('sudo', ['-n', 'sqlite3', '/Library/Application Support/com.apple.TCC/TCC.db', "INSERT OR REPLACE INTO access (service,client,client_type,auth_value,auth_reason,auth_version,indirect_object_identifier,flags) VALUES('kTCCServiceAccessibility','com.unvibe.app',0,2,4,1,'UNUSED',0);"]);
        note('Launch C', 'Unvibe\'s Accessibility granted again, as the install step does');
      }
      blockApi();
    }
    scale = tag === 'b' ? 1.5 : 1;
    const l = await launch(tag, tag === 'b' ? ['--force-device-scale-factor=1.5'] : []);
    app = l.app;
    await minimize(app, l.companion);
    startShadow(tag);
    if (tag === 'a') await openVsCode();
    if (tag === 'a') await runA(app, l.companion, os === 'mac' ? 'mac' : '100');
    if (tag === 'b') await runB(app, l.companion);
    if (tag === 'c') await runC(app, l.companion);
  } catch (e) {
    failedLaunch = true;
    log(false, `Launch ${tag}`, `stopped: ${short(e)}`);
    desktop(`${tag}-stopped`);
  } finally {
    stopShadow(tag);
    await app?.close().catch(() => {});
    await sleep(2000);
    if (tag === 'c') { try { unblockApi(); } catch (e) { log(false, 'The hosts file back after launch C', short(e)); } }
  }
}
await closeVsCode();

// --- No hosted-AI call ---------------------------------------------------------------------------------------------
const requests = netlogs.flatMap(({ tag, file: f }) => (existsSync(f) ? keepSummaryAndDrop(f, host, path.join(out, `netlog-d5-${os}-${tag}.txt`)).map((q) => ({ ...q, tag })) : []));
const ai = requests.filter((q) => q.method === 'POST' && /^\/api\/v1\/(reviews|comprehension|previews)\b/.test(q.path));
const answered = ai.filter((q) => q.status);
log(answered.length === 0 && ai.every((q) => q.tag === 'c'), 'No hosted-AI call: nothing reached the server',
  `the app's net logs: ${requests.length} request(s) to ${host}; AI POSTs ${ai.length} (${ai.map((q) => `${q.tag} ${q.path} ${q.status || 'no answer'}`).join(', ') || 'none'}), with an answer ${answered.length}. Launch C ran behind the hosts block`);
writeFileSync(path.join(out, `report-d5-${os}.txt`), `Unvibe ${version}: D5 #366 button rows (${os}), no hosted AI\n\n${report.join('\n')}\n`);
process.exit(failedLaunch || report.some((l) => l.startsWith('FAIL')) ? 1 : 0);
