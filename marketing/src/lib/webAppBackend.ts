const defaultBackend = 'https://api.unvibe.site';

export function webAppBackendUrl(): string {
  const configured = process.env.UNVIBE_APP_BACKEND_URL?.trim() || defaultBackend;
  const url = new URL(configured);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('The web app backend must use HTTPS in production.');
  }
  return url.origin;
}

export function webAppSessionCookieOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 };
}

const SERVICE_PROBLEM = 'The explanation service had a problem. Try again in a minute.';

/**
 * A failed answer from the Unvibe service, re-sent from unvibe.site as JSON only (Security X-U32):
 * the service's plain `error` string and status are kept, never its body or content type, so
 * nothing upstream can render as HTML on this origin.
 */
export async function serviceErrorJson(response: Response): Promise<Response> {
  const upstream = (await response.json().catch(() => null)) as { error?: unknown } | null;
  const error = typeof upstream?.error === 'string' && upstream.error.length <= 300 ? upstream.error : SERVICE_PROBLEM;
  const status = response.status >= 400 && response.status <= 599 ? response.status : 502;
  return Response.json({ error }, { status, headers: { 'cache-control': 'no-store' } });
}
