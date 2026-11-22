/**
 * Selection capture: save clipboard → activate the user's editor if needed →
 * synthesize Copy → read → restore clipboard. macOS uses System Events (⌘C).
 * Windows uses SendKeys (Ctrl+Insert — Ctrl+C would interrupt a running terminal process).
 * Linux reads the X11/Wayland PRIMARY selection (the highlighted text), so no Copy is
 * synthesized and the clipboard is never touched.
 * A failed capture returns no code so the shortcut never explains a stale clipboard
 * when the user did not select anything.
 */
import { clipboard } from 'electron';
import { execFile } from 'node:child_process';
import { autoRead, type AutoNativeOutput, type AutoReadResult } from '../core/autoRead';
import { clipboardHolder } from '../core/clipboardHold';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Every synthetic copy, from the shortcut, the button, Quick look or auto mode, goes through this one at a time (SHOULD-366d).
const holdClipboard = clipboardHolder(clipboard);
const copiedCode = (result: CaptureResult) => result.code;
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const isLinux = process.platform === 'linux';

/** Linux: the highlighted text is already in PRIMARY; empty when nothing is selected. */
export function readLinuxPrimary(read: (type: 'selection') => string = (type) => clipboard.readText(type)): CaptureResult {
  const text = read('selection');
  return text.trim().length > 0 ? { code: text } : { code: null, error: 'empty' };
}

/** Why a capture waits for Explain instead of sending at once; null sends at once. */
export type ConfirmReason = 'link' | 'highlight';

/**
 * An `unvibe://review` link always waits ('link'). On Linux PRIMARY keeps the last highlight from
 * any app, so with nothing highlighted now the shortcut could pick up old text ('highlight'): the
 * person sees it and presses Explain. Clipboard explains, samples and already-captured code are the
 * person's own choice and send at once.
 */
export function captureConfirmReason(
  options: { confirm?: boolean; preferClipboard?: boolean; sample?: boolean; captured?: unknown },
  linux = isLinux,
): ConfirmReason | null {
  if (options.confirm) return 'link';
  return linux && !options.preferClipboard && !options.sample && !options.captured ? 'highlight' : null;
}

function osascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { timeout: 5000, windowsHide: true }, (err, stdout) =>
      err ? reject(err) : resolve(stdout.trim()),
    );
  });
}

function powershell(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NoLogo', '-STA', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', command],
      { timeout: 8000, windowsHide: true },
      (err, stdout) => (err ? reject(err) : resolve(String(stdout).trim())),
    );
  });
}

function isSelfApp(name: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase();
  return n === 'electron' || n === 'unvibe' || n.includes('unvibe');
}

/** Last non-Unvibe frontmost app — used when Unvibe itself is focused (companion click). */
let lastForeignApp: string | null = null;
let watchTimer: NodeJS.Timeout | null = null;
let watchPolling = false;

const MAC_FRONTMOST_SCRIPT = 'tell application "System Events" to get name of first application process whose frontmost is true';

/**
 * Polls the frontmost app through System Events. That is an Apple Event, so the first poll raises
 * macOS's "control System Events" question: start it only once the person knows what the shortcut
 * does (after setup), never at a fresh install's first launch.
 */
export function startFrontmostWatch(): void {
  if (watchTimer) return;
  if (!isMac) return;
  watchTimer = setInterval(() => {
    // One osascript at a time: while macOS shows its question, a call can wait up to 5 s.
    if (watchPolling) return;
    watchPolling = true;
    osascript(MAC_FRONTMOST_SCRIPT)
      .then((name) => {
        if (name && !isSelfApp(name)) lastForeignApp = name;
      }, (error: unknown) => {
        // Automation is switched off: every poll would fail, so stop until a capture works again.
        if (macCaptureFailure(error) === 'automation_denied') stopFrontmostWatch();
      })
      .finally(() => {
        watchPolling = false;
      });
  }, 600);
}

function stopFrontmostWatch(): void {
  clearInterval(watchTimer ?? undefined);
  watchTimer = null;
}

/**
 * Why a macOS copy failed. `automation_denied`: macOS refused Unvibe's Apple Events to System Events
 * (error -1743, the Automation switch is off, and macOS won't ask again). `automation_timeout`: the
 * call ran out of time (killed by our cap, or AppleEvent timed out -1712), which is what happens
 * while macOS is still showing its question. Exported for tests.
 */
export function macCaptureFailure(error: unknown): 'automation_denied' | 'automation_timeout' | 'failed' {
  const e = (error ?? {}) as { message?: unknown; killed?: unknown };
  const message = typeof e.message === 'string' ? e.message : '';
  if (/\(-1743\)|not authori[sz]ed to send apple events/i.test(message)) return 'automation_denied';
  if (e.killed === true || /\(-1712\)/.test(message)) return 'automation_timeout';
  return 'failed';
}

export type CaptureBlock = 'automation_denied' | 'automation_timeout' | 'elevated' | null;

/**
 * What the panel should say about the last shortcut press after a review starts. Only a shortcut press reads
 * another window, so only its result changes the answer: macOS refusing or still asking about System Events, or a
 * Windows window that runs as administrator (UIPI), is kept until the next press; anything else clears it. The
 * sample, an already captured selection and clipboard explains leave it as it was.
 */
export function nextCaptureBlock(
  previous: CaptureBlock,
  options: { sample?: boolean; captured?: unknown; preferClipboard?: boolean },
  capture: { code: string | null; error?: string },
): CaptureBlock {
  if (options.sample || options.captured || options.preferClipboard) return previous;
  if (capture.code) return null;
  return capture.error === 'automation_denied' || capture.error === 'automation_timeout' || capture.error === 'elevated' ? capture.error : null;
}

/**
 * Whether a review start only brings the open panel back as it was (Design ruling e: ⌃U with nothing newly selected).
 * That needs a real read that came back empty. Before the person agrees to sending code nothing is read at all
 * (Security CC-4), so the panel has to open on the agreement instead, even while it still shows an earlier
 * explanation. Setup step 3's paste was dropped exactly there: the sample's panel was still open (QA, 0.1.53 RC).
 */
export function restoresOpenPanel(start: { code: string | null; agreed: boolean; needsGrant: boolean; panelOpen: boolean; panelHasCode: boolean }): boolean {
  return start.agreed && !start.code && !start.needsGrant && start.panelOpen && start.panelHasCode;
}

/**
 * Whether a review start shows the Island's "Loading" (it says Reading): only when something is really read. Before the
 * person agrees to sending code nothing is read at all (Security CC-4) and the panel opens on the agreement, so the
 * Island stays as it was; the first-run sample is Unvibe's own code and needs no agreement (CC-6). Otherwise the Island
 * said Reading over the agreement and kept saying it after Not now (QA setup-0157 still mac-11; Security SHOULD-372c).
 */
export function readsOnStart(start: { agreed: boolean; sample?: boolean }): boolean {
  return start.agreed || Boolean(start.sample);
}

/**
 * startReview's first step: the Island's Loading at once (when something will be read, readsOnStart), then the usage
 * round trip. The pulse must not wait for it: past its 60 s cache that is a billing call of up to 20 s (lead review,
 * #374), and ⌃U would show nothing until it ends.
 */
export function pulseThenUsage<U>(start: { agreed: boolean; sample?: boolean }, pulse: () => void, usage: () => Promise<U>): Promise<U> {
  if (readsOnStart(start)) pulse();
  return usage();
}

/**
 * Sets $name to the foreground process name. ($pid is PowerShell's read-only automatic
 * variable, so the window's process id goes in $procId.)
 */
const PS_FOREGROUND =
  'Add-Type @"\nusing System;\nusing System.Runtime.InteropServices;\npublic class Fg {\n  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();\n  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);\n  [DllImport("kernel32.dll", SetLastError = true)] public static extern IntPtr OpenProcess(uint access, bool inherit, uint pid);\n  [DllImport("advapi32.dll", SetLastError = true)] public static extern bool OpenProcessToken(IntPtr process, uint access, out IntPtr token);\n  [DllImport("advapi32.dll", SetLastError = true)] public static extern bool GetTokenInformation(IntPtr token, int cls, out uint info, uint len, out uint ret);\n  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);\n}\n"@\n' +
  '$h = [Fg]::GetForegroundWindow(); [uint32]$procId = 0; [void][Fg]::GetWindowThreadProcessId($h, [ref]$procId); ' +
  '$name = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName; ' +
  // UIPI: a normal-integrity app's synthetic keystrokes never reach an elevated window, and SendKeys reports success
  // anyway. The foreground process's token says whether it is elevated (TokenElevation = 20); a process we may not
  // even query (OpenProcess / OpenProcessToken refused) is treated the same. $elevated is "1" or "0".
  '$elevated = "0"; $p = [Fg]::OpenProcess(0x1000, $false, $procId); if ($p -eq [IntPtr]::Zero) { $elevated = "1" } else { [IntPtr]$t = [IntPtr]::Zero; if (-not [Fg]::OpenProcessToken($p, 0x8, [ref]$t)) { $elevated = "1" } else { [uint32]$e = 0; [uint32]$r = 0; if ([Fg]::GetTokenInformation($t, 20, [ref]$e, 4, [ref]$r) -and $e -ne 0) { $elevated = "1" }; [void][Fg]::CloseHandle($t) }; [void][Fg]::CloseHandle($p) }; ' +
  '$me = [IntPtr]::Zero; [uint32]$mine = 0; [uint32]$mr = 0; if ([Fg]::OpenProcessToken([System.Diagnostics.Process]::GetCurrentProcess().Handle, 0x8, [ref]$me) -and [Fg]::GetTokenInformation($me, 20, [ref]$mine, 4, [ref]$mr) -and $mine -ne 0) { $elevated = "0" }';

/** Ctrl+Insert copies in editors, browsers and consoles without sending SIGINT like Ctrl+C. */
const PS_COPY = "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^{INSERT}')";

/** Console hosts where a stray copy keystroke must not be repeated. */
const WINDOWS_TERMINALS = new Set(['windowsterminal', 'powershell', 'pwsh', 'cmd', 'conhost', 'openconsole', 'wezterm', 'wezterm-gui', 'alacritty']);

function isWindowsTerminal(name: string | null): boolean {
  return Boolean(name && WINDOWS_TERMINALS.has(name.toLowerCase()));
}

export async function frontmostApp(): Promise<string | null> {
  try {
    if (isWindows) {
      const name = await powershell(`${PS_FOREGROUND}; $name`);
      return name || null;
    }
    if (!isMac) return null;
    return await osascript(MAC_FRONTMOST_SCRIPT);
  } catch {
    return null;
  }
}

async function activateApp(name: string): Promise<void> {
  if (isWindows) {
    const escaped = name.replace(/'/g, "''");
    await powershell(`$w = New-Object -ComObject WScript.Shell; [void]$w.AppActivate('${escaped}')`);
    await delay(160);
    return;
  }
  const escaped = name.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  await osascript(`tell application "${escaped}" to activate`);
  await delay(160);
}

async function syntheticCopy(): Promise<void> {
  if (isWindows) {
    await powershell(PS_COPY);
    return;
  }
  // Key code 8 is physical C on the current macOS keyboard layout. It is more
  // reliable than a character keystroke in Cursor and VS Code's full-screen
  // editor surfaces.
  await osascript('tell application "System Events" to key code 8 using {command down}');
}

/**
 * Editors update the pasteboard asynchronously, especially for larger selections.
 * Poll briefly instead of assuming a single fixed delay is enough.
 */
async function waitForCopiedText(): Promise<string> {
  // Windows editors and terminals can take longer to commit the copy after SendKeys.
  const attempts = isWindows ? 32 : 18;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    await delay(70);
    const text = clipboard.readText();
    if (text.trim().length > 0) return text;
  }
  return '';
}

export interface CaptureResult {
  code: string | null;
  /** The app the selection was read from, when capture already looked it up (Windows). */
  sourceApp?: string | null;
  /** Why no code came back: nothing was copied, the copy itself failed, or macOS blocked or is still asking about System Events. */
  error?: 'empty' | 'failed' | 'unsupported' | 'automation_denied' | 'automation_timeout' | 'elevated';
}

/** The foreground app's name and whether it runs elevated, as PowerShell printed them (`<name>\n<0|1>`). */
export function parseWindowsForeground(output: string): { name: string | null; elevated: boolean } {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const flag = lines.at(-1);
  const elevated = flag === '1';
  const name = (flag === '1' || flag === '0' ? lines.slice(0, -1) : lines).join(' ').trim();
  return { name: name || null, elevated };
}

/** Windows: one PowerShell launch finds the foreground app, says whether it is elevated, and sends the copy keystroke. */
async function windowsDetectAndCopy(): Promise<{ name: string | null; elevated: boolean }> {
  return parseWindowsForeground(await powershell(`${PS_FOREGROUND}; ${PS_COPY}; $name; $elevated`));
}

/**
 * The IDE bridge writes the editor's active selection to the local pasteboard immediately
 * before opening Unvibe. It is still entirely on-device; this mode avoids relying on macOS
 * focus timing after the external application link has been handled.
 */
export async function captureSelection(options: { preferClipboard?: boolean; fromApp?: string } = {}): Promise<CaptureResult> {
  if (options.preferClipboard) {
    const copied = clipboard.readText();
    return copied.trim().length > 0 ? { code: copied } : { code: null, error: 'empty' };
  }
  if (isLinux) return readLinuxPrimary();
  if (!isMac && !isWindows) return { code: null, error: 'unsupported' };
  return holdClipboard(() => copySelection(options), copiedCode);
}

/**
 * Auto mode's native read on the Mac, one osascript (JXA) launch: the frontmost app's bundle id must be the selection's
 * editor, no hardware input since the settle began (and none in the last 500 ms), no Shift, Control, Option or Command
 * held (it would join the ⌘C), then ⌘C and a 5 ms watch of the pasteboard's change count. `copied -` goes out the
 * moment the count moves, so Node reads the text and puts the clipboard back without waiting for anything else.
 * Idle time comes from IOHIDSystem's HIDIdleTime (kernel). CGEventSourceSecondsSinceLastEventType lags up to about a
 * second after input on macOS 27.2, so it isn't used. The synthetic ⌘C resets HIDIdleTime too (QA run 44982193648: with
 * the mark taken before it, every read dropped), so the mark is a second sample taken after `copied -` is out, after
 * the keystroke as on Windows, and printed as the next line: the uptime before and after that sample and the idle
 * seconds, for the input check after the restore.
 * A key or click between the idle sample and that mark (a paste that replaces the selection before the ⌘C lands, say)
 * is invisible to HIDIdleTime, so the mark also carries the HID system's press counts taken with the idle sample:
 * key-downs, left and right mouse-downs (CGEventSourceCounterForEventType: how many, never which key). The input check
 * drops the result unless exactly the ⌘C's own key-down and no click came since (Security MUST-A5 on #384).
 */
const MAC_AUTO_HID = [
  "ObjC.import('CoreGraphics');",
  "var me = Application.currentApplication(); me.includeStandardAdditions = true;",
  'function hid() {',
  '  var b = $.NSProcessInfo.processInfo.systemUptime;',
  "  var m = /\"HIDIdleTime\" = (\\d+)/.exec(me.doShellScript('/usr/sbin/ioreg -c IOHIDSystem -r -d 1'));",
  '  var a = $.NSProcessInfo.processInfo.systemUptime;',
  "  if (!m) throw new Error('HIDIdleTime missing');",
  '  return [b, a, Number(m[1]) / 1e9];',
  '}',
  // kCGEventSourceStateHIDSystemState = 1; kCGEventKeyDown = 10, kCGEventLeftMouseDown = 1, kCGEventRightMouseDown = 3.
  'function presses() {',
  '  return [10, 1, 3].map(function (type) { return Number($.CGEventSourceCounterForEventType(1, type)); });',
  '}',
].join('\n');

/** Key-downs the synthetic ⌘C adds to the HID system's count (the C; Command is a flags change, not a key-down). */
const MAC_COPY_KEY_DOWNS = 1;

const MAC_AUTO_READ = [
  "ObjC.import('AppKit');",
  MAC_AUTO_HID,
  "function emit(line) { $.NSFileHandle.fileHandleWithStandardOutput.writeData($(line + '\\n').dataUsingEncoding($.NSUTF8StringEncoding)); }",
  'function run(argv) {',
  "  var se = Application('System Events');",
  '  var front = String(se.processes.whose({ frontmost: true })[0].bundleIdentifier()).toLowerCase();',
  "  if (front !== String(argv[0]).toLowerCase()) { emit('skip app'); return ''; }",
  '  var pb = $.NSPasteboard.generalPasteboard;',
  '  var before = pb.changeCount;',
  // The settle's age is taken just before the idle sample, so a mouse-up right before the settle never reads as input.
  '  var since = Date.now() - Number(argv[1]);',
  '  var p = presses();',
  '  var h = hid();',
  "  if (h[2] < Math.max(0.5, since / 1000) || ($.NSEvent.modifierFlags & 0x1E0000)) { emit('skip busy'); return ''; }",
  "  se.keyCode(8, { using: 'command down' });",
  '  var end = Date.now() + 1300;',
  '  while (Date.now() < end) {',
  // The copy has landed: the line goes out first, so the clipboard is put back while the mark is still being sampled
  // (QA run 3: a paste ~50 ms after the copy landed, before a restore that waited for the mark, got the selection). A
  // failed sample sends a zero mark, which MAC_AUTO_INPUT always reads as input, so the result is dropped.
  '    if (pb.changeCount !== before) {',
  "      emit('copied -');",
  "      var mark; try { mark = hid().concat(p).join(','); } catch (e) { mark = '0,0,0,0,0,0'; }",
  "      emit(mark); return '';",
  '    }',
  '    delay(0.005);',
  '  }',
  "  emit('none ' + h.join(','));",
  "  return '';",
  '}',
].join('\n');

/**
 * After the restore: 'input' if any key-down beyond the ⌘C's own or any click came since the idle sample, or any
 * hardware input came after the mark's sample. With no new input the idle time grew by exactly the time between the two
 * samples, which is at least (this sample's start - that sample's end). A mark that isn't 6 numbers reads as input.
 */
const MAC_AUTO_INPUT = [
  MAC_AUTO_HID,
  'function run(argv) {',
  "  var m = String(argv[0]).split(',').map(Number);",
  "  if (m.length !== 6 || m.some(isNaN)) return 'input';",
  '  var p = presses();',
  `  if (((p[0] - m[3]) >>> 0) !== ${MAC_COPY_KEY_DOWNS} || p[1] !== m[4] || p[2] !== m[5]) return 'input';`,
  '  var h = hid();',
  "  return h[2] < m[2] + (h[0] - m[1]) ? 'input' : 'idle';",
  '}',
].join('\n');

/**
 * Windows: the clipboard's sequence number, the last input's tick (GetLastInputInfo: a time, never a key), and a 10 ms
 * watch for the sequence number to move, all in the PowerShell process that sends the keystroke. Whether Shift, Ctrl or
 * Alt is held comes from Forms' managed `Control.ModifierKeys` in PS_AUTO_READ, with no key-state P/Invoke: EDR
 * keylogger rules match those names in a PowerShell script (Security MUST-A4 on #384).
 */
const PS_AUTO_CLASS =
  'Add-Type @"\nusing System;\nusing System.Diagnostics;\nusing System.Runtime.InteropServices;\nusing System.Threading;\npublic class UvAuto {\n  [StructLayout(LayoutKind.Sequential)] struct Lii { public uint cbSize; public uint dwTime; }\n  [DllImport("user32.dll")] static extern bool GetLastInputInfo(ref Lii info);\n  [DllImport("user32.dll")] static extern uint GetClipboardSequenceNumber();\n  public static uint LastInput() { Lii info = new Lii(); info.cbSize = 8; if (!GetLastInputInfo(ref info)) throw new Exception("GetLastInputInfo"); return info.dwTime; }\n  public static uint IdleMs() { return unchecked((uint)Environment.TickCount - LastInput()); }\n  public static uint Seq() { return GetClipboardSequenceNumber(); }\n  public static bool WaitSeq(uint before, int ms) { Stopwatch watch = Stopwatch.StartNew(); while (watch.ElapsedMilliseconds < ms) { if (GetClipboardSequenceNumber() != before) return true; Thread.Sleep(10); } return false; }\n}\n"@\n';

/**
 * The app and the settle time arrive as environment variables, never inside the script text. The keystroke goes only to
 * the selection's editor, not elevated, with no input since the settle began (the settle's age is taken before the idle
 * sample, so the mouse-up itself never reads as input); the mark is the last input's tick right after the keystroke
 * (SendKeys counts as input), so any later input changes it.
 */
const PS_AUTO_READ =
  `${PS_FOREGROUND}; Add-Type -AssemblyName System.Windows.Forms; ${PS_AUTO_CLASS}` +
  'if (-not ([bool]$name -and ("$name.exe" -ieq $env:UNVIBE_AUTO_APP) -and $elevated -eq "0")) { [Console]::Out.WriteLine("skip app $name"); exit }; ' +
  '$before = [UvAuto]::Seq(); ' +
  '$need = [Math]::Max([int64]500, [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds() - [int64]$env:UNVIBE_AUTO_SINCE); ' +
  "if ([UvAuto]::IdleMs() -lt $need -or [System.Windows.Forms.Control]::ModifierKeys -ne 'None') { [Console]::Out.WriteLine(\"skip busy $name\"); exit }; " +
  "[System.Windows.Forms.SendKeys]::SendWait('^{INSERT}'); $mark = [UvAuto]::LastInput(); " +
  'if ([UvAuto]::WaitSeq($before, 2000)) { [Console]::Out.WriteLine("copied $mark $name") } else { [Console]::Out.WriteLine("none $mark $name") }';

const PS_AUTO_INPUT = `${PS_AUTO_CLASS}[UvAuto]::LastInput()`;

/**
 * Runs a helper and streams its output: `first` resolves with the first line the moment it's printed, not when the
 * process exits, and `next` with the second. A line the helper never printed resolves '' if it exited cleanly, and
 * rejects if it failed; `next` never counts as an unhandled rejection when nobody waits for it.
 */
function streamLines(file: string, args: string[], options: { timeout: number; env?: NodeJS.ProcessEnv }): { first: Promise<string>; next: Promise<string> } {
  const waiting: Array<{ resolve: (line: string) => void; reject: (err: unknown) => void }> = [];
  const [first, next] = [0, 1].map(() => new Promise<string>((resolve, reject) => waiting.push({ resolve, reject })));
  next.catch(() => undefined);
  let out = '';
  const child = execFile(file, args, { ...options, windowsHide: true }, (err) => {
    if (!err && out.trim()) waiting.shift()?.resolve(out.trim());
    for (const line of waiting.splice(0)) {
      if (err) line.reject(err);
      else line.resolve('');
    }
  });
  child.stdout?.on('data', (chunk: Buffer | string) => {
    out += String(chunk);
    for (let end = out.indexOf('\n'); end >= 0 && waiting.length; end = out.indexOf('\n')) {
      waiting.shift()?.resolve(out.slice(0, end).trim());
      out = out.slice(end + 1);
    }
  });
  return { first, next };
}

async function autoNative(app: string, settleStartedAt: number): Promise<AutoNativeOutput> {
  if (isWindows) {
    const { first } = streamLines('powershell.exe', ['-NoProfile', '-NoLogo', '-STA', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', PS_AUTO_READ], {
      timeout: 8000,
      env: { ...process.env, UNVIBE_AUTO_APP: app, UNVIBE_AUTO_SINCE: String(settleStartedAt) },
    });
    return { line: await first };
  }
  const { first, next } = streamLines('osascript', ['-l', 'JavaScript', '-e', MAC_AUTO_READ, app, String(settleStartedAt)], { timeout: 5000 });
  return { line: await first, next };
}

async function autoInputSince(mark: string): Promise<boolean> {
  if (isWindows) return (await powershell(PS_AUTO_INPUT)) !== mark;
  return (await streamLines('osascript', ['-l', 'JavaScript', '-e', MAC_AUTO_INPUT, mark], { timeout: 5000 }).first) !== 'idle';
}

/**
 * Auto mode's read (ledger 646; core/autoRead.ts says what it guarantees). `settleStartedAt` is the mouse-up's time:
 * any input after it means the person is acting, so nothing is copied. Linux (the laptop harness only) reads PRIMARY.
 */
export async function captureForAuto(app: string, settleStartedAt: number): Promise<AutoReadResult> {
  if (isLinux) {
    const primary = readLinuxPrimary();
    return primary.code ? { code: primary.code } : { code: null, error: 'empty' };
  }
  if (!isMac && !isWindows) return { code: null, error: 'failed' };
  try {
    return await autoRead(
      {
        formats: () => clipboard.availableFormats(),
        readText: () => clipboard.readText(),
        hold: holdClipboard,
        native: autoNative,
        inputSince: autoInputSince,
        wait: delay,
      },
      app,
      settleStartedAt,
    );
  } catch {
    return { code: null, error: 'failed' };
  }
}

/** The synthetic copy itself; holdClipboard has saved the person's clipboard and puts it back after. */
async function copySelection(options: { fromApp?: string }): Promise<CaptureResult> {
  // Let Control+U / the saved shortcut release before synthesizing Copy.
  await delay(90);
  // Empty the text pasteboard so an unchanged clipboard cannot be mistaken for a selection.
  // The explicit Use clipboard action remains available in the no-selection picker.
  clipboard.writeText('');
  let sourceApp: string | null | undefined;
  let elevated = false;
  try {
    let grabbed: string;
    if (isWindows) {
      ({ name: sourceApp, elevated } = await windowsDetectAndCopy());
      grabbed = await waitForCopiedText();
      // A second keystroke is harmless in an editor but not in a console, and pointless at an elevated window.
      if (!grabbed && !elevated && !isWindowsTerminal(sourceApp)) {
        await syntheticCopy();
        grabbed = await waitForCopiedText();
      }
    } else {
      const front = await frontmostApp();
      if (options.fromApp) {
        // After the Accessibility grant: back to the app the shortcut was pressed in.
        await activateApp(options.fromApp);
      } else if (isSelfApp(front) && lastForeignApp) {
        await activateApp(lastForeignApp);
      } else if (!isSelfApp(front) && front) {
        lastForeignApp = front;
      }

      // Give macOS a beat to commit the cleared pasteboard before asking the editor
      // to write into it. Without this, VS Code can occasionally return the prior item.
      await delay(120);
      await syntheticCopy();
      // System Events answered, so the frontmost watch can run (again) without asking anything.
      startFrontmostWatch();
      grabbed = await waitForCopiedText();
      if (!grabbed) {
        await syntheticCopy();
        grabbed = await waitForCopiedText();
      }
    }
    if (grabbed.trim().length > 0) {
      return { code: grabbed, sourceApp };
    }
    // Nothing arrived from a window the keystroke could never reach: say so, instead of "select code first".
    return { code: null, sourceApp, error: elevated ? 'elevated' : 'empty' };
  } catch (error) {
    return { code: null, sourceApp, error: isMac ? macCaptureFailure(error) : 'failed' };
  }
}
