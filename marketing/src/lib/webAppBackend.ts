const defaultBackend = 'https://api.unvibe.site';

export function webAppBackendUrl(): string {
  const configured = process.env.UNVIBE_APP_BACKEND_URL?.trim() || defaultBackend;
  const url = new URL(configured);
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw new Error('The web app backend must use HTTPS in production.');
  }
  return url.origin;
}
