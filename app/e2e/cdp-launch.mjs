// Starts the installed Unvibe app and drives its windows through Chromium's debug port.
//
// Release builds (0.1.45+) turn off Electron's Node inspector fuse, so Playwright's
// `_electron.launch` (which starts the app with --inspect) can no longer attach. The renderer debug
// port still works: every BrowserWindow shows up as a page of one Chromium context. What this route
// cannot do is run code in the main process (`app.evaluate`); callers check main-process behaviour
// through the app's own IPC, its files on disk, or the operating system instead.
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {{ exe: string, userData: string, args?: string[], env?: NodeJS.ProcessEnv, timeout?: number }} options
 * The app writes its debug port to <userData>/DevToolsActivePort (port 0 = any free port), so
 * userData must be the folder the app really uses (UNVIBE_USER_DATA is set from it).
 */
export async function launchApp({ exe, userData, args = [], env = process.env, timeout = 90000 }) {
  const portFile = path.join(userData, 'DevToolsActivePort');
  rmSync(portFile, { force: true }); // a port left by an earlier run of this profile is not ours
  const appEnv = { ...env, UNVIBE_USER_DATA: userData };
  delete appEnv.ELECTRON_RUN_AS_NODE;
  delete appEnv.NODE_OPTIONS;
  const child = spawn(exe, [...args, '--remote-debugging-port=0'], {
    env: appEnv,
    // Its own process group on macOS, so close() stops every helper process with it.
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = [];
  child.stdout.on('data', (d) => output.push(String(d)));
  child.stderr.on('data', (d) => output.push(String(d)));
  let exited = null;
  child.on('exit', (code, signal) => { exited = { code, signal }; });
  // A script that throws must not leave the app (and its debug port) running.
  process.on('exit', () => { if (!exited) stop(child); });

  const start = Date.now();
  let browser = null;
  while (!browser && Date.now() - start < timeout) {
    if (exited) throw new Error(`the app exited before its debug port opened (${JSON.stringify(exited)})`);
    const port = existsSync(portFile) ? Number(readFileSync(portFile, 'utf8').split('\n')[0]) : 0;
    if (port) browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`).catch(() => null);
    if (!browser) await sleep(300);
  }
  if (!browser) {
    stop(child);
    throw new Error(`no debug port after ${timeout} ms`);
  }
  const context = browser.contexts()[0];

  return {
    browser,
    context,
    process: child,
    output,
    /** Every open app window (companion, panel, island, …) as a Playwright page. */
    windows: () => context.pages(),
    onWindow: (fn) => { context.pages().forEach(fn); context.on('page', fn); },
    async windowWith(part, wait = 30000) {
      const t = Date.now();
      while (Date.now() - t < wait) {
        const hit = context.pages().find((w) => w.url().includes(part) && !w.isClosed());
        if (hit) return hit;
        await sleep(250);
      }
      return null;
    },
    async close() {
      await browser.close().catch(() => {});
      stop(child);
      const t = Date.now();
      while (!exited && Date.now() - t < 10000) await sleep(200);
    },
  };
}

function stop(child) {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-child.pid, 'SIGTERM');
  } catch { /* already gone */ }
}

/** The app's store file: the install id and setup flags live here (main process state, on disk). */
export function readStore(userData) {
  const file = path.join(userData, 'unvibe-store.json');
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
}
