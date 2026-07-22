/**
 * Guaranteed menu-bar tray image.
 *
 * The tray icon is normally loaded from `dist/assets/trayTemplate.png` (copied from
 * `build/trayTemplate.png` at build time). If that file is ever missing — a broken build,
 * a changed output path, a stripped package — `nativeImage.createFromPath` returns an EMPTY
 * image, and `new Tray(emptyImage)` produces a zero-width, invisible menu-bar item. That was
 * the "Unvibe doesn't show in the menu bar" bug.
 *
 * To make that failure impossible, the real 32×32 template glyph is embedded here as a base64
 * PNG and used as a last-resort fallback so the tray always has a renderable image. This module
 * is pure (no Electron import) so it can be unit-tested under plain `node --test`.
 */

/** The real Unvibe menu-bar glyph (32×32 template PNG), embedded so it can never go missing. */
export const TRAY_FALLBACK_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAABwUlEQVR4nO2WzysFURTHPzPDi7cgefKbIkos3kbyc0GWLz/+Bisrkq2NUkoW/gIbewslGyWKpKzspJQSK9koL290daam3Gu6M+9ZzbduTeeeOec733vmnAspUiRDO9AFOPwzmoAjwJd1JUSs4Vr6VwOrwCvQD/QBnUAReAS2gFoqhInQFy9oyE+F9gvlPJYW4FQC7wDZCIXWxfcO6EmSuArYkGC3QLdljRzLu3tATRwCBxJgNoGcI8AHcGYbIyPJx0iOXolVZ/sXlIA3jV3J6WnsnkHqd4nl2hJwDYkugGWNfQm4NBBzy9UHgoBZw7GpZYI6hrIQ8IEvg11JbQU3BoGSoaKdCAJOHAK+odl8auxF6R0VV+AJGNXYx4Fn2xowISPnPKTZy0uwNSAHNMqzsg0bWrmKVW9LwAcGDfuF0OAJ1pzBt1n2rQg40v/VajX4qFrokEuJetZBqXMCvBh6yp9oAK6F/ablnFcKrsi7D0AbMeEAMyGZ5yMKV/lPh/wXYxa69ouCOX8PDPx2+bmS3YjPdsS9ITZywKEk2ZcJpxLtiu1c6qLiyEthBVKrJjQZJ5CTgIQn/31GpqAikSIFtvgG7VRbbVduoKoAAAAASUVORK5CYII=';

/** Decode the embedded fallback into raw PNG bytes. */
export function trayFallbackBuffer(): Buffer {
  return Buffer.from(TRAY_FALLBACK_PNG_BASE64, 'base64');
}

/** PNG magic number: the first 8 bytes of every valid PNG file. */
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Read the pixel dimensions from a PNG buffer without decoding it. Returns null if the buffer
 * is not a valid PNG (bad signature or missing IHDR). Width/height live in the IHDR chunk, which
 * a spec-compliant PNG places first, at byte offsets 16 (width) and 20 (height), big-endian.
 */
export function pngSize(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 24) return null;
  if (!buf.subarray(0, 8).equals(PNG_SIGNATURE)) return null;
  if (buf.subarray(12, 16).toString('ascii') !== 'IHDR') return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  if (width <= 0 || height <= 0) return null;
  return { width, height };
}

/** True when the buffer is a valid, non-empty PNG the OS can actually render. */
export function isRenderablePng(buf: Buffer): boolean {
  return pngSize(buf) !== null;
}
