// D5 #366 (the Unvibe button), real-device rows on a Mac and a Windows runner, with VS Code and the real pointer (the
// OS's own mouse events: mouse.swift's CGEvents on the Mac, mouse_event on Windows). The lists this answers:
// unvibe-app's README "Not verified yet" (agents/unvibe-app/evidence/d5-bubble/README.md L42-48), Security's
// real-machine checks and N6 (requests/security/20261119-1703-security-unvibe-app-pr366-d5-bubble-s1.md §3, L89-93),
// and Design's real-device captures (requests/unvibe-app/20261119-1659-design-s1-d5-bubble-366.md L48-55).
//
// Launch A (Mac and Windows 100 %), a new qa- profile, setup skipped, the main window minimized, VS Code maximized:
//   A0 off by default (the lead, RC4): Settings say the button and Quick look are off, no choice on file, no helper,
//      a real drag shows no button; Quick look can't be turned on while the button is off, and nothing is recorded.
//   A1 (Mac) no new permission prompt when the button is turned on: the on-screen windows before and after (and after
//      the press, A4), with Unvibe's Accessibility reset by the workflow first (a clean Mac); the helper is running;
//      the choice is on file (unvibe-bubble.json: one choice, the button on, its copy version and time).
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
//      The press row lists the helper's lines (down, press, app) and the pointer events the button's page saw; those
//      listeners go on after the light crops and off after the press row (unvibe-app 2026-11-20: the ring on runs 6
//      and 7's Mac light crops came with them). Until then the page holds only the show/hide log (as in run 5).
//   FR the focus right after the button appears (unvibe-app, the ring is drawn only on :focus-visible): A2's 5 rounds
//      and A4 before its crops, then A6 and A7 after A4's press; each read has document.activeElement BODY and the
//      button not :focus-visible. The A4/A6/A7 crop rows also give the focus at each crop.
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
// Launch F (Mac, after A, a fresh profile and process; #378 the Mac panel fade, lead's options 1 + 3). ⌃U from VS Code
//   opens the panel on the agreement (no agreement: nothing is read); then, in order:
//   F untouched: nothing has clicked an Unvibe window; a click into VS Code (the app in front all along, also
//      activated by name) leaves the panel as it is: it STAYS at or above 0.5 for 3 s (option 3, documented);
//   F app switch: another app (Finder) activated by name fades the panel below 0.5 within 3 s (ms given);
//   F touched: the panel's header clicked (the panel back, its focus read), then a click into VS Code and VS Code
//      activated: it fades below 0.5 within 3 s (ms given; unvibe-app expects about 300 ms). NOT TESTABLE if the
//      header click didn't give the panel focus;
//   F hide: with "Hide" as the click-away setting, a click on the panel's header keeps it on screen (1 s later, by
//      the window list), and a click into VS Code with VS Code activated takes it off the screen within 3 s.
//   Its install id is the run's D5_ID, flagged with launch A's profile. d5=fade runs launch F only (no button needed,
//   so a build without #366 runs it).
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
// d5=auto: launch X only, auto mode (#384, ledger 646) in VS Code, then Cursor, behind the hosts block as launch C
//   (Security's C-3 rows, requests/security/20261121-1741-…-auto-explain-383-384-s2.md L134-140):
//   X0 consent: auto can't turn on alone while the button is off; with the button (Settings' "Turn on both") main
//      records both choices in one write at copy version 2026-11-21. D5-a, then the agreement, as launch C.
//   Then in each editor (a 36-line sample on disk saved by the editor itself 200 ms after each change, so the file
//   holds what the person's keys did; each selection runs from one line's end to the next one's end, 2 lines, one line
//   further down each row, so no two rows read the same text; each row waits until 16 s after the last mouse-up, so the
//   15 s spacing never decides a row):
//   X8 the control first: a settled selection with no key is read once (one start, the panel reads that line), the
//      file unchanged and the person's clipboard theirs again. Without it every row below could pass with auto mode
//      never reading at all.
//   X1 select, then paste (the person's own clipboard text) 300 / 700 / 900 / 1200 / 1500 / 2500 ms after the
//      mouse-up: the file holds the paste in place of the selection, the person's clipboard is theirs again 5 s later,
//      and no explanation read the pasted text (a read after the key copies the line the paste landed in: run
//      44987639357, Mac, +468 ms). Run 44977282607 lost the paste at 1200 ms; the #384 fix copies only when no input
//      came since the mouse-up, never empties the clipboard, and drops a read met by any key. On the Mac the keys go
//      through System Events (mouse.swift se-paste / se-type), which reset HIDIdleTime as a keyboard does; CGEvent keys
//      didn't (run 44987639357), so the Mac idle check never saw them.
//   X2 select, then type at the same moments: the file holds the typed word in its place, and no read holds it.
//   X1 and X2 also fail an explanation that started more than 50 ms after the key: a read the key met was kept.
//   X3 an image on the clipboard (a PNG, as a screenshot copy): a settled selection leaves the clipboard untouched
//      (no change seen from outside), the image the same, and nothing starts.
//   X4 a file copied in Finder / Explorer: the same, the file still on the clipboard.
//   X5 a double-click on a word: the clipboard untouched and nothing starts.
//   X6 4 selections in a row: at most one auto copy in the 15 s from the first read (the Mac's clipboard watcher
//      sees the copied text; Windows: the history (Win+V) read through WinRT when the runner has it, and the
//      clipboard's change bursts); then one more after 16 s is read again (the control).
//   X7 Cmd+Tab / Alt+Tab 250 ms (before the 700 ms) and 800 ms (during the read) after the mouse-up: nothing starts,
//      nothing is sent, the person's clipboard is back.
//   Mac, #384 MUST-A5 (19f57c81 counts HID key-downs and clicks across each read):
//   X9a before the editors: one System Events ⌘C adds exactly 1 key-down and no click to the HID system's counts, as
//      soon as the keystroke returns and 300 ms later (the constant, and whether the count lags).
//   X9b after them: Unvibe had no Input Monitoring grant (a runner row for it is removed first), and the reads leave
//      no Input Monitoring row for Unvibe or osascript (system and user TCC databases), no prompt window on screen,
//      and no ListenEvent line naming either in the TCC log since the launch began.
//   Each read is seen from outside: the app's own "explanation started" event (onShortcutFired in the main window),
//   the panel's init event (what was read), the net log, and the clipboard's changes.
// d5=auto-defender (Windows only), Security's SHOULD-384c: launch X in VS Code only, X8 and then settled selections 16 s
//   apart until the launch has started 12 auto explanations (16 tries at most); their count and times go to
//   auto-reads.txt, and the workflow's Defender steps (Defender back at its defaults before, Protection history and
//   Defender/Operational after) judge the row. Its own run: in run 44982193648 Defender at its defaults under all of
//   launch X ran the Windows job past its 45 minutes with no log.
// d5=auto-ai: launch Y only (ai on, the only hosted call this script makes): auto on, the agreement, VS Code (Mac) or
//   Cursor (Windows), one settled selection of a short function with real faults, auto turned off as soon as the
//   explanation starts (one call at most); the answer must end with Suggested fixes (#383); stills of the panel.
//
// NO hosted-AI call except launch Y: launches A and B have no agreement, so a press reads nothing (core/consent.ts
// reviewCapture); launches C and X run behind the hosts block. The app's net logs are summarised (time, method, path,
// status) and deleted.
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
// 'rows' (the default): launches A, F and C on the Mac, A, B and C on Windows; 'fade': launch F only (Mac); 'auto':
// launch X only (VS Code and Cursor); 'auto-defender': launch X's reads only (VS Code, Windows); 'auto-ai': launch Y
// only (VS Code on the Mac, Cursor on Windows).
const D5 = process.env.D5 || 'rows';
if (!['rows', 'fade', 'auto', 'auto-defender', 'auto-ai'].includes(D5)) throw new Error(`D5 must be rows, fade, auto, auto-defender or auto-ai, not ${D5}`);
if (!exe) throw new Error('UNVIBE_EXE is not set');
if (!code) throw new Error('VSCODE is not set');
if ((D5 === 'auto' || (D5 === 'auto-ai' && os === 'windows')) && !process.env.CURSOR) throw new Error('CURSOR is not set');
if (os !== 'mac' && os !== 'windows') throw new Error('the Unvibe button exists on a Mac and on Windows only');
if (D5 === 'fade' && os !== 'mac') throw new Error('D5=fade (launch F, the Mac panel fade) runs on a Mac only');
if (D5 === 'auto-defender' && os !== 'windows') throw new Error('D5=auto-defender (Security SHOULD-384c, Microsoft Defender) runs on Windows only');
// The one switch for a hosted call: only D5=auto-ai runs with ai on (one call at most), every other mode with it off.
if (D5 === 'auto-ai' && process.env.QA_AI_OK !== '1') throw new Error('D5=auto-ai makes one hosted call: run it with ai on');
if (D5 !== 'auto-ai' && process.env.QA_AI_OK === '1') throw new Error(`D5=${D5} makes no hosted-AI call: run it with ai off`);
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
  'param([string]$op, [int]$x1, [int]$y1, [int]$x2, [int]$y2, [int]$n, [int]$x3 = 0, [int]$y3 = 0, [string]$act = "")',
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
  '  // Auto-mode rows: real key events (keybd_event, as a keyboard), and the window in front.',
  '  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint f, UIntPtr e);',
  '  [DllImport("user32.dll")] public static extern short VkKeyScan(char ch);',
  '  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();',
  '  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);',
  '  public static void K(byte vk, bool up) { keybd_event(vk, 0, up ? 2u : 0u, UIntPtr.Zero); }',
  '  public static void Combo(byte mod, byte vk) { K(mod, false); System.Threading.Thread.Sleep(20); K(vk, false); K(vk, true); System.Threading.Thread.Sleep(20); K(mod, true); }',
  '  public static void Type(string s) { foreach (char c in s) { short v = VkKeyScan(c); byte vk = (byte)(v & 0xff); bool sh = (v & 0x100) != 0; if (sh) K(0x10, false); K(vk, false); K(vk, true); if (sh) K(0x10, true); System.Threading.Thread.Sleep(15); } }',
  '  // Alt held, Tab, Alt released: the switcher picks the last window.',
  '  public static void AltTab() { K(0x12, false); System.Threading.Thread.Sleep(40); K(0x09, false); K(0x09, true); System.Threading.Thread.Sleep(200); K(0x12, true); }',
  '  public static string Fg() { uint pid; GetWindowThreadProcessId(GetForegroundWindow(), out pid); try { return System.Diagnostics.Process.GetProcessById((int)pid).ProcessName; } catch { return "pid " + pid; } }',
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
  'function Act([string]$a) { if ($a -eq "paste") { [Ptr]::Combo(0x11, 0x56) } elseif ($a -eq "copy") { [Ptr]::Combo(0x11, 0x43) } elseif ($a -eq "switch") { [Ptr]::AltTab() } elseif ($a.StartsWith("type:")) { [Ptr]::Type($a.Substring(5)) } else { throw "unknown key action $a" } }',
  'function Now() { [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() }',
  'if ($op -eq "key") { Act $act; Now }',
  'if ($op -eq "fg") { [Ptr]::Fg() }',
  '# The drag, then the key action $n ms after the release, timed in this process.',
  'if ($op -eq "dragkey") {',
  '  Settle $x1 $y1; $before = [Ptr]::Cur()',
  '  [Ptr]::mouse_event(2, 0, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 80',
  '  Steps $x1 $y1 $x2 $y2',
  '  [Ptr]::mouse_event(4, 0, 0, 0, [UIntPtr]::Zero)',
  '  $up = Now; $sw = [Diagnostics.Stopwatch]::StartNew()',
  '  while ($sw.ElapsedMilliseconds -lt $n) { Start-Sleep -Milliseconds 2 }',
  '  Act $act',
  '  "press: $before"',
  '  "up=$up key=$(Now)"',
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

// --- Auto-mode rows (#384): real keys, the app in front, the clipboard's other formats, its changes ------------------
/** One key action now as real key events (paste, copy, switch = Cmd/Alt+Tab, type:<ascii>); returns when it went. */
function keyNow(action) {
  const printed = os === 'mac'
    ? execFileSync(process.env.MOUSE, ['key', action], { encoding: 'utf8' }).trim()
    : winPtr('key', '0', '0', '0', '0', '0', '0', '0', action);
  return Number(printed.split(/\s+/).pop());
}
/** A drag, then the key action `ms` after its release, timed inside one process; returns { up, key, done? } (ms since
 * 1970; done: when the key action ended, Mac only). */
function dragKey(x1, y1, x2, y2, ms, action) {
  onScreen([x1, y1], [x2, y2]);
  pointer.t0 = Date.now();
  const printed = os === 'mac'
    ? execFileSync(process.env.MOUSE, ['dragkey', S(x1), S(y1), S(x2), S(y2), String(ms), action], { encoding: 'utf8' }).trim()
    : winPtr('dragkey', S(x1), S(y1), S(x2), S(y2), String(ms), '0', '0', action);
  const m = /up=(\d+) key=(\d+)(?: done=(\d+))?/.exec(printed);
  if (!m) throw new Error(`harness: dragkey printed "${printed.slice(-160)}"`);
  pointer.last = printed.split(/\r?\n/)[0];
  return { up: Number(m[1]), key: Number(m[2]), done: m[3] ? Number(m[3]) : null };
}
/** The app in front: the Mac's bundle id, Windows' process name. */
const frontApp = () => {
  try { return os === 'mac' ? execFileSync(process.env.MOUSE, ['front'], { encoding: 'utf8' }).trim() : winPtr('fg', '0', '0', '0', '0', '0'); } catch (e) { return `? (${short(e)})`; }
};
// Windows: the clipboard's formats, image, files and text, read in an STA PowerShell (Windows PowerShell's default).
const WIN_CLIP = [
  'Add-Type -AssemblyName System.Windows.Forms, System.Drawing',
  "Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern uint GetClipboardSequenceNumber();' -Name S -Namespace QaClip",
  'function Info { $d = [System.Windows.Forms.Clipboard]::GetDataObject(); $f = if ($d) { @($d.GetFormats()) } else { @() }',
  '  $img = if ([System.Windows.Forms.Clipboard]::ContainsImage()) { $i = [System.Windows.Forms.Clipboard]::GetImage(); "$($i.Width)x$($i.Height)" } else { "" }',
  '  $files = if ([System.Windows.Forms.Clipboard]::ContainsFileDropList()) { @([System.Windows.Forms.Clipboard]::GetFileDropList()) } else { @() }',
  '  $t = if ([System.Windows.Forms.Clipboard]::ContainsText()) { [System.Windows.Forms.Clipboard]::GetText() } else { "" }',
  '  [pscustomobject]@{ c = [QaClip.S]::GetClipboardSequenceNumber(); types = $f; image = $img; files = $files; len = $t.Length; text = $t.Substring(0, [Math]::Min(80, $t.Length)) } | ConvertTo-Json -Compress -Depth 3 }',
].join('\n');
/** The clipboard now: { c (change count / sequence number), types, png (Mac sha256) or image (Windows WxH), files, len, text }. */
function clipInfo() {
  const raw = os === 'mac' ? execFileSync(process.env.MOUSE, ['clip', 'info'], { encoding: 'utf8' }) : ps(`${WIN_CLIP}\nInfo`);
  const o = JSON.parse(raw.trim().split(/\r?\n/).pop());
  // Windows PowerShell 5.1 writes an empty list as {} (run 44977282607's X3: path.basename got an object).
  for (const k of ['types', 'files']) o[k] = (Array.isArray(o[k]) ? o[k] : [o[k]]).filter((v) => typeof v === 'string');
  return o;
}
const clipText = (o) => `change ${o.c}; ${o.types?.length ?? 0} format(s)${o.png ? `; PNG ${o.png.slice(0, 12)}` : ''}${o.image ? `; image ${o.image}` : ''}${o.files?.length ? `; files ${o.files.map((f) => path.basename(f)).join(', ')}` : ''}; text ${o.len} chars`;
/** The clipboard holds this PNG only (as a screenshot copy does). */
function clipImage(png) {
  if (os === 'mac') execFileSync(process.env.MOUSE, ['clip', 'image', png]);
  else ps(`${WIN_CLIP}\n$img = [System.Drawing.Image]::FromFile('${png}'); [System.Windows.Forms.Clipboard]::SetImage($img)`);
}
/**
 * A file copied the way a person does it: Finder (select it, ⌘C) or Explorer (open its folder with it selected, Ctrl+C).
 * Returns how: 'Finder' / 'Explorer', or the fallback when that left no file on the clipboard (a file URL written by
 * the harness on a Mac, Set-Clipboard -Path on Windows), so the row says which one it judged.
 */
async function clipFileAsPerson(f) {
  if (os === 'mac') {
    try {
      // `open -R` shows the file selected in a Finder window and brings Finder to the front (no Apple Events, so no
      // Automation prompt for Finder on the runner).
      execFileSync('open', ['-R', f]);
      await sleep(1800);
      const fg = frontApp();
      if (fg === 'com.apple.finder') {
        keyNow('copy');
        await sleep(800);
        if (clipInfo().files?.some((p) => p === f || p.endsWith(f))) return 'Finder (the file selected, ⌘C)';
      } else note('Files from Finder', `the app in front was ${fg}, not Finder`);
    } catch (e) { note('Files from Finder', short(e)); }
    execFileSync(process.env.MOUSE, ['clip', 'files', f]);
    return 'a file URL written by the harness (Finder\'s ⌘C left none)';
  }
  try {
    spawn('explorer.exe', [`/select,${f}`], { detached: true, stdio: 'ignore' }).unref();
    await sleep(3500);
    let fg = frontApp();
    // A window opened by a background process doesn't get the foreground, and the maximized editor covers it (run
    // 44977282607: a click on its title bar went to the editor); brought forward as the taskbar would (the file stays
    // selected).
    if (!/explorer/i.test(fg)) { explorerToFront(); await sleep(700); fg = frontApp(); }
    if (/explorer/i.test(fg)) {
      keyNow('copy');
      await sleep(800);
      if (clipInfo().files?.some((p) => p.toLowerCase() === f.toLowerCase())) return 'Explorer (select, Ctrl+C)';
    } else note('Files from Explorer', `the window in front was ${fg}, not Explorer`);
  } catch (e) { note('Files from Explorer', short(e)); }
  ps(`Set-Clipboard -Path '${f}'`);
  return 'Set-Clipboard -Path (Explorer\'s Ctrl+C left none)';
}
/** Explorer windows the harness opened, closed (Shell.Application). */
function closeExplorerWindows() {
  if (os === 'windows') { try { ps('(New-Object -ComObject Shell.Application).Windows() | ForEach-Object { try { $_.Quit() } catch {} }'); } catch {} }
}
/**
 * The clipboard's changes, watched from outside for the launch: the Mac's change count every 5 ms with the content
 * at each change (pasteboard reads take no lock); Windows' GetClipboardSequenceNumber every ~15 ms and nothing else,
 * since opening the clipboard there could make the app's own write fail. Lines: { t, c [, types, text] }.
 */
let clipWatch = null;
function startClipWatch() {
  if (clipWatch) return;
  let child;
  if (os === 'mac') child = spawn(process.env.MOUSE, ['clipwatch'], { stdio: ['pipe', 'pipe', 'ignore'] });
  else {
    const f = path.join(TMP, 'unvibe-d5-clipwatch.ps1');
    writeFileSync(f, [
      "Add-Type -MemberDefinition '[DllImport(\"user32.dll\")] public static extern uint GetClipboardSequenceNumber();' -Name S -Namespace QaWatch",
      '$last = [QaWatch.S]::GetClipboardSequenceNumber()',
      '[Console]::Out.WriteLine("{""t"":$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()),""c"":$last,""start"":1}"); [Console]::Out.Flush()',
      'while ($true) { Start-Sleep -Milliseconds 5; $c = [QaWatch.S]::GetClipboardSequenceNumber(); if ($c -ne $last) { $last = $c; [Console]::Out.WriteLine("{""t"":$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()),""c"":$c}"); [Console]::Out.Flush() } }',
    ].join('\r\n'));
    child = spawn('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', f], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true });
  }
  const events = [];
  createInterface({ input: child.stdout }).on('line', (l) => { try { const e = JSON.parse(l); if (!e.start) events.push(e); } catch {} });
  child.on('error', () => {});
  clipWatch = { child, events };
}
function stopClipWatch() {
  if (!clipWatch) return;
  try { clipWatch.child.stdin.end(); } catch {}
  clipWatch.child.kill();
  clipWatch = null;
}
/** The clipboard's changes from `since` to `until`: how many, in bursts (changes less than 3 s apart), with the sample
 * texts seen on a Mac. */
function clipChanges(since, until = Date.now()) {
  const ev = (clipWatch?.events ?? []).filter((e) => e.t >= since && e.t <= until);
  const bursts = [];
  for (const e of ev) { const b = bursts.at(-1); if (b && e.t - b.last < 3000) { b.n++; b.last = e.t; } else bursts.push({ first: e.t, last: e.t, n: 1 }); }
  const sample = ev.filter((e) => typeof e.text === 'string' && e.text.includes('qa line '));
  return { ev, bursts, sample };
}
// Windows' clipboard history (Win+V): on, cleared, and read through WinRT (Clipboard.GetHistoryItemsAsync).
const WIN_HISTORY = [
  'Add-Type -AssemblyName System.Runtime.WindowsRuntime',
  '$null = [Windows.ApplicationModel.DataTransfer.Clipboard, Windows.ApplicationModel.DataTransfer, ContentType = WindowsRuntime]',
  "$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]",
  'function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); [void]$task.Wait(15000); $task.Result }',
].join('\n');
function winHistoryOn() {
  ps("New-Item -Path 'HKCU:\\Software\\Microsoft\\Clipboard' -Force | Out-Null; Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Clipboard' -Name EnableClipboardHistory -Value 1 -Type DWord");
  // Run 44977282607: the user setting alone left IsHistoryEnabled false (ClipboardHistoryDisabled) on the runner; the
  // machine policy that allows it, too.
  try { ps("New-Item -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System' -Force | Out-Null; Set-ItemProperty -Path 'HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows\\System' -Name AllowClipboardHistory -Value 1 -Type DWord"); } catch { /* not admin */ }
  const on = () => ps(`${WIN_HISTORY}\n[Windows.ApplicationModel.DataTransfer.Clipboard]::IsHistoryEnabled()`).split(/\r?\n/).pop();
  let state = on();
  if (state !== 'True') {
    try { ps("Get-Service -Name 'cbdhsvc_*' | Restart-Service -Force"); } catch {}
    state = on();
  }
  return state === 'True';
}
const winHistoryClear = () => ps(`${WIN_HISTORY}\n[Windows.ApplicationModel.DataTransfer.Clipboard]::ClearHistory()`);
/** The history's text items, newest first: [{ t (ms), text (first 200 characters) }], or null if it can't be read. */
function winHistory() {
  try {
    const raw = ps([
      WIN_HISTORY,
      '$r = Await ([Windows.ApplicationModel.DataTransfer.Clipboard]::GetHistoryItemsAsync()) ([Windows.ApplicationModel.DataTransfer.ClipboardHistoryItemsResult])',
      '$out = @(foreach ($i in $r.Items) { $txt = ""; if ($i.Content.Contains("Text")) { $txt = Await ($i.Content.GetTextAsync()) ([string]) }; [pscustomobject]@{ t = $i.Timestamp.ToUnixTimeMilliseconds(); text = $txt.Substring(0, [Math]::Min(200, $txt.Length)) } })',
      '"status $($r.Status)"; ConvertTo-Json -Compress -InputObject $out',
    ].join('\n'));
    const [status, json] = raw.split(/\r?\n/);
    if (!/Success/.test(status)) return { status, items: null };
    const items = JSON.parse(json || '[]');
    return { status, items: Array.isArray(items) ? items : [items] };
  } catch (e) { return { status: short(e), items: null }; }
}

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

// The editor the helpers below drive: VS Code (every mode), or Cursor (the auto-mode launches; a VS Code fork with the
// same workbench, Monaco DOM and command line, its own data folder and debug port).
const EDITORS = {
  vscode: { name: 'VS Code', exe: code, data: codeData, port: 9339, owners: ['Code', 'Visual Studio Code', 'Electron'], proc: 'Code', app: 'Visual Studio Code', killMac: 'Visual Studio Code.app/Contents/MacOS/', image: 'Code.exe' },
  cursor: { name: 'Cursor', exe: process.env.CURSOR, data: path.join(TMP, 'd5-cursor'), port: 9341, owners: ['Cursor'], proc: 'Cursor', app: 'Cursor', killMac: 'Cursor.app/Contents/MacOS/', image: 'Cursor.exe' },
};
let ED = EDITORS.vscode;
function vsSettings(theme, extra = {}) {
  const settingsFile = path.join(ED.data, 'User', 'settings.json');
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
    ...extra,
  }, null, 2));
}
let vs = null; // { browser, page }
async function openVsCode(extraArgs = [], file = sampleFile) {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  for (const key of Object.keys(env)) if (/^(UNVIBE_|GITHUB_TOKEN|GH_TOKEN|ACTIONS_)/.test(key)) delete env[key];
  spawn(ED.exe, ['--user-data-dir', ED.data, '--extensions-dir', path.join(ED.data, 'extensions'), '--new-window', `--remote-debugging-port=${ED.port}`, ...extraArgs, file], { stdio: 'ignore', detached: true, env }).unref();
  const browser = await waitFor(() => chromium.connectOverCDP(`http://127.0.0.1:${ED.port}`), 90000, 1000);
  if (!browser) throw new Error(`${ED.name} did not open its debug port`);
  const page = await waitFor(async () => browser.contexts().flatMap((c) => c.pages()).find((p) => /workbench/.test(p.url())), 60000, 500);
  if (!page) throw new Error(`no ${ED.name} window`);
  await page.locator('.monaco-editor .view-line').first().waitFor({ timeout: 60000 });
  // Cursor's first start covers the workbench with its sign-in screen (Log In / Sign Up, no skip; the laptop's Cursor
  // 3.31 smoke): hidden by a style in its own page, as a signed-in person never sees it. Its AI stays off (signed out).
  if (ED === EDITORS.cursor) await page.evaluate(() => { const s = document.createElement('style'); s.textContent = '.onboarding-v2-overlay { display: none !important; }'; document.head.appendChild(s); });
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
  note(`${ED.name} placed`, placed ? `content at (${placed.x}, ${placed.y}), ×${r1(placed.k)}${SCREEN ? ` on ${SCREEN.w}×${SCREEN.h}` : ''}` : `not settled in 30 s (last read (${prev?.x}, ${prev?.y}))`);
  return vs;
}
async function closeVsCode() {
  await vs?.browser.close().catch(() => {});
  vs = null;
  try {
    if (os === 'mac') execFileSync('pkill', ['-f', ED.killMac]);
    else execFileSync('taskkill', ['/IM', ED.image, '/T', '/F'], { stdio: 'ignore' });
  } catch { /* not running */ }
  await sleep(3000);
}
/** VS Code's content origin on the screen and its CSS → screen scale. */
async function vsOrigin() {
  const inner = await vs.page.evaluate(() => ({ iw: innerWidth, ih: innerHeight, dpr: devicePixelRatio }));
  if (os === 'mac') {
    const frameOf = (owner) => { try { return execFileSync(process.env.MOUSE, ['frame', owner], { encoding: 'utf8' }).trim(); } catch { return ''; } };
    const owner = ED.owners.find((o) => frameOf(o));
    if (!owner) throw new Error(`no on-screen ${ED.name} window`);
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
    `$w = Get-Process ${ED.proc} -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1`,
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
    // The focus in the button's page (unvibe-app 2026-11-20: a ring on the Mac light crops of runs 6 and 7, drawn only
    // on :focus-visible): what has focus, whether the button matches :focus or :focus-visible, and its outline. Read
    // only. hasFocus() is true under Playwright's focus emulation, so it says nothing about the OS window.
    const a = document.activeElement;
    const cs = b ? getComputedStyle(b) : null;
    const focus = {
      active: a ? `${a.nodeName}${typeof a.className === 'string' && a.className.trim() ? `.${a.className.trim().split(/\s+/).join('.')}` : ''}`.slice(0, 60) : 'none',
      fo: Boolean(b?.matches(':focus')), fv: Boolean(b?.matches(':focus-visible')),
      outline: cs ? `${cs.outlineStyle} ${cs.outlineWidth}` : '-', has: document.hasFocus(),
    };
    return {
      shown: Boolean(b || q), pill: Boolean(b?.classList.contains('ghost--pill')), flipped: Boolean(b?.classList.contains('ghost--flipped')),
      quick: Boolean(q), quickText: q ? q.innerText : '', x: screenX, y: screenY, w: outerWidth, h: outerHeight, t: Date.now(), log: window.__qaLog ?? null, ev: window.__qaEv ?? null, focus,
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
/** Records each show and hide in the button's page with its time (a MutationObserver, as in run 5's 57af963d: no
 * event listeners); installed once the page exists. */
async function watchGhost(app) {
  await ghostPage(app)?.evaluate(() => {
    if (window.__qaLog) return;
    window.__qaLog = [];
    const mark = () => {
      const s = Boolean(document.querySelector('.ghost, .quick'));
      const l = window.__qaLog;
      if (!l.length || l[l.length - 1].s !== s) l.push({ s, t: Date.now() });
    };
    new MutationObserver(mark).observe(document.getElementById('root'), { childList: true, subtree: true, attributes: true });
    mark();
  }).catch(() => {});
}
/** A4's trail: each pointer, focus and blur event that reaches the button's page (type, time, the target's class:
 * Mac A4 run 44677798585, a press on the button that opened nothing). Read only; listeners in the capture phase,
 * passive, never stopping anything. Installed only after the light crops and removed after the press row
 * (unvibe-app 2026-11-20: the ring on the Mac light crops came with these listeners, runs 6 and 7, not run 5). */
async function trailOn(app) {
  await ghostPage(app)?.evaluate(() => {
    if (window.__qaTrailOff) return;
    window.__qaEv = window.__qaEv ?? [];
    const types = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click', 'focus', 'blur'];
    const on = (e) => {
      const ev = window.__qaEv;
      const at = e.target === window ? 'window' : String(e.target?.getAttribute?.('class') ?? e.target?.nodeName ?? '');
      if (ev.length < 400) ev.push({ type: e.type, t: Date.now(), on: at.slice(0, 40) });
    };
    for (const type of types) window.addEventListener(type, on, { capture: true, passive: true });
    window.__qaTrailOff = () => {
      for (const type of types) window.removeEventListener(type, on, { capture: true });
      window.__qaTrailOff = null;
    };
  }).catch(() => {});
}
const trailOff = (app) => ghostPage(app)?.evaluate(() => window.__qaTrailOff?.()).catch(() => {});
/** The pointer events that reached the button's page from `since`: "pointerdown@+12 ms (ghost)…", or 'none'. */
const pageEvents = (g, since) => {
  if (!g?.ev) return 'not watched';
  const got = g.ev.filter((e) => e.t >= since);
  return got.length ? got.map((e) => `${e.type}@+${e.t - since} ms${e.on ? ` (${e.on})` : ''}`).join(', ') : 'none';
};
/** The focus in the button's page, short: "BODY", or "BUTTON.ghost :focus-visible, outline auto 1px". */
const focusText = (f) => (f ? `${f.active}${f.fv ? ' :focus-visible' : f.fo ? ' :focus' : ''}${f.outline && !/^none /.test(f.outline) ? `, outline ${f.outline}` : ''}` : '-');
/** The focus right after the button appears, read by labelled waitShown calls (the FR rows; launch F's rows are "F"). */
const focusReads = [];
/** One FR row: every read in `reads` has BODY as the page's active element and the button not :focus-visible. */
const focusRow = (row, reads) => log(reads.length > 0 && reads.every((x) => x.f?.active === 'BODY' && !x.f.fv), row,
  reads.length ? `${reads.map((x) => `${x.label}: ${focusText(x.f)}`).join('; ')} (document.hasFocus() ${[...new Set(reads.map((x) => x.f?.has))].join('/')}: Playwright's focus emulation)` : 'no read');
const shownAt = (g, since) => g?.log?.find((e) => e.s && e.t >= since)?.t ?? null;
const hiddenAt = (g, since) => g?.log?.find((e) => !e.s && e.t >= since)?.t ?? null;
const waitShown = async (app, ms = 3000, label = null) => {
  const g = await waitFor(async () => { const s = await ghost(app); return s?.shown ? s : null; }, ms, 10);
  if (g && label) focusReads.push({ label, f: g.focus });
  return g;
};
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
  return { f, size: `${img.w}×${img.h}`, sha: sha(f).slice(0, 12), clear: diffs.every((d) => d <= 24), diffs, focus: s.focus };
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
const crops = (r) => `${r.nudged ? `pill ${r.pill ? 'opened after a 1 px nudge' : 'not open after a 1 px nudge either'}; ` : ''}button crop ${r.cb ? `${r.cb.size} sha ${r.cb.sha} (corner diffs ${r.cb.diffs.join('/')})` : 'none (gone)'}; pill crop ${r.cp ? `${r.cp.size} sha ${r.cp.sha} (${r.cp.diffs.join('/')})` : 'none'}; focus at the crops: pill ${focusText(r.cp?.focus)}, button ${focusText(r.cb?.focus)}`;

// --- Launch A: the button in VS Code --------------------------------------------------------------------------------
async function runA(app, companion, tag) {
  focusReads.length = 0;
  const L = await vsLines();
  if (L.lines.length < 20) throw new Error(`VS Code shows ${L.lines.length} code lines`);
  note(`VS Code (${tag})`, `${L.theme}; content at (${L.o.x}, ${L.o.y}), CSS → screen ×${r1(L.o.k)}; ${L.lines.length} code lines on screen; editor ${L.editor ? `${Math.round(L.editor.x)}..${Math.round(L.editor.right)} × ${Math.round(L.editor.y)}..${Math.round(L.editor.bottom)}` : '?'}`);
  // VS Code in front, as a person clicks into it.
  pointer.click(L.lines[0].right + 60, L.lines[0].y);
  await sleep(600);

  // A0 (the lead, RC4 02b46bda: off by default, opt-in): in this fresh profile Settings say the button and Quick look
  // are off, no choice is on file (unvibe-bubble.json, main's record), no helper runs, and a real drag in VS Code shows
  // no button; Quick look can't be turned on while the button is off and nothing is recorded (bubbleStore.set).
  const bubbleFile = path.join(`${base}-a`, 'unvibe-bubble.json');
  try {
    const s0 = await companion.evaluate(() => window.unvibe.bubbleSettings());
    const helper0 = processTree(app.process.pid).filter(isHelper);
    const file0 = existsSync(bubbleFile);
    const row0 = (await vsLines()).lines[2];
    pointer.drag(row0.left + 2, row0.y, Math.min(row0.right - 2, row0.left + 420), row0.y);
    const g0 = await waitShown(app, 2500);
    const sel0 = await vsSelected();
    pointer.click(L.lines[1].right + 80, L.lines[1].y);
    await sleep(600);
    log(s0?.ghost === false && s0?.preview === false && !file0 && helper0.length === 0 && sel0 > 0 && !g0, `A0 ${tag}: the button is off by default (a real drag in VS Code shows none)`,
      `settings ghost ${s0?.ghost}, preview ${s0?.preview}; unvibe-bubble.json ${file0 ? 'on file' : 'none'}; helper processes ${helper0.map((p) => `${p.name}#${p.pid}`).join(', ') || 'none'}; the drag on line 3: VS Code selection boxes ${sel0}, button ${g0 ? 'SHOWN' : 'none in 2.5 s'}`);
    const q0 = await companion.evaluate(() => window.unvibe.setBubble('preview', true));
    const file1 = existsSync(bubbleFile);
    log(q0?.preview === false && q0?.ghost === false && !file1, `A0 ${tag}: Quick look can't be turned on while the button is off (nothing recorded)`,
      `setBubble('preview', true) gave ghost ${q0?.ghost}, preview ${q0?.preview}; unvibe-bubble.json ${file1 ? 'on file' : 'none'}`);
  } catch (e) { log(false, `A0 ${tag}: off by default`, `stopped: ${short(e)}`); }

  // A1: turning the button on (Settings, the main window) starts the helper; on a Mac, no permission prompt.
  const before = os === 'mac' ? screenWindows() : [];
  const settingsOn = await companion.evaluate(() => window.unvibe.setBubble('ghost', true));
  await sleep(6000);
  const helperOn = processTree(app.process.pid).filter(isHelper);
  log(settingsOn.ghost === true && settingsOn.preview === false && helperOn.length === 1, `A1 ${tag}: the button turned on in Settings starts the helper (Quick look stays off)`,
    `settings ghost ${settingsOn.ghost}, preview ${settingsOn.preview}, available ${settingsOn.available}; helper processes ${helperOn.map((p) => `${p.name}#${p.pid}`).join(', ') || 'none'}`);
  // Opt-in on file (Security G1): main records the choice with the copy version and the time it was made.
  try {
    const choices = JSON.parse(readFileSync(bubbleFile, 'utf8')).choices ?? [];
    const last = choices.at(-1);
    const age = last ? Date.now() - Date.parse(last.at) : NaN;
    log(choices.length === 1 && last?.item === 'ghost' && last?.on === true && last?.copyVersion !== undefined && age >= 0 && age < 120000,
      `A1 ${tag}: turning it on is recorded as one choice (the button on, its copy version and time)`,
      `${choices.length} choice(s); the last: item ${last?.item}, on ${last?.on}, copy version ${last?.copyVersion}, made ${Number.isFinite(age) ? `${Math.round(age / 1000)} s ago` : '?'}`);
  } catch (e) { log(false, `A1 ${tag}: turning it on is recorded`, `no record read: ${short(e)}`); }
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
    const g = await waitShown(app, 3000, `A2 round ${i + 1}`);
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
  let g = await waitShown(app, 3000, 'A4');
  if (!g) { log(false, `A4 ${tag}: hover, crops and press`, `no button for the drag on line ${L.lines.indexOf(row) + 1}`); return; }
  const r = await pillThenButton(app, g, `${tag}-light`, { x: to.x, y: to.y + 60 });
  log(Boolean(r.pill) && (r.pill.b?.w ?? r.pill.w) > (g.b?.w ?? g.w), `A4 ${tag}: hovering the button opens the pill`, r.pill ? `the button ${r1(g.b?.w ?? g.w)}×${r1(g.b?.h ?? g.h)} → the pill ${r1(r.pill.b?.w ?? r.pill.w)}×${r1(r.pill.b?.h ?? r.pill.h)}, grown ${near(r.pill.b?.x ?? r.pill.x, g.b?.x ?? g.x, 1.5) ? 'right' : 'left'}; hovered at the button's middle (${Math.round(mid(g).x)}, ${Math.round(mid(g).y)})` : `no pill in 2 s (hovered at the button's middle (${Math.round(mid(g).x)}, ${Math.round(mid(g).y)}))`);
  log(Boolean(r.cb?.clear) && Boolean(r.cp?.clear), `A4 ${tag}: 1:1 crops over VS Code light, corners see-through`, crops(r));
  // unvibe-app 2026-11-20 (the ring on run 6's and 7's Mac light crops): the button's focus right after each show,
  // read with nothing but the show/hide log in its page; A4's trail listeners go on only now, after the crops.
  const lightReads = focusReads.length;
  focusRow(`FR ${tag}: right after the button appears (A2's 5 rounds, A4 before its crops), the button's page has document.activeElement BODY and the button doesn't match :focus-visible`, focusReads.slice(0, lightReads));
  if (!r.back) { log(false, `A4 ${tag}: the press`, 'the button was gone when the pointer left the pill'); return; }
  await trailOn(app);
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
  await trailOff(app);
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
  const gf = await waitShown(app, 3000, "A6 flipped (after A4's press)");
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
  const gd = await waitShown(app, 3000, 'A7 dark (its page reloaded)');
  if (!gd) log(false, `A7 ${tag}: the button and the pill over VS Code dark`, 'no button');
  else {
    const theme = await ghostPage(app).evaluate(() => document.documentElement.dataset.theme);
    const r = await pillThenButton(app, gd, `${tag}-dark`, { x: toD.x, y: toD.y + 60 });
    log(L4.theme === 'dark' && theme === 'dark' && Boolean(r.cb?.clear) && Boolean(r.cp?.clear), `A7 ${tag}: 1:1 crops over VS Code dark, corners see-through`,
      `VS Code ${L4.theme}, the button's page ${theme}; ${crops(r)}`);
  }
  pointer.click(L4.lines[1].right + 80, L4.lines[1].y);
  await waitHidden(app, 2000);
  focusRow(`FR ${tag}: after A4's press, the same when the button appears again (A6 flipped; A7 dark, its page reloaded)`, focusReads.slice(lightReads));
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

// --- Launch F (Mac): #378, the panel fade: untouched stays, an app switch fades, touched fades, and "Hide" ------------
async function runF(app, companion) {
  const L = await vsLines();
  pointer.click(L.lines[2].left + 30, L.lines[2].y, 2); // VS Code in front, a word selected (the button is off here)
  await sleep(500);
  keys.unvibe();
  const panel = await waitFor(async () => panelPage(app), 8000, 100);
  if (!panel) { log(false, 'F mac: the panel fade', 'no panel 8 s after ⌃U'); desktop('f-no-panel'); return; }
  let view = '';
  await waitFor(async () => { view = await panel.evaluate(() => [...(document.querySelector('.ob')?.classList ?? [])].filter((c) => c.startsWith('ob--')).join(' ')).catch(() => ''); return /aiConsent/.test(view); }, 8000);
  const opacity = () => panel.evaluate(() => Number(getComputedStyle(document.querySelector('.ob')).opacity)).catch(() => null);
  const before = await opacity();
  const P = await panel.evaluate(() => ({ x: screenX, y: screenY, w: outerWidth, h: outerHeight }));
  // A click in VS Code off the panel (it opens near the pointer): a line above or below it, else beside it.
  const off = (l) => l.y < P.y - 20 || l.y > P.y + P.h + 20 || l.left + 30 < P.x - 20 || l.left + 30 > P.x + P.w + 20;
  const away = L.lines.find(off) ?? L.lines[0];
  const where = `VS Code clicked at (${Math.round(away.left + 30)}, ${Math.round(away.y)})${off(away) ? '' : ' (no line off the panel: inside it)'} and activated by name`;
  const intoVsCode = () => { pointer.click(away.left + 30, away.y); osa('tell application "Visual Studio Code" to activate'); };
  /** The opacity below 0.5 within `ms`, and how long after `t0` it got there; null if it didn't. */
  const fadeWithin = async (t0, ms) => { const o = await waitFor(async () => { const v = await opacity(); return v !== null && v < 0.5 ? v : null; }, ms, 50); return o === null ? null : { o, ms: Date.now() - t0 }; };
  /** The lowest opacity read over `ms`. */
  const lowestOver = async (ms) => { let low = Infinity; const end = Date.now() + ms; while (Date.now() < end) { const v = await opacity(); if (v !== null) low = Math.min(low, v); await sleep(100); } return low; };
  // The NSWorkspace activation notes while launch F runs (lead, #378 reads the pid in "(bundle id - pid)"): mouse.swift
  // prints each note's userInfo as macOS gives it; the report keeps the lines and whether Unvibe's main pid is named.
  const tF = Date.now();
  const acts = [];
  const actChild = spawn(process.env.MOUSE, ['activations', '60'], { stdio: ['ignore', 'pipe', 'ignore'] });
  actChild.on('error', () => {});
  createInterface({ input: actChild.stdout }).on('line', (l) => acts.push({ t: Date.now(), l: l.slice(0, 200) }));
  const actNote = () => {
    actChild.kill();
    note('F mac: NSWorkspace activation notes during launch F (mouse.swift activations)',
      `${acts.length ? acts.map((x) => `+${x.t - tF} ms ${x.l.replace(/\t/g, ' = ')}`).join('; ') : 'none'}; Unvibe's main pid ${app.process.pid} ${acts.some((x) => x.l.includes(` - ${app.process.pid})`)) ? 'is named in a note' : 'is in no note'}`);
  };
  await sleep(500);

  // F untouched (option 3): VS Code was in front all along, so nothing reaches Unvibe; the panel stays.
  intoVsCode();
  const low = await lowestOver(3000);
  desktop('f-untouched');
  log(low >= 0.5, 'F mac: untouched (⌃U, no click on any Unvibe window), a click into VS Code, the app in front all along, leaves the panel as it is (option 3: it stays)',
    `panel view "${view}", opacity ${before === null ? '?' : r1(before)}; the lowest over 3 s ${low === Infinity ? '?' : r1(low)}; ${where}; AI POSTs ${aiPosts('f').length}`);

  // F app switch: another app comes to the front.
  const tSwitch = Date.now();
  osa('tell application "Finder" to activate');
  const sw = await fadeWithin(tSwitch, 3000);
  desktop('f-app-switch');
  log(sw !== null, 'F mac: another app coming to the front (Finder, activated by name) fades the panel',
    sw ? `opacity ${r1(sw.o)}, ${sw.ms} ms after the activation call` : `opacity ${r1(await opacity())}: stayed at or above 0.5 for 3 s`);
  osa('tell application "Visual Studio Code" to activate');
  await sleep(800);

  // F touched: a click on the panel's header (it comes back), then VS Code clicked and activated.
  const head = await panel.evaluate(() => { const h = document.querySelector('.ob-head')?.getBoundingClientRect(); return h ? { x: h.left + h.width / 2, y: h.top + h.height / 2 } : null; }).catch(() => null);
  if (!head) { log(false, 'F mac: touched, then VS Code', 'the panel has no header (.ob-head) to click'); actNote(); return; }
  pointer.click(P.x + head.x, P.y + head.y);
  await sleep(600);
  const backTo = await opacity();
  const tTouched = Date.now();
  intoVsCode();
  const tf = await fadeWithin(tTouched, 3000);
  desktop('f-touched');
  log(tf !== null, 'F mac: touched (a click on the panel\'s header), then a click into VS Code with VS Code activated, fades the panel (unvibe-app: about 300 ms)',
    `opacity after the header click ${r1(backTo)}; then ${where}: ${tf ? `opacity ${r1(tf.o)}, ${tf.ms} ms after the click call` : `opacity ${r1(await opacity())}: stayed at or above 0.5 for 3 s`}`);

  // F hide: "Hide" as the click-away setting. Each row starts from a panel opened afresh with ⌃U (VS Code in front, a
  // word selected) and seen on the screen: its page visible, and a window of Unvibe's in the window list at the frame
  // the panel reports now (its height follows its content, 360-560, so the frame read at launch F's start can be stale:
  // run 44847332266 matched nothing before the click). A row whose start isn't met FAILs with the frame and the list.
  await companion.evaluate(() => window.unvibe.setSettings({ inactiveBehavior: 'hide' }));
  await sleep(800);
  const pids = new Set(processTree(app.process.pid).map((p) => p.pid));
  let hp = panel;
  const seen = async () => {
    const f = await hp.evaluate(() => ({ x: screenX, y: screenY, w: outerWidth, h: outerHeight, vis: document.visibilityState })).catch(() => null);
    const mine = screenWindows().filter((w) => pids.has(w.pid));
    const listed = Boolean(f) && mine.some((w) => near(w.x, f.x, 3) && near(w.y, f.y, 3) && near(w.w, f.w, 3) && near(w.h, f.h, 3));
    return { on: listed && f.vis === 'visible', listed, f, mine };
  };
  const say = (s) => `the panel reports ${s.f ? `${s.f.x},${s.f.y} ${s.f.w}×${s.f.h}, page ${s.f.vis}` : 'no frame'}; `
    + `${s.listed ? 'its window is in the list' : 'no window of Unvibe\'s at that frame'} (Unvibe's windows: ${s.mine.map((w) => `${w.x},${w.y} ${w.w}×${w.h} layer ${w.layer}`).join(' | ') || 'none'})`;
  /** ⌃U with VS Code in front and a word selected; the panel seen on the screen within 5 s, else the last look. */
  const fresh = async () => {
    pointer.click(L.lines[2].left + 30, L.lines[2].y, 2);
    await sleep(500);
    keys.unvibe();
    hp = (await waitFor(async () => panelPage(app), 5000, 100)) ?? hp;
    return (await waitFor(async () => { const s = await seen(); return s.on ? s : null; }, 5000, 200)) ?? seen();
  };
  const headOf = async (s) => {
    const h = await hp.evaluate(() => { const r = document.querySelector('.ob-head')?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; }).catch(() => null);
    return h && s.f ? { x: s.f.x + h.x, y: s.f.y + h.y } : null;
  };

  // Hide 1: a click on the panel itself keeps it on the screen (lead's S1: Unvibe's own activation is not "another app").
  const s0 = await fresh();
  const h0 = s0.on ? await headOf(s0) : null;
  if (!s0.on || !h0) {
    log(false, 'F mac: with "Hide" set, a click on the panel itself keeps it on the screen', `not run: the panel was not seen on the screen after a fresh ⌃U: ${say(s0)}${s0.on ? '; no header (.ob-head)' : ''}`);
  } else {
    pointer.click(h0.x, h0.y);
    await sleep(1000);
    const s1 = await seen();
    desktop('f-hide-click');
    log(s1.on, 'F mac: with "Hide" set, a click on the panel itself keeps it on the screen',
      `before the click (fresh ⌃U): ${say(s0)}; header clicked at (${Math.round(h0.x)}, ${Math.round(h0.y)}); 1 s after: ${s1.on ? 'on the screen' : say(s1)}; opacity ${r1(await hp.evaluate(() => Number(getComputedStyle(document.querySelector('.ob')).opacity)).catch(() => NaN))}`);
  }

  // Hide 2: touched (a header click), then a click into VS Code with VS Code activated, takes it off the screen.
  const s2 = await fresh();
  const h2 = s2.on ? await headOf(s2) : null;
  let s3 = null;
  if (s2.on && h2) {
    pointer.click(h2.x, h2.y);
    await sleep(1000);
    s3 = await seen();
  }
  if (!s3?.on) {
    log(false, 'F mac: with "Hide" set, touched, then a click into VS Code with VS Code activated takes the panel off the screen',
      `not run: the panel was not seen on the screen ${s2.on && h2 ? `1 s after the header click: ${say(s3)}` : `after a fresh ⌃U: ${say(s2)}${s2.on ? '; no header (.ob-head)' : ''}`}`);
  } else {
    const tHide = Date.now();
    intoVsCode();
    let last = s3;
    const gone = await waitFor(async () => { last = await seen(); return last.listed ? null : Date.now(); }, 3000, 100);
    desktop('f-hide');
    log(Boolean(gone), 'F mac: with "Hide" set, touched, then a click into VS Code with VS Code activated takes the panel off the screen',
      `before (fresh ⌃U, header clicked): ${say(s3)}; then ${where}: ${gone ? `its window left the list ${gone - tHide} ms after the click call (page ${last.f?.vis ?? '?'})` : `still on the screen 3 s later: ${say(last)}`}`);
  }
  await companion.evaluate(() => window.unvibe.setSettings({ inactiveBehavior: 'fade' })).catch(() => {});
  await hp.locator('.consent-form__actions button.ghost').click({ timeout: 3000 }).catch(() => {});
  await sleep(800);
  actNote();
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
async function blockHolds(tag = 'c') {
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
  const seen = apiRequests(netlogs.find((l) => l.tag === tag).file, host);
  const answered = seen.filter((q) => q.status);
  const ok = runner.startsWith('no answer') && resolverOk && dnsOk && answered.length === 0;
  log(ok, `D5-a: the block holds before the agreement (otherwise launch ${tag.toUpperCase()} stops here: no agreement, ${tag === 'c' ? 'no press' : 'no read'})`,
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

// --- Launches X and Y: auto mode (#384) ----------------------------------------------------------------------------
const bubbleFileOf = (tag) => path.join(`${base}-${tag}`, 'unvibe-bubble.json');
const norm = (s) => String(s ?? '').replace(/\u00a0/g, ' ');
let personN = 0;
/** The person's own clipboard text for one row (made up, different each time). */
const person = () => `qa-person-clip-${++personN}-${Date.now().toString(36)}`;
const TYPED = 'qatyped';
/** X0 / Y0: auto mode through Settings' own calls (the main window is Settings' window). Alone, with the button off,
 * it records nothing; with the button ("Turn on both": withButton) main records both choices in one write. */
async function autoOn(app, companion, tag) {
  const alone = await companion.evaluate(() => window.unvibe.setBubble('auto', true));
  const file0 = existsSync(bubbleFileOf(tag));
  const both = await companion.evaluate(() => window.unvibe.setBubble('auto', true, true));
  let rec = [];
  try { rec = JSON.parse(readFileSync(bubbleFileOf(tag), 'utf8')).choices ?? []; } catch { /* none */ }
  const g = rec.find((c) => c.item === 'ghost');
  const a = rec.find((c) => c.item === 'auto');
  const helper = await waitFor(async () => { const h = processTree(app.process.pid).filter(isHelper); return h.length ? h : null; }, 10000, 500);
  log(alone?.ghost === false && alone?.auto === false && !file0 && both?.ghost === true && both?.auto === true && rec.length === 2
    && g?.on === true && a?.on === true && g.copyVersion === '2026-11-21' && a.copyVersion === '2026-11-21' && g.at === a.at && Boolean(helper),
  `${tag.toUpperCase()}0: auto mode turns on only with the button ("Turn on both"), both choices recorded in one write`,
  `alone, the button off: ghost ${alone?.ghost}, auto ${alone?.auto}, unvibe-bubble.json ${file0 ? 'on file' : 'none'}; with the button: ghost ${both?.ghost}, auto ${both?.auto}; ${rec.length} choice(s): ${rec.map((c) => `${c.item} ${c.on} ${c.copyVersion} ${c.at}`).join('; ')}; helper ${helper ? helper.map((p) => `${p.name}#${p.pid}`).join(', ') : 'not running in 10 s'}`);
}
/** The app's own "an explanation started" moments: startReview sends shortcut:fired to the main window first thing,
 * for a press, the shortcut and an auto start alike. */
async function watchStarts(companion) {
  await companion.evaluate(() => { if (!window.__qaFired) { window.__qaFired = []; window.unvibe.onShortcutFired(() => window.__qaFired.push(Date.now())); } });
}
const startsSince = async (companion, since) => ((await companion.evaluate(() => window.__qaFired ?? []).catch(() => [])) ?? []).filter((t) => t >= since);
/** What each explanation read (the panel's init event: its first line and length) and how it ended. */
async function watchReads(app) {
  await panelPage(app)?.evaluate(() => {
    if (window.__qaInit) return;
    window.__qaInit = [];
    window.__qaEnd = [];
    window.unvibe.onReviewEvent((e) => {
      if (e?.type === 'init') window.__qaInit.push({ t: Date.now(), auto: Boolean(e.autoStart), len: String(e.preview ?? '').length, head: String(e.preview ?? '').trim().split('\n')[0].slice(0, 90), full: String(e.preview ?? '').slice(0, 600) });
      if (e?.type === 'done' || e?.type === 'error') window.__qaEnd.push({ t: Date.now(), type: e.type, code: e.code ?? null, message: String(e.message ?? '').slice(0, 140) });
    });
  }).catch(() => {});
}
const readsSince = async (app, since) => ((await panelPage(app)?.evaluate(() => window.__qaInit ?? []).catch(() => [])) ?? []).filter((r) => r.t >= since);
const endsSince = async (app, since) => ((await panelPage(app)?.evaluate(() => window.__qaEnd ?? []).catch(() => [])) ?? []).filter((r) => r.t >= since);
const netFile = (tag) => netlogs.find((l) => l.tag === tag)?.file;
const reviewPostsSince = (tag, since) => apiRequests(netFile(tag), host).filter((q) => q.method === 'POST' && /^\/api\/v1\/reviews\b/.test(q.path) && q.t >= since - 500);
/** The editor in front, as a person brings it there: activated by name on a Mac (a synthesized click doesn't activate
 * an app on macOS 26), a click right of its last line on Windows. */
async function activateEditor() {
  if (os === 'mac') osa(`tell application "${ED.app}" to activate`);
  else {
    const L = await vsLines();
    const last = L.lines.at(-3) ?? L.lines.at(-1);
    pointer.click(Math.min(last.right + 60, L.editor.right - 40), last.y);
  }
  await sleep(700);
}
/** Windows: the last File Explorer window brought to the front (restored if minimized; Alt pressed and released first,
 * the documented way a background process may set the foreground). Returns 'ok' or 'none' (no Explorer window). */
function explorerToFront() {
  return ps([
    'Add-Type @"',
    'using System; using System.Runtime.InteropServices;',
    'public class QaFront {',
    '  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);',
    '  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int c);',
    '  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);',
    '  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, IntPtr extra); }',
    '"@',
    "$w = @((New-Object -ComObject Shell.Application).Windows()) | Where-Object { $_.FullName -match 'explorer\\.exe$' } | Select-Object -Last 1",
    "if (-not $w) { 'none' } else {",
    '  $h = [IntPtr][long]$w.HWND',
    '  if ([QaFront]::IsIconic($h)) { [void][QaFront]::ShowWindow($h, 9) }',
    '  [QaFront]::keybd_event(0x12, 0, 0, [IntPtr]::Zero); [QaFront]::keybd_event(0x12, 0, 2, [IntPtr]::Zero)',
    "  [void][QaFront]::SetForegroundWindow($h); 'ok' }",
  ].join('\n'));
}
/** The other app an app switch goes back to, brought to the front: Finder (Mac); a File Explorer window (Windows). */
async function otherAppInFront() {
  if (os === 'mac') { osa('tell application "Finder" to activate'); await sleep(600); return 'com.apple.finder'; }
  if (explorerToFront() === 'none') { spawn('explorer.exe', [sampleDir], { detached: true, stdio: 'ignore' }).unref(); await sleep(3500); explorerToFront(); }
  await sleep(700);
  const fg = frontApp();
  if (!/explorer/i.test(fg)) throw new Error(`File Explorer did not come to the front (${fg} did)`);
  return 'explorer';
}
/** 36 plain lines for one editor, each ending "qa line <tag> <k>" (the Mac's clipboard watcher tells an auto copy by
 * that text); the tag differs per editor, so the 10-minute repeat check never meets a text twice. About 70 characters,
 * so every drag point stays in the screen's left 3/5 (run 44977282607: on the Mac's 1280 × 960 screen, Cursor's window
 * at x 140 put 98-character line ends under Unvibe's panel at the bottom right). Each still passes auto mode's size
 * floor (40 characters).
 */
const autoSample = (tag) => Array.from({ length: 36 }, (_, i) => `function ${tag}S${i + 1}(v, n = ${(i + 1) * 10}) { return v > n ? n : v + ${i + 1}; } // qa line ${tag} ${i + 1}`);
/** The editor settings for the auto rows: saved 200 ms after each change (the file then holds what the keys did), no
 * suggestion box or inline completion that could take a typed key, and no drag-and-drop of text (a row's drag starts
 * where the last row's selection ended). */
const AUTO_EDITOR = {
  'files.autoSave': 'afterDelay', 'files.autoSaveDelay': 200, 'editor.quickSuggestions': { other: 'off', comments: 'off', strings: 'off' },
  'editor.suggestOnTriggerCharacters': false, 'editor.wordBasedSuggestions': 'off', 'editor.acceptSuggestionOnEnter': 'off',
  'editor.inlineSuggest.enabled': false, 'editor.parameterHints.enabled': false, 'editor.autoClosingBrackets': 'never',
  'editor.dragAndDrop': false,
};

// Mac, #384 MUST-A5 (19f57c81): auto mode's read counts HID key-downs and clicks (CGEventSourceCounterForEventType,
// HID system state) and keeps a result only when the count moved by exactly its own ⌘C's key-down.
/** The HID system's press counts: [key-downs, left mouse-downs, right mouse-downs]. */
const pressCounts = () => execFileSync(process.env.MOUSE, ['presses'], { encoding: 'utf8' }).trim().split(/\s+/).map(Number);
const TCC_SYSTEM = '/Library/Application Support/com.apple.TCC/TCC.db';
const LISTEN_Q = "SELECT client || ' ' || auth_value FROM access WHERE service = 'kTCCServiceListenEvent' AND (client LIKE '%unvibe%' OR client LIKE '%osascript%');";
/** Input Monitoring (kTCCServiceListenEvent) rows for Unvibe or osascript: the system database and the user's. */
function listenRows() {
  const sys = execFileSync('sudo', ['-n', 'sqlite3', TCC_SYSTEM, LISTEN_Q], { encoding: 'utf8' }).trim();
  let user;
  try { user = execFileSync('sqlite3', [path.join(process.env.HOME ?? '', 'Library/Application Support/com.apple.TCC/TCC.db'), LISTEN_Q], { encoding: 'utf8' }).trim(); } catch (e) { user = `not read (${short(e)})`; }
  return { sys, user };
}
/** X9a: the key-down count one System Events ⌘C adds (auto mode's MAC_COPY_KEY_DOWNS is 1), read as soon as the
 * keystroke returns and 300 ms later (does the count lag?); the harness's CGEvent ⌘C beside it. */
async function copyKeyDowns() {
  const step = 'X9a (Mac): one System Events ⌘C adds exactly 1 to the HID key-down count and no click (MUST-A5\'s constant)';
  try {
    const p0 = pressCounts();
    osa('tell application "System Events" to key code 8 using command down');
    const p1 = pressCounts();
    await sleep(300);
    const p2 = pressCounts();
    const q0 = pressCounts();
    keyNow('copy');
    await sleep(300);
    const q1 = pressCounts();
    const d = (a, b) => (b - a) >>> 0;
    log(d(p0[0], p2[0]) === 1 && p2[1] === p0[1] && p2[2] === p0[2], step,
      `key-downs ${p0[0]} → ${p1[0]} as the keystroke returned (+${d(p0[0], p1[0])}${d(p0[0], p1[0]) === d(p0[0], p2[0]) ? ', no lag' : ', LAGS'}) → ${p2[0]} 300 ms later (+${d(p0[0], p2[0])}); left clicks ${p0[1]} → ${p2[1]}, right ${p0[2]} → ${p2[2]}; the harness's CGEvent ⌘C (mouse.swift) adds +${d(q0[0], q1[0])}`);
  } catch (e) { log(false, step, `stopped: ${short(e)}`); }
}
async function runX(app, companion) {
  if (!(await blockHolds('x'))) return;
  // Security's Mac C-3 row (19f57c81): Unvibe starts with no Input Monitoring grant; the auto reads must add none and
  // raise no prompt.
  let listen0 = null;
  if (os === 'mac') {
    try {
      listen0 = listenRows();
      if (/unvibe/i.test(listen0.sys)) {
        execFileSync('sudo', ['-n', 'sqlite3', TCC_SYSTEM, "DELETE FROM access WHERE service = 'kTCCServiceListenEvent' AND client LIKE '%unvibe%';"]);
        note('Input Monitoring', `the runner had a row for Unvibe (${listen0.sys}); removed before the reads`);
      }
    } catch (e) { note('Input Monitoring', `not read before the reads (${short(e)})`); }
  }
  const xT0 = Date.now();
  await autoOn(app, companion, 'x');
  // The agreement, as launch C: no editor open, the pointer at the screen's bottom right so the panel opens there.
  await closeVsCode();
  const area = await companion.evaluate(() => ({ x: screen.availLeft, y: screen.availTop, w: screen.availWidth, h: screen.availHeight }));
  pointer.move((area.x + area.w - 240) * scale, (area.y + area.h - 240) * scale);
  await giveAgreement(app);
  await watchStarts(companion);
  await watchReads(app);
  if (os === 'windows') {
    let on = false;
    try { on = winHistoryOn(); } catch (e) { note('Clipboard history (Win+V)', short(e)); }
    note('Clipboard history (Win+V)', on ? 'turned on (EnableClipboardHistory = 1; IsHistoryEnabled true)' : 'not available on this runner: X6 counts the clipboard\'s change bursts only');
  }
  if (os === 'mac') await copyKeyDowns();
  startClipWatch();
  // A real PNG for X3 (a corner of the screen) and a file for X4.
  const png = grab(file('x-clipboard-image'), 0, 0, 160, 100);
  const qaFile = path.join(sampleDir, 'qa-notes.txt');
  writeFileSync(qaFile, 'QA file for the auto-mode files row\n');
  const ctx = { app, companion, png, qaFile, lastRead: 0, t0: Date.now(), defender: D5 === 'auto-defender' };
  for (const which of ctx.defender ? ['vscode'] : ['vscode', 'cursor']) {
    ED = EDITORS[which];
    try { await autoEditor(ctx, which === 'vscode' ? 'vs' : 'cu'); } catch (e) { log(false, `X ${ED.name}`, `stopped: ${short(e)}`); desktop(`x-${which}-stopped`); } finally { await closeVsCode(); closeExplorerWindows(); }
  }
  ED = EDITORS.vscode;
  stopClipWatch();
  if (ctx.defender) {
    // SHOULD-384c: what the workflow's Defender step counts (each start is one auto read that copied and was kept).
    const st = await startsSince(companion, ctx.t0);
    const iso = (t) => new Date(t).toISOString();
    writeFileSync(path.join(out, 'auto-reads.txt'), `${st.length}\n${iso(ctx.t0)} ${iso(Date.now())}\n${st.map(iso).join('\n')}\n`);
    note('SHOULD-384c (Defender)', `${st.length} auto read(s) started an explanation in launch X, ${iso(ctx.t0)} to ${iso(Date.now())}; the workflow's Defender step judges the row`);
  }
  if (os === 'mac' && !ctx.defender) {
    const step = 'X9b (Mac): the auto reads raise no Input Monitoring prompt, and Input Monitoring lists neither Unvibe nor osascript';
    try {
      const listen1 = listenRows();
      const prompts = screenWindows().filter((w) => /UserNotificationCenter|universalAccessAuthWarn|tccd|System Settings|System Preferences/i.test(w.owner));
      const mins = Math.ceil((Date.now() - xT0) / 60000) + 1;
      let logLines = [];
      let logNote = '';
      try {
        const text = execFileSync('log', ['show', '--last', `${mins}m`, '--style', 'compact', '--predicate', 'subsystem == "com.apple.TCC" AND eventMessage CONTAINS[c] "ListenEvent"'], { encoding: 'utf8', maxBuffer: 64 << 20, timeout: 180000 });
        logLines = text.split('\n').filter((l) => /ListenEvent/i.test(l));
      } catch (e) { logNote = `; the TCC log not read (${short(e)})`; }
      const ours = logLines.filter((l) => /unvibe|osascript/i.test(l));
      for (const l of ours.slice(0, 3)) note('X9b TCC log', l.replace(/\s+/g, ' ').slice(0, 300));
      log(!/unvibe|osascript/i.test(listen1.sys) && !/unvibe|osascript/i.test(listen1.user) && prompts.length === 0 && ours.length === 0 && !logNote, step,
        `Input Monitoring rows for Unvibe/osascript: before ${listen0 ? `system "${listen0.sys || 'none'}", user "${listen0.user || 'none'}"` : 'not read'}; after system "${listen1.sys || 'none'}", user "${listen1.user || 'none'}"; prompt windows on screen: ${prompts.map((w) => w.owner).join(', ') || 'none'}; TCC log, last ${mins} min: ${logLines.length} ListenEvent line(s), ${ours.length} naming Unvibe or osascript${logNote}`);
    } catch (e) { log(false, step, `stopped: ${short(e)}`); }
  }
}

async function autoEditor(ctx, tag) {
  const { app, companion } = ctx;
  const lines = autoSample(tag);
  const original = `${lines.join('\n')}\n`;
  const autoFile = path.join(sampleDir, `auto-${tag}.js`);
  writeFileSync(autoFile, original);
  vsSettings('light', AUTO_EDITOR);
  await openVsCode([], autoFile);
  await sleep(1500);
  const lineOf = (L, k) => {
    const l = L.lines.find((x) => norm(x.text).trimEnd().endsWith(`// qa line ${tag} ${k}`));
    if (!l) throw new Error(`line ${k} of the sample is not on screen in ${ED.name}`);
    return l;
  };
  const want = (k, r) => `${[...lines.slice(0, k - 1), lines[k - 1] + r, ...lines.slice(k + 1)].join('\n')}\n`;
  /** The file back to the sample, and the editor showing it (it reloads a saved file changed on disk). */
  const reset = async () => {
    if (readFileSync(autoFile, 'utf8') !== original) writeFileSync(autoFile, original);
    const back = await waitFor(async () => { const L = await vsLines(); return lines.every((s, i) => L.lines.some((x) => norm(x.text).trimEnd() === s) || i >= L.lines.length) ? true : null; }, 8000, 300);
    if (!back) throw new Error(`${ED.name} does not show the sample again 8 s after it was put back on disk`);
  };
  const spaced = async () => { const w = ctx.lastRead + 16000 - Date.now(); if (w > 0) await sleep(w); };
  /** "the file: …" for a row: what the person's keys left. */
  const fileSays = (got, k, r) => {
    if (got === want(k, r)) return `the ${r === TYPED ? 'typed word' : 'paste'} in place of the selection`;
    if (got === original) return 'UNCHANGED (the keys did not reach the selection)';
    const g = got.split('\n');
    const i = g.findIndex((s, j) => s !== lines[j]);
    return `OTHER: from line ${i + 1}: "${(g[i] ?? '').slice(0, 110)}" / "${(g[i + 1] ?? '').slice(0, 60)}"; ${g.length - 1} lines (the sample 36)`;
  };
  /** What auto mode did from `t0`: its starts, what it read, the clipboard's changes, the app in front. */
  const autoSays = async (t0) => {
    const st = await startsSince(companion, t0);
    const rd = await readsSince(app, t0);
    const ch = clipChanges(t0);
    const texts = [...new Set(ch.sample.map((e) => `"${norm(e.text).trim().slice(0, 50)}"`))];
    const types = os === 'mac' ? [...new Set(ch.ev.flatMap((e) => e.types ?? []))] : [];
    return {
      st, rd, ch,
      text: `auto: ${st.length} start(s)${rd.length ? `, read "${rd[0].head}" (${rd[0].len} chars)` : ''}; clipboard changes ${ch.ev.length} in ${ch.bursts.length} burst(s)${texts.length ? `, sample text seen ${texts.join(', ')}` : ''}${types.length ? `, types ${types.join(' ')}` : ''}; in front after: ${frontApp()}`,
    };
  };
  let kNext = 1;
  // One line further down per row: each selection ("\n" + the next line) is a text no other row reads, so the
  // 10-minute repeat check never decides a row, and 36 lines hold every row.
  const nextK = () => { const k = kNext; kNext += 1; return k; };
  const block = async (k) => {
    const L = await vsLines();
    const a = lineOf(L, k);
    const b = lineOf(L, k + 1);
    const edge = L.editor.right - 40;
    const s = { x1: Math.min(a.right + 30, edge), y1: a.y, x2: Math.min(b.right + 30, edge), y2: b.y };
    // Never a drag onto Unvibe's own panel (run 44977282607, Mac Cursor: the drags went to the panel, not the editor).
    const pr = await panelPage(app)?.evaluate(() => ({ x: screenX, y: screenY, w: outerWidth, h: outerHeight, vis: document.visibilityState })).catch(() => null);
    if (pr?.vis === 'visible') {
      for (const [x, y] of [[s.x1, s.y1], [s.x2, s.y2]]) {
        if (x >= pr.x * scale && x < (pr.x + pr.w) * scale && y >= pr.y * scale && y < (pr.y + pr.h) * scale) throw new Error(`harness: (${Math.round(x)}, ${Math.round(y)}) is under Unvibe's panel (${pr.x}, ${pr.y}, ${pr.w}×${pr.h}); nothing dragged`);
      }
    }
    return s;
  };

  // X8 the control: a settled selection with no key is read once (else the rows below prove nothing).
  {
    const k = nextK();
    const step = `X8 ${ED.name}: a settled selection with no key is read once (the control)`;
    try {
      await spaced();
      await reset();
      const P = person();
      setClipboard(P);
      await activateEditor();
      await watchReads(app);
      const s = await block(k);
      const t0 = Date.now();
      ctx.lastRead = pointer.drag(s.x1, s.y1, s.x2, s.y2);
      await sleep(5500);
      const said = await autoSays(t0);
      const got = readFileSync(autoFile, 'utf8');
      const clip = readClipboard().trim();
      log(said.st.length === 1 && said.rd.length >= 1 && said.rd[0].len >= 40 && got === original && clip === P, step,
        `lines ${k}-${k + 1} (end to end), no key; the file ${got === original ? 'unchanged' : 'CHANGED'}; the person's clipboard 5.5 s later: ${clip === P ? 'theirs' : `NOT theirs ("${clip.slice(0, 60)}")`}; ${said.text}`);
    } catch (e) { log(false, step, `stopped: ${short(e)}`); }
  }

  // D5=auto-defender (Windows, Security's SHOULD-384c): after the control, settled selections 16 s apart until the
  // launch has started 12 auto explanations (16 tries at most, never past the sample's last line); nothing else.
  if (ctx.defender) {
    const step = `XD ${ED.name}: settled selections, each read by auto mode, for the Defender check (at least 10)`;
    let tries = 0;
    let n = 0;
    try {
      n = (await startsSince(companion, ctx.t0)).length;
      for (; n < 12 && tries < 16 && kNext + 1 <= lines.length; tries++) {
        const k = nextK();
        await spaced();
        await reset();
        setClipboard(person());
        await activateEditor();
        const s = await block(k);
        ctx.lastRead = pointer.drag(s.x1, s.y1, s.x2, s.y2);
        await sleep(5000);
        n = (await startsSince(companion, ctx.t0)).length;
      }
      log(n >= 10, step, `${n} auto start(s) in the launch after ${tries} more selection(s) (the control's included)`);
    } catch (e) { log(false, step, `stopped after ${tries} more selection(s), ${n} start(s): ${short(e)}`); }
    return;
  }

  // X1 / X2: select, then paste or type, at six moments (the lead: 700, 900 and 1500 added after run 44977282607).
  for (const kind of ['paste', 'type']) {
    for (const ms of [300, 700, 900, 1200, 1500, 2500]) {
      const k = nextK();
      try {
        await spaced();
        await reset();
        const P = person();
        setClipboard(P);
        await activateEditor();
        await watchReads(app);
        const s = await block(k);
        const t0 = Date.now();
        // Mac: the keys through System Events, which reset HIDIdleTime as a keyboard does (run 44987639357: CGEvent keys
        // didn't, so the Mac idle check never saw them); Windows: SendInput, which GetLastInputInfo sees.
        const r = dragKey(s.x1, s.y1, s.x2, s.y2, ms, `${os === 'mac' ? 'se-' : ''}${kind === 'paste' ? 'paste' : `type:${TYPED}`}`);
        ctx.lastRead = r.up;
        await sleep(5500);
        const got = readFileSync(autoFile, 'utf8');
        const clip = readClipboard().trim();
        const said = await autoSays(t0);
        const fileOk = got === want(k, kind === 'paste' ? P : TYPED);
        const clipOk = clip === P;
        // A read that holds the person's key came after it: the idle check missed the key.
        const readKey = said.rd.some((x) => (x.full ?? '').includes(kind === 'paste' ? P : TYPED));
        // A start after the key (50 ms slack: the start event's trip to the main window, and System Events' own delay
        // before its key lands) means a read the key met was kept (Security's acceptance for 19f57c81: a key from +375 to
        // +1703 ms starts nothing unless the read had already finished).
        const late = said.st.filter((t) => t > r.key + 50);
        log(fileOk && clipOk && !readKey && late.length === 0, `${kind === 'paste' ? 'X1' : 'X2'} ${ED.name}: select, then ${kind === 'paste' ? 'paste' : 'type'} ${ms} ms after the mouse-up`,
          `lines ${k}-${k + 1} (end to end); the key went ${r.key - r.up} ms after the release${r.done ? ` (done ${r.done - r.up} ms)` : ''}; the file: ${fileSays(got, k, kind === 'paste' ? P : TYPED)}; the person's clipboard 5.5 s later: ${clipOk ? 'theirs' : `NOT theirs ("${clip.slice(0, 60)}")`}; ${readKey ? `a read HELD the ${kind === 'paste' ? 'pasted text' : 'typed word'}; ` : ''}${said.st.length ? `start(s) at ${said.st.map((t) => `+${t - r.up}`).join(', ')} ms${late.length ? ' (AFTER the key)' : ' (before the key)'}; ` : ''}${said.text}`);
      } catch (e) { log(false, `${kind === 'paste' ? 'X1' : 'X2'} ${ED.name}: select, then ${kind} ${ms} ms after the mouse-up`, `stopped: ${short(e)}`); }
    }
  }

  // X3 an image, X4 a file: a settled selection leaves the clipboard as it is.
  for (const what of ['image', 'files']) {
    const k = nextK();
    const step = what === 'image' ? `X3 ${ED.name}: an image on the clipboard survives a settled selection (nothing read, nothing starts)` : `X4 ${ED.name}: a file copied in ${os === 'mac' ? 'Finder' : 'Explorer'} survives a settled selection (nothing read, nothing starts)`;
    try {
      await spaced();
      await reset();
      let how = 'a PNG (screenshot-style copy)';
      if (what === 'image') clipImage(ctx.png);
      else how = await clipFileAsPerson(ctx.qaFile);
      await sleep(500);
      const before = clipInfo();
      await activateEditor();
      await watchReads(app);
      const s = await block(k);
      const t0 = Date.now();
      ctx.lastRead = pointer.drag(s.x1, s.y1, s.x2, s.y2);
      await sleep(3500);
      const after = clipInfo();
      const said = await autoSays(t0);
      const kept = what === 'image'
        ? (os === 'mac' ? Boolean(before.png) && after.png === before.png : Boolean(before.image) && after.image === before.image)
        : Boolean(before.files?.length) && JSON.stringify(after.files) === JSON.stringify(before.files);
      log(kept && after.c === before.c && said.st.length === 0 && said.ch.ev.length === 0, step,
        `${how}; before: ${clipText(before)}${before.types?.length ? ` [${before.types.join(' ')}]` : ''}; after the selection and 3.5 s: ${clipText(after)}; ${said.text}`);
    } catch (e) { log(false, step, `stopped: ${short(e)}`); }
  }

  // X5 a double-click on a word.
  {
    const k = nextK();
    const step = `X5 ${ED.name}: a double-click on a word reads nothing and starts nothing`;
    try {
      await spaced();
      await reset();
      const P = person();
      setClipboard(P);
      await activateEditor();
      const L = await vsLines();
      const l = lineOf(L, k);
      const t0 = Date.now();
      pointer.click(l.left + 20, l.y, 2);
      await sleep(3000);
      const said = await autoSays(t0);
      const sel = await vsSelected();
      const clip = readClipboard().trim();
      log(said.st.length === 0 && said.ch.ev.length === 0 && clip === P, step, `line ${k}, "function" double-clicked; VS Code selection boxes ${sel}; ${readsText(pointer.last, t0)}; the person's clipboard ${clip === P ? 'theirs' : `NOT theirs ("${clip.slice(0, 60)}")`}; ${said.text}`);
    } catch (e) { log(false, step, `stopped: ${short(e)}`); }
  }

  // X6 4 selections in a row: at most one auto copy in the 15 s from the first read; one more after 16 s (control).
  {
    const step = `X6 ${ED.name}: 4 selections in a row reach the clipboard at most once in 15 s${os === 'windows' ? ' (Win+V history)' : ''}`;
    try {
      await spaced();
      await reset();
      const P = person();
      setClipboard(P);
      if (os === 'windows') { try { winHistoryClear(); } catch (e) { note('Clipboard history', `not cleared (${short(e)})`); } }
      await activateEditor();
      const t0 = Date.now();
      const ups = [];
      for (let i = 0; i < 4; i++) {
        const s = await block(nextK());
        if (os === 'mac' && i > 0) osa(`tell application "${ED.app}" to activate`);
        ups.push(pointer.drag(s.x1, s.y1, s.x2, s.y2));
        await sleep(1300);
      }
      const end = ups[0] + 700 + 15000;
      const lastIn = ups.filter((u) => u < end - 700).length;
      const wait = ups[0] + 16500 - Date.now();
      if (wait > 0) await sleep(wait);
      await activateEditor();
      const sc = await block(nextK());
      const tc = Date.now();
      const upC = pointer.drag(sc.x1, sc.y1, sc.x2, sc.y2);
      ctx.lastRead = upC;
      await sleep(4500);
      const ch = clipChanges(t0);
      const st = await startsSince(companion, t0);
      const inWin = (t) => t >= t0 && t < end;
      const macCopies = [...new Set(ch.sample.filter((e) => inWin(e.t)).map((e) => norm(e.text).trim()))];
      const burstsIn = ch.bursts.filter((b) => inWin(b.first));
      const control = os === 'mac' ? ch.sample.some((e) => e.t >= tc) : ch.bursts.some((b) => b.first >= tc);
      let hist = null;
      if (os === 'windows') hist = winHistory();
      const histSample = hist?.items ? hist.items.filter((h) => norm(h.text).includes('qa line ')) : null;
      const histIn = histSample ? histSample.filter((h) => inWin(h.t)) : null;
      const copiesIn = os === 'mac' ? macCopies.length : burstsIn.length;
      const ok = copiesIn <= 1 && (histIn === null || histIn.length <= 1) && st.filter(inWin).length <= 1;
      log(ok, step, `${lastIn} of 4 selections within the 15 s (mouse-ups ${ups.map((u) => `+${u - ups[0]}`).join(', ')} ms); in the 15 s: ${os === 'mac' ? `${macCopies.length} sample text(s) on the clipboard${macCopies.length ? ` (${macCopies.map((t) => `"${t.slice(0, 40)}"`).join(', ')})` : ''}` : `${burstsIn.length} clipboard change burst(s)`}, ${st.filter(inWin).length} start(s)${hist ? `; Win+V history: ${hist.items ? `${histSample.length} sample item(s), ${histIn.length} in the 15 s` : `not read (${hist.status})`}` : ''}; the control selection 16 s after the first: ${control ? 'read (the clipboard changed)' : 'NOT read'}`);
    } catch (e) { log(false, step, `stopped: ${short(e)}`); }
  }

  // X7 an app switch (Cmd+Tab / Alt+Tab) before and during the read.
  for (const ms of [250, 800]) {
    const k = nextK();
    const step = `X7 ${ED.name}: ${os === 'mac' ? 'Cmd' : 'Alt'}+Tab ${ms} ms after the mouse-up (${ms < 700 ? 'before the 700 ms' : 'during the read'}) sends nothing`;
    try {
      await spaced();
      await reset();
      const P = person();
      setClipboard(P);
      const other = await otherAppInFront();
      await activateEditor();
      await watchReads(app);
      const s = await block(k);
      const t0 = Date.now();
      const r = dragKey(s.x1, s.y1, s.x2, s.y2, ms, 'switch');
      ctx.lastRead = r.up;
      await sleep(4500);
      const front = frontApp();
      const said = await autoSays(t0);
      const posts = reviewPostsSince('x', t0);
      const clip = readClipboard().trim();
      const switched = os === 'mac' ? front === other : /explorer/i.test(front);
      const detail = `the switch went ${r.key - r.up} ms after the release; in front 4.5 s later: ${front}; explanation POSTs ${posts.length}; the person's clipboard ${clip === P ? 'theirs' : `NOT theirs ("${clip.slice(0, 60)}")`}; ${said.text}`;
      if (!switched) untestable(step, `the switch did not bring ${other} to the front; ${detail}`);
      else log(said.st.length === 0 && posts.length === 0 && clip === P, step, detail);
    } catch (e) { log(false, step, `stopped: ${short(e)}`); }
  }
}

// Launch Y: one real explanation of a settled selection (ai on; the only hosted call in this script).
const AI_SAMPLE = [
  '// qa sample: an order total',
  'function orderTotal(items, discount) {',
  '  let total = 0;',
  '  for (let i = 0; i <= items.length; i++) {',
  '    total += items[i].price * items[i].qty;',
  '  }',
  '  if (discount > 0) total = total - total * discount / 100;',
  '  return total.toFixed(2);',
  '}',
  '',
  '// end of the sample',
];
async function runY(app, companion) {
  await autoOn(app, companion, 'y');
  await closeVsCode();
  const area = await companion.evaluate(() => ({ x: screen.availLeft, y: screen.availTop, w: screen.availWidth, h: screen.availHeight }));
  pointer.move((area.x + area.w - 240) * scale, (area.y + area.h - 240) * scale);
  const panel = await giveAgreement(app);
  await watchStarts(companion);
  await watchReads(app);
  ED = os === 'mac' ? EDITORS.vscode : EDITORS.cursor;
  const f = path.join(sampleDir, 'order-total.js');
  writeFileSync(f, `${AI_SAMPLE.join('\n')}\n`);
  vsSettings('light', AUTO_EDITOR);
  await openVsCode([], f);
  await sleep(2000);
  const P = person();
  setClipboard(P);
  await activateEditor();
  const L = await vsLines();
  const a = L.lines.find((l) => norm(l.text).startsWith('// qa sample'));
  // The function's own closing brace (column 0), not the loop's indented one.
  const b = L.lines.find((l) => norm(l.text).trimEnd() === '}');
  if (!a || !b) throw new Error(`the sample is not on screen in ${ED.name}`);
  const edge = L.editor.right - 40;
  const t0 = Date.now();
  const up = pointer.drag(Math.min(a.right + 30, edge), a.y, Math.min(b.right + 30, edge), b.y);
  // The cap: auto mode off the moment the explanation starts (main records it), so nothing else can start.
  const st = await waitFor(async () => { const s = await startsSince(companion, t0); return s.length ? s : null; }, 8000, 50);
  const off = await companion.evaluate(() => window.unvibe.setBubble('auto', false));
  if (!st) {
    log(false, `Y1 ${ED.name}: auto mode explains a settled selection with no press`, `no explanation started in 8 s after the mouse-up; auto then turned off (${off?.auto === false ? 'recorded' : 'NOT recorded'}); ${readsText(pointer.last, t0)}`);
    return;
  }
  line(`CALL  1/1: auto mode: the settled selection (lines 2-9 of a short function) explained with no press, ${st[0] - up} ms after the mouse-up; auto turned off right after (${off?.auto === false ? 'recorded' : 'NOT recorded'})`);
  const ended = await waitFor(async () => { const e = await endsSince(app, t0); return e.length ? e : null; }, 90000, 500);
  await sleep(1500);
  const rd = await readsSince(app, t0);
  const posts = reviewPostsSince('y', t0);
  const ans = await panel.evaluate(() => {
    const root = document.querySelector('.short-answer');
    const heads = [...document.querySelectorAll('.short-answer h1, .short-answer h2, .short-answer h3, .short-answer h4')].map((h) => h.textContent.trim());
    const fixH = [...document.querySelectorAll('.short-answer h3, .short-answer h4')].find((h) => /suggested fixes/i.test(h.textContent));
    const fixes = [];
    for (let el = fixH?.nextElementSibling; el && !/^H[1-6]$/.test(el.tagName); el = el.nextElementSibling) {
      if (el.matches('ul, ol')) fixes.push(...[...el.querySelectorAll('li')].map((li) => li.textContent.trim()));
    }
    const text = root?.innerText ?? '';
    return { heads, fixHead: Boolean(fixH), fixes, nothing: /Nothing to fix that I can see\./.test(text), len: text.length, text };
  });
  log(st.length === 1 && posts.length === 1 && posts[0].status === 200 && ended?.[0]?.type === 'done',
    `Y1 ${ED.name}: auto mode explains a settled selection with no press (one POST, answered 200)`,
    `start ${st[0] - up} ms after the mouse-up; read "${rd[0]?.head ?? '?'}" (${rd[0]?.len ?? '?'} chars, auto start ${rd[0]?.auto}); POST /api/v1/reviews ${posts.length} (${posts.map((q) => q.status || 'no answer').join(', ') || 'none'}); ended ${ended ? `${ended[0].type}${ended[0].message ? ` "${ended[0].message}"` : ''} ${ended[0].t - st[0]} ms after the start` : 'not in 90 s'}`);
  log(ans.fixHead && ans.heads.length > 0 && /suggested fixes/i.test(ans.heads.at(-1)) && ((ans.fixes.length >= 1 && ans.fixes.length <= 3) || ans.nothing),
    `Y2 ${ED.name}: the answer ends with Suggested fixes (#383): 1 to 3 fixes, or "Nothing to fix that I can see."`,
    `headings ${ans.heads.map((h) => `"${h}"`).join(', ') || 'none'}; ${ans.fixes.length} fix(es)${ans.nothing ? ', "Nothing to fix that I can see."' : ''}; answer ${ans.len} chars`);
  for (const [i, fx] of ans.fixes.entries()) note(`Y2 fix ${i + 1}`, fx.replace(/\s+/g, ' ').slice(0, 300));
  // Stills: the panel as it is, then with the fixes in view, and the screen.
  await panel.screenshot({ path: file('auto-panel') }).catch((e) => note('Still auto-panel', short(e)));
  await panel.evaluate(() => [...document.querySelectorAll('.short-answer h3, .short-answer h4')].find((h) => /suggested fixes/i.test(h.textContent))?.scrollIntoView({ block: 'start' })).catch(() => {});
  await sleep(400);
  await panel.screenshot({ path: file('auto-fixes') }).catch((e) => note('Still auto-fixes', short(e)));
  desktop('auto-editor-and-panel');
  const clip = readClipboard().trim();
  log(clip === P, `Y3 ${ED.name}: the person's clipboard is theirs again after the read`, clip === P ? 'theirs' : `NOT theirs ("${clip.slice(0, 60)}")`);
  // A second selection after 16 s, auto now off: nothing starts (the cap holds).
  await sleep(Math.max(0, up + 16000 - Date.now()));
  await activateEditor();
  const L2 = await vsLines();
  const c = L2.lines.find((l) => norm(l.text).startsWith('// end of the sample'));
  const t2 = Date.now();
  if (c) pointer.drag(Math.min(a.right + 30, edge), a.y, Math.min(c.right + 30, edge), c.y);
  await sleep(4000);
  const st2 = await startsSince(companion, t2);
  const posts2 = reviewPostsSince('y', t0);
  log((await startsSince(companion, t0)).length === 1 && st2.length === 0 && posts2.length === 1, `Y4 ${ED.name}: one hosted call: with auto off after the start, a new selection starts nothing`,
    `${c ? 'a new selection (lines 1-11) 16 s later' : 'no second selection (line 11 not on screen)'}: ${st2.length} start(s); explanation POSTs in the launch ${posts2.length}`);
}

// --- The runs ----------------------------------------------------------------------------------------------------------
wideScreen();
if (os === 'windows') {
  // Run 44671864693: GetCursorInfo found no showing cursor on the runner, so the I-beam rows couldn't be judged.
  try { note('The runner\'s cursor, MouseKeys turned on', winPtr('mousekeys', '960', '540', '0', '0', '1').split(/\r?\n/).join('; ')); } catch (e) { note('The runner\'s cursor', `MouseKeys not set (${short(e)})`); }
}
vsSettings('light');
let failedLaunch = false;
const plan = D5 === 'auto' || D5 === 'auto-defender' ? ['x'] : D5 === 'auto-ai' ? ['y'] : os === 'windows' ? ['a', 'b', 'c'] : D5 === 'fade' ? ['f'] : ['a', 'f', 'c'];
for (const tag of plan) {
  let app = null;
  try {
    if (tag === 'c' || tag === 'x' || tag === 'y') {
      if (os === 'mac') {
        // Quick look and auto mode read the selection the way Control+U does (System Events ⌘C): Accessibility back
        // on for Unvibe, as the install step grants it (A1 ran with it reset).
        execFileSync('sudo', ['-n', 'sqlite3', '/Library/Application Support/com.apple.TCC/TCC.db', "INSERT OR REPLACE INTO access (service,client,client_type,auth_value,auth_reason,auth_version,indirect_object_identifier,flags) VALUES('kTCCServiceAccessibility','com.unvibe.app',0,2,4,1,'UNUSED',0);"]);
        note(`Launch ${tag.toUpperCase()}`, 'Unvibe\'s Accessibility granted again, as the install step does');
      }
      if (tag !== 'y') blockApi();
    }
    scale = tag === 'b' ? 1.5 : 1;
    const l = await launch(tag, tag === 'b' ? ['--force-device-scale-factor=1.5'] : []);
    app = l.app;
    await minimize(app, l.companion);
    startShadow(tag);
    if ((tag === 'a' || tag === 'f') && !vs) await openVsCode();
    if (tag === 'a') await runA(app, l.companion, os === 'mac' ? 'mac' : '100');
    if (tag === 'b') await runB(app, l.companion);
    if (tag === 'f') await runF(app, l.companion);
    if (tag === 'c') await runC(app, l.companion);
    if (tag === 'x') await runX(app, l.companion);
    if (tag === 'y') await runY(app, l.companion);
  } catch (e) {
    failedLaunch = true;
    log(false, `Launch ${tag}`, `stopped: ${short(e)}`);
    desktop(`${tag}-stopped`);
  } finally {
    stopShadow(tag);
    await app?.close().catch(() => {});
    await sleep(2000);
    if (tag === 'c' || tag === 'x') { try { unblockApi(); } catch (e) { log(false, `The hosts file back after launch ${tag.toUpperCase()}`, short(e)); } }
  }
}
await closeVsCode();

// --- Hosted-AI calls: none, or at most one (launch Y) ------------------------------------------------------------
const requests = netlogs.flatMap(({ tag, file: f }) => (existsSync(f) ? keepSummaryAndDrop(f, host, path.join(out, `netlog-d5-${os}-${tag}.txt`)).map((q) => ({ ...q, tag })) : []));
const ai = requests.filter((q) => q.method === 'POST' && /^\/api\/v1\/(reviews|comprehension|previews)\b/.test(q.path));
const answered = ai.filter((q) => q.status);
const aiList = `AI POSTs ${ai.length} (${ai.map((q) => `${q.tag} ${q.path} ${q.status || 'no answer'}`).join(', ') || 'none'}), with an answer ${answered.length}`;
if (D5 === 'auto-ai') {
  log(ai.length <= 1 && ai.every((q) => q.tag === 'y'), 'At most one hosted call (launch Y\'s auto start)', `the app's net logs: ${requests.length} request(s) to ${host}; ${aiList}`);
} else {
  log(answered.length === 0 && ai.every((q) => q.tag === 'c' || q.tag === 'x'), 'No hosted-AI call: nothing reached the server',
    `the app's net logs: ${requests.length} request(s) to ${host}; ${aiList}. Launch${D5 === 'auto' || D5 === 'auto-defender' ? ' X' : ' C'} ran behind the hosts block`);
}
const title = D5 === 'auto' ? 'D5 auto mode (#384) rows, VS Code and Cursor, no hosted AI'
  : D5 === 'auto-defender' ? 'D5 auto mode (#384) reads in VS Code with Microsoft Defender at its defaults (SHOULD-384c), no hosted AI'
  : D5 === 'auto-ai' ? 'D5 auto mode (#384) with Suggested fixes (#383), at most one hosted call' : 'D5 #366 button rows';
writeFileSync(path.join(out, `report-d5-${os}.txt`), `Unvibe ${version}: ${title} (${os})${D5.startsWith('auto') ? '' : ', no hosted AI'}\n\n${report.join('\n')}\n`);
process.exit(failedLaunch || report.some((l) => l.startsWith('FAIL')) ? 1 : 0);
