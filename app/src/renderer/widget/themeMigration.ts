/**
 * Design ruling c: the panel's own moon toggle is gone; the panel follows Settings › Theme. Someone who had turned
 * the panel dark with the moon (localStorage, per device) and never chose a Theme gets Theme: Dark once; the old key
 * is then removed either way.
 */
export const PANEL_THEME_KEY = 'unvibe.panelTheme2';

export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * `stored`: the old key's value (null when absent). Theme counts as never set when Settings has no record of a choice
 * and still holds the default, light.
 */
export function panelThemeMigration(stored: string | null, settings: { theme?: ThemePreference; themeChosen?: boolean }): { setTheme: 'dark' | null; dropKey: boolean } {
  const neverSet = !settings.themeChosen && (settings.theme ?? 'light') === 'light';
  return { setTheme: stored === 'dark' && neverSet ? 'dark' : null, dropKey: stored !== null };
}
