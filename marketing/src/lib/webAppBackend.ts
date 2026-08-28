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
