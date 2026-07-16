import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { LogoMark } from '../shared/logo';

type PageId = 'Home' | 'Study' | 'History' | 'Quiz' | 'Progress' | 'Plan' | 'Projects' | 'Concepts' | 'Notebook' | 'Briefings' | 'Library' | 'Profile';

interface Feature { icon: string; t: string; d: string }
interface PageDef { id: PageId; icon: string; lead: string; features: Feature[] }

interface Profile {
  reviews: number; understood: number; needsReview: number;
  linesUnderstood: number; linesReviewed: number;
  conceptsSeen: number; conceptsDeveloping: number; conceptsFamiliar: number;
  conceptsStrong: number; conceptsNeedReview: number;
  streak: number; bestStreak: number;
  usage: Array<{ label: string; pct: number }>; heat: number[];
}
interface FeedItem { id: string; ts: string; title: string; meta: string; outcome: string }
interface LearningItem extends FeedItem { concept?: string; level: string; lines: number }
interface SyncStatus {
  phase: 'local' | 'syncing' | 'synced' | 'offline' | 'auth_required' | 'error';
  pending: number; lastSyncedAt?: string; nextRetryAt?: string; message?: string;
}
type Account = { userId: string; email: string } | null;
interface Settings {
  onboarded: boolean; shortcut: string; barPosition: string;
  widgetOpacityInactive: number; inactiveBehavior: string;
  launchAtLogin: boolean; theme: 'system' | 'light' | 'dark'; notifications: boolean;
  quietHours: { enabled: boolean; start: string; end: string };
}
interface BillingOverview {
  workspace: { id: string; name: string; type: 'personal' | 'team'; role: string };
  subscription: { plan: 'free' | 'pro' | 'teams'; interval: 'monthly' | 'annual' | null; status: string; seats: number; currentPeriodEnd?: string };
  usage: Array<{ kind: string; used: number; limit: number; remaining: number; resetsAt: string }>;
  canManageBilling: boolean;
  hasBillingAccount: boolean;
}

const PLAN_FEATURES = {
  free: ['30 explanations each month', 'One active project', 'Saved learning history', 'No card required'],
  pro: ['More AI usage', 'Up to 10 active projects', 'Deeper cross-file context', 'Personal learning history'],
  teams: ['Everything in Pro', 'Shared team workspace', 'Roles and permissions', 'Centralized billing'],
} as const;

const IC = {
  home: 'M3 9.5 10 3l7 6.5V17H3z M8 17v-5h4v5',
  progress: 'M4 16V9 M10 16V4 M16 16v-6',
  projects: 'M3 6a1 1 0 0 1 1-1h4l2 2h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  study: 'M4 4h9a3 3 0 0 1 3 3v9a3 3 0 0 0-3-3H4z M4 4v9',
  history: 'M10 3a7 7 0 1 0 7 7 M10 6v4l3 2',
  quiz: 'M10 3a7 7 0 1 0 7 7 M8.2 8.1a2 2 0 1 1 3.4 1.4c-.8.7-1.6 1.1-1.6 2.3 M10 15h.01',
  concepts: 'M10 3l2.1 4.9L17 10l-4.9 2.1L10 17l-2.1-4.9L3 10l4.9-2.1z',
  notebook: 'M5 3h9a1 1 0 0 1 1 1v13l-3-2-3 2-3-2V4a1 1 0 0 1 1-1z M8 7h5 M8 10h5',
  briefings: 'M5 3h10v14H5z M8 7h4 M8 10h4 M8 13h2',
  library: 'M4 3h3v14H4z M9 3h3v14H9z M14 4l3 .8-3.4 12.6-2.9-.8z',
  profile: 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M4 17c.7-3 3-4.5 6-4.5s5.3 1.5 6 4.5',
  spark: 'M10 3v14 M3 10h14 M6 6l8 8 M14 6l-8 8',
  eye: 'M2 10s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5z M10 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  layers: 'M10 3l7 4-7 4-7-4z M3 11l7 4 7-4',
  check: 'M4 10l4 4 8-9',
  clock: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M10 6v4l3 2',
  map: 'M3 5l5-2 4 2 5-2v12l-5 2-4-2-5 2z M8 3v12 M12 5v12',
  plan: 'M3 5h14v10H3z M3 8h14 M6 12h3',
};

const PAGES: Record<Exclude<PageId, 'Home' | 'Progress' | 'Plan' | 'History' | 'Quiz'>, PageDef> = {
  Projects: { id: 'Projects', icon: IC.projects, lead: 'Every repository you point Unvibe at, distilled into something you can actually hold in your head.', features: [
    { icon: IC.eye, t: 'Plain-English summaries', d: 'What each repo is for and how it earns its keep — no folder-tree dumps.' },
    { icon: IC.layers, t: 'How it fits together', d: 'The moving parts and where they connect, so a new codebase stops feeling like a maze.' },
    { icon: IC.check, t: 'How much you grasp', d: 'A running sense of which corners you understand and which you have not opened yet.' },
    { icon: IC.map, t: 'Where to start reading', d: 'Unvibe points you at the file a newcomer should open first.' },
  ] },
  Study: { id: 'Study', icon: IC.study, lead: 'Guided tracks built from your own repositories — Unvibe teaches the parts that matter, one short lesson at a time.', features: [
    { icon: IC.map, t: 'Paths from your code', d: 'Frontend, backend, security, architecture, databases, testing — drawn from what you actually ship.' },
    { icon: IC.check, t: 'One lesson at a time', d: 'Bite-sized steps you can finish between commits, not a 40-hour course.' },
    { icon: IC.spark, t: 'Tuned to your level', d: 'Lessons meet you where you are and climb only as fast as you do.' },
    { icon: IC.clock, t: 'Pick up where you left off', d: 'Every track remembers your place, so momentum survives a busy week.' },
  ] },
  Concepts: { id: 'Concepts', icon: IC.concepts, lead: 'Your growing handbook of ideas — each one explained once, well, and tied back to the code where you met it.', features: [
    { icon: IC.eye, t: 'A definition that sticks', d: 'Plain wording first, precise wording second — never the other way around.' },
    { icon: IC.layers, t: 'Examples from your repos', d: 'Real snippets where the idea shows up in code you have touched.' },
    { icon: IC.spark, t: 'Gotchas and near-misses', d: 'The mistakes people make with each idea, so you spot them early.' },
    { icon: IC.check, t: 'A quick check', d: 'One question adds evidence without pretending Unvibe knows exactly what you understand.' },
  ] },
  Notebook: { id: 'Notebook', icon: IC.notebook, lead: 'The keeper for anything worth a second look — explanations, diagrams, and the back-and-forth you had with Unvibe.', features: [
    { icon: IC.notebook, t: 'Saved explanations', d: 'Star an explanation in any widget and it lands here, searchable.' },
    { icon: IC.layers, t: 'Diagrams', d: 'Execution flows and structure sketches, kept next to the code they describe.' },
    { icon: IC.spark, t: 'Threads', d: 'Whole follow-up conversations, not just the first answer.' },
    { icon: IC.clock, t: 'Nothing evaporates', d: 'Close a widget without worry — what you kept is still here tomorrow.' },
  ] },
  Briefings: { id: 'Briefings', icon: IC.briefings, lead: 'Short recaps of what changed and what you picked up — a two-minute read each morning, a longer one each week.', features: [
    { icon: IC.clock, t: 'Morning recap', d: 'What the agents changed overnight, told as a story rather than a diff.' },
    { icon: IC.check, t: 'Weekly review', d: 'The concepts you locked in and the ones worth revisiting.' },
    { icon: IC.eye, t: 'Written for skimming', d: 'Headline first, detail underneath — read as deep as you have time for.' },
    { icon: IC.spark, t: 'Only what moved', d: 'Quiet days stay quiet. Briefings appear when there is something to say.' },
  ] },
  Library: { id: 'Library', icon: IC.library, lead: 'Hand-picked reading matched to whatever you are learning right now — guides and roadmaps, minus the rabbit holes.', features: [
    { icon: IC.map, t: 'Roadmaps', d: 'The shape of a topic end to end, so you know what is left to learn.' },
    { icon: IC.eye, t: 'Focused guides', d: 'Chosen to match your open concepts — no endless tab-hoarding.' },
    { icon: IC.layers, t: 'Reference you keep', d: 'The pages you return to, gathered in one calm place.' },
    { icon: IC.check, t: 'Tied to your work', d: 'Every pick connects back to code you are actually reviewing.' },
  ] },
  Profile: { id: 'Profile', icon: IC.profile, lead: 'The long view of your learning — evidence you have built, ideas to revisit, and everything you have reviewed.', features: [
    { icon: IC.spark, t: 'Milestones', d: 'Quiet, earned markers — first repo understood, first week-long streak.' },
    { icon: IC.check, t: 'Evidence map', d: 'Concepts use cautious labels such as developing, familiar, strong, or needs review.' },
    { icon: IC.clock, t: 'Review history', d: 'A full trail of what you looked at and when.' },
    { icon: IC.layers, t: 'Your history', d: 'The record stays grounded in checks you actually completed.' },
  ] },
};

const NAV: Array<{ id: PageId; icon: string }> = [
  { id: 'Home', icon: IC.home },
  { id: 'Study', icon: IC.study },
  { id: 'History', icon: IC.history },
  { id: 'Quiz', icon: IC.quiz },
  { id: 'Progress', icon: IC.progress },
  { id: 'Plan', icon: IC.plan },
];

const FOOT: Array<{ id: string; icon: string; toast: string }> = [
  { id: 'Settings', icon: 'M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M10 2.8l1 2.2 2.4-.6 1.2 2-1.7 1.8.8 2.3-2.2 1-.1 2.5H9.6l-.1-2.5-2.2-1 .8-2.3-1.7-1.8 1.2-2 2.4.6z', toast: '' },
];

function Icon({ d }: { d: string }) {
  return <svg viewBox="0 0 20 20" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
}

/** Remounts on `animKey` so CSS fade-in plays on every navigation / step change. */
function FadeIn({
  animKey,
  className,
  stagger = false,
  children,
}: {
  animKey: string | number;
  className?: string;
  stagger?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      key={animKey}
      className={`fade-in${stagger ? ' fade-stagger' : ''}${className ? ` ${className}` : ''}`}
    >
      {children}
    </div>
  );
}

function prettyAccel(a: string): string {
  return a.replace('CommandOrControl', '⌘').replace('Command', '⌘').replace('Control', '⌃').replace('Alt', '⌥').replace('Shift', '⇧').replace(/\+/g, '');
}
function accelFromEvent(e: KeyboardEvent): string | null {
  const mods: string[] = [];
  if (e.metaKey) mods.push('CommandOrControl');
  if (e.ctrlKey && !e.metaKey) mods.push('Control');
  if (e.altKey) mods.push('Alt');
  if (e.shiftKey) mods.push('Shift');
  let key = e.key;
  if (key === ' ') key = 'Space';
  else if (/^[a-z]$/i.test(key)) key = key.toUpperCase();
  else if (/^[0-9]$/.test(key)) { /* keep */ }
  else return null; // must end on a printable/space key
  if (mods.length === 0) return null; // require at least one modifier
  return [...mods, key].join('+');
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function SignInForm({ onDone }: { onDone: (email: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  useEffect(() => { window.unvibe.onDeviceAuth((r) => { setBusy(false); if (r.ok && r.email) onDone(r.email); else if (!r.ok) setErr(r.error ?? 'Secure sign-in failed.'); }); }, [onDone]);
  const startDevice = async () => {
    setBusy(true); setErr('');
    const r = (await window.unvibe.startDeviceAuth()) as { ok: boolean; userCode?: string; error?: string };
    if (r.ok && r.userCode) setCode(r.userCode); else { setBusy(false); setErr(r.error ?? 'Could not start secure sign-in.'); }
  };
  return (
    <div className="signin">
      <button className="field-btn" disabled={busy} onClick={startDevice}>{busy ? 'Waiting for secure sign-in…' : 'Sign in securely'}</button>
      {err && <div className="field-err">{err}</div>}
      <div className="field-note">{code ? `A secure browser window is open. Enter code ${code} after signing in.` : 'We open your browser so Supabase can verify your account. This app never sees your password.'}</div>
    </div>
  );
}

function PermRow({ compact }: { compact?: boolean }) {
  const [state, setState] = useState<{ granted: boolean; platform: string } | null>(null);
  const check = () => void window.unvibe.accessibility().then((r) => setState(r as { granted: boolean; platform: string }));
  useEffect(() => {
    check();
    const t = setInterval(check, 2500); // reflect a grant made in System Settings without a manual re-check
    return () => clearInterval(t);
  }, []);
  const granted = state?.granted ?? false;
  const na = state?.platform !== 'darwin';
  return (
    <div className={compact ? '' : 'perm-block'}>
      <div className="perm-head">
        <span className={`pstat ${na ? 'na' : granted ? 'ok' : 'no'}`}>{na ? 'N/A' : granted ? 'Granted' : 'Not granted'}</span>
        <span className="perm-title">Accessibility</span>
      </div>
      <div className="perm-why">Lets Unvibe read the code you have selected in another app when you press the shortcut. Without it, Unvibe falls back to explaining whatever you last copied.</div>
      {!granted && !na && (
        <div className="perm-actions">
          <button className="act" onClick={() => window.unvibe.promptAccessibility()}>Request access</button>
          <button className="act" onClick={() => window.unvibe.openAccessibility()}>Open System Settings</button>
          <button className="act" onClick={check}>Re-check</button>
        </div>
      )}
    </div>
  );
}

function Choice({ selected, title, detail, onClick }: { selected: boolean; title: string; detail: string; onClick: () => void }) {
  return <button className={`ob__choice${selected ? ' selected' : ''}`} aria-pressed={selected} onClick={onClick}><span className="ob__choice-check">✓</span><span><b>{title}</b><small>{detail}</small></span></button>;
}

function Onboarding({ shortcut, account, onDone, onSignedIn }: { shortcut: string; account: Account; onDone: () => void; onSignedIn: () => void }) {
  const [step, setStep] = useState(0);
  const [fired, setFired] = useState(false);
  const [position, setPosition] = useState('bottom-center');
  const [level, setLevel] = useState('intermediate');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  useEffect(() => { window.unvibe.onShortcutFired(() => setFired(true)); }, []);
  const steps = ['Welcome', 'Account', 'How it works', 'Permission', 'Shortcut', 'Overlay', 'Select code', 'Your level', 'First explanation', 'Done'];

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const finish = () => { void window.unvibe.completeOnboarding(); onDone(); };

  const nav = (continueLabel = 'Continue', disabled = false) => <div className="ob__actions"><button className="ob__skip" disabled={step === 0} onClick={back}>Back</button><button className="field-btn inline" disabled={disabled} onClick={next}>{continueLabel}</button></div>;

  return (
    <div className="ob">
      <div className="ob__card fade-in">
        <div className="ob__progress"><span>Step {step + 1} of {steps.length}</span><span>{steps[step]}</span></div>
        <div className="ob__dots">{steps.map((_, i) => <span key={i} className={`ob__dot${i <= step ? ' on' : ''}`} />)}</div>

        <FadeIn animKey={step} stagger className="ob__step">
          {step === 0 && (
            <>
              <div className="ob__mark"><LogoMark size={48} stroke={1.7} /></div>
              <h2 className="ob__title">Welcome to Unvibe</h2>
              <p className="ob__sub">A quiet teacher that sits beside your editor and explains the code you are shipping — at your level, wherever you work.</p>
              {nav('Get started')}
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="ob__title">Keep it on this Mac—or sync it</h2>
              <p className="ob__sub">An account syncs your learning across devices. Local-only keeps every record on this Mac.</p>
              {account ? <div className="ob__status">✓ Signed in as {account.email}</div> : <SignInForm onDone={() => onSignedIn()} />}
              {nav(account ? 'Continue' : 'Keep it local')}
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="ob__title">A quieter way to learn code</h2>
              <ul className="ob__list">
                <li><b>Select code</b> in Cursor, VS Code, a terminal, or a browser.</li>
                <li><b>Press {prettyAccel(shortcut)}</b> — a floating explanation appears beside your work.</li>
                <li><b>Keep what you learn</b> — every review builds your streak, concepts, and progress.</li>
              </ul>
              {nav()}
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="ob__title">One permission</h2>
              <PermRow />
              {nav('Continue')}
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="ob__title">Try your shortcut</h2>
              <p className="ob__sub">Press <span className="kbd-lg">{prettyAccel(shortcut)}</span> now. A floating widget should appear — that is where explanations live. You can change this shortcut any time in Settings.</p>
              <div className={`ob__test ${fired ? 'ok' : ''}`}>{fired ? '✓ Detected — the overlay works.' : 'Waiting for the shortcut…'}</div>
              {nav('Continue', !fired)}
            </>
          )}

          {step === 5 && (
            <>
              <h2 className="ob__title">Put the overlay where it helps</h2>
              <p className="ob__sub">You can drag and pin explanations later. This only chooses where the small activation bar begins.</p>
              <div className="ob__choices"><Choice selected={position === 'bottom-center'} title="Bottom center" detail="Quiet and within reach" onClick={() => { setPosition('bottom-center'); void window.unvibe.setSettings({ barPosition: 'bottom-center' }); }} /><Choice selected={position === 'top-right'} title="Top right" detail="Closer to the menu bar" onClick={() => { setPosition('top-right'); void window.unvibe.setSettings({ barPosition: 'top-right' }); }} /></div>
              {nav()}
            </>
          )}

          {step === 6 && (
            <>
              <h2 className="ob__title">Start with a small selection</h2>
              <p className="ob__sub">Highlight a function, a condition, or a confusing line. Unvibe only uses the exact filtered snippet you choose.</p>
              <div className="ob__demo"><span>const</span> eligible = <b>user.age</b> {'>'}= 18</div>
              {nav('I understand')}
            </>
          )}

          {step === 7 && (
            <>
              <h2 className="ob__title">Choose how deep to go</h2>
              <p className="ob__sub">Every explanation can change level later.</p>
              <div className="ob__choices"><Choice selected={level === 'new'} title="New" detail="Start with the idea" onClick={() => setLevel('new')} /><Choice selected={level === 'intermediate'} title="Intermediate" detail="Practical detail and trade-offs" onClick={() => setLevel('intermediate')} /><Choice selected={level === 'expert'} title="Expert" detail="Implementation nuance" onClick={() => setLevel('expert')} /></div>
              {nav()}
            </>
          )}

          {step === 8 && (
            <>
              <h2 className="ob__title">Your first explanation lives beside your work</h2>
              <div className="ob__widget"><div><b>Why this condition?</b><span>The check keeps underage users out of an adult-only flow.</span></div><small>{level} · Save · Test me</small></div>
              <div className="ob__theme"><span>Preview</span><button className={theme === 'light' ? 'on' : ''} onClick={() => { setTheme('light'); document.documentElement.dataset.theme = 'light'; void window.unvibe.setSettings({ theme: 'light' }); }}>Light</button><button className={theme === 'dark' ? 'on' : ''} onClick={() => { setTheme('dark'); document.documentElement.dataset.theme = 'dark'; void window.unvibe.setSettings({ theme: 'dark' }); }}>Dark</button></div>
              {nav()}
            </>
          )}

          {step === 9 && (
            <>
              <div className="ob__mark"><LogoMark size={44} stroke={1.7} /></div>
              <h2 className="ob__title">You're set</h2>
              <p className="ob__sub">Select code anywhere and press {prettyAccel(shortcut)}. Your progress collects in this dashboard.</p>
              <div className="ob__actions"><button className="ob__skip" onClick={back}>Back</button><button className="field-btn inline" onClick={finish}>Enter Unvibe</button></div>
            </>
          )}
        </FadeIn>
      </div>
    </div>
  );
}

function LoginScreen({ onSignedIn, onSkip }: { onSignedIn: (email: string) => void; onSkip: () => void }) {
  return (
    <div className="login">
      <div className="login__bg" />
      <FadeIn animKey="login" stagger className="login__card">
        <div className="login__mark"><LogoMark size={48} stroke={1.6} /></div>
        <div className="login__brand">Unvibe</div>
        <h2 className="login__tag">Understand everything you ship.</h2>
        <div className="login__features">
          <div className="login__feature"><span className="lf-icon">⌘</span><span>Select code anywhere</span></div>
          <div className="login__feature"><span className="lf-icon">▸</span><span>Press your shortcut</span></div>
          <div className="login__feature"><span className="lf-icon">✓</span><span>Understand and keep it</span></div>
        </div>
        <SignInForm onDone={onSignedIn} />
        <button className="login__skip" onClick={onSkip}>Keep it local for now →</button>
      </FadeIn>
    </div>
  );
}

function Home({ user, shortcut, profile, feed }: { user: string; shortcut: string; profile: Profile | null; feed: FeedItem[] }) {
  return (
    <>
      <div className="topline"><h1>Hello again, {user}</h1><div className="avatar">{user[0]?.toUpperCase() ?? 'U'}</div></div>
      <div className="cols">
        <div className="main-col">
          <div className="hero">
            <h2>Understand everything you ship.</h2>
            <p>Highlight code in any app and Unvibe explains it right where you are working — pitched to how much you already know, and quiet until you ask.</p>
            <div className="row"><button onClick={() => window.unvibe.companionReview()}>Explain some code</button><span className="kbd">or press {shortcut} anywhere</span></div>
          </div>
          <div className="feed-label">LATELY</div>
          {feed.length === 0 ? (
            <div className="feed-empty"><div className="t">Nothing reviewed yet</div><div className="d">Highlight some code and press {shortcut}. The things you review will gather here so you can return to any of them.</div></div>
          ) : (
            <div className="feed">
              {feed.map((f) => (
                <div className="feed-row" key={f.id}>
                  <div className="feed-time">{fmtTime(f.ts)}</div>
                  <div className="feed-main"><div className="feed-title">{f.title}</div><div className="feed-meta">{f.meta}</div></div>
                  <span className={`tag tag--${f.outcome}`}>{f.outcome === 'understood' ? 'Understood' : f.outcome === 'needs_review' ? 'Revisit' : 'Reviewed'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rail">
          <div className="stats">
            <div className="stat"><span className="v">{profile?.linesUnderstood ?? 0}</span><span className="l">lines understood</span></div>
            <div className="stat"><span className="v">{(profile?.conceptsFamiliar ?? 0) + (profile?.conceptsStrong ?? 0)}</span><span className="l">concepts familiar or strong</span></div>
            <div className="stat"><span className="v">{profile?.streak ?? 0}</span><span className="l">day streak</span></div>
          </div>
          <div className="rail-card"><div className="t">Kept on your machine</div><div className="d">Code is scanned for secrets on your device before anything is sent. The service never reads your repository.</div></div>
          <div className="rail-card"><div className="t">How it works</div><div className="d">Select code, press {shortcut}, pick a depth from New to Expert, then take a quick check to lock it in.</div></div>
        </div>
      </div>
    </>
  );
}

function Progress({ profile }: { profile: Profile | null }) {
  const heat = profile?.heat ?? Array.from({ length: 182 }, () => 0);
  return (
    <>
      <div className="topline"><h1>Progress</h1></div>
      <p className="lead">The honest measure of what you have understood — not lines typed, but lines you could explain to someone else.</p>
      <div className="tiles">
        <div className="tile"><div className="v">{profile?.linesUnderstood ?? 0}</div><div className="l">lines understood</div><div className="note">of {profile?.linesReviewed ?? 0} reviewed</div></div>
        <div className="tile"><div className="v">{profile?.conceptsDeveloping ?? 0}</div><div className="l">concepts developing</div><div className="note">{profile?.conceptsSeen ?? 0} encountered · {profile?.conceptsNeedReview ?? 0} to revisit</div></div>
        <div className="tile"><div className="v">{profile?.reviews ?? 0}</div><div className="l">reviews done</div><div className="note">{profile?.needsReview ?? 0} to revisit</div></div>
        <div className="tile"><div className="v">{profile?.streak ?? 0}</div><div className="l">day streak</div><div className="note">best: {profile?.bestStreak ?? 0} days</div></div>
      </div>
      <div className="panel-card">
        <div className="ph"><span className="t">Your streak</span><span className="m">last 6 months</span></div>
        <div className="heat">{heat.map((lvl, i) => <i key={i} className={lvl ? `a${lvl}` : ''} />)}</div>
        <div className="heat-legend"><span>Less</span><i /><i className="a1" /><i className="a2" /><i className="a3" /><span>More</span><span style={{ marginLeft: 'auto' }}>Review code on a day to light it up.</span></div>
      </div>
      <div className="two">
        <div className="panel-card" style={{ marginBottom: 0 }}>
          <div className="ph"><span className="t">Where you learn</span></div>
          <div className="bars">
            {(profile && profile.usage.length > 0 ? profile.usage : [{ label: 'Editors & IDEs', pct: 0 }, { label: 'Terminal', pct: 0 }, { label: 'Browser & docs', pct: 0 }]).map((u) => (
              <div className="bar-row" key={u.label}><div className="bl"><span>{u.label}</span><span>{u.pct}%</span></div><div className="bar-track"><i style={{ width: `${u.pct}%` }} /></div></div>
            ))}
          </div>
          <p className="soft-note">Unvibe notes which app you were in when you asked — never what you typed.</p>
        </div>
        <div className="panel-card" style={{ marginBottom: 0 }}>
          <div className="ph"><span className="t">Understanding over time</span></div>
          <div className="chart-empty">Your weekly curve of lines understood will draw itself here after a few days of reviewing.</div>
        </div>
      </div>
    </>
  );
}

function outcomeName(outcome: string): string {
  return outcome === 'understood' ? 'Understood' : outcome === 'needs_review' ? 'To revisit' : 'Reviewed';
}

function Study({ items, shortcut, onReview }: { items: LearningItem[]; shortcut: string; onReview: () => void }) {
  const revisit = items.filter((item) => item.outcome === 'needs_review');
  const recent = items.filter((item) => item.outcome !== 'needs_review').slice(0, 3);
  const queue = revisit.length > 0 ? revisit : recent;
  return <>
    <div className="topline"><h1>Study</h1></div>
    <p className="lead">A small, evidence-based queue from the code you have already reviewed. It grows only when you use Unvibe—no generic course pretending to know your project.</p>
    {queue.length === 0 ? <LearningEmpty title="Your study queue is waiting for its first review." detail={`Select code and press ${shortcut}. When you mark a concept to revisit, it will appear here.`} onReview={onReview} /> : <>
      <div className="learning-summary"><div><strong>{revisit.length}</strong><span>ready to revisit</span></div><div><strong>{items.length}</strong><span>reviews in your recent history</span></div><p>Start with the items that asked for another pass. A fresh explanation can generate the next real comprehension check.</p></div>
      <div className="learning-list">{queue.slice(0, 6).map((item) => <article className="learning-card" key={item.id}><div><span className="learning-kicker">{item.outcome === 'needs_review' ? 'REVIEW QUEUE' : 'RECENT CONCEPT'}</span><h2>{item.title}</h2><p>{item.meta || `${item.lines} lines · ${item.level}`}</p></div><button className="soft-btn" onClick={onReview}>Open a fresh explanation</button></article>)}</div>
    </>}
  </>;
}

function History({ items, onReview }: { items: LearningItem[]; onReview: () => void }) {
  return <>
    <div className="topline"><h1>History</h1></div>
    <p className="lead">Your actual trail of explanations and checks. It stays on this Mac first, then syncs when you sign in—never a fabricated activity feed.</p>
    {items.length === 0 ? <LearningEmpty title="No history yet." detail="Your explanations will appear here after you select code and open a review." onReview={onReview} /> : <div className="history-list">{items.map((item) => <article className="history-row" key={item.id}><time dateTime={item.ts}>{new Date(item.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · {fmtTime(item.ts)}</time><div><h2>{item.title}</h2><p>{item.meta || `${item.lines} lines · ${item.level}`}</p></div><span className={`tag tag--${item.outcome}`}>{outcomeName(item.outcome)}</span></article>)}</div>}
  </>;
}

function Quiz({ items, onReview }: { items: LearningItem[]; onReview: () => void }) {
  const candidates = items.filter((item) => item.outcome === 'needs_review');
  return <>
    <div className="topline"><h1>Quiz</h1></div>
    <p className="lead">Comprehension checks happen inside a fresh explanation, where Unvibe has the exact code and context to ask a fair question. This queue simply chooses what is worth revisiting.</p>
    <div className="quiz-callout"><span className="quiz-icon"><Icon d={IC.quiz} /></span><div><span className="learning-kicker">HOW QUIZZES WORK</span><h2>Explain a selection, then choose “Test me.”</h2><p>Your result updates the same learning history, concept evidence, and review queue shown everywhere else.</p></div><button className="primary-btn" onClick={onReview}>Start a code check</button></div>
    {candidates.length > 0 ? <section className="quiz-queue"><div className="ph"><span className="t">Ready to revisit</span><span className="m">{candidates.length} item{candidates.length === 1 ? '' : 's'}</span></div>{candidates.slice(0, 5).map((item) => <div className="quiz-row" key={item.id}><div><strong>{item.title}</strong><span>{item.meta || `${item.lines} lines`}</span></div><button className="soft-btn" onClick={onReview}>Practice it</button></div>)}</section> : <LearningEmpty title="Nothing needs a quiz yet." detail="When an explanation is marked for another look, it will appear here. You can always start a fresh code check now." onReview={onReview} />}
  </>;
}

function LearningEmpty({ title, detail, onReview }: { title: string; detail: string; onReview: () => void }) {
  return <div className="learning-empty"><div className="stub__icon"><Icon d={IC.spark} /></div><h2>{title}</h2><p>{detail}</p><button className="primary-btn" onClick={onReview}>Explain some code</button></div>;
}

function Plan() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [available, setAvailable] = useState(false);
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const [seats, setSeats] = useState(2);
  const [teamName, setTeamName] = useState('My team');
  const [message, setMessage] = useState('Loading plan…');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const result = await window.unvibe.billingOverview() as { ok: boolean; data?: { overview: BillingOverview; checkoutAvailable: boolean }; error?: string };
    if (!result.ok || !result.data) { setMessage(result.error ?? 'Could not load plan.'); return; }
    setOverview(result.data.overview); setAvailable(result.data.checkoutAvailable); setSeats(Math.max(2, result.data.overview.subscription.seats)); setMessage('');
  };
  useEffect(() => { void load(); }, []);

  const checkout = async (plan: 'pro' | 'teams') => {
    setBusy(true); setMessage('');
    const input = plan === 'pro' ? { plan, interval, seats: 1 } : { plan, interval, seats, ...(overview?.workspace.type === 'team' ? { workspaceId: overview.workspace.id } : { workspaceName: teamName }) };
    const result = await window.unvibe.startBillingCheckout(input) as { ok: boolean; error?: string };
    if (!result.ok) setMessage(result.error ?? 'Checkout could not start.');
    setBusy(false);
  };

  const portal = async () => {
    if (!overview) return;
    setBusy(true);
    const result = await window.unvibe.openBillingPortal(overview.workspace.id) as { ok: boolean; error?: string };
    if (!result.ok) setMessage(result.error ?? 'Billing could not open.');
    setBusy(false);
  };

  return <div className="plan-view">
    <div className="page-head"><div><div className="eyebrow">Plan & usage</div><h1>Start free. Grow when your projects do.</h1><p>Your AI model access is included. You never need to paste in your own provider API key.</p></div></div>
    {message && <div className="plan-message" role="status">{message}</div>}
    {overview && <>
      <div className="plan-current"><div><span>Current plan</span><strong>{overview.subscription.plan}</strong></div><div><span>Interval</span><strong>{overview.subscription.interval ?? 'no billing'}</strong></div><div><span>Status</span><strong>{overview.subscription.plan === 'free' ? 'ready' : overview.subscription.status.replaceAll('_', ' ')}</strong></div><div><span>Renews</span><strong>{overview.subscription.currentPeriodEnd ? new Date(overview.subscription.currentPeriodEnd).toLocaleDateString() : 'not applicable'}</strong></div><div><span>Workspace</span><strong>{overview.workspace.name}</strong></div>{overview.canManageBilling && overview.hasBillingAccount && <button className="soft-btn" onClick={() => void portal()} disabled={busy}>Manage billing</button>}</div>
      <div className="plan-usage">{overview.usage.slice(0, 3).map((line) => <div key={line.kind}><span>{line.kind.replaceAll('_', ' ')}</span><strong>{line.used} / {line.limit}</strong><progress value={line.used} max={line.limit} /></div>)}</div>
      <div className="plan-billing-control">
        <div className="plan-toggle" aria-label="Billing interval"><button type="button" className={interval === 'monthly' ? 'on' : ''} onClick={() => setInterval('monthly')} aria-pressed={interval === 'monthly'}>Monthly</button><button type="button" className={interval === 'annual' ? 'on' : ''} onClick={() => setInterval('annual')} aria-pressed={interval === 'annual'}>Annual <span>Save 25% on Teams</span></button></div>
        <p><strong>Annual Teams:</strong> $6/member/month, billed as $72/member/year. <span>Pro stays $8/month, billed as $96/year.</span></p>
      </div>
      {!available && <div className="plan-message quiet">Checkout is disabled until billing is configured on the server.</div>}
      <div className="plan-options">
        <article><b>Free · learn how your code works</b><h2>$0</h2><p className="plan-price-note">Always free</p><ul className="plan-feature-list">{PLAN_FEATURES.free.map((feature) => <li key={feature}><Icon d={IC.check} />{feature}</li>)}</ul><button className="soft-btn" disabled>Included</button></article>
        <article className="featured"><b>Pro · best for individuals</b><h2>{interval === 'monthly' ? '$8/month' : '$96/year'}</h2><p className="plan-price-note">{interval === 'monthly' ? 'One personal account · billed monthly' : 'Equivalent to $8/month · billed once yearly'}</p><ul className="plan-feature-list">{PLAN_FEATURES.pro.map((feature) => <li key={feature}><Icon d={IC.check} />{feature}</li>)}</ul><button className="primary-btn" onClick={() => void checkout('pro')} disabled={busy || !available}>Upgrade to Pro</button></article>
        <article><b>Teams · for 2+ members</b><h2>{interval === 'monthly' ? '$8/member/month' : '$6/member/month'}</h2><p className="plan-price-note">{interval === 'monthly' ? `${seats} paid seats · $${seats * 8}/month total` : `${seats} paid seats · $${seats * 72}/year total`} <span className={interval === 'annual' ? 'annual-save' : ''}>{interval === 'annual' ? 'Save 25%' : '2-seat minimum'}</span></p><ul className="plan-feature-list">{PLAN_FEATURES.teams.map((feature) => <li key={feature}><Icon d={IC.check} />{feature}</li>)}</ul><div className="plan-team-inputs"><input aria-label="Team name" value={teamName} onChange={(event) => setTeamName(event.target.value)} disabled={overview.workspace.type === 'team'} /><input aria-label="Seats" type="number" min={2} max={500} value={seats} onChange={(event) => setSeats(Number(event.target.value))} /></div><button className="primary-btn" onClick={() => void checkout('teams')} disabled={busy || !available || seats < 2}>Start a team</button></article>
      </div>
    </>}
  </div>;
}

function Explainer({ page, shortcut }: { page: PageDef; shortcut: string }) {
  return (
    <>
      <div className="topline"><h1>{page.id}<span className="d2">fills in as you review</span></h1></div>
      <p className="lead">{page.lead}</p>
      <div className="feature-grid">
        {page.features.map((f) => (
          <div className="feature" key={f.t}><div className="fh"><Icon d={f.icon} /><span className="t">{f.t}</span></div><div className="d">{f.d}</div></div>
        ))}
      </div>
      <div className="stub">
        <div className="stub__icon"><svg viewBox="0 0 20 20" strokeLinecap="round" strokeLinejoin="round" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 3v14 M3 10h14 M6 6l8 8 M14 6l-8 8" /></svg></div>
        <div className="stub__text"><b>Your {page.id.toLowerCase()} will appear here.</b> Review code with <b>{shortcut}</b> and each concept, track, and highlight builds itself from what you learn.</div>
        <button className="stub__cta" onClick={() => window.unvibe.companionReview()}>Review some code</button>
      </div>
    </>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return <button className={`toggle${on ? ' on' : ''}`} role="switch" aria-checked={on} onClick={onClick}><span className="knob" /></button>;
}

function AccountPanel({ account, onChange, onDeleted, onNotice }: { account: Account; onChange: () => void; onDeleted: () => void; onNotice: (message: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  if (!account) {
    return (
      <div className="setrow" style={{ display: 'block' }}>
        <div className="sl">Sign in</div>
        <div className="sd" style={{ marginBottom: 14 }}>Sync your learning across devices. You are using Unvibe locally right now.</div>
        <SignInForm onDone={onChange} />
      </div>
    );
  }
  const del = async () => {
    setBusy(true); setErr('');
    const r = (await window.unvibe.deleteAccount()) as { ok: boolean; error?: string };
    setBusy(false);
    if (r.ok) onDeleted(); else setErr(r.error ?? 'Could not delete the account.');
  };
  return (
    <>
      <div className="setrow"><div><div className="sl">Signed in</div><div className="sd">{account.email}</div></div>
        <button className="act" onClick={async () => {
          const result = (await window.unvibe.signOut()) as { ok: boolean; error?: string; warning?: string };
          onChange();
          onNotice(result.ok
            ? result.warning ? `Signed out locally. ${result.warning}` : 'Signed out securely.'
            : result.error ?? 'Sign-out could not be saved on this Mac.');
        }}>Sign out</button></div>
      <div className="setrow" style={{ display: 'block' }}>
        <div className="sl" style={{ color: '#a1291f' }}>Delete account</div>
        <div className="sd" style={{ marginBottom: 12 }}>Permanently removes your account and every review, concept, and streak — on this Mac and on our servers. This cannot be undone.</div>
        {!confirming ? <button className="act danger" onClick={() => setConfirming(true)}>Delete my account…</button> : (
          <div className="danger-row">
            <input className="field delete-confirm" aria-label="Type DELETE to confirm account deletion" value={phrase} placeholder="Type DELETE to confirm" onChange={(e) => setPhrase(e.target.value)} />
            <button className="act danger" disabled={busy || phrase !== 'DELETE'} onClick={del}>{busy ? 'Deleting…' : 'Delete everything'}</button>
            <button className="act" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        )}
        {err && <div className="field-err">{err}</div>}
      </div>
    </>
  );
}

function Settings({ info, account, settings, onAccountChange, onSettings, onClose, onAccountDeleted, onNotice }: {
  info: { version: string }; account: Account; settings: Settings;
  onAccountChange: () => void; onSettings: (patch: Partial<Settings>) => Promise<string | undefined>; onClose: () => void; onAccountDeleted: () => void; onNotice: (message: string) => void;
}) {
  const [tab, setTab] = useState('General');
  const [recording, setRecording] = useState(false);
  const [shortcutErr, setShortcutErr] = useState('');
  const recRef = useRef(recording); recRef.current = recording;

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (!recRef.current) return;
      e.preventDefault();
      const accel = accelFromEvent(e);
      if (!accel) return;
      setRecording(false);
      const err = await onSettings({ shortcut: accel });
      setShortcutErr(err ?? '');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onSettings]);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Settings" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mside">
          <div className="mh">SETTINGS</div>
          {['General', 'Overlay', 'Notifications', 'Permissions', 'Privacy'].map((t) => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
          <div className="mh" style={{ paddingTop: 18 }}>ACCOUNT</div>
          {['Account', 'Data'].map((t) => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
          <div className="ver">Unvibe v{info.version}</div>
        </div>
        <div className="mbody">
          <h2>{tab}</h2>

          {tab === 'General' && (
            <>
              <div className="setrow">
                <div><div className="sl">Activation shortcut</div><div className="sd">Select code, then press this to open an explanation.</div>{shortcutErr && <div className="field-err">{shortcutErr}</div>}</div>
                <button className={`act kbd-cap${recording ? ' rec' : ''}`} onClick={() => { setShortcutErr(''); setRecording(true); }}>{recording ? 'Press keys…' : prettyAccel(settings.shortcut)}</button>
              </div>
              <div className="setrow"><div><div className="sl">Launch at login</div><div className="sd">Start Unvibe automatically when you log in to your Mac.</div></div><Toggle on={settings.launchAtLogin} onClick={() => onSettings({ launchAtLogin: !settings.launchAtLogin })} /></div>
              <div className="setrow"><div><div className="sl">App appearance</div><div className="sd">Choose light, dark, or follow your Mac automatically.</div></div><select className="sel-input" value={settings.theme} onChange={(e) => onSettings({ theme: e.target.value as Settings['theme'] })}><option value="system">Follow system</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
            </>
          )}

          {tab === 'Overlay' && (
            <>
              <div className="setrow"><div><div className="sl">Floating bar position</div><div className="sd">Where the small activation bar sits.</div></div>
                <select className="sel-input" value={settings.barPosition} onChange={(e) => onSettings({ barPosition: e.target.value })}>
                  <option value="bottom-center">Bottom center</option><option value="top-center">Top center</option>
                  <option value="top-right">Top right</option><option value="bottom-right">Bottom right</option>
                </select>
              </div>
              <div className="setrow"><div><div className="sl">Inactive widget</div><div className="sd">What an explanation does when you click away (and it is not pinned).</div></div>
                <select className="sel-input" value={settings.inactiveBehavior} onChange={(e) => onSettings({ inactiveBehavior: e.target.value })}>
                  <option value="dim">Dim</option><option value="stay">Stay solid</option><option value="collapse">Collapse</option>
                </select>
              </div>
              <div className="setrow"><div><div className="sl">Dimmed opacity</div><div className="sd">How faint a dimmed widget becomes — {Math.round(settings.widgetOpacityInactive * 100)}%.</div></div>
                <input className="range" type="range" min={35} max={100} value={Math.round(settings.widgetOpacityInactive * 100)} onChange={(e) => onSettings({ widgetOpacityInactive: Number(e.target.value) / 100 })} />
              </div>
            </>
          )}

          {tab === 'Notifications' && (
            <>
              <div className="setrow"><div><div className="sl">Bar notifications</div><div className="sd">Short, rate-limited messages in the floating bar.</div></div><Toggle on={settings.notifications} onClick={() => onSettings({ notifications: !settings.notifications })} /></div>
              <div className="setrow"><div><div className="sl">Quiet hours</div><div className="sd">Silence notifications overnight.</div></div><Toggle on={settings.quietHours.enabled} onClick={() => onSettings({ quietHours: { ...settings.quietHours, enabled: !settings.quietHours.enabled } })} /></div>
              {settings.quietHours.enabled && (
                <div className="setrow"><div><div className="sl">From / to</div><div className="sd">24-hour times.</div></div>
                  <div className="danger-row">
                    <input className="time-input" type="time" value={settings.quietHours.start} onChange={(e) => onSettings({ quietHours: { ...settings.quietHours, start: e.target.value } })} />
                    <input className="time-input" type="time" value={settings.quietHours.end} onChange={(e) => onSettings({ quietHours: { ...settings.quietHours, end: e.target.value } })} />
                  </div>
                </div>
              )}
            </>
          )}

          {tab === 'Permissions' && <PermRow compact />}

          {tab === 'Privacy' && (
            <>
              <div className="setrow"><div><div className="sl">On-device secret scan</div><div className="sd">Every selection is scanned for keys and tokens before it leaves your Mac. Always on.</div></div><button className="act" disabled>On</button></div>
              <div className="setrow"><div><div className="sl">The service never reads your repo</div><div className="sd">Only the exact, filtered snippet you review is sent — nothing else.</div></div></div>
              <div className="setrow"><div><div className="sl">Privacy policy</div><div className="sd">Read how Unvibe handles your code and data on our website.</div></div><button className="act" onClick={() => window.unvibe.openPrivacy()}>Read →</button></div>
            </>
          )}

          {tab === 'Account' && <AccountPanel account={account} onChange={onAccountChange} onDeleted={onAccountDeleted} onNotice={onNotice} />}
          {tab === 'Data' && (
            <div className="setrow" style={{ display: 'block' }}><div className="sl">Your data</div><div className="sd">Reviews and progress live in a file on this Mac. Deleting your account (under Account) erases them everywhere.</div></div>
          )}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState<PageId>('Home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [info, setInfo] = useState({ version: '0.1.0', user: 'there', shortcut: '⌘U' });
  const [account, setAccount] = useState<Account>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [history, setHistory] = useState<LearningItem[]>([]);
  const [sync, setSync] = useState<SyncStatus>({ phase: 'local', pending: 0 });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [gate, setGate] = useState<'checking' | 'onboarding' | 'login' | 'app'>('checking');

  const refresh = async () => {
    const [acct, prof, fd, hist, st, syncState] = await Promise.all([
      window.unvibe.account() as Promise<Account>,
      window.unvibe.profile() as Promise<Profile>,
      window.unvibe.feed(8) as Promise<FeedItem[]>,
      window.unvibe.history(100) as Promise<LearningItem[]>,
      window.unvibe.getSettings() as Promise<Settings>,
      window.unvibe.syncStatus() as Promise<SyncStatus>,
    ]);
    setAccount(acct); setProfile(prof); setFeed(fd); setHistory(hist); setSettings(st); setSync(syncState);
    return { acct, st };
  };

  useEffect(() => {
    void window.unvibe.appInfo().then((i) => setInfo(i as typeof info));
    void (async () => {
      const { acct, st } = await refresh();
      setGate(!st.onboarded ? 'onboarding' : acct ? 'app' : 'login');
    })();
    const onFocus = () => void refresh();
    window.unvibe.onSyncStatus((next) => setSync(next as SyncStatus));
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  useEffect(() => {
    const preference = settings?.theme ?? 'system';
    const dark = preference === 'dark' || (preference === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  }, [settings?.theme]);

  const applySettings = async (patch: Partial<Settings>): Promise<string | undefined> => {
    const r = (await window.unvibe.setSettings(patch)) as { settings: Settings; shortcutError?: string };
    setSettings(r.settings);
    if (r.settings.shortcut) setInfo((i) => ({ ...i, shortcut: r.settings.shortcut }));
    return r.shortcutError;
  };

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1800); };
  const shortcutLabel = prettyAccel(info.shortcut);

  if (gate === 'checking') return <div className="titlebar" />;
  if (gate === 'onboarding') {
    return (<><div className="titlebar" /><Onboarding shortcut={settings?.shortcut ?? 'CommandOrControl+U'} account={account} onSignedIn={async () => { await refresh(); }} onDone={async () => { await refresh(); setGate('app'); }} /></>);
  }
  if (gate === 'login') {
    return (<><div className="titlebar" /><LoginScreen onSignedIn={async () => { await refresh(); setGate('app'); }} onSkip={() => setGate('app')} /></>);
  }

  return (
    <>
      <div className="titlebar" />
      <div className="layout">
        <aside className="side fade-in fade-in--side">
          <div className="brand"><span className="mark"><LogoMark size={22} /></span><span className="name">Unvibe</span><span className="badge">Beta</span></div>
          <nav className="nav">{NAV.map((p) => <button key={p.id} className={p.id === page ? 'on' : ''} onClick={() => setPage(p.id)}><Icon d={p.icon} />{p.id}</button>)}</nav>
          <div className="spacer" />
          <button
            className={`sync-state sync-state--${sync.phase}`}
            aria-label={`Sync status: ${sync.phase}. ${sync.pending} pending.`}
            onClick={() => void window.unvibe.retrySync()}
            disabled={sync.phase === 'syncing' || sync.phase === 'local'}
          >
            <span className="sync-state__dot" />
            <span>{sync.phase === 'local' ? 'Saved on this Mac' : sync.phase === 'syncing' ? 'Syncing…' : sync.phase === 'synced' ? 'Synced' : sync.phase === 'auth_required' ? 'Sign in again' : 'Retry sync'}</span>
            {sync.pending > 0 && <small>{sync.pending} pending</small>}
          </button>
          <div className="promo"><div className="t">Start free. <em>Learn daily.</em></div><div className="d">30 explanations each month. Your AI model access is included—no provider API key needed.</div></div>
          <nav className="nav">{FOOT.map((f) => <button key={f.id} onClick={() => (f.id === 'Settings' ? setSettingsOpen(true) : flash(f.toast))}><Icon d={f.icon} />{f.id}</button>)}</nav>
        </aside>
        <main className="content">
          <div className="page">
            <FadeIn animKey={page} stagger>
              {page === 'Home' ? <Home user={info.user} shortcut={shortcutLabel} profile={profile} feed={feed} />
                : page === 'Study' ? <Study items={history} shortcut={shortcutLabel} onReview={() => window.unvibe.companionReview()} />
                : page === 'History' ? <History items={history} onReview={() => window.unvibe.companionReview()} />
                : page === 'Quiz' ? <Quiz items={history} onReview={() => window.unvibe.companionReview()} />
                : page === 'Progress' ? <Progress profile={profile} />
                : page === 'Plan' ? <Plan />
                : <Explainer page={PAGES[page]} shortcut={shortcutLabel} />}
            </FadeIn>
          </div>
        </main>
      </div>
      {settingsOpen && settings && (
        <Settings info={info} account={account} settings={settings}
          onAccountChange={async () => { const { acct } = await refresh(); if (!acct) setGate('app'); }}
          onAccountDeleted={() => { setSettingsOpen(false); setAccount(null); setProfile(null); setFeed([]); setGate('login'); }}
          onSettings={applySettings} onClose={() => setSettingsOpen(false)} onNotice={flash} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
