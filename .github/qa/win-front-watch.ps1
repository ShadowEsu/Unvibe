# Runs in the background during a Windows first launch and logs what a person would see (lead, 0.1.52 RC row):
#   shell   the taskbar's own events for every top-level window (RegisterShellHookWindow): created, activated,
#           FLASH (the button turns orange: Windows refused a window's bid for the front), redraw
#   front   every change of the foreground window: process, title, class
#   unvibe  every change of each Unvibe top-level window: visible, minimized, cloaked (DWM), on-screen rect
# Usage: win-front-watch.ps1 -Out <dir> [-Seconds 90]   Writes <Out>\front-watch.log (one line per event, ms from start).
# Reads only window state; sends no input and changes no window.
param([string]$Out, [int]$Seconds = 90)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @"
using System; using System.Diagnostics; using System.IO; using System.Text; using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class FrontWatch {
  delegate IntPtr WndProcFn(IntPtr h, uint m, IntPtr w, IntPtr l);
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct WNDCLASSEX { public uint cbSize, style; public WndProcFn lpfnWndProc; public int cbClsExtra, cbWndExtra;
    public IntPtr hInstance, hIcon, hCursor, hbrBackground; public string lpszMenuName, lpszClassName; public IntPtr hIconSm; }
  [StructLayout(LayoutKind.Sequential)] struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam, lParam; public uint time; public int x, y; }
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  delegate bool EnumFn(IntPtr h, IntPtr p);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern ushort RegisterClassEx(ref WNDCLASSEX c);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr CreateWindowEx(uint ex, string cls, string name, uint style, int x, int y, int w, int h, IntPtr parent, IntPtr menu, IntPtr inst, IntPtr p);
  [DllImport("user32.dll")] static extern IntPtr DefWindowProc(IntPtr h, uint m, IntPtr w, IntPtr l);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern uint RegisterWindowMessage(string s);
  [DllImport("user32.dll")] static extern bool RegisterShellHookWindow(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr SetTimer(IntPtr h, IntPtr id, uint ms, IntPtr fn);
  [DllImport("user32.dll")] static extern int GetMessage(out MSG m, IntPtr h, uint min, uint max);
  [DllImport("user32.dll")] static extern bool TranslateMessage(ref MSG m);
  [DllImport("user32.dll")] static extern IntPtr DispatchMessage(ref MSG m);
  [DllImport("user32.dll")] static extern void PostQuitMessage(int code);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern IntPtr GetWindow(IntPtr h, uint cmd);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int index);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumFn fn, IntPtr p);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int attr, out int v, int size);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr GetModuleHandle(string name);

  static WndProcFn proc; static EnumFn enumFn; static StreamWriter log; static Stopwatch clock; static uint shellMsg;
  static long deadlineMs; static string lastFront = ""; static Dictionary<IntPtr, string> lastWin = new Dictionary<IntPtr, string>();
  static List<IntPtr> found;
  static HashSet<uint> unvibePids = new HashSet<uint>();

  static void Line(string kind, string text) {
    log.WriteLine(string.Format("{0,8} {1} {2,-6} {3}", clock.ElapsedMilliseconds, DateTime.UtcNow.ToString("HH:mm:ss.fff"), kind, text));
  }
  public static string Describe(IntPtr h) {
    if (h == IntPtr.Zero) return "(none)";
    uint pid; GetWindowThreadProcessId(h, out pid);
    string pname = "?"; try { pname = Process.GetProcessById((int)pid).ProcessName; } catch (Exception) { }
    StringBuilder t = new StringBuilder(256); GetWindowText(h, t, 256);
    StringBuilder c = new StringBuilder(128); GetClassName(h, c, 128);
    return string.Format("{0}#{1} '{2}' [{3}] 0x{4:X}", pname, pid, t, c, h.ToInt64());
  }
  static string State(IntPtr h) {
    int cloaked = 0; DwmGetWindowAttribute(h, 14, out cloaked, 4); // DWMWA_CLOAKED
    RECT r; GetWindowRect(h, out r);
    StringBuilder t = new StringBuilder(256); GetWindowText(h, t, 256);
    bool owned = GetWindow(h, 4) != IntPtr.Zero; // GW_OWNER: owned windows get no taskbar button of their own
    bool tool = (GetWindowLong(h, -20) & 0x80) != 0; // GWL_EXSTYLE has WS_EX_TOOLWINDOW: no taskbar button either
    return string.Format("'{0}' visible={1} minimized={2} cloaked={3} owned={4} tool={5} rect={6},{7} {8}x{9} front={10}",
      t, IsWindowVisible(h), IsIconic(h), cloaked, owned, tool, r.L, r.T, r.R - r.L, r.B - r.T, GetForegroundWindow() == h);
  }
  static void Poll() {
    string f = Describe(GetForegroundWindow());
    if (f != lastFront) { Line("front", f); lastFront = f; }
    unvibePids.Clear();
    foreach (Process p in Process.GetProcessesByName("Unvibe")) unvibePids.Add((uint)p.Id);
    found = new List<IntPtr>();
    EnumWindows(enumFn, IntPtr.Zero);
    foreach (IntPtr h in found) {
      if (!IsWindowVisible(h) && !lastWin.ContainsKey(h)) continue; // hidden helper windows until they first show
      string s = State(h); string old;
      if (!lastWin.TryGetValue(h, out old) || old != s) { Line("unvibe", string.Format("0x{0:X} {1}", h.ToInt64(), s)); lastWin[h] = s; }
    }
  }
  static bool OnWindow(IntPtr h, IntPtr p) { uint pid; GetWindowThreadProcessId(h, out pid); if (unvibePids.Contains(pid)) found.Add(h); return true; }
  static string ShellName(int code) {
    switch (code) {
      case 1: return "WINDOWCREATED"; case 2: return "WINDOWDESTROYED"; case 4: return "WINDOWACTIVATED";
      case 6: return "REDRAW"; case 0x8004: return "RUDEAPPACTIVATED"; case 0x8006: return "FLASH";
      case 13: return "WINDOWREPLACED"; case 16: return "MONITORCHANGED"; default: return "code " + code;
    }
  }
  static IntPtr OnMessage(IntPtr h, uint m, IntPtr w, IntPtr l) {
    if (m == shellMsg && shellMsg != 0) { Line("shell", ShellName(w.ToInt32()) + " " + Describe(l)); return IntPtr.Zero; }
    if (m == 0x0113) { // WM_TIMER
      Poll();
      if (clock.ElapsedMilliseconds > deadlineMs) { Line("end", "watch over"); PostQuitMessage(0); }
      return IntPtr.Zero;
    }
    return DefWindowProc(h, m, w, l);
  }
  public static void Run(string path, int seconds) {
    // Shared for reading and writing: win-row.ps1 reads it while this still runs.
    log = new StreamWriter(new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.ReadWrite), new UTF8Encoding(false)); log.AutoFlush = true;
    clock = Stopwatch.StartNew(); deadlineMs = seconds * 1000L;
    proc = OnMessage; enumFn = OnWindow; // kept in static fields so the GC never collects the callbacks
    WNDCLASSEX wc = new WNDCLASSEX(); wc.cbSize = (uint)Marshal.SizeOf(typeof(WNDCLASSEX)); wc.lpfnWndProc = proc;
    wc.hInstance = GetModuleHandle(null); wc.lpszClassName = "UnvibeQaFrontWatch";
    if (RegisterClassEx(ref wc) == 0) throw new Exception("RegisterClassEx failed " + Marshal.GetLastWin32Error());
    // A hidden top-level window (never shown, no taskbar button): RegisterShellHookWindow needs a top-level window.
    IntPtr hw = CreateWindowEx(0x80, "UnvibeQaFrontWatch", "Unvibe QA front watch", 0, 0, 0, 0, 0, IntPtr.Zero, IntPtr.Zero, wc.hInstance, IntPtr.Zero); // WS_EX_TOOLWINDOW
    if (hw == IntPtr.Zero) throw new Exception("CreateWindowEx failed " + Marshal.GetLastWin32Error());
    shellMsg = RegisterWindowMessage("SHELLHOOK");
    Line("start", string.Format("shell hook registered={0} (message {1}); polling every 200 ms for {2} s", RegisterShellHookWindow(hw), shellMsg, seconds));
    Poll();
    SetTimer(hw, new IntPtr(1), 200, IntPtr.Zero);
    MSG msg;
    while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) { TranslateMessage(ref msg); DispatchMessage(ref msg); }
    log.Close();
  }
}
"@
New-Item -ItemType Directory -Force $Out | Out-Null
[FrontWatch]::Run((Join-Path $Out 'front-watch.log'), $Seconds)
