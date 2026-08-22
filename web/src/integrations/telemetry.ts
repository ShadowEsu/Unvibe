/**
 * Small, dependency-free server integrations for production telemetry.
 *
 * These adapters are intentionally best-effort: analytics or issue tracking must
 * never make a user-facing request fail. They accept event names and sanitized
 * metadata only; never pass code, tokens, billing secrets, or email addresses.
 */

type SafeValue = string | number | boolean | null;
type SafeProperties = Record<string, SafeValue>;

function enabled(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function host(value: string | undefined, fallback: string): string {
  return (value?.trim() || fallback).replace(/\/$/, '');
}

export async function capturePostHog(event: string, properties: SafeProperties = {}): Promise<void> {
  const key = process.env.POSTHOG_API_KEY?.trim();
  if (!enabled(key)) return;
  const distinctId = process.env.POSTHOG_SERVER_DISTINCT_ID?.trim() || 'unvibe-server';
  try {
    await fetch(`${host(process.env.POSTHOG_HOST, 'https://us.i.posthog.com')}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, event, distinct_id: distinctId, properties }),
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    // Observability must never block the product path.
  }
}

function sentryDsnParts(dsn: string): { publicKey: string; host: string; projectId: string } | null {
  try {
    const url = new URL(dsn);
    const projectId = url.pathname.replace(/^\//, '');
    if (!url.username || !projectId) return null;
    return { publicKey: url.username, host: url.host, projectId };
  } catch {
    return null;
  }
}

export async function captureSentryError(error: unknown, context: SafeProperties = {}): Promise<void> {
  const dsn = process.env.SENTRY_DSN?.trim();
  const parts = dsn ? sentryDsnParts(dsn) : null;
  if (!parts) return;
  const exception = error instanceof Error ? error : new Error(String(error));
  try {
    await fetch(`https://${parts.host}/api/${parts.projectId}/store/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${parts.publicKey}` },
      body: JSON.stringify({
        platform: 'node',
        level: 'error',
        message: exception.message,
        exception: { values: [{ type: exception.name, value: exception.message, stacktrace: { frames: [] } }] },
        tags: { service: 'unvibe-api', environment: process.env.APP_ENV || process.env.NODE_ENV || 'development' },
        extra: context,
      }),
      signal: AbortSignal.timeout(3_000),
    });
  } catch {
    // Keep the original failure path deterministic.
  }
}

export async function createLinearIssue(title: string, description: string, labels: string[] = []): Promise<void> {
  const apiKey = process.env.LINEAR_API_KEY?.trim();
  const teamId = process.env.LINEAR_TEAM_ID?.trim();
  if (!apiKey || !teamId || process.env.LINEAR_AUTO_CREATE_ISSUES !== 'true') return;
  try {
    await fetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { Authorization: apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `mutation CreateIssue($input: IssueCreateInput!) { issueCreate(input: $input) { success } }`,
        variables: { input: { teamId, title: title.slice(0, 200), description: description.slice(0, 4_000), labelIds: labels } },
      }),
      signal: AbortSignal.timeout(4_000),
    });
  } catch {
    // Issue creation is deliberately non-blocking.
  }
}

export async function reportServerFailure(error: unknown, context: SafeProperties = {}): Promise<void> {
  await Promise.all([
    captureSentryError(error, context),
    capturePostHog('server_failure', { ...context, error_type: error instanceof Error ? error.name : 'unknown' }),
    createLinearIssue(
      `Unvibe API failure: ${context.route || 'unknown route'}`,
      error instanceof Error ? error.stack || error.message : String(error),
      ['bug'],
    ),
  ]);
}
