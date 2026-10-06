import { useEffect, useRef, useState } from 'react';

interface AccountMenuProps {
  name: string;
  email?: string;
  planLabel: string;
  signedIn: boolean;
  compact?: boolean;
  version: string;
  onSettings: () => void;
  onShortcuts: () => void;
  onPlan: () => void;
  onInvite: () => void;
  onFeedback: () => void;
  onSignIn: () => void;
  onSignOut: () => Promise<void>;
}

const HELP = 'https://unvibe.site/beta#help';
const CHANGELOG = 'https://unvibe.site/releases';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '')).toUpperCase();
}

function MenuIcon({ d }: { d: string }) {
  return <svg viewBox="0 0 20 20" aria-hidden="true"><path d={d} /></svg>;
}

const ICONS = {
  settings: 'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M10 2.8l1 2.2 2.4-.6 1.2 2-1.7 1.8.8 2.3-2.2 1-.1 2.5H9.6l-.1-2.5-2.2-1 .8-2.3-1.7-1.8 1.2-2 2.4.6z',
  keys: 'M3 6h14v8H3z M6 9h.01 M9 9h.01 M12 9h.01 M7 12h6',
  plan: 'M4 7l6-3 6 3-6 3z M4 11l6 3 6-3 M4 15l6 3 6-3',
  invite: 'M8 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M2.5 17c.6-3 2.8-4.5 5.5-4.5 1.2 0 2.3.3 3.2.9 M15 11v6 M12 14h6',
  help: 'M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15z M7.8 7.6a2.3 2.3 0 0 1 4.4.9c0 1.5-2.2 2-2.2 3.2 M10 14.2h.01',
  news: 'M4 4h12v12H4z M7 8h6 M7 11h6 M7 14h3',
  feedback: 'M4 4h12v9H8l-4 3z',
  signout: 'M8 4H4v12h4 M12 6l4 4-4 4 M16 10H8',
  signin: 'M12 4h4v12h-4 M8 6l-4 4 4 4 M4 10h8',
  external: 'M8 4H4v12h12v-4 M11 3h6v6 M17 3l-8 8',
};

/** Granola-style account popover anchored to the profile button at the bottom of the sidebar. */
export function AccountMenu(props: AccountMenuProps) {
  const { name, email, planLabel, signedIn, compact, version } = props;
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; bottom: number }>({ left: 12, bottom: 64 });
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // The sidebar scrolls, so the menu is fixed to the window and anchored above the trigger.
  const place = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPos({ left: Math.max(8, rect.left), bottom: Math.max(8, window.innerHeight - rect.top + 8) });
  };
  const firstItem = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    requestAnimationFrame(() => firstItem.current?.focus());
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const external = (url: string) => run(() => void window.unvibe.openUrl(url));

  // Arrow keys move through the menu items.
  const onMenuKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>('.acct-menu__item') ?? []);
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
    items[next]?.focus();
  };

  return (
    <div className="acct" ref={rootRef}>
      {open ? (
        <div className="acct-menu" role="menu" aria-label="Account" onKeyDown={onMenuKey} style={{ left: pos.left, bottom: pos.bottom }}>
          <div className="acct-menu__head">
            <span className="acct-avatar acct-avatar--lg" aria-hidden="true">{initials(name)}</span>
            <div className="acct-menu__who">
              <strong>{name}</strong>
              <span>{email || 'Saved on this computer'}</span>
            </div>
            <span className="acct-menu__plan">{planLabel}</span>
          </div>

          <button type="button" className="acct-menu__cta" onClick={run(props.onInvite)}>
            <MenuIcon d={ICONS.invite} />
            Invite a friend, both get Pro
          </button>

          <div className="acct-menu__group">
            <button ref={firstItem} type="button" role="menuitem" className="acct-menu__item" onClick={run(props.onSettings)}>
              <MenuIcon d={ICONS.settings} /><span>Settings</span><kbd>⌘ ,</kbd>
            </button>
            <button type="button" role="menuitem" className="acct-menu__item" onClick={run(props.onShortcuts)}>
              <MenuIcon d={ICONS.keys} /><span>Keyboard shortcuts</span>
            </button>
            <button type="button" role="menuitem" className="acct-menu__item" onClick={run(props.onPlan)}>
              <MenuIcon d={ICONS.plan} /><span>Plan and usage</span>
            </button>
            <button type="button" role="menuitem" className="acct-menu__item" onClick={run(props.onFeedback)}>
              <MenuIcon d={ICONS.feedback} /><span>Send feedback</span>
            </button>
          </div>

          <div className="acct-menu__group">
            <button type="button" role="menuitem" className="acct-menu__item" onClick={external(HELP)}>
              <MenuIcon d={ICONS.help} /><span>Help center</span><MenuIcon d={ICONS.external} />
            </button>
            <button type="button" role="menuitem" className="acct-menu__item" onClick={external(CHANGELOG)}>
              <MenuIcon d={ICONS.news} /><span>What&rsquo;s new</span><MenuIcon d={ICONS.external} />
            </button>
          </div>

          <div className="acct-menu__group">
            {signedIn ? (
              <button type="button" role="menuitem" className="acct-menu__item" onClick={run(() => void props.onSignOut())}>
                <MenuIcon d={ICONS.signout} /><span>Sign out</span>
              </button>
            ) : (
              <button type="button" role="menuitem" className="acct-menu__item" onClick={run(props.onSignIn)}>
                <MenuIcon d={ICONS.signin} /><span>Sign in to sync</span>
              </button>
            )}
          </div>
          <div className="acct-menu__foot">Unvibe {version}</div>
        </div>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        className={`acct-trigger${open ? ' is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        title={compact ? name : undefined}
        onClick={() => { place(); setOpen((value) => !value); }}
      >
        <span className="acct-avatar" aria-hidden="true">{initials(name)}</span>
        <span className="acct-trigger__text nav-label">
          <strong>{name}</strong>
          <small>{planLabel}</small>
        </span>
        <svg className="acct-trigger__chev nav-label" viewBox="0 0 20 20" aria-hidden="true"><path d="M7 8l3-3 3 3 M7 12l3 3 3-3" /></svg>
      </button>
    </div>
  );
}
