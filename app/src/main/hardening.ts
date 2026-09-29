/**
 * Process-wide hardening for the desktop agent. Call installHardening() once, before any
 * window is created or IPC handler is registered.
 *
 * - IPC is accepted only from Unvibe's own bundled pages (file://), never from a remote frame.
 * - Renderer permissions are denied except clipboard writes and microphone for voice questions.
 * - <webview> can never be attached; crashed renderers reload a bounded number of times.
 * - Unexpected errors are logged instead of silently killing the menu-bar agent.
 */
import { app, ipcMain, session, type IpcMainEvent, type IpcMainInvokeEvent, type WebContents } from 'electron';
import { allowPermission, isTrustedSenderUrl } from '../core/permissions';

function senderUrl(event: IpcMainEvent | IpcMainInvokeEvent): string {
  return event.senderFrame?.url ?? '';
}

function guardIpc(): void {
  const handle = ipcMain.handle.bind(ipcMain);
  ipcMain.handle = ((channel: string, listener: (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown) =>
    handle(channel, (event, ...args) => {
      if (!isTrustedSenderUrl(senderUrl(event))) {
        console.warn(`[security] blocked ${channel} from an untrusted frame`);
        throw new Error('Blocked request from an untrusted page.');
      }
      return listener(event, ...args);
    })) as typeof ipcMain.handle;

  const on = ipcMain.on.bind(ipcMain);
  ipcMain.on = ((channel: string, listener: (event: IpcMainEvent, ...args: unknown[]) => void) =>
    on(channel, (event, ...args) => {
      if (!isTrustedSenderUrl(senderUrl(event))) {
        console.warn(`[security] ignored ${channel} from an untrusted frame`);
        return;
      }
      listener(event, ...args);
    })) as typeof ipcMain.on;
}

const MAX_RELOADS_PER_MINUTE = 3;
const reloads = new WeakMap<WebContents, number[]>();

function recoverRenderer(contents: WebContents, reason: string): void {
  if (contents.isDestroyed() || reason === 'clean-exit') return;
  const now = Date.now();
  const recent = (reloads.get(contents) ?? []).filter((at) => now - at < 60_000);
  if (recent.length >= MAX_RELOADS_PER_MINUTE) {
    console.error(`[app] renderer keeps crashing (${reason}); leaving it closed`);
    return;
  }
  recent.push(now);
  reloads.set(contents, recent);
  console.warn(`[app] renderer ${reason}; reloading`);
  setTimeout(() => {
    if (!contents.isDestroyed()) contents.reload();
  }, 400);
}

function describe(reason: unknown): string {
  return reason instanceof Error ? `${reason.name}: ${reason.message}` : String(reason);
}

export function installHardening(): void {
  guardIpc();

  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
    contents.on('render-process-gone', (_e, details) => recoverRenderer(contents, details.reason));
    contents.on('unresponsive', () => console.warn('[app] a window stopped responding'));
  });

  void app.whenReady().then(() => {
    const ses = session.defaultSession;
    ses.setPermissionRequestHandler((contents, permission, callback, details) => {
      const media = (details as { mediaTypes?: string[] }).mediaTypes ?? [];
      callback(allowPermission(permission, details.requestingUrl ?? contents.getURL(), media));
    });
    ses.setPermissionCheckHandler((_contents, permission, requestingOrigin) =>
      permission === 'clipboard-sanitized-write' || permission === 'media'
        ? isTrustedSenderUrl(requestingOrigin)
        : false,
    );
  });

  process.on('unhandledRejection', (reason) => console.error('[app] unhandled rejection', describe(reason)));
  process.on('uncaughtException', (error) => console.error('[app] uncaught exception', describe(error)));
}
