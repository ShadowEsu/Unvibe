/*
 * Unvibe's selection helper for Windows (D5, the Unvibe button).
 *
 * It watches the mouse only, through a low-level mouse hook (WH_MOUSE_LL); there is no keyboard hook (Security G3).
 * The hook callback only posts the event to a worker thread and returns at once, so Windows never drops the hook
 * for being slow (LowLevelHooksTimeout). It reads no text from any app. One JSON object per line goes to stdout for
 * Unvibe's main process; nothing goes to a file, a socket or stderr (Security H1, H2). It exits when Unvibe closes
 * its stdin.
 *
 * Events (app/src/core/bubble.ts parseHelperLine is the contract):
 *   {"e":"ready","v":1}
 *   {"e":"select","x":..,"y":..,"app":"<exe name>","g":"drag|double|triple"}   a mouse selection ended over text
 *   {"e":"down"|"right"|"scroll","x":..,"y":..}                                 so the button can leave
 *   {"e":"app","app":"<exe name>"}                                              another app came to the front
 * Points are physical screen pixels (the process is per-monitor DPI aware); main converts them to DIPs.
 */
#undef _WIN32_WINNT
#undef WINVER
#define _WIN32_WINNT 0x0A00 /* Windows 10, Electron's own minimum: GetDpiForSystem */
#define WINVER 0x0A00
#define WIN32_LEAN_AND_MEAN
#define UNICODE
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define MSG_MOUSE (WM_APP + 1)
#define MSG_FRONT (WM_APP + 2)

static DWORD g_worker;
static HANDLE g_queue_ready;

static LPARAM pack_point(POINT pt) {
  return (LPARAM)(((ULONGLONG)(ULONG)pt.y << 32) | (ULONGLONG)(ULONG)pt.x);
}

static POINT unpack_point(LPARAM l) {
  POINT pt;
  pt.x = (LONG)(ULONG)((ULONGLONG)l & 0xffffffffULL);
  pt.y = (LONG)(ULONG)((ULONGLONG)l >> 32);
  return pt;
}

static LRESULT CALLBACK on_mouse(int code, WPARAM wParam, LPARAM lParam) {
  if (code == HC_ACTION) {
    const MSLLHOOKSTRUCT *m = (const MSLLHOOKSTRUCT *)lParam;
    switch (wParam) {
      case WM_LBUTTONDOWN:
      case WM_LBUTTONUP:
      case WM_RBUTTONDOWN:
      case WM_MOUSEWHEEL:
      case WM_MOUSEHWHEEL:
        PostThreadMessageW(g_worker, MSG_MOUSE, wParam, pack_point(m->pt));
        break;
      default:
        break;
    }
  }
  return CallNextHookEx(NULL, code, wParam, lParam);
}

static void CALLBACK on_front(HWINEVENTHOOK hook, DWORD event, HWND hwnd, LONG obj, LONG child, DWORD thread, DWORD time) {
  (void)hook; (void)event; (void)obj; (void)child; (void)thread; (void)time;
  PostThreadMessageW(g_worker, MSG_FRONT, 0, (LPARAM)hwnd);
}

/* The foreground window's exe file name ("Code.exe"), JSON-escaped into out. Empty when Windows won't say
 * (an elevated window, for one). */
static void exe_of(HWND hwnd, char *out, size_t cap) {
  out[0] = '\0';
  DWORD pid = 0;
  if (!hwnd || !GetWindowThreadProcessId(hwnd, &pid) || !pid) return;
  HANDLE proc = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid);
  if (!proc) return;
  WCHAR path[MAX_PATH * 2];
  DWORD len = (DWORD)(sizeof path / sizeof path[0]);
  BOOL ok = QueryFullProcessImageNameW(proc, 0, path, &len);
  CloseHandle(proc);
  if (!ok) return;
  const WCHAR *name = path;
  for (const WCHAR *p = path; *p; p++) if (*p == L'\\' || *p == L'/') name = p + 1;
  char utf8[MAX_PATH * 3];
  int n = WideCharToMultiByte(CP_UTF8, 0, name, -1, utf8, (int)sizeof utf8, NULL, NULL);
  if (n <= 0) return;
  size_t o = 0;
  for (const unsigned char *s = (const unsigned char *)utf8; *s && o + 7 < cap; s++) {
    if (*s == '"' || *s == '\\') { out[o++] = '\\'; out[o++] = (char)*s; }
    else if (*s < 0x20) { o += (size_t)snprintf(out + o, cap - o, "\\u%04x", *s); }
    else out[o++] = (char)*s;
  }
  out[o] = '\0';
}

/* The pointer is the text I-beam (Chromium, Monaco and Java editors use the system one): the press started in text,
 * not on a tab, a scrollbar or a sidebar. When Windows can't say, it counts as text. */
static BOOL pointer_is_beam(void) {
  CURSORINFO ci;
  ci.cbSize = sizeof ci;
  if (!GetCursorInfo(&ci) || !ci.hCursor) return TRUE;
  return ci.hCursor == LoadCursorW(NULL, IDC_IBEAM);
}

static void emit_point(const char *e, POINT pt) {
  printf("{\"e\":\"%s\",\"x\":%ld,\"y\":%ld}\n", e, (long)pt.x, (long)pt.y);
  fflush(stdout);
}

static DWORD WINAPI worker(LPVOID arg) {
  (void)arg;
  MSG msg;
  POINT down = {0, 0};
  BOOL have_down = FALSE, down_over_text = FALSE;
  POINT last_click = {0, 0};
  DWORD last_click_at = 0;
  int clicks = 0;
  DWORD last_scroll = 0;
  char app[MAX_PATH * 6];
  PeekMessageW(&msg, NULL, WM_USER, WM_USER, PM_NOREMOVE); /* make the queue before anyone posts */
  SetEvent(g_queue_ready);
  while (GetMessageW(&msg, NULL, 0, 0) > 0) {
    if (msg.message == MSG_FRONT) {
      exe_of((HWND)msg.lParam, app, sizeof app);
      if (app[0]) { printf("{\"e\":\"app\",\"app\":\"%s\"}\n", app); fflush(stdout); }
      continue;
    }
    if (msg.message != MSG_MOUSE) continue;
    POINT pt = unpack_point(msg.lParam);
    switch (msg.wParam) {
      case WM_LBUTTONDOWN: {
        const DWORD now = msg.time;
        const int cx = GetSystemMetrics(SM_CXDOUBLECLK) / 2, cy = GetSystemMetrics(SM_CYDOUBLECLK) / 2;
        const BOOL near_last = labs(pt.x - last_click.x) <= cx && labs(pt.y - last_click.y) <= cy;
        clicks = (clicks > 0 && near_last && now - last_click_at <= GetDoubleClickTime()) ? clicks + 1 : 1;
        last_click = pt;
        last_click_at = now;
        down = pt;
        have_down = TRUE;
        down_over_text = pointer_is_beam();
        emit_point("down", pt);
        break;
      }
      case WM_LBUTTONUP: {
        if (!have_down) break;
        have_down = FALSE;
        const LONG dx = pt.x - down.x, dy = pt.y - down.y;
        const UINT dpi = GetDpiForSystem();
        const LONG slop = (LONG)(4 * (dpi ? dpi : 96) / 96);
        const char *g = NULL;
        if (dx * dx + dy * dy > slop * slop) g = "drag";
        else if (clicks == 2) g = "double";
        else if (clicks >= 3) g = "triple";
        if (!g || !down_over_text) break;
        /* A drag that went up, or left along one line, ends where it started: the selection's end is there. */
        const BOOL upward = dy < -slop || (labs(dy) <= slop && dx < 0);
        const POINT end = (g[0] == 'd' && g[1] == 'r' && upward) ? down : pt;
        exe_of(GetForegroundWindow(), app, sizeof app);
        if (!app[0]) break;
        printf("{\"e\":\"select\",\"x\":%ld,\"y\":%ld,\"app\":\"%s\",\"g\":\"%s\"}\n", (long)end.x, (long)end.y, app, g);
        fflush(stdout);
        break;
      }
      case WM_RBUTTONDOWN:
        emit_point("right", pt);
        break;
      case WM_MOUSEWHEEL:
      case WM_MOUSEHWHEEL: {
        if (msg.time - last_scroll < 250) break;
        last_scroll = msg.time;
        emit_point("scroll", pt);
        break;
      }
      default:
        break;
    }
  }
  return 0;
}

/* Unvibe closing our stdin (or quitting) ends the helper. */
static DWORD WINAPI watch_stdin(LPVOID arg) {
  (void)arg;
  HANDLE in = GetStdHandle(STD_INPUT_HANDLE);
  char buf[256];
  DWORD got = 0;
  while (in && in != INVALID_HANDLE_VALUE && ReadFile(in, buf, sizeof buf, &got, NULL) && got > 0) {}
  ExitProcess(0);
  return 0;
}

int main(void) {
  /* Physical pixels on every monitor, so the points match Electron's screenToDipPoint. */
  typedef BOOL(WINAPI * SetCtx)(HANDLE);
  SetCtx set_ctx = (SetCtx)(void *)GetProcAddress(GetModuleHandleW(L"user32.dll"), "SetProcessDpiAwarenessContext");
  if (!set_ctx || !set_ctx((HANDLE)-4 /* DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 */)) SetProcessDPIAware();

  g_queue_ready = CreateEventW(NULL, TRUE, FALSE, NULL);
  HANDLE w = CreateThread(NULL, 0, worker, NULL, 0, &g_worker);
  if (!w || !g_queue_ready) return 1;
  WaitForSingleObject(g_queue_ready, 2000);
  CreateThread(NULL, 0, watch_stdin, NULL, 0, NULL);

  HHOOK hook = SetWindowsHookExW(WH_MOUSE_LL, on_mouse, GetModuleHandleW(NULL), 0);
  if (!hook) return 2;
  HWINEVENTHOOK front = SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, NULL, on_front, 0, 0, WINEVENT_OUTOFCONTEXT);
  printf("{\"e\":\"ready\",\"v\":1}\n");
  fflush(stdout);

  MSG msg;
  while (GetMessageW(&msg, NULL, 0, 0) > 0) {
    TranslateMessage(&msg);
    DispatchMessageW(&msg);
  }
  if (front) UnhookWinEvent(front);
  UnhookWindowsHookEx(hook);
  return 0;
}
