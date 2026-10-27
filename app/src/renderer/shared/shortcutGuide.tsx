/** What turning on the Mac shortcut needs from the preload API. */
export interface GrantApi {
  accessibility(): Promise<{ granted?: boolean } | null>;
  promptAccessibility(): Promise<unknown>;
  openAccessibility(): Promise<unknown>;
}

/** How often an open guide checks for the Accessibility grant. */
export const GRANT_CHECK_MS = 2000;

/** Turn on the shortcut: macOS shows its prompt, then System Settings opens at Accessibility. */
export async function turnOnShortcut(api: Pick<GrantApi, 'promptAccessibility' | 'openAccessibility'>): Promise<void> {
  await api.promptAccessibility();
  await api.openAccessibility();
}

/**
 * Checks for the Accessibility grant every 2 s until it arrives, then calls `onGranted` once. Only an
 * open guide watches: the returned stop ends the checks when it closes.
 */
export function watchGrant(api: Pick<GrantApi, 'accessibility'>, onGranted: () => void, every = GRANT_CHECK_MS): () => void {
  let watching = true;
  const timer = setInterval(() => {
    void api.accessibility().then((result) => {
      if (!watching || result?.granted !== true) return;
      stop();
      onGranted();
    });
  }, every);
  function stop(): void {
    watching = false;
    clearInterval(timer);
  }
  return stop;
}

/**
 * The 3-step guide shown while System Settings is open, in setup's step 4 and in the review panel.
 * The stale-entry help is open from the start. `illustration` adds a drawing of the Accessibility
 * list (drawn here, never a macOS screenshot).
 */
export function ShortcutGuide({ buttonClass, illustration = false }: { buttonClass: string; illustration?: boolean }) {
  return (
    <div className={`shortcut-guide${illustration ? ' shortcut-guide--wide' : ''}`}>
      <div className="shortcut-guide__main">
        <ol className="shortcut-guide__steps">
          <li className="is-done"><span>System Settings opened at <b>Privacy &amp; Security, Accessibility</b>.</span></li>
          <li><span>Find <b>Unvibe</b> in the list and switch it on. macOS may ask for your password.</span></li>
          <li><span>Come back here. This screen updates by itself.</span></li>
        </ol>
        <p className="shortcut-guide__wait"><span className="shortcut-pill shortcut-pill--busy" role="status"><i aria-hidden="true" />Waiting for the switch</span></p>
        <details className="shortcut-guide__fix" open>
          <summary>Switched it on and nothing changed?</summary>
          <p>macOS may still hold an old Unvibe entry. Press Fix it, switch Unvibe on again, then restart Unvibe.</p>
          <div className="shortcut-guide__acts">
            <button type="button" className={buttonClass} onClick={() => void window.unvibe.resetAccessibility().then(() => window.unvibe.openAccessibility())}>Fix it</button>
            <button type="button" className={buttonClass} onClick={() => void window.unvibe.restartApp()}>Restart Unvibe</button>
          </div>
        </details>
      </div>
      {illustration ? <AccessibilityDrawing /> : null}
    </div>
  );
}

/** A drawing of the Accessibility list with the Unvibe row picked out. Other apps are blank rows. */
function AccessibilityDrawing() {
  return (
    <figure className="shortcut-art">
      <div className="shortcut-art__window" role="img" aria-label="Drawing of the Accessibility list, with Unvibe highlighted and its switch off">
        <div className="shortcut-art__bar"><i /><i /><i /><span>Accessibility</span></div>
        <div className="shortcut-art__row"><span className="shortcut-art__icon" /><span className="shortcut-art__name" /><span className="shortcut-art__switch is-on" /></div>
        <div className="shortcut-art__row is-you">
          <svg className="shortcut-art__vibe" width="22" height="22" viewBox="0 0 22 22">
            <path d="M3 18V10a8 8 0 0 1 16 0v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="#b8a6ff" stroke="#141414" strokeWidth="1.6" />
            <circle cx="8.5" cy="11" r="1.6" fill="#141414" />
            <circle cx="13.5" cy="11" r="1.6" fill="#141414" />
          </svg>
          <span>Unvibe</span>
          <span className="shortcut-art__switch" />
        </div>
        <div className="shortcut-art__row"><span className="shortcut-art__icon" /><span className="shortcut-art__name shortcut-art__name--short" /><span className="shortcut-art__switch" /></div>
      </div>
      <figcaption>Illustration. Your list will look different.</figcaption>
    </figure>
  );
}
