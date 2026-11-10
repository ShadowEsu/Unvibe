/**
 * The counted download links' names, for pages and components (no server code here, so it is safe in the
 * browser bundle). /download/<file> counts the click and redirects: src/lib/downloadCounter.ts.
 */
export const DOWNLOAD_FILE_NAMES = ["mac", "mac-intel", "windows"] as const;

export type DownloadFile = (typeof DOWNLOAD_FILE_NAMES)[number];

/** Address path for a file's counted link, e.g. "/download/mac". */
export function downloadPath(file: DownloadFile): string {
  return `/download/${file}`;
}
