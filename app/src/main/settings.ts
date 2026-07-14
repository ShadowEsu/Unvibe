/**
 * Persisted app settings (main process). Separate file from the learning store so wiping
 * learning data never touches preferences. Applies OS-level side effects (login item).
 */
import { app } from 'electron';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

export type BarPosition = 'top-center' | 'bottom-center' | 'top-right' | 'bottom-right';
export type InactiveBehavior = 'dim' | 'stay' | 'collapse';
export type ThemePreference = 'system' | 'light' | 'dark';

export interface Settings {
  onboarded: boolean;
  /** Electron accelerator. Default is ⌘U. */
  shortcut: string;
  barPosition: BarPosition;
  /** Opacity of an unfocused, unpinned widget (0.35–1). */
  widgetOpacityInactive: number;
  inactiveBehavior: InactiveBehavior;
  launchAtLogin: boolean;
  theme: ThemePreference;
  notifications: boolean;
  quietHours: { enabled: boolean; start: string; end: string }; // "HH:MM"
  lastWidgetBounds?: { x: number; y: number; width: number; height: number };
}

const DEFAULTS: Settings = {
  onboarded: false,
  shortcut: 'CommandOrControl+U',
  barPosition: 'bottom-center',
  widgetOpacityInactive: 0.72,
  inactiveBehavior: 'dim',
  launchAtLogin: false,
  theme: 'system',
  notifications: true,
  quietHours: { enabled: false, start: '22:00', end: '08:00' },
};

class SettingsStore {
  private data: Settings;
  private file: string;

  constructor() {
    this.file = path.join(app.getPath('userData'), 'unvibe-settings.json');
    let loaded: Partial<Settings> = {};
    try {
      loaded = JSON.parse(readFileSync(this.file, 'utf8')) as Partial<Settings>;
    } catch {
      /* first run */
    }
    this.data = { ...DEFAULTS, ...loaded, quietHours: { ...DEFAULTS.quietHours, ...loaded.quietHours } };
  }

  all(): Settings {
    return this.data;
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
    this.data = { ...this.data, ...patch, quietHours: { ...this.data.quietHours, ...patch.quietHours } };
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
