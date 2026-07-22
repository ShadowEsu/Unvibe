/**
 * Persisted app settings (main process). Separate file from the learning store so wiping
 * learning data never touches preferences. Applies OS-level side effects (login item).
 */
import { app } from 'electron';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { DEFAULT_LOCAL_AI_PROVIDER, normalizeLocalAiProvider, type LocalAiProviderId } from './localAi';
import type { ExplanationLevel } from '../core/protocol';

export type BarPosition = 'top-center' | 'bottom-center' | 'top-right' | 'bottom-right';
export type BarVisibility = 'always' | 'during-review';
export type InactiveBehavior = 'dim' | 'stay' | 'collapse';
export type ThemePreference = 'system' | 'light' | 'dark';

/** Bump when a release should re-show onboarding for existing installs. */
const SETTINGS_REVISION = 5;

export interface Settings {
  /** Internal — when lower than SETTINGS_REVISION, onboarded is reset once. */
  settingsRevision?: number;
  onboarded: boolean;
  /** Electron accelerator. Default is ⌘U. */
  shortcut: string;
  barPosition: BarPosition;
  /** Keep the learning strip available between reviews, or only show it during a review. */
  barVisibility: BarVisibility;
  /** Expand the learning strip into a small recent-learning preview on hover. */
  barHoverPreview: boolean;
  /** Follow the display under the pointer when positioning the learning strip. */
  followActiveDisplay: boolean;
  /** Locally synthesized UI cues. Never records or plays remote audio. */
  soundEffects: boolean;
  /** Opacity of an unfocused, unpinned widget (0.35–1). */
  widgetOpacityInactive: number;
  inactiveBehavior: InactiveBehavior;
  launchAtLogin: boolean;
  theme: ThemePreference;
  /** Starting depth for new explanations. Users can still change it in every review. */
  defaultExplanationLevel: ExplanationLevel;
  notifications: boolean;
  quietHours: { enabled: boolean; start: string; end: string }; // "HH:MM"
  /** When true, ⌘U and the "Explain Clipboard" menu action do nothing until unpaused. */
  paused: boolean;
  /** Glance completion: show "Explanation ready" as a quiet dot instead of auto-expanding. */
  glanceMode: boolean;
  /** Milestone chimes (first explanation, streaks) — mutable without muting all sounds. */
  soundMilestones: boolean;
  /** Suppress island sounds while the Mac screen is locked. */
  quietWhileLocked: boolean;
  lastWidgetBounds?: { x: number; y: number; width: number; height: number };
  /** Prefer the user's own local API key instead of Unvibe cloud AI. */
  useOwnAi: boolean;
  /** Provider for local BYOK calls (cheap default model per provider). */
  aiProvider: LocalAiProviderId;
  /** @deprecated Legacy field — migrated into aiProvider. */
  aiModel?: string;
  /** Last folder used for git-diff / nearby-file Pro features. */
  lastProjectRoot?: string;
}

const DEFAULTS: Settings = {
  settingsRevision: SETTINGS_REVISION,
  onboarded: false,
  shortcut: 'CommandOrControl+U',
  barPosition: 'top-center',
  barVisibility: 'always',
  barHoverPreview: true,
  followActiveDisplay: true,
  soundEffects: true,
  widgetOpacityInactive: 0.72,
  inactiveBehavior: 'dim',
  launchAtLogin: false,
  theme: 'system',
  defaultExplanationLevel: 'intermediate',
  notifications: true,
  quietHours: { enabled: false, start: '22:00', end: '08:00' },
  paused: false,
  glanceMode: true,
  soundMilestones: true,
  quietWhileLocked: true,
  useOwnAi: false,
  aiProvider: DEFAULT_LOCAL_AI_PROVIDER,
};

class SettingsStore {
  private data: Settings;
  private file: string;
  /** True once after a SETTINGS_REVISION bump so setup can be refreshed without deleting learning. */
  private freshStart = false;

  constructor() {
    this.file = path.join(app.getPath('userData'), 'unvibe-settings.json');
    let loaded: Partial<Settings> = {};
    try {
      loaded = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Settings>;
    } catch {
      /* first run */
    }
    const needsOnboardingReset = (loaded.settingsRevision ?? 0) < SETTINGS_REVISION;
    this.freshStart = needsOnboardingReset;
    const aiProvider = normalizeLocalAiProvider(
      loaded.aiProvider ?? loaded.aiModel ?? DEFAULT_LOCAL_AI_PROVIDER,
    );
    this.data = {
      ...DEFAULTS,
      ...loaded,
      quietHours: { ...DEFAULTS.quietHours, ...loaded.quietHours },
      aiProvider,
      settingsRevision: SETTINGS_REVISION,
      ...(needsOnboardingReset
        ? {
            onboarded: false,
            // Fresh panel size for the new onboarding cohort.
            lastWidgetBounds: undefined,
          }
        : {}),
    };
    if (needsOnboardingReset) delete this.data.lastWidgetBounds;
    delete this.data.aiModel;
    if (needsOnboardingReset || loaded.aiProvider !== aiProvider || loaded.aiModel) this.persist();
  }

  all(): Settings {
    return this.data;
  }

  /** Consume the one-shot migration flag. Learning/account data must remain untouched. */
  takeFreshStart(): boolean {
    const v = this.freshStart;
    this.freshStart = false;
    return v;
  }

  private persist(): void {
    try {
      mkdirSync(path.dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(this.data), { mode: 0o600 });
    } catch {
      /* best-effort */
    }
  }

  set(patch: Partial<Settings>): Settings {
    const nextProvider = patch.aiProvider !== undefined
      ? normalizeLocalAiProvider(patch.aiProvider)
      : patch.aiModel !== undefined
        ? normalizeLocalAiProvider(patch.aiModel)
        : undefined;
    this.data = {
      ...this.data,
      ...patch,
      quietHours: { ...this.data.quietHours, ...patch.quietHours },
      ...(nextProvider ? { aiProvider: nextProvider } : {}),
    };
    delete this.data.aiModel;
    this.persist();
    if (patch.launchAtLogin !== undefined && process.platform === 'darwin') {
      app.setLoginItemSettings({ openAtLogin: this.data.launchAtLogin });
    }
    return this.data;
  }

  /** True when notifications should be suppressed right now (quiet hours). */
  inQuietHours(now = new Date()): boolean {
    const q = this.data.quietHours;
    if (!q.enabled) return false;
    const cur = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = q.start.split(':').map(Number);
    const [eh, em] = q.end.split(':').map(Number);
    const s = sh * 60 + sm;
    const e = eh * 60 + em;
    return s <= e ? cur >= s && cur < e : cur >= s || cur < e; // handles overnight ranges
  }
}

let singleton: SettingsStore | null = null;
export function settings(): SettingsStore {
  if (!singleton) singleton = new SettingsStore();
  return singleton;
}
