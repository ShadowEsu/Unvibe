import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';
import type { ExplanationLevel } from '../../core/protocol';
import { linesLabel } from '../../core/linesLabel';
import { languageName, waitingStatus } from '../shared/shortAnswer';
import { Celebration, CheckMark } from '../shared/motion';

/**
 * The side window's structure (Design S1 "Sheet", ledger 464): the answer first under one quiet meta line, one
 * filled primary (Got it), one outline secondary (Test me), and everything else in one More menu. The look lives
 * in the --sw-* custom properties in widget.css, so the S2 glass and S3 dark skins only change CSS.
 */

export const LEVELS: Array<{ id: ExplanationLevel; label: string }> = [
  { id: 'new', label: 'New' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'expert', label: 'Expert' },
];

/* -------------------------------- meta line ------------------------------- */

/** "useAutosave.ts · 14 lines · TypeScript": the file (or the app it came from), the line count and the language. */
export function metaLine(meta: { file?: string; sourceApp?: string | null; lines?: number; language?: string }): string {
  const file = meta.file?.split(/[\\/]/).pop();
  return [file || meta.sourceApp || undefined, meta.lines ? linesLabel(meta.lines) : undefined, languageName(meta.language)]
    .filter(Boolean)
    .join(' · ');
}

/* ---------------------------------- loading -------------------------------- */

/**
 * The one step line while an explanation is pending, from real events only: the code was captured (ready), the
 * request went out (streaming, nothing on screen yet), then the first words replace it. Null once any answer
 * text is on screen, or when nothing is pending.
 */
export function loadingStep(state: { phase: string; answerShown: boolean; lines?: number; language?: string }): string | null {
  if (state.phase === 'ready') return waitingStatus(state.lines, state.language);
  if (state.phase === 'streaming' && !state.answerShown) return 'Asking Vibe…';
  return null;
}

/* ----------------------------------- menus ---------------------------------- */

export interface MenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  /** Radio items (the level choices) say which one is on. */
  checked?: boolean;
  disabled?: boolean;
  /** A short tag after the label, such as "Pro". */
  tag?: string;
  title?: string;
}

export type MenuMove = { focus: number } | { close: 'escape' | 'tab' } | null;

/** Keys inside an open menu (the WAI-ARIA menu button pattern): arrows wrap, Home and End jump, Esc and Tab close. */
export function menuKey(key: string, index: number, count: number): MenuMove {
  switch (key) {
    case 'ArrowDown': return { focus: (index + 1) % count };
    case 'ArrowUp': return { focus: (index <= 0 ? count : index) - 1 };
    case 'Home': return { focus: 0 };
    case 'End': return { focus: count - 1 };
    case 'Escape': return { close: 'escape' };
    case 'Tab': return { close: 'tab' };
    default: return null;
  }
}

/**
 * An open menu. It grows from --m-scale-press with its transform origin at the trigger: `up` opens above a trigger
 * at its left edge (the action bar), `down-end` below one at its right edge (the level pill).
 */
export function MenuList({ id, label, items, placement, itemRefs, onKeyDown, onPick }: {
  id: string;
  label: string;
  items: MenuItem[];
  placement: 'up' | 'down-end';
  itemRefs?: { current: Array<HTMLButtonElement | null> };
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPick: (item: MenuItem) => void;
}) {
  return (
    <div className={`sw-menu sw-menu--${placement}`} id={id} role="menu" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(el) => { if (itemRefs) itemRefs.current[index] = el; }}
          type="button"
          role={item.checked === undefined ? 'menuitem' : 'menuitemradio'}
          aria-checked={item.checked}
          aria-disabled={item.disabled || undefined}
          tabIndex={-1}
          title={item.title}
          className="sw-menu__item"
          onClick={() => onPick(item)}
        >
          <span>{item.label}</span>
          {item.tag ? <span className="sw-menu__tag">{item.tag}</span> : null}
          {item.checked ? <svg className="sw-menu__on" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2 5 8.6l4.5-5" /></svg> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * A button that opens a menu. Opening focuses the chosen (or first) item; arrows move, Esc closes at once with no
 * exit animation and puts focus back on the button, a click outside or Tab just closes.
 */
export function MenuButton({ className, items, placement, menuLabel, title, disabled = false, children }: {
  className: string;
  items: MenuItem[];
  placement: 'up' | 'down-end';
  menuLabel: string;
  title?: string;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return undefined;
    itemRefs.current[Math.max(0, items.findIndex((item) => item.checked))]?.focus();
    const onOutside = (event: PointerEvent) => { if (!(event.target instanceof Node) || !wrap.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', onOutside);
    return () => document.removeEventListener('pointerdown', onOutside);
    // Focus moves only when the menu opens, not when its items re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onMenuKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = menuKey(event.key, itemRefs.current.findIndex((el) => el === document.activeElement), items.length);
    if (!move) return;
    if ('focus' in move) {
      event.preventDefault();
      itemRefs.current[move.focus]?.focus();
      return;
    }
    setOpen(false);
    if (move.close === 'escape') {
      // Esc closes this menu only, not the panel too.
      event.preventDefault();
      event.stopPropagation();
      trigger.current?.focus();
    }
  };

  return (
    <div className="sw-menu-wrap" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className={className}
        title={title}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open ? (
        <MenuList
          id={id}
          label={menuLabel}
          items={items}
          placement={placement}
          itemRefs={itemRefs}
          onKeyDown={onMenuKey}
          onPick={(item) => {
            if (item.disabled) return;
            setOpen(false);
            trigger.current?.focus();
            item.onSelect();
          }}
        />
      ) : null}
    </div>
  );
}

const chevron = <svg className="sw-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg>;

/* ----------------------------------- tabs ----------------------------------- */

/** The review tabs, only once there are two or more (a new tab comes from More). */
export function TabStrip({ tabs, activeId, onSelect, onClose }: {
  tabs: Array<{ id: string; label: string }>;
  activeId: string;
  onSelect: (id: string) => void;
  onClose: (id: string, event: MouseEvent) => void;
}) {
  if (tabs.length < 2) return null;
  return (
    <div className="tabs" role="group" aria-label="Review tabs">
      {tabs.map((tab) => (
        <div key={tab.id} className={`tab${tab.id === activeId ? ' on' : ''}`}>
          <button type="button" aria-pressed={tab.id === activeId} className="tab__label" onClick={() => onSelect(tab.id)}>
            {tab.label}
          </button>
          <button type="button" className="tab__x" aria-label={`Close ${tab.label}`} title={`Close ${tab.label}`} onClick={(event) => onClose(tab.id, event)}>
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3 3 9" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------- level ---------------------------------- */

/** The one place the explanation level lives: a pill in the meta row that opens the five levels. */
export function LevelPill({ level, locked, disabled, onPick }: {
  level: ExplanationLevel;
  /** Levels the plan does not include (Expert without Pro): shown with a Pro tag and not choosable. */
  locked: (id: ExplanationLevel) => boolean;
  disabled: boolean;
  onPick: (id: ExplanationLevel) => void;
}) {
  const current = LEVELS.find((l) => l.id === level)?.label ?? level;
  const items: MenuItem[] = LEVELS.map((l) => {
    const isLocked = locked(l.id);
    return {
      id: l.id,
      label: l.label,
      checked: l.id === level,
      disabled: isLocked,
      tag: isLocked ? 'Pro' : undefined,
      title: isLocked ? 'Expert explanations are included with Unvibe Pro' : `Explain at ${l.label} level`,
      onSelect: () => onPick(l.id),
    };
  });
  return (
    <MenuButton className="sw-pill" items={items} placement="down-end" menuLabel="Explanation level" disabled={disabled}>
      Level: {current}
      {chevron}
    </MenuButton>
  );
}

/* ---------------------------------- actions --------------------------------- */

/**
 * What More holds: the actions that used to repeat across the header, the tool rail and the footer, once each.
 * Explain differently, Why and Teach wait for a finished answer; the rest work at any time.
 */
export function moreMenuItems(opts: {
  features: { whyExists: boolean; teachBack: boolean };
  answerReady: boolean;
  teachOpen: boolean;
  panelTheme: 'dark' | 'light';
  on: { explainDifferently: () => void; why: () => void; teach: () => void; newTab: () => void; saved: () => void; theme: () => void };
}): MenuItem[] {
  const waiting = !opts.answerReady;
  const items: MenuItem[] = [{ id: 'different', label: 'Explain differently', disabled: waiting, onSelect: opts.on.explainDifferently }];
  if (opts.features.whyExists) items.push({ id: 'why', label: 'Why this exists', disabled: waiting, onSelect: opts.on.why });
  if (opts.features.teachBack) items.push({ id: 'teach', label: opts.teachOpen ? 'Hide Teach it back' : 'Teach it back', disabled: waiting, onSelect: opts.on.teach });
  items.push(
    { id: 'newTab', label: 'New tab', onSelect: opts.on.newTab },
    { id: 'saved', label: 'Saved explanations', onSelect: opts.on.saved },
    { id: 'theme', label: opts.panelTheme === 'dark' ? 'Light panel' : 'Dark panel', onSelect: opts.on.theme },
  );
  return items;
}

/**
 * The action bar: one filled primary (Got it, which turns into a mint "Understood" with its check), one outline
 * secondary (Test me) and More. A Got it celebration plays inside the primary button only.
 */
export function ActionBar({ answerReady, understood, streaming, celebration, reduced, moreItems, weekCount, onGotIt, onTestMe, onStop, onCelebrationEnd }: {
  /** The answer is all on screen, so it can be marked understood or tested. */
  answerReady: boolean;
  understood: boolean;
  streaming: boolean;
  /** The running Got it celebration, or null. */
  celebration: number | null;
  reduced: boolean;
  moreItems: MenuItem[];
  weekCount?: ReactNode;
  onGotIt: () => void;
  onTestMe: () => void;
  onStop: () => void;
  onCelebrationEnd: () => void;
}) {
  return (
    <div className="sw-actions">
      <span className="celebrate-host">
        <button
          type="button"
          className={`sw-btn sw-btn--primary${understood ? ' sw-btn--understood' : ''}`}
          disabled={!answerReady}
          aria-disabled={understood || undefined}
          onClick={() => { if (!understood) onGotIt(); }}
        >
          {understood ? <><CheckMark pop={celebration !== null && !reduced} />Understood</> : 'Got it'}
        </button>
        <Celebration run={celebration} reduced={reduced} onEnd={onCelebrationEnd} />
      </span>
      <button type="button" className="sw-btn sw-btn--secondary" disabled={!answerReady} onClick={onTestMe}>Test me</button>
      <MenuButton className="sw-btn sw-btn--quiet" items={moreItems} placement="up" menuLabel="More actions">
        More
        {chevron}
      </MenuButton>
      {streaming ? <button type="button" className="sw-btn sw-btn--quiet" onClick={onStop}>Stop</button> : null}
      {weekCount ? <span className="sw-week">{weekCount}</span> : null}
    </div>
  );
}
