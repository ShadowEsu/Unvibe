/**
 * Resolve PostHog config without Electron so release/env wiring stays unit-testable.
 * The project API key is write-only (same class as NEXT_PUBLIC_POSTHOG_KEY on the site).
 */

const BAKED_RELEASE_POSTHOG_KEY = process.env.UNVIBE_RELEASE_POSTHOG_KEY || '';
const BAKED_RELEASE_POSTHOG_HOST = process.env.UNVIBE_RELEASE_POSTHOG_HOST || '';
const DEFAULT_HOST = 'https://us.i.posthog.com';

export type AnalyticsProps = Record<string, string | number | boolean | undefined>;

export const DESKTOP_ANALYTICS_EVENTS = [
  'app_opened',
  'app_active',
  'review_started',
  'review_completed',
  'onboarding_completed',
  'account_signed_in',
] as const;

export type DesktopAnalyticsEvent = (typeof DESKTOP_ANALYTICS_EVENTS)[number];

function usableToken(value: string | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed || trimmed === '[SENSITIVE]' || trimmed.toLowerCase() === 'sensitive') return '';
  return trimmed;
}

export function resolvePosthogKey(
  env: NodeJS.ProcessEnv = process.env,
  baked = BAKED_RELEASE_POSTHOG_KEY,
): string {
  return (
    usableToken(env.UNVIBE_POSTHOG_KEY) ||
    usableToken(env.NEXT_PUBLIC_POSTHOG_KEY) ||
    usableToken(env.POSTHOG_PROJECT_API_KEY) ||
    usableToken(baked)
  );
}

export function resolvePosthogHost(
  env: NodeJS.ProcessEnv = process.env,
  baked = BAKED_RELEASE_POSTHOG_HOST,
): string {
  const raw =
    usableToken(env.UNVIBE_POSTHOG_HOST) ||
    usableToken(env.POSTHOG_HOST) ||
    usableToken(env.NEXT_PUBLIC_POSTHOG_HOST) ||
    usableToken(baked) ||
    DEFAULT_HOST;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return DEFAULT_HOST;
    return url.origin;
  } catch {
    return DEFAULT_HOST;
  }
}

/** Strip undefined and reject anything that looks like code / PII payloads. */
export function sanitizeAnalyticsProps(props?: AnalyticsProps): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  if (!props) return out;
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined) continue;
    if (typeof value === 'string' && value.length > 120) continue;
    if (/^(code|email|token|prompt|explanation|path|fileContents)$/i.test(key)) continue;
    out[key] = value;
  }
  return out;
}
