/**
 * The panel's Saved tab (overlay B; Design ruling a): lessons pinned with Save, then Recent (every finished
 * explanation is saved automatically). Opening one shows the SAVED lesson text from this computer's store: it never
 * re-reads the file or runs a review, so no explanation is spent and it works when the file is gone. Pure, so the
 * main process passes the store in and the tests pass plain records.
 */
import { computeLearningItems, type LocalEvent } from '../core/learning';

export interface SavedRow {
  id: string;
  ts: string;
  /** The Library's title for the lesson ("debounce.js", "7 lines of javascript"). */
  title: string;
  /** The first non-empty line of the saved code, so the panel can name the lesson by its first symbol. */
  firstLine?: string;
  lines: number;
  language?: string;
  level: string;
}

export interface SavedLists {
  pinned: SavedRow[];
  recent: SavedRow[];
}

export interface SavedLesson {
  id: string;
  ts: string;
  code: string;
  explanation: string;
  lines: number;
  language?: string;
  level: string;
  file?: string;
  pinned: boolean;
}

const firstLineOf = (code?: string): string | undefined => code?.split('\n').find((line) => line.trim())?.trim().slice(0, 160);

/** Pinned lessons in pin order, then up to `recentLimit` other lessons, newest first. Lessons without text are left out. */
export function savedLessons(events: LocalEvent[], pinnedIds: string[], recentLimit = 8): SavedLists {
  const withText = events.filter((event) => Boolean(event.explanation?.trim()));
  const items = computeLearningItems(withText, withText.length || 1);
  const byId = new Map(items.map((item) => [item.id, item]));
  const codeOf = new Map(withText.map((event) => [event.id, event.code]));
  const row = (id: string): SavedRow | null => {
    const item = byId.get(id);
    if (!item) return null;
    return { id, ts: item.ts, title: item.title, firstLine: firstLineOf(codeOf.get(id)), lines: item.lines, language: item.language, level: item.level };
  };
  const pinned = pinnedIds.map(row).filter((r): r is SavedRow => r !== null);
  const pinnedSet = new Set(pinned.map((r) => r.id));
  const recent = items.filter((item) => !pinnedSet.has(item.id)).slice(0, recentLimit).map((item) => row(item.id)!);
  return { pinned, recent };
}

/** The saved lesson as it is stored, or an error. Reads only the store: no file, no request, no explanation spent. */
export function openSavedLesson(lookup: (id: string) => LocalEvent | undefined, pinnedIds: string[], id: unknown): { ok: true; lesson: SavedLesson } | { ok: false; error: string } {
  const event = typeof id === 'string' && id ? lookup(id) : undefined;
  const explanation = event?.explanation?.trim();
  if (!event || !explanation) return { ok: false, error: 'That lesson is no longer on this Mac.' };
  return {
    ok: true,
    lesson: {
      id: event.id,
      ts: event.ts,
      code: event.code ?? '',
      explanation,
      lines: event.lines,
      language: event.language,
      level: event.level,
      file: event.file,
      pinned: pinnedIds.includes(event.id),
    },
  };
}
