/**
 * Launch at login (first-run spec, "not in the three"). Asked once, after the user's first
 * explanation of their own code. A login launch starts quietly in the tray, and it is never a
 * return or a streak day: it opens no window and records nothing. Pure rules; main.ts wires them.
 */

/** Windows hands this to a login launch so it can tell itself apart from a click. */
export const LOGIN_LAUNCH_ARG = '--login-launch';

/**
 * What a finished explanation does about the launch-at-login question:
 * - `ask`: the first explanation of the user's own code while launch at login is off. Shown once.
 * - `settle`: the first own-code explanation finds launch at login already on, so the question
 *   counts as answered and never appears, even if the user turns it off later in Settings.
 * - `none`: the first-run sample, or the question was already asked or settled.
 * `launchAtLogin` is read only when it matters, since it asks the OS.
 */
export function loginPromptStep(state: { ownCode: boolean; asked: boolean; launchAtLogin: () => boolean }): 'ask' | 'settle' | 'none' {
  if (!state.ownCode || state.asked) return 'none';
  return state.launchAtLogin() ? 'settle' : 'ask';
}

/** macOS reports a login launch; Windows sees LOGIN_LAUNCH_ARG from the login item. */
export function isLoginLaunch(platform: NodeJS.Platform, argv: readonly string[], wasOpenedAtLogin: boolean): boolean {
  return platform === 'darwin' ? wasOpenedAtLogin : argv.includes(LOGIN_LAUNCH_ARG);
}

/**
 * Whether a launch opens the companion. A login launch after setup stays in the tray, so the
 * shortcut is ready with no window; before setup is done the companion still opens to finish it.
 */
export function launchOpensWindow(loginLaunch: boolean, onboarded: boolean): boolean {
  return !loginLaunch || !onboarded;
}

/**
 * Read back after turning launch at login on. Returns the one line telling the user where to turn
 * it on by hand when the OS did not take it (possible on Macs without notarization), else null.
 */
export function loginItemFallback(platform: NodeJS.Platform, item: { openAtLogin: boolean; status?: string }): string | null {
  if (platform === 'darwin') {
    return item.openAtLogin && item.status !== 'requires-approval'
      ? null
      : 'Launch at login did not turn on. Turn on Unvibe in System Settings > General > Login Items.';
  }
  return item.openAtLogin ? null : 'Launch at login did not turn on. Turn on Unvibe in Settings > Apps > Startup.';
}
