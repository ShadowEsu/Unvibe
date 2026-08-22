/** Optional crash reporting for the Electron main process. No code or user content is sent. */
function parts(dsn: string): { key: string; host: string; project: string } | null {
  try {
    const url = new URL(dsn);
    const project = url.pathname.replace(/^\//, '');
    return url.username && project ? { key: url.username, host: url.host, project } : null;
  } catch {
    return null;
  }
}

export function captureDesktopError(error: unknown, context: Record<string, string> = {}): void {
  const parsed = parts(process.env.UNVIBE_SENTRY_DSN?.trim() || '');
  if (!parsed) return;
  const exception = error instanceof Error ? error : new Error(String(error));
  void fetch(`https://${parsed.host}/api/${parsed.project}/store/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parsed.key}` },
    body: JSON.stringify({
      platform: 'electron',
      level: 'fatal',
      message: exception.message,
      exception: { values: [{ type: exception.name, value: exception.message }] },
      tags: { service: 'unvibe-desktop', environment: process.env.APP_ENV || 'development' },
      extra: context,
    }),
    signal: AbortSignal.timeout(3_000),
  }).catch(() => undefined);
}

export function installDesktopCrashReporting(): void {
  process.on('uncaughtException', (error) => captureDesktopError(error, { source: 'uncaughtException' }));
  process.on('unhandledRejection', (reason) => captureDesktopError(reason, { source: 'unhandledRejection' }));
}
