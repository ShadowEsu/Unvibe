import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import type { GhostView } from '../../main/bubble';
import { Buddy } from '../shared/buddy';
import { prettyShortcut, shortcutCaps } from '../shared/prettyShortcut';
import { renderInline } from '../shared/richText';
import '../shared/tokens.css';

type ThemePreference = 'light' | 'dark' | 'system';

function applyTheme(preference: ThemePreference) {
  const dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}

/** Hover opens the pill after 150 ms (Design NOTE §1); hover alone never presses (Security G7). */
const HOVER_DELAY_MS = 150;

function Keycaps({ shortcut }: { shortcut: string }) {
  return (
    <span className="ghost__keys" aria-hidden="true">
      {shortcutCaps(shortcut).map((cap, i) => <kbd key={i} className="ghost__key">{cap}</kbd>)}
    </span>
  );
}

function Button({ view }: { view: GhostView }) {
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const label = `Explain this selection (${prettyShortcut(view.shortcut)})`;
  const enter = () => {
    hoverTimer.current = setTimeout(() => window.unvibe.ghostHover(true), HOVER_DELAY_MS);
  };
  const leave = () => {
    clearTimeout(hoverTimer.current ?? undefined);
    window.unvibe.ghostHover(false);
  };
  useEffect(() => () => clearTimeout(hoverTimer.current ?? undefined), []);
  return (
    <button
      type="button"
      className={`ghost${view.look === 'pill' ? ' ghost--pill' : ''}${view.flipped ? ' ghost--flipped' : ''}`}
      aria-label={label}
      title={label}
      onMouseEnter={enter}
      onMouseLeave={leave}
      onClick={() => window.unvibe.ghostPress()}
    >
      <Buddy mood="idle" size={19} label="" />
      {view.look === 'pill' ? (
        <>
          <span className="ghost__word">Explain</span>
          <Keycaps shortcut={view.shortcut} />
        </>
      ) : null}
    </button>
  );
}

/**
 * Quick look (D5 T3): 3 bullets as plain text with code spans only, never HTML or links (Security A7); the full
 * explanation is one click away. The card reports its height so main fits the window to it.
 */
function QuickLook({ view }: { view: GhostView }) {
  const box = useRef<HTMLDivElement>(null);
  const p = view.preview;
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const report = () => window.unvibe.ghostHeight(Math.ceil(el.getBoundingClientRect().height));
    const observer = new ResizeObserver(report);
    observer.observe(el);
    report();
    return () => observer.disconnect();
  }, []);
  const working = !p || p.phase === 'reading' || p.phase === 'streaming';
  const bullets = p?.bullets ?? [];
  const skeletons = working ? (bullets.length === 0 ? 2 : 1) : 0;
  return (
    <div ref={box} className="quick" role="dialog" aria-label="Quick look">
      <div className="quick__head">
        <Buddy mood={working ? 'thinking' : 'idle'} size={20} label="" />
        <span className="quick__title">{working ? 'Explaining…' : 'Quick look'}</span>
        {p?.title ? <span className="quick__meta">· {p.title}</span> : null}
      </div>
      {p?.phase === 'error' ? (
        <p className="quick__message" role="status">{p.message}</p>
      ) : (
        <ul className="quick__list" aria-live="polite" aria-busy={working}>
          {bullets.map((bullet, i) => <li key={i} className="quick__item">{renderInline(bullet)}</li>)}
          {Array.from({ length: skeletons }, (_, i) => <li key={`s${i}`} className="quick__item quick__item--skeleton" aria-hidden="true" />)}
        </ul>
      )}
      <div className="quick__foot">
        <button type="button" className="quick__full" onClick={() => window.unvibe.ghostOpenFull()}>
          Open full explanation <Keycaps shortcut={view.shortcut} />
        </button>
        <button type="button" className="quick__dismiss" onClick={() => window.unvibe.ghostClose()}>Not now</button>
      </div>
    </div>
  );
}

function App() {
  const [view, setView] = useState<GhostView>({ look: 'hidden', flipped: false, shortcut: 'Control+U' });
  useEffect(() => {
    window.unvibe.onGhostView(setView);
    let theme: ThemePreference = 'light';
    void window.unvibe.getSettings().then((value) => {
      theme = (value as { theme?: ThemePreference }).theme ?? 'light';
      applyTheme(theme);
    });
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onScheme = () => { if (theme === 'system') applyTheme('system'); };
    media.addEventListener('change', onScheme);
    return () => media.removeEventListener('change', onScheme);
  }, []);
  if (view.look === 'hidden') return null;
  if (view.look === 'preview') return <QuickLook key="quick" view={view} />;
  return <Button view={view} />;
}

createRoot(document.getElementById('root')!).render(<App />);
