/**
 * Whether the sign-in form says "Finish in your browser" or "Your browser did not open" for its current link.
 * Main returns the code first and opens the browser alongside; it reports only a failure, for the link it tried.
 * That failure can arrive before the code (the browser can fail at once) or long after it, and a Retry makes a new
 * link, so every event names its link and only the current link's events count.
 */
export type DeviceBrowserState = { url: string; failedUrl: string; openedUrl: string };

export type DeviceBrowserEvent =
  /** The code and its link arrived (startDeviceAuth replied). */
  | { type: 'code'; url: string }
  /** Main could not open the browser for this link. */
  | { type: 'failed'; url: string }
  /** The person pressed Open browser and it opened this link. */
  | { type: 'opened'; url: string };

export const DEVICE_BROWSER_START: DeviceBrowserState = { url: '', failedUrl: '', openedUrl: '' };

export function deviceBrowserReducer(state: DeviceBrowserState, event: DeviceBrowserEvent): DeviceBrowserState {
  switch (event.type) {
    case 'code': return { ...state, url: event.url };
    case 'failed': return { ...state, failedUrl: event.url };
    case 'opened': return { ...state, openedUrl: event.url };
  }
}

/** A failure for the current link counts, unless the person has since opened that link by hand. */
export function browserOpenedFor(state: DeviceBrowserState): boolean {
  return !(state.failedUrl === state.url && state.openedUrl !== state.url);
}
