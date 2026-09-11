/**
 * Desktop usage analytics (main process only).
 * Metadata only — never code, emails, prompts, or explanations.
 * Renderers stay offline; this module owns the PostHog HTTPS capture.
 */
import { app } from 'electron';
import {
  resolvePosthogHost,
  resolvePosthogKey,
  sanitizeAnalyticsProps,
  type AnalyticsProps,
  type DesktopAnalyticsEvent,
} from './analyticsConfig';
import { settings } from './settings';
import { store } from './store';
import { localDayKey } from '../core/learning';

const CAPTURE_TIMEOUT_MS = 2500;

let lastActiveDay = '';

function analyticsAllowed(): boolean {
  if (!resolvePosthogKey()) return false;
  return settings().all().shareUsageAnalytics !== false;
}

function baseProps(): Record<string, string | number | boolean> {
  const account = store().account();
  return {
    source: 'desktop',
    app_version: app.getVersion(),
    platform: process.platform,
    arch: process.arch,
    signed_in: Boolean(account?.userId),
    onboarded: Boolean(settings().all().onboarded),
  };
}

export async function track(
  event: DesktopAnalyticsEvent,
  props?: AnalyticsProps,
): Promise<void> {
  if (!analyticsAllowed()) return;
  const apiKey = resolvePosthogKey();
  const host = resolvePosthogHost();
  const distinctId = store().installId();
  const properties = {
    ...baseProps(),
    ...sanitizeAnalyticsProps(props),
  };

  try {
    const response = await fetch(`${host}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId.slice(0, 80) || 'desktop',
        properties,
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(CAPTURE_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.error('desktop analytics capture rejected', response.status);
    }
  } catch (error) {
    console.error('desktop analytics capture failed', error);
  }
}

/** Fire once per local calendar day so PostHog can count true daily active installs. */
export function trackAppActive(now = new Date()): void {
  const day = localDayKey(now);
  if (day === lastActiveDay) return;
  lastActiveDay = day;
  void track('app_active', { local_day: day });
}

export function trackAppOpened(): void {
  trackAppActive();
  void track('app_opened');
}

/** Test helper — resets the once-per-day gate. */
export function resetAnalyticsDayGateForTests(): void {
  lastActiveDay = '';
}
