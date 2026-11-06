import { useEffect, useId, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

/**
 * The 0.1.51 panel header's `⋯` menu and the review tabs (design row 552, SPEC §4): what the header, the tool
 * rail and the status pill used to show, once each, behind one button. Menu and tabs come from the side-window
 * branch (cf41d37e); the menu rules are Design's Q12 (APP-0151-ANSWERS.md).
 */

export interface MenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  /** Choice items say which one is on: one of several (radio) or a toggle on its own (checkbox). */
  checked?: boolean;
  toggle?: boolean;
  disabled?: boolean;
  /** A line that only tells something (the status, what's left): not dimmed, does nothing. */
  info?: boolean;
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
 * Where focus goes when a menu opens: a choice menu's chosen item, otherwise the first (or, opened with ArrowUp,
 * the last) item that does something.
 */
export function openFocus(items: MenuItem[], from: 'first' | 'last' = 'first'): number {
  if (items.every((item) => item.checked !== undefined && !item.toggle)) return items.findIndex((item) => item.checked);
  const live = (item: MenuItem) => !item.info && !item.disabled;
  if (from === 'first') return items.findIndex(live);
  for (let i = items.length - 1; i >= 0; i--) if (live(items[i])) return i;
  return -1;
}

/** An open menu below its button, aligned to the button's right edge. */
export function MenuList({ id, label, items, itemRefs, onKeyDown, onPick }: {
  id: string;
  label: string;
  items: MenuItem[];
  itemRefs?: { current: Array<HTMLButtonElement | null> };
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPick: (item: MenuItem) => void;
}) {
  return (
    <div className="pm-menu" id={id} role="menu" aria-label={label} onKeyDown={onKeyDown}>
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={(el) => { if (itemRefs) itemRefs.current[index] = el; }}
          type="button"
          role={item.checked === undefined ? 'menuitem' : item.toggle ? 'menuitemcheckbox' : 'menuitemradio'}
          aria-checked={item.checked}
          aria-disabled={item.disabled || item.info || undefined}
          tabIndex={-1}
          title={item.title}
          className={`pm-menu__item${item.info ? ' pm-menu__item--info' : ''}`}
          onClick={() => onPick(item)}
        >
          <span>{item.label}</span>
          {item.tag ? <span className="pm-menu__tag">{item.tag}</span> : null}
          {item.checked ? <svg className="pm-menu__on" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2 5 8.6l4.5-5" /></svg> : null}
        </button>
      ))}
    </div>
  );
}

/**
 * A button that opens a menu. Opening focuses the chosen (or first) item; arrows move, Esc closes and puts focus
 * back on the button, a click outside or Tab just closes.
 */
export function MenuButton({ className, items, menuLabel, ariaLabel, title, children }: {
  className: string;
  items: MenuItem[];
  menuLabel: string;
  ariaLabel?: string;
  title?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  // ArrowUp on the button opens the menu at its end (WAI-ARIA menu button pattern).
  const openFrom = useRef<'first' | 'last'>('first');

  useEffect(() => {
    if (!open) return undefined;
    itemRefs.current[Math.max(0, openFocus(items, openFrom.current))]?.focus();
    openFrom.current = 'first';
    const close = () => setOpen(false);
    const onOutside = (event: PointerEvent) => { if (!(event.target instanceof Node) || !wrap.current?.contains(event.target)) close(); };
    document.addEventListener('pointerdown', onOutside);
    // The header is a drag region, where no pointerdown arrives; leaving the window closes the menu too.
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('pointerdown', onOutside);
      window.removeEventListener('blur', close);
    };
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
    <div className="pm-wrap" ref={wrap}>
      <button
        ref={trigger}
        type="button"
        className={className}
        title={title}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
          event.preventDefault();
          openFrom.current = event.key === 'ArrowUp' ? 'last' : 'first';
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
          itemRefs={itemRefs}
          onKeyDown={onMenuKey}
          onPick={(item) => {
            if (item.disabled || item.info) return;
            setOpen(false);
            trigger.current?.focus();
            item.onSelect();
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * What the panel's `⋯` holds, in the inventory's order. Tools that need a finished answer wait for one. The menu
 * shows only while the panel is open; a collapsed panel's header has its own Expand button.
 */
export function panelMenuItems(state: {
  status: string;
  answerReady: boolean;
  features: { whyExists?: boolean; teachBack?: boolean };
  teachOpen: boolean;
  dark: boolean;
  usage?: { remaining: number; resetsOn: string };
}, act: {
  explain: () => void; depth: () => void; testMe: () => void; ask: () => void; why: () => void; teach: () => void;
  newTab: () => void; saved: () => void; theme: () => void; collapse: () => void;
}): MenuItem[] {
  const items: MenuItem[] = [
    { id: 'status', label: state.status, info: true, onSelect: () => undefined },
    { id: 'explain', label: 'Explain', onSelect: act.explain },
    { id: 'depth', label: 'Depth', onSelect: act.depth },
    { id: 'test', label: 'Test me', disabled: !state.answerReady, onSelect: act.testMe },
    { id: 'ask', label: 'Ask a follow-up', onSelect: act.ask },
  ];
  if (state.features.whyExists) items.push({ id: 'why', label: 'Why does this exist?', disabled: !state.answerReady, onSelect: act.why });
  if (state.features.teachBack) items.push({ id: 'teach', label: 'Teach it back', checked: state.teachOpen, toggle: true, disabled: !state.answerReady, onSelect: act.teach });
  items.push(
    { id: 'tab', label: 'New review tab', onSelect: act.newTab },
    { id: 'saved', label: 'Saved explanations', onSelect: act.saved },
    { id: 'theme', label: state.dark ? 'Light panel' : 'Dark panel', onSelect: act.theme },
    { id: 'collapse', label: 'Collapse panel', onSelect: act.collapse },
  );
  if (state.usage) items.push({ id: 'left', label: `${state.usage.remaining} left`, info: true, title: `Resets ${state.usage.resetsOn}`, onSelect: () => undefined });
  return items;
}

/** The review tabs, only once there are two or more (a new tab comes from `⋯`). */
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
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ))}
    </div>
  );
}
