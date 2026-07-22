/** Resolve the backend host without importing Electron so release configuration stays testable. */
const BAKED_RELEASE_BACKEND = process.env.UNVIBE_RELEASE_BACKEND || '';

export function resolveBackendUrl(
  env: NodeJS.ProcessEnv = process.env,
  baked = BAKED_RELEASE_BACKEND,
): string {
  const explicit = env.UNVIBE_BACKEND?.trim();
  const bakedUrl = baked?.trim();
  if (explicit) {
    const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?\/?$/i.test(explicit);
    if (!(bakedUrl && isLocal)) return explicit;
  }
  return bakedUrl || 'http://localhost:8787';
}
