/**
 * Citation parsing. The model is instructed to wrap every concrete code reference in a marker
 * of the form `[[cite:FILE:START-END]]` (or `[[cite:FILE:LINE]]`). We parse those markers,
 * validate each against the files actually sent (a hallucination guard — a citation to a file
 * that was never in the context is flagged `verified: false`), and turn them into clickable
 * segments. Pure and unit-tested.
 */

export interface Citation {
  file: string;
  startLine: number;
  endLine?: number;
}

export type Segment =
  | { type: 'text'; value: string }
  | { type: 'cite'; file: string; startLine: number; endLine?: number; verified: boolean };

const CITE_RE = /\[\[cite:([^\]:]+):(\d+)(?:-(\d+))?\]\]/g;
const PARTIAL_TAIL = /\[\[cite:[^\]]*$/;

export function basename(path: string): string {
  const norm = path.replace(/\\/g, '/');
  return norm.slice(norm.lastIndexOf('/') + 1);
}

/** All citations found in a completed explanation. */
export function parseCitations(text: string): Citation[] {
  const out: Citation[] = [];
  for (const m of text.matchAll(CITE_RE)) {
    out.push({
      file: m[1],
      startLine: Number(m[2]),
      endLine: m[3] ? Number(m[3]) : undefined,
    });
  }
  return out;
}

/** Split text into renderable segments, marking each citation verified or not. */
export function toSegments(text: string, verify: (file: string) => boolean): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(CITE_RE)) {
    const index = m.index ?? 0;
    if (index > last) {
      segments.push({ type: 'text', value: text.slice(last, index) });
    }
    segments.push({
      type: 'cite',
      file: m[1],
      startLine: Number(m[2]),
      endLine: m[3] ? Number(m[3]) : undefined,
      verified: verify(m[1]),
    });
    last = index + m[0].length;
  }
  if (last < text.length) {
    segments.push({ type: 'text', value: text.slice(last) });
  }
  return segments;
}

/**
 * For live streaming: replace complete markers with a readable `basename:line` and drop a
 * trailing partial marker so half-typed markers never flash on screen.
 */
export function stripMarkersForLive(text: string): string {
  return text
    .replace(CITE_RE, (_full, file: string, start: string) => `${basename(file)}:${start}`)
    .replace(PARTIAL_TAIL, '');
}
