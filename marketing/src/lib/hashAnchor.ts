/**
 * The element id a URL hash points at ("#v0-1-40" → "v0-1-40"), or null for an empty hash or one that is not valid
 * percent-encoding ("#%E0"): decodeURIComponent throws on those, and a crafted link must not break the page.
 */
export function anchorFromHash(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw) || null;
  } catch {
    return null;
  }
}
