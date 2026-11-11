/** Resolve the backend host without importing Electron so release configuration stays testable. */
const BAKED_RELEASE_BACKEND = process.env.UNVIBE_RELEASE_BACKEND || '';

export function resolveBackendUrl(
  env: NodeJS.ProcessEnv = process.env,
  baked = BAKED_RELEASE_BACKEND,
  packaged = false,
): string {
  const bakedUrl = baked?.trim();
  // A packaged app talks only to the backend it was built for. Every request carries its trial token or the
  // user's sign-in token, so an environment variable or a .env file must not send them to another host (Security 5o).
  if (packaged) return bakedUrl || 'http://localhost:8787';
  const explicit = env.UNVIBE_BACKEND?.trim();
  if (explicit) {
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/?$/i.test(explicit);
    if (!(bakedUrl && isLocal)) return explicit;
  }
  return bakedUrl || 'http://localhost:8787';
}
