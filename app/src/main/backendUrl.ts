/** Resolve the backend host without importing Electron so release configuration stays testable. */
const BAKED_RELEASE_BACKEND = process.env.UNVIBE_RELEASE_BACKEND || '';

/**
 * `packaged` has no default on purpose: a caller that forgets it must not fall back to the development rule.
 * A packaged app talks only to the backend it was built for. Every request carries its trial token or the user's
 * sign-in token, so an environment variable or a .env file must not send them to another host (Security 5o).
 * A development build takes UNVIBE_BACKEND when it is set (local mocks, staging).
 */
export function resolveBackendUrl(
  packaged: boolean,
  env: NodeJS.ProcessEnv = process.env,
  baked = BAKED_RELEASE_BACKEND,
): string {
  const bakedUrl = baked?.trim();
  const fallback = bakedUrl || 'http://localhost:8787';
  if (packaged) return fallback;
  return env.UNVIBE_BACKEND?.trim() || fallback;
}
