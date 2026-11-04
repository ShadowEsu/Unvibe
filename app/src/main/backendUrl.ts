/** Resolve the backend host without importing Electron so release configuration stays testable. */
const BAKED_RELEASE_BACKEND = process.env.UNVIBE_RELEASE_BACKEND || '';

/**
 * The one override a release build accepts besides its own URL: the motion checks' mock on a CI runner
 * (app/e2e/motion-mock.mjs). `.test` never resolves in public DNS; only the runner's /etc/hosts maps it.
 * Honoured over https only, and only with UNVIBE_CI_MOCK=1 (Security 20261104-0637).
 */
export const CI_MOCK_HOST = 'unvibe-mock.test';

function ciMockOrigin(value: string, env: NodeJS.ProcessEnv): string | null {
  if (env.UNVIBE_CI_MOCK !== '1') return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  const bare = !url.username && !url.password && (url.pathname === '/' || url.pathname === '') && !url.search && !url.hash;
  return url.protocol === 'https:' && url.hostname === CI_MOCK_HOST && bare ? url.origin : null;
}

/**
 * Development builds (nothing baked) use UNVIBE_BACKEND as given, or the local web app. A release build
 * sends the person's code and its tokens only to its own baked service: UNVIBE_BACKEND is ignored unless it
 * names that same service or the CI mock above (Security 20261104-0637: a remote http override would have
 * received code, questions and tokens in cleartext).
 */
export function resolveBackendUrl(
  env: NodeJS.ProcessEnv = process.env,
  baked = BAKED_RELEASE_BACKEND,
): string {
  const explicit = env.UNVIBE_BACKEND?.trim();
  const bakedUrl = baked?.trim();
  if (!bakedUrl) return explicit || 'http://localhost:8787';
  if (!explicit) return bakedUrl;
  return ciMockOrigin(explicit, env) ?? bakedUrl;
}
