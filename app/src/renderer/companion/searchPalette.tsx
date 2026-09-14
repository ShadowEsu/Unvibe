import { useEffect, useRef } from 'react';

export interface SearchPaletteItem {
  id: string;
  title: string;
  detail: string;
  run: () => void;
}

export interface SearchPaletteGroup {
  label: string;
  items: SearchPaletteItem[];
}

/** A local-only command palette. Lesson content never leaves the renderer. */
export function SearchPalette({ groups, query, onQuery, onClose }: {
  groups: SearchPaletteGroup[];
  query: string;
  onQuery: (value: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const move = (direction: 1 | -1) => {
    const rows = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>('.search-palette__row') ?? []);
    if (rows.length === 0) return;
    const current = rows.indexOf(document.activeElement as HTMLButtonElement);
    const next = current < 0
      ? direction === 1 ? 0 : rows.length - 1
      : (current + direction + rows.length) % rows.length;
    rows[next]?.focus();
  };

  return (
    <div className="search-overlay" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        ref={dialogRef}
        className="search-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Search Unvibe"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          } else if (event.key === 'ArrowDown') {
            event.preventDefault();
            move(1);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            move(-1);
          } else if (event.key === 'Enter' && event.target === inputRef.current) {
            event.preventDefault();
            dialogRef.current?.querySelector<HTMLButtonElement>('.search-palette__row')?.click();
          } else if (event.key === 'Tab') {
            const controls = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('input, button') ?? []);
            const first = controls[0];
            const last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="search-palette__head">
          <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5" /><path d="m12.5 12.5 4 4" /></svg>
          <input
            ref={inputRef}
            type="search"
            aria-label="Search lessons and pages"
            placeholder="Search lessons, concepts, or pages"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
          <button type="button" onClick={onClose} aria-label="Close search">Esc</button>
        </div>
        <div className="search-palette__body">
          {groups.length === 0 ? (
            <p className="search-palette__empty" role="status">No matches. Try a lesson title, concept, or page.</p>
          ) : groups.map((group) => (
            <section key={group.label} aria-label={group.label}>
              <h2>{group.label}</h2>
              {group.items.map((item) => (
                <button key={item.id} type="button" className="search-palette__row" onClick={item.run}>
                  <span>{item.title}</span>
                  <small>{item.detail}</small>
                </button>
              ))}
            </section>
          ))}
        </div>
        <div className="search-palette__foot">↑ ↓ move · Enter open · Esc close</div>
      </div>
    </div>
  );
}
