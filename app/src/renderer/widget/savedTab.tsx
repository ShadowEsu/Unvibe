import { useEffect, useRef, useState } from 'react';
import type { SavedLesson, SavedRow } from '../../main/panelSaved';
import { linesLabel } from '../../core/linesLabel';
import { renderRich } from '../shared/richText';
import { LEVELS } from './levelChip';
import { CodeRow } from './panelBody';
import { Icon } from './icons';
import { firstSymbol } from './selectionName';

const rowName = (row: { title: string; firstLine?: string }) => firstSymbol(row.firstLine) ?? row.title;
const rowMeta = (row: { lines: number; language?: string; level: string }) =>
  [linesLabel(row.lines), row.language && row.language !== 'plaintext' ? row.language : undefined, LEVELS.find((l) => l.id === row.level)?.label]
    .filter(Boolean).join(' · ');

/**
 * The Saved tab (SPEC; Design ruling a): lessons pinned with Save, then Recent (every finished explanation is saved
 * automatically). Opening one shows its SAVED text from this computer's store: nothing is re-read or re-explained,
 * so no explanation is spent and it opens even when the file is gone. `version` reloads the lists after a Save.
 */
export function SavedTab({ version }: { version: number }) {
  const [lists, setLists] = useState<{ pinned: SavedRow[]; recent: SavedRow[] } | null>(null);
  const [open, setOpen] = useState<SavedLesson | null>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  // Focus follows the view: the lesson's heading when one opens, its row again after Back (opening or closing
  // unmounts the button that had focus).
  const headingRef = useRef<HTMLHeadingElement>(null);
  const returnTo = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    void window.unvibe.savedLessons().then((next) => { if (live) setLists(next); });
    return () => { live = false; };
  }, [version, reload]);

  useEffect(() => {
    if (open) headingRef.current?.focus();
    else if (returnTo.current && lists) {
      listRef.current?.querySelector<HTMLButtonElement>(`[data-lesson="${CSS.escape(returnTo.current)}"]`)?.focus();
      returnTo.current = null;
    }
  }, [open, lists]);

  const show = async (id: string) => {
    setError('');
    const result = await window.unvibe.savedLesson(id);
    if (result.ok) {
      setCodeOpen(false);
      returnTo.current = id;
      setOpen(result.lesson);
    } else setError(result.error);
  };

  // Save or unsave this lesson by its id (the panel's current selection may be another one).
  const togglePin = async (lesson: SavedLesson) => {
    const result = await window.unvibe.pinSaved(lesson.id, !lesson.pinned);
    if (result.ok) {
      setOpen({ ...lesson, pinned: result.pinned === true });
      setReload((n) => n + 1);
    }
  };

  if (open) {
    const name = rowName({ title: linesLabel(open.lines), firstLine: open.code });
    return (
      <section className="ob-saved-lesson" aria-label={name}>
        <button type="button" className="ob-link ob-back" onClick={() => setOpen(null)}>Back</button>
        <h2 className="ob-saved-lesson__title" ref={headingRef} tabIndex={-1}>{name}</h2>
        <p className="ob-meta">{rowMeta(open)}</p>
        {open.code ? <CodeRow id={`saved-code-${open.id}`} code={open.code} open={codeOpen} onToggle={() => setCodeOpen((v) => !v)} /> : null}
        <div className="ob-answer">{renderRich(open.explanation)}</div>
        <div className="ob-chips">
          <button type="button" className={`ob-chip${open.pinned ? ' is-on' : ''}`} aria-pressed={open.pinned} onClick={() => void togglePin(open)}>
            <Icon name="bookmark" size={14} />Save
          </button>
        </div>
      </section>
    );
  }
  if (!lists) return null;
  const empty = lists.pinned.length === 0 && lists.recent.length === 0;
  return (
    <div className="ob-saved" ref={listRef}>
      {error ? <p className="ob-sub" role="alert">{error}</p> : null}
      {empty ? <p className="ob-sub">Nothing saved yet.</p> : null}
      {([['Saved', lists.pinned], ['Recent', lists.recent]] as const).map(([heading, rows]) => rows.length ? (
        <section key={heading} className="ob-saved__group" aria-label={heading}>
          <h2 className="ob-label">{heading}</h2>
          <ul>
            {rows.map((row) => (
              <li key={row.id}>
                <button type="button" className="ob-saved__row" data-lesson={row.id} onClick={() => void show(row.id)}>
                  <span className="ob-saved__name">{rowName(row)}</span>
                  <span className="ob-meta">{rowMeta(row)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null)}
    </div>
  );
}
