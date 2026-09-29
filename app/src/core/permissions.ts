/** Pure security decisions for the desktop agent, kept free of Electron so they can be tested. */

const APP_PAGE = /^file:\/\//i;

/** True only for frames that loaded Unvibe's own local renderer files. */
export function isTrustedSenderUrl(url: string | undefined | null): boolean {
  return typeof url === 'string' && APP_PAGE.test(url);
}

/** Renderer permission decision: clipboard writes, and microphone (audio only) for voice questions. */
export function allowPermission(permission: string, requestingUrl: string, mediaTypes: readonly string[] = []): boolean {
  if (!isTrustedSenderUrl(requestingUrl)) return false;
  if (permission === 'clipboard-sanitized-write') return true;
  if (permission === 'media') return mediaTypes.length > 0 && mediaTypes.every((type) => type === 'audio');
  return false;
}

/** Only HTTPS and mail links may leave the app for the default browser. */
export function isSafeExternalUrl(url: string): boolean {
  return /^https:\/\//i.test(url) || /^mailto:/i.test(url);
}
