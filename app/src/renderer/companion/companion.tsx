import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { LogoMark } from '../shared/logo';
import { RichText } from '../shared/richText';

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
interface LearningItem extends FeedItem {
  concept?: string; level: string; lines: number;
  file?: string; project?: string; scope?: string; dueLabel?: string;
  language?: string; code?: string; explanation?: string;
}

const STUDY_LEVELS = [
  { id: 'new', label: 'New' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'expert', label: 'Expert' },
] as const;
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
  defaultExplanationLevel: typeof STUDY_LEVELS[number]['id'];
  useOwnAi: boolean;
  aiProvider: 'gemini' | 'anthropic' | 'openai' | 'grok' | 'deepseek' | 'kimi';
}
interface BillingOverview {
  workspace: { id: string; name: string; type: 'personal' | 'team'; role: string };
  subscription: { plan: 'free' | 'pro' | 'teams'; interval: 'monthly' | 'annual' | null; status: string; seats: number; currentPeriodEnd?: string };
  usage: Array<{ kind: string; used: number; limit: number; remaining: number; resetsAt: string }>;
  canManageBilling: boolean;
  hasBillingAccount: boolean;
}

const PLAN_FEATURES = {
  free: ['50 explanations each month', '1 active project', 'Core explanation levels', 'Selected-code explanations', 'No credit card required'],
  pro: ['100 explanations each month', 'Git diff + agent change briefs', 'Nearby-file context', 'Since-last-understood compares', 'Expert explanations'],
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
      <button className="field-btn" disabled={busy} onClick={startDevice}>{busy ? 'Waiting for Google sign-in…' : 'Continue with Google'}</button>
      {err && <div className="field-err">{err}</div>}
      <div className="field-note">{code ? `Browser open — sign in with Google, then approve code ${code}.` : 'Opens your browser for Google sign-in. Unvibe never sees your Google password.'}</div>
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
      <div className="perm-why">Lets Unvibe read the code you have selected in another app when you press the shortcut. Without it, Unvibe falls back to explaining whatever you last copied. If the toggle is already on, quit Unvibe fully and reopen it — macOS only applies the grant to the next launch.</div>
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

function Onboarding({ shortcut, onDone }: { shortcut: string; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [level, setLevel] = useState('intermediate');
  const [sampleDetail, setSampleDetail] = useState<'simple' | 'technical'>('simple');
  const steps = ['Welcome', 'Try it', 'Your depth', 'Use anywhere'];

  const next = () => setStep((s) => Math.min(s + 1, steps.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const finish = () => { void window.unvibe.completeOnboarding(); onDone(); };

  const nav = (continueLabel = 'Continue') => <div className="ob__actions"><button className="ob__skip" disabled={step === 0} onClick={back}>Back</button><button className="field-btn inline" onClick={next}>{continueLabel}</button></div>;

  return (
    <div className="ob">
      <div className="ob__card fade-in">
        <div className="ob__progress"><span>Step {step + 1} of {steps.length}</span><span>{steps[step]}</span></div>
        <div className="ob__dots">{steps.map((_, i) => <span key={i} className={`ob__dot${i <= step ? ' on' : ''}`} />)}</div>

        <FadeIn animKey={step} stagger className="ob__step">
          {step === 0 && (
            <>
              <div className="ob__mark"><LogoMark size={48} stroke={1.7} /></div>
              <div className="ob__eyebrow">YOUR UNDERSTANDING LAYER</div>
              <h2 className="ob__title">Understand the code you ship.</h2>
              <p className="ob__sub">Unvibe sits beside your work, explains the exact code you choose, and helps you retain it. Nothing is sent until the on-device secret scan finishes.</p>
              <div className="ob__signal"><span className="ob__pixel" />Local filter on <span>·</span> You stay in control</div>
              {nav('Get started')}
            </>
          )}

          {step === 1 && (
            <>
              <div className="ob__eyebrow">GUIDED EXAMPLE</div>
              <h2 className="ob__title">See the learning loop.</h2>
              <div className="ob__sample">
                <div className="ob__sample-code"><span>if</span> (!user.isVerified) {'{'}<br />&nbsp;&nbsp;return redirect('/verify-email');<br />{'}'}</div>
                <div className="ob__sample-answer">
                  <b>{sampleDetail === 'simple' ? 'Why this exists' : 'Control-flow rationale'}</b>
                  <p>{sampleDetail === 'simple' ? 'It stops unverified users from entering an area that requires a confirmed email.' : 'The guard clause exits early, preserving the verified-only invariant before protected work begins.'}</p>
                </div>
              </div>
              <div className="ob__sample-actions"><button className={sampleDetail === 'simple' ? 'on' : ''} onClick={() => setSampleDetail('simple')}>Understand</button><button className={sampleDetail === 'technical' ? 'on' : ''} onClick={() => setSampleDetail('technical')}>Explain differently</button><span>Then test yourself and save it.</span></div>
              {nav()}
            </>
          )}

          {step === 2 && (
            <>
              <div className="ob__eyebrow">DEFAULT LEARNING DEPTH</div>
              <h2 className="ob__title">Start at the right level.</h2>
              <p className="ob__sub">You can change depth inside every explanation. This simply sets your starting point.</p>
              <div className="ob__choices ob__depths"><Choice selected={level === 'new'} title="New" detail="Plain language and the core idea." onClick={() => setLevel('new')} /><Choice selected={level === 'beginner'} title="Beginner" detail="A guided walkthrough." onClick={() => setLevel('beginner')} /><Choice selected={level === 'intermediate'} title="Intermediate" detail="Practical detail and trade-offs." onClick={() => setLevel('intermediate')} /><Choice selected={level === 'advanced'} title="Advanced" detail="Architecture and edge cases." onClick={() => setLevel('advanced')} /></div>
              <div className="ob__actions"><button className="ob__skip" onClick={back}>Back</button><button className="field-btn inline" onClick={() => { void window.unvibe.setSettings({ defaultExplanationLevel: level }); next(); }}>Continue</button></div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="ob__eyebrow">OPTIONAL, MACOS ONLY</div>
              <h2 className="ob__title">Use selected code anywhere.</h2>
              <p className="ob__sub">Enable this when you want to highlight code in another app and press <span className="kbd-lg">{prettyAccel(shortcut)}</span>. You can skip it and still paste code, choose files, and learn locally.</p>
              <PermRow />
              <div className="ob__actions"><button className="ob__skip" onClick={back}>Back</button><button className="field-btn inline" onClick={finish}>Enter Unvibe</button></div>
            </>
          )}
        </FadeIn>
      </div>
    </div>
  );
}

function LoginScreen({ onSignedIn, onSkip, shortcut }: { onSignedIn: (email: string) => void; onSkip: () => void; shortcut: string }) {
  return (
    <div className="login">
      <div className="login__bg" />
      <FadeIn animKey="login" stagger className="login__card">
        <div className="login__mark"><LogoMark size={48} stroke={1.6} /></div>
        <div className="login__brand">Unvibe</div>
        <h2 className="login__tag">Understand everything you ship.</h2>
        <div className="login__features">
          <div className="login__feature"><span className="lf-icon">1</span><span>Select code anywhere</span></div>
          <div className="login__feature"><span className="lf-icon">2</span><span>Press {prettyAccel(shortcut)}</span></div>
          <div className="login__feature"><span className="lf-icon">3</span><span>Read the explanation beside your work</span></div>
          <div className="login__feature"><span className="lf-icon">4</span><span>Save it on this Mac — sync later if you want</span></div>
        </div>
        <SignInForm onDone={onSignedIn} />
        <button className="login__skip" onClick={onSkip}>Keep it local for now →</button>
      </FadeIn>
    </div>
  );
}

function UsageChip({ usage, onPlan, compact = false }: {
  usage: { used: number; limit: number; remaining: number; resetsAt: string; plan?: string } | null;
  onPlan: () => void;
  compact?: boolean;
}) {
  if (!usage) return null;
  const low = usage.remaining <= 5;
  const out = usage.remaining <= 0;
  const planLabel = usage.plan === 'pro' ? 'Pro' : usage.plan === 'teams' ? 'Teams' : 'Free';
  return (
    <button
      type="button"
      className={`usage-chip${compact ? ' usage-chip--side' : ''}${out ? ' usage-chip--out' : low ? ' usage-chip--low' : ''}`}
      onClick={onPlan}
      title={`${planLabel} · resets ${new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`}
    >
      <span>{out ? '0 left' : `${usage.remaining} left`}</span>
      <small>{usage.used}/{usage.limit} · {planLabel}</small>
    </button>
  );
}

function Home({ shortcut, profile, feed, usage, onPlan }: {
  shortcut: string;
  profile: Profile | null;
  feed: FeedItem[];
  usage: { used: number; limit: number; remaining: number; resetsAt: string } | null;
  onPlan: () => void;
}) {
  return (
    <>
      <div className="topline">
        <h1>Keep it local.</h1>
      </div>
      {usage && usage.remaining <= 0 && (
        <div className="limit-banner" role="status">
          <div>
            <strong>You have reached your monthly explanation limit.</strong>
            <p>Your saved history and projects remain available. Allowance resets on {new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.</p>
          </div>
          <button type="button" className="primary-btn" onClick={onPlan}>Upgrade to Pro</button>
        </div>
      )}
      <div className="cols">
        <div className="main-col">
          <div className="hero">
            <h2>Understand everything you ship.</h2>
            <p>Highlight code in any app and Unvibe explains it right where you are working — pitched to how much you already know, and quiet until you ask.</p>
            <div className="row">
              <button onClick={() => window.unvibe.companionReview()} disabled={!!usage && usage.remaining <= 0}>Explain some code</button>
              <span className="kbd">or press {shortcut} anywhere</span>
            </div>
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

function LessonCode({ code, language }: { code: string; language?: string }) {
  return (
    <div className="lesson-code">
      <div className="lesson-code__bar"><span>{language || 'code'}</span><span>{code.split('\n').length} lines</span></div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

function Study({ history, queue, shortcut, onReview, onRestudy, onRefresh }: {
  history: LearningItem[]; queue: LearningItem[]; shortcut: string; onReview: () => void;
  onRestudy: (item: LearningItem, level: string) => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
}) {
  const lessons = history.filter((item) => Boolean(item.code));
  const [selectedId, setSelectedId] = useState<string | null>(lessons[0]?.id ?? queue[0]?.id ?? null);
  const selected = history.find((item) => item.id === selectedId) ?? queue.find((item) => item.id === selectedId) ?? null;
  const [level, setLevel] = useState(selected?.level || 'intermediate');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [askLeft, setAskLeft] = useState<number | null>(null);

  useEffect(() => {
    void window.unvibe.studyAskStatus().then((s) => {
      const status = s as { remaining: number };
      setAskLeft(status.remaining);
    });
  }, [selectedId]);

  useEffect(() => {
    if (selected?.level) setLevel(selected.level);
  }, [selected?.id, selected?.level]);

  const ask = async () => {
    if (!selected) return;
    setBusy(true); setError(''); setAnswer('');
    const result = await window.unvibe.studyAsk({ eventId: selected.id, question }) as { ok: boolean; answer?: string; error?: string; remaining?: number };
    setBusy(false);
    if (result.remaining !== undefined) setAskLeft(result.remaining);
    if (!result.ok) { setError(result.error ?? 'Could not ask.'); return; }
    setAnswer(result.answer ?? '');
    setQuestion('');
    void onRefresh();
  };

  const revisit = queue.filter((item) => item.outcome === 'needs_review').length;
  const catalog = lessons.length > 0 ? lessons : queue;

  return <>
    <div className="topline"><h1>Study</h1></div>
    <p className="lead">Everything you have already reviewed stays here. Re-open the code, pick a level again, and ask a short follow-up when you get stuck.</p>
    {catalog.length === 0 ? <LearningEmpty title="Your study shelf is empty." detail={`Select code and press ${shortcut}. After an explanation finishes, the code and teaching text land here for later study.`} onReview={onReview} /> : (
      <div className="study-layout">
        <aside className="study-rail">
          <div className="learning-summary study-summary">
            <div><strong>{revisit}</strong><span>needs review</span></div>
            <div><strong>{catalog.length}</strong><span>saved lessons</span></div>
          </div>
          <div className="learning-list">
            {catalog.slice(0, 40).map((item) => (
              <button
                key={item.id}
                type="button"
                className={`learning-card learning-card--pick ${item.id === selectedId ? 'on' : ''}`}
                onClick={() => { setSelectedId(item.id); setAnswer(''); setError(''); }}
              >
                <div>
                  <span className="learning-kicker">{item.dueLabel ?? item.level}</span>
                  <h2>{item.title}</h2>
                  <p>{item.meta || `${item.lines} lines · ${item.level}`}</p>
                </div>
              </button>
            ))}
          </div>
        </aside>
        <section className="study-pane">
          {!selected ? <p className="muted">Pick a lesson from the left.</p> : <>
            <div className="study-pane__head">
              <div>
                <span className="learning-kicker">{outcomeName(selected.outcome)}</span>
                <h2>{selected.title}</h2>
                <p>{selected.meta || `${selected.lines} lines · ${selected.level}`}</p>
              </div>
            </div>
            {selected.code ? <LessonCode code={selected.code} language={selected.language} /> : <p className="muted">No saved code on this item yet — restudy will try to reopen the file.</p>}
            {selected.explanation ? <div className="lesson-explain"><span className="learning-kicker">Last explanation</span><RichText className="lesson-explain__body" text={selected.explanation} /></div> : null}
            <div className="study-levels">
              <span className="learning-kicker">Restudy level</span>
              <div className="level-row">
                {STUDY_LEVELS.map((opt) => (
                  <button key={opt.id} type="button" className={level === opt.id ? 'on' : ''} onClick={() => setLevel(opt.id)}>{opt.label}</button>
                ))}
              </div>
              <button className="primary-btn" type="button" onClick={() => void onRestudy(selected, level)}>Explain again at this level</button>
            </div>
            <div className="study-assistant">
              <div className="study-assistant__head">
                <span className="learning-kicker">Study assistant</span>
                <span className="muted">{askLeft === null ? '' : `${askLeft} questions left today`}</span>
              </div>
              <p className="muted">Ask about this lesson only — short clarifying questions work best.</p>
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                placeholder="e.g. Why does this return early here?"
                disabled={busy || !selected.code}
              />
              <button className="soft-btn" type="button" disabled={busy || !question.trim() || !selected.code} onClick={() => void ask()}>
                {busy ? 'Thinking…' : 'Ask'}
              </button>
              {error ? <p className="form-error">{error}</p> : null}
              {answer ? <div className="lesson-explain"><span className="learning-kicker">Answer</span><div className="lesson-explain__body">{answer}</div></div> : null}
            </div>
          </>}
        </section>
      </div>
    )}
  </>;
}

function History({ items, onReview, onContinue }: { items: LearningItem[]; onReview: () => void; onContinue: (item: LearningItem) => void | Promise<void> }) {
  const [filter, setFilter] = useState<'all' | 'understood' | 'needs_review'>('all');
  const [query, setQuery] = useState('');
  const filtered = items.filter((item) => {
    const matchesFilter = filter === 'all' || (filter === 'understood' ? item.outcome === 'understood' : item.outcome === 'needs_review');
    const haystack = [item.title, item.meta, item.file, item.project, item.language, item.concept, item.explanation].filter(Boolean).join(' ').toLowerCase();
    return matchesFilter && haystack.includes(query.trim().toLowerCase());
  });
  const [openId, setOpenId] = useState<string | null>(filtered[0]?.id ?? items[0]?.id ?? null);
  const open = filtered.find((item) => item.id === openId) ?? filtered[0] ?? null;

  useEffect(() => {
    const next = items.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'understood') return item.outcome === 'understood';
      return item.outcome === 'needs_review';
    });
    if (next.length === 0) return;
    if (!openId || !next.some((item) => item.id === openId)) {
      setOpenId(next[0]!.id);
    }
  }, [filter, items, openId]);

  const counts = {
    all: items.length,
    understood: items.filter((i) => i.outcome === 'understood').length,
    needs_review: items.filter((i) => i.outcome === 'needs_review').length,
  };
  const continueItem = items.find((item) => item.outcome === 'needs_review') ?? items[0] ?? null;

  return (
    <div className="learn-page">
      <div className="topline learn-topline">
        <div>
          <h1>History</h1>
          <p className="lead lead--tight">Code and explanations from reviews on this Mac. Open any row to reread.</p>
        </div>
        {items.length > 0 ? (
          <div className="learn-filters" role="tablist" aria-label="Filter history">
            {([
              ['all', 'All', counts.all],
              ['understood', 'Understood', counts.understood],
              ['needs_review', 'Revisit', counts.needs_review],
            ] as const).map(([id, label, n]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={filter === id}
                className={filter === id ? 'on' : ''}
                onClick={() => setFilter(id)}
              >
                {label}<em>{n}</em>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {items.length > 0 ? (
        <div className="history-tools">
          <label className="history-search">
            <span className="sr-only">Search your explanations</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search explanations, files, concepts…" />
          </label>
          {continueItem ? <button type="button" className="history-continue" onClick={() => void onContinue(continueItem)}>Continue where you left off <span>→</span></button> : null}
        </div>
      ) : null}

      {items.length === 0 ? <LearningEmpty title="No history yet." detail="Your explanations will appear here after you select code and open a review." onReview={onReview} /> : (
        <div className="learn-shell">
          <aside className="learn-rail" aria-label="History list">
            {filtered.length === 0 ? (
              <p className="learn-rail__empty">Nothing in this filter.</p>
            ) : filtered.map((item) => {
              const active = item.id === (open?.id ?? openId);
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`learn-item ${active ? 'on' : ''}`}
                  onClick={() => setOpenId(item.id)}
                >
                  <div className="learn-item__top">
                    <time dateTime={item.ts}>{new Date(item.ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</time>
                    <span className={`pill pill--${item.outcome}`}>{outcomeName(item.outcome)}</span>
                  </div>
                  <strong>{item.title}</strong>
                  <span className="learn-item__meta">{item.level} · {item.lines} lines{item.language ? ` · ${item.language}` : ''}</span>
                </button>
              );
            })}
          </aside>

          <section className="learn-stage" aria-live="polite">
            {!open ? (
              <div className="learn-stage__empty">
                <p>Select a lesson on the left to read the code and explanation.</p>
              </div>
            ) : (
              <article className="learn-reader" key={open.id}>
                <header className="learn-reader__head">
                  <div>
                    <div className="learn-reader__chips">
                      <span className="pill">{open.level}</span>
                      <span className={`pill pill--${open.outcome}`}>{outcomeName(open.outcome)}</span>
                      <time dateTime={open.ts}>{new Date(open.ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</time>
                    </div>
                    <h2>{open.title}</h2>
                    <p>{open.file || open.project || open.meta || 'Saved lesson'}</p>
                  </div>
                </header>
                {open.code ? <LessonCode code={open.code} language={open.language} /> : (
                  <p className="muted">Code was not saved for this older entry. New reviews keep the snippet here.</p>
                )}
                {open.explanation ? (
                  <div className="lesson-explain">
                    <span className="learning-kicker">Explanation</span>
                    <RichText className="lesson-explain__body" text={open.explanation} />
                  </div>
                ) : (
                  <p className="muted">No explanation text on file yet for this one.</p>
                )}
              </article>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function Quiz({ history, queue, onReview, onRefresh }: {
  history: LearningItem[]; queue: LearningItem[]; onReview: () => void; onRefresh: () => void | Promise<void>;
}) {
  const candidates = [
    ...queue.filter((item) => item.code),
    ...history.filter((item) => item.code && !queue.some((q) => q.id === item.id)),
  ];
  const [selectedId, setSelectedId] = useState<string | null>(candidates[0]?.id ?? null);
  const selected = candidates.find((item) => item.id === selectedId) ?? null;
  const [card, setCard] = useState<{ question: string; options: string[]; conceptLabel: string; key: number } | null>(null);
  const [result, setResult] = useState<{ correct: boolean; rationale: string; answerIndex?: number } | null>(null);
  const [wrongPicks, setWrongPicks] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [left, setLeft] = useState<number | null>(null);
  const [cardKey, setCardKey] = useState(0);
  const [mode, setMode] = useState<'quick-check' | 'recall' | 'scenario'>('quick-check');

  useEffect(() => {
    void window.unvibe.quizStatus().then((s) => setLeft((s as { remaining: number }).remaining));
  }, []);

  useEffect(() => {
    if (!selectedId && candidates[0]) setSelectedId(candidates[0].id);
  }, [candidates, selectedId]);

  const selectLesson = (item: LearningItem) => {
    if (busy) return;
    setSelectedId(item.id);
    setError('');
    setCard(null);
    setResult(null);
    setWrongPicks([]);
  };

  const start = async (item: LearningItem) => {
    setSelectedId(item.id);
    setBusy(true); setError(''); setCard(null); setResult(null); setWrongPicks([]);
    const r = await window.unvibe.quizStart({ eventId: item.id, mode }) as {
      ok: boolean; question?: string; options?: string[]; conceptLabel?: string; error?: string; remaining?: number;
    };
    setBusy(false);
    if (r.remaining !== undefined) setLeft(r.remaining);
    if (!r.ok || !r.question || !r.options) { setError(r.error ?? 'Could not start quiz.'); return; }
    const nextKey = cardKey + 1;
    setCardKey(nextKey);
    setCard({ question: r.question, options: r.options, conceptLabel: r.conceptLabel ?? item.title, key: nextKey });
  };

  const answer = async (choice: number) => {
    if (!selected || result?.correct || wrongPicks.includes(choice)) return;
    setBusy(true); setError('');
    const r = await window.unvibe.quizAnswer({ eventId: selected.id, choice }) as {
      ok: boolean; correct?: boolean; rationale?: string; answerIndex?: number; error?: string;
    };
    setBusy(false);
    if (!r.ok) { setError(r.error ?? 'Could not grade.'); return; }
    if (!r.correct) {
      setWrongPicks((prev) => (prev.includes(choice) ? prev : [...prev, choice]));
      setResult({ correct: false, rationale: r.rationale ?? 'Sorry — wrong. Pick another option.' });
      void onRefresh();
      return;
    }
    setResult({
      correct: true,
      rationale: r.rationale ?? 'You got it.',
      answerIndex: r.answerIndex ?? choice,
    });
    void onRefresh();
  };

  const letters = 'ABCDEFGH';

  return (
    <div className="learn-page">
      <div className="topline learn-topline">
        <div>
          <h1>Quiz</h1>
          <p className="lead lead--tight">Choose a lesson, then start a card. Wrong answers stay open so you can keep trying.</p>
        </div>
        {left !== null ? <span className="learn-quota">{left} left today</span> : null}
      </div>

      {candidates.length === 0 ? <LearningEmpty title="Nothing to quiz yet." detail="Finish an explanation so Unvibe can keep the code locally. Then quiz cards can be built from that lesson." onReview={onReview} /> : (
        <div className="learn-shell learn-shell--quiz">
          <aside className="learn-rail" aria-label="Lessons to quiz">
            <p className="learn-rail__label">Lessons</p>
            {candidates.slice(0, 24).map((item) => {
              const active = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`learn-item ${active ? 'on' : ''}`}
                  disabled={busy}
                  onClick={() => selectLesson(item)}
                >
                  <div className="learn-item__top">
                    <span className="learning-kicker">{item.level}</span>
                    {active && card ? <span className="pill pill--live">Active</span> : null}
                    {active && busy ? <span className="pill pill--live">Building</span> : null}
                  </div>
                  <strong>{item.title}</strong>
                  <span className="learn-item__meta">{item.dueLabel ? `${item.dueLabel} · ` : ''}{item.lines} lines</span>
                </button>
              );
            })}
          </aside>

          <section className="learn-stage quiz-stage" aria-live="polite">
            <div className="quiz-mode-bar" role="radiogroup" aria-label="Quiz mode">
              {([
                ['quick-check', 'Quick check'],
                ['recall', 'Recall'],
                ['scenario', 'Scenario'],
              ] as const).map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={mode === id} className={mode === id ? 'on' : ''} disabled={busy} onClick={() => setMode(id)}>{label}</button>)}
              <span className="quiz-mode-bar__note">Adaptive to your last result</span>
            </div>
            {card ? (
              <div className="quiz-card" key={card.key}>
                <header className="quiz-card__head">
                  <span className="learning-kicker">{card.conceptLabel || 'Check'}</span>
                  {selected ? (
                    <button className="ghost-link" type="button" disabled={busy} onClick={() => selected && void start(selected)}>
                      New card
                    </button>
                  ) : null}
                </header>
                <h2>{card.question}</h2>
                {selected?.code ? (
                  <details className="quiz-code">
                    <summary>Show the code</summary>
                    <LessonCode code={selected.code.slice(0, 2_400)} language={selected.language} />
                  </details>
                ) : null}
                <div className="quiz-options" role="list">
                  {card.options.map((opt, idx) => {
                    const isWrong = wrongPicks.includes(idx);
                    const isCorrect = Boolean(result?.correct && result.answerIndex === idx);
                    let cls = '';
                    if (isCorrect) cls = 'correct';
                    else if (isWrong) cls = 'wrong';
                    else if (result?.correct) cls = 'dimmed';
                    return (
                      <button
                        key={`${card.key}-${idx}`}
                        type="button"
                        className={cls}
                        disabled={busy || isWrong || Boolean(result?.correct)}
                        onClick={() => void answer(idx)}
                      >
                        <span className="quiz-opt-letter" aria-hidden="true">{letters[idx] ?? String(idx + 1)}</span>
                        <span className="quiz-opt-text">{opt}</span>
                      </button>
                    );
                  })}
                </div>
                {result ? (
                  <div
                    className={`quiz-result ${result.correct ? 'ok' : 'bad'}`}
                    key={result.correct ? 'ok' : `try-${wrongPicks.join('-')}`}
                  >
                    <span className="quiz-result__eyebrow">{result.correct ? 'Nice work' : 'Keep going'}</span>
                    <strong>{result.correct ? 'Congrats!' : 'Not that one'}</strong>
                    <p>{result.rationale || (result.correct ? 'You got it. That one sticks a little better now.' : 'No stress — pick another option. The card stays open.')}</p>
                    {result.correct ? (
                      <button className="soft-btn" type="button" onClick={() => selected && void start(selected)}>Another card</button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="learn-stage__empty quiz-stage__idle">
                <span className="quiz-stage__mark" aria-hidden="true"><Icon d={IC.quiz} /></span>
                <h2>{busy ? 'Building your card…' : selected ? selected.title : 'Ready when you are'}</h2>
                <p>
                  {busy
                    ? 'Unvibe is writing a short check from the code you already reviewed.'
                    : selected
                      ? 'Start a card for this lesson. Wrong answers stay open so you can keep trying.'
                      : 'Choose a lesson on the left, then start a card.'}
                </p>
                {error ? <p className="form-error quiz-stage__error">{error}</p> : null}
                {selected && !busy ? (
                  <button className="primary-btn" type="button" onClick={() => void start(selected)}>
                    Quiz this lesson
                  </button>
                ) : null}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function LearningEmpty({ title, detail, onReview }: { title: string; detail: string; onReview: () => void }) {
  return <div className="learning-empty"><div className="stub__icon"><Icon d={IC.spark} /></div><h2>{title}</h2><p>{detail}</p><button className="primary-btn" onClick={onReview}>Explain some code</button></div>;
}

function Plan() {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [available, setAvailable] = useState(false);
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const [message, setMessage] = useState('Loading plan…');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const result = await window.unvibe.billingOverview() as { ok: boolean; data?: { overview: BillingOverview; checkoutAvailable: boolean }; error?: string };
    if (!result.ok || !result.data) { setMessage(result.error ?? 'Could not load plan.'); return; }
    setOverview(result.data.overview); setAvailable(result.data.checkoutAvailable); setMessage('');
  };
  useEffect(() => { void load(); }, []);

  const checkout = async () => {
    setBusy(true); setMessage('');
    const result = await window.unvibe.startBillingCheckout({ plan: 'pro', interval, seats: 1 }) as { ok: boolean; error?: string };
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
        <div className="plan-toggle" aria-label="Billing interval"><button type="button" className={interval === 'monthly' ? 'on' : ''} onClick={() => setInterval('monthly')} aria-pressed={interval === 'monthly'}>Monthly</button><button type="button" className={interval === 'annual' ? 'on' : ''} onClick={() => setInterval('annual')} aria-pressed={interval === 'annual'}>Annual <span>Save 25%</span></button></div>
        <p><strong>Pro annual:</strong> $72/year — about $6/month. Save 25% vs $8/month billed monthly.</p>
      </div>
      {!available && <div className="plan-message quiet">Checkout is disabled until billing is configured on the server.</div>}
      <div className="plan-options plan-options--two">
        <article><b>Free · understand the code in front of you</b><h2>$0</h2><p className="plan-price-note">No credit card required</p><ul className="plan-feature-list">{PLAN_FEATURES.free.map((feature) => <li key={feature}><Icon d={IC.check} />{feature}</li>)}</ul><button className="soft-btn" disabled>Included</button></article>
        <article className="featured"><b>Pro · understand the complete project</b><h2>{interval === 'monthly' ? '$8/month' : '$72/year'}</h2><p className="plan-price-note">{interval === 'monthly' ? 'Best for individuals · billed monthly' : 'About $6/month · billed $72/year · save 25%'}</p><ul className="plan-feature-list">{PLAN_FEATURES.pro.map((feature) => <li key={feature}><Icon d={IC.check} />{feature}</li>)}</ul><button className="primary-btn" onClick={() => void checkout()} disabled={busy || !available}>Upgrade to Pro</button></article>
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

function AiSettingsPanel({ settings, onSettings, onNotice }: {
  settings: Settings;
  onSettings: (patch: Partial<Settings>) => Promise<string | undefined>;
  onNotice: (message: string) => void;
}) {
  const [keyDraft, setKeyDraft] = useState('');
  const [hint, setHint] = useState<string | null>(null);
  const [present, setPresent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [costs, setCosts] = useState<Array<{ level: string; samples: Array<{ lines: number; label: string }> }> | null>(null);
  const [providers, setProviders] = useState<Array<{ id: Settings['aiProvider']; label: string; blurb: string; model?: string }>>([]);
  const provider = settings.aiProvider ?? 'gemini';
  const selected = providers.find((m) => m.id === provider);

  const refresh = async () => {
    const status = await window.unvibe.aiKeyStatus() as { ok: boolean; data?: { present: boolean; hint: string | null } };
    if (status.ok && status.data) { setPresent(status.data.present); setHint(status.data.hint); }
    const catalog = await window.unvibe.aiModels() as { ok: boolean; data?: Array<{ id: Settings['aiProvider']; label: string; blurb: string; model?: string }> };
    if (catalog.ok && catalog.data) setProviders(catalog.data);
    const overview = await window.unvibe.aiCostOverview(provider) as { ok: boolean; data?: Array<{ level: string; samples: Array<{ lines: number; label: string }> }> };
    if (overview.ok && overview.data) setCosts(overview.data);
  };
  useEffect(() => { void refresh(); }, [provider]);

  const saveKey = async () => {
    setBusy(true); setErr('');
    const r = await window.unvibe.aiSetKey(keyDraft) as { ok: boolean; error?: string; provider?: Settings['aiProvider'] };
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? 'Could not save key.'); return; }
    setKeyDraft('');
    if (r.provider) await onSettings({ aiProvider: r.provider });
    onNotice('API key saved on this Mac only.');
    await refresh();
  };
  const clearKey = async () => {
    setBusy(true);
    await window.unvibe.aiClearKey();
    setBusy(false);
    onNotice('Local API key removed.');
    await refresh();
  };

  return (
    <>
      <div className="setrow" style={{ display: 'block' }}>
        <div className="sl">Your own API key</div>
        <div className="sd" style={{ marginBottom: 12 }}>
          Works with Gemini, OpenAI, Anthropic, Grok, DeepSeek, or Kimi. The key stays encrypted on this Mac and is never sent to Unvibe.
        </div>
        <div className="ai-key-row">
          <input
            className="field"
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={present ? `Key on file (${hint})` : 'Paste any supported API key'}
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
          />
          <button className="act" disabled={busy || !keyDraft.trim()} onClick={() => void saveKey()}>{busy ? 'Saving…' : 'Save key'}</button>
          {present && <button className="act" disabled={busy} onClick={() => void clearKey()}>Remove</button>}
        </div>
        {err && <div className="field-err">{err}</div>}
      </div>
      <div className="setrow">
        <div>
          <div className="sl">Use my own AI</div>
          <div className="sd">Always call your provider from this Mac instead of Unvibe cloud AI.</div>
        </div>
        <Toggle on={Boolean(settings.useOwnAi)} onClick={() => void onSettings({ useOwnAi: !settings.useOwnAi })} />
      </div>
      <div className="setrow">
        <div>
          <div className="sl">Provider</div>
          <div className="sd">Each option uses a cheap default model. Cost estimates update below.</div>
        </div>
        <select
          className="sel-input"
          value={provider}
          onChange={(e) => void onSettings({ aiProvider: e.target.value as Settings['aiProvider'] })}
        >
          {(providers.length ? providers : [
            { id: 'gemini' as const, label: 'Gemini' },
            { id: 'openai' as const, label: 'OpenAI' },
            { id: 'anthropic' as const, label: 'Anthropic' },
            { id: 'deepseek' as const, label: 'DeepSeek' },
            { id: 'grok' as const, label: 'Grok' },
            { id: 'kimi' as const, label: 'Kimi' },
          ]).map((m) => (
            <option key={m.id} value={m.id}>{m.label}{m.id === 'gemini' ? ' (cheapest)' : ''}</option>
          ))}
        </select>
      </div>
      <div className="setrow" style={{ display: 'block' }}>
        <div className="sl">Rough cost per explanation · {selected?.label ?? provider}{selected?.model ? ` · ${selected.model}` : ''}</div>
        <div className="sd" style={{ marginBottom: 10 }}>
          Estimates update when you change the provider. List prices only — your provider bill may differ.
        </div>
        {costs ? (
          <div className="cost-table" role="table" aria-label="Estimated cost by mode and lines">
            <div className="cost-row head" role="row">
              <span>Mode</span><span>~50 lines</span><span>~200 lines</span><span>~500 lines</span>
            </div>
            {costs.map((row) => (
              <div className="cost-row" role="row" key={row.level}>
                <span>{row.level}</span>
                {row.samples.map((s) => <span key={s.lines}>{s.label}</span>)}
              </div>
            ))}
          </div>
        ) : <div className="sd">Loading estimates…</div>}
        <p className="cost-note">
          {selected?.blurb ?? 'Pick a provider and paste its API key. We keep the cheap default models.'}
        </p>
      </div>
    </>
  );
}

function OverlayPreview({ position, dimmed }: { position: string; dimmed: number }) {
  return <div className="settings-preview" aria-label="Live preview of the Unvibe overlay">
    <div className="settings-preview__window"><span /><span /><span /></div>
    <div className={`settings-preview__bar settings-preview__bar--${position}`}><LogoMark size={13} stroke={2} /><b>Unvibe</b><em>Ready to explain</em></div>
    <div className="settings-preview__card" style={{ opacity: dimmed }}><span>Selected code</span><b>verifyUser()</b><small>Intermediate · Local filter on</small></div>
  </div>;
}

function IntegrationsPanel() {
  const [items, setItems] = useState<Array<{ id: string; name: string; detail: string; state: 'detected' | 'available' | 'not-installed' }> | null>(null);
  useEffect(() => { void window.unvibe.integrations().then((result) => setItems(result as typeof items)); }, []);
  if (!items) return <div className="settings-empty">Checking this Mac…</div>;
  return <div className="integration-list">{items.map((item) => <div className="integration-row" key={item.id}><div><b>{item.name}</b><small>{item.detail}</small></div><span className={`integration-state ${item.state}`}>{item.state === 'not-installed' ? 'Not installed' : item.state === 'detected' ? 'Detected' : 'Available'}</span></div>)}</div>;
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
          <div className="settings-brand"><LogoMark size={19} /><span>Unvibe</span></div>
          <div className="mh">PREFERENCES</div>
          {['General', 'Appearance', 'Shortcut & Capture', 'Learning', 'Privacy & Data'].map((t) => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}><span className="settings-nav-icon">{t === 'General' ? '⌘' : t === 'Appearance' ? '◐' : t === 'Shortcut & Capture' ? '⌁' : t === 'Learning' ? '✦' : '⌂'}</span>{t}</button>)}
          <div className="mh" style={{ paddingTop: 18 }}>UNVIBE</div>
          {['Integrations', 'AI', 'Account & Plan', 'About'].map((t) => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}><span className="settings-nav-icon">{t === 'Integrations' ? '↗' : t === 'AI' ? '◌' : t === 'Account & Plan' ? '◈' : 'i'}</span>{t}</button>)}
          <div className="ver">Unvibe v{info.version}</div>
        </div>
        <div className="mbody">
          <h2>{tab}</h2>

          {tab === 'AI' && <AiSettingsPanel settings={settings} onSettings={onSettings} onNotice={onNotice} />}

          {tab === 'General' && (
            <>
              <div className="setrow"><div><div className="sl">Launch at login</div><div className="sd">Start Unvibe automatically when you log in to your Mac.</div></div><Toggle on={settings.launchAtLogin} onClick={() => onSettings({ launchAtLogin: !settings.launchAtLogin })} /></div>
              <div className="setrow"><div><div className="sl">Bar notifications</div><div className="sd">Short, rate-limited messages when an explanation is ready.</div></div><Toggle on={settings.notifications} onClick={() => onSettings({ notifications: !settings.notifications })} /></div>
              <div className="setrow"><div><div className="sl">Quiet hours</div><div className="sd">Silence notifications overnight.</div></div><Toggle on={settings.quietHours.enabled} onClick={() => onSettings({ quietHours: { ...settings.quietHours, enabled: !settings.quietHours.enabled } })} /></div>
              {settings.quietHours.enabled && <div className="setrow"><div><div className="sl">From / to</div><div className="sd">24-hour times.</div></div><div className="danger-row"><input className="time-input" type="time" value={settings.quietHours.start} onChange={(e) => onSettings({ quietHours: { ...settings.quietHours, start: e.target.value } })} /><input className="time-input" type="time" value={settings.quietHours.end} onChange={(e) => onSettings({ quietHours: { ...settings.quietHours, end: e.target.value } })} /></div></div>}
            </>
          )}

          {tab === 'Appearance' && (
            <>
              <OverlayPreview position={settings.barPosition} dimmed={settings.widgetOpacityInactive} />
              <div className="settings-section-label">OVERLAY PREVIEW</div>
              <div className="setrow"><div><div className="sl">App appearance</div><div className="sd">Choose light, dark, or follow your Mac automatically.</div></div><select className="sel-input" value={settings.theme} onChange={(e) => onSettings({ theme: e.target.value as Settings['theme'] })}><option value="system">Follow system</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
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

          {tab === 'Shortcut & Capture' && (
            <>
              <div className="setrow"><div><div className="sl">Activation shortcut</div><div className="sd">Select code, then press this to open an explanation.</div>{shortcutErr && <div className="field-err">{shortcutErr}</div>}</div><button className={`act kbd-cap${recording ? ' rec' : ''}`} onClick={() => { setShortcutErr(''); setRecording(true); }}>{recording ? 'Press keys…' : prettyAccel(settings.shortcut)}</button></div>
              <PermRow compact />
            </>
          )}

          {tab === 'Learning' && <><div className="setrow"><div><div className="sl">Default explanation depth</div><div className="sd">The starting depth for a new explanation. You can always switch it in the overlay.</div></div><select className="sel-input" value={settings.defaultExplanationLevel} onChange={(e) => onSettings({ defaultExplanationLevel: e.target.value as Settings['defaultExplanationLevel'] })}>{STUDY_LEVELS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="setrow"><div><div className="sl">Learning records</div><div className="sd">Explanations, quiz results, and concepts save immediately on this Mac.</div></div></div></>}

          {tab === 'Integrations' && <IntegrationsPanel />}

          {tab === 'Privacy & Data' && (
            <>
              <div className="setrow"><div><div className="sl">On-device secret scan</div><div className="sd">Every selection is scanned for keys and tokens before it leaves your Mac. Always on.</div></div><button className="act" disabled>On</button></div>
              <div className="setrow"><div><div className="sl">The service never reads your repo</div><div className="sd">Only the exact, filtered snippet you review is sent — nothing else.</div></div></div>
              <div className="setrow"><div><div className="sl">Privacy policy</div><div className="sd">Read how Unvibe handles your code and data on our website.</div></div><button className="act" onClick={() => window.unvibe.openPrivacy()}>Read →</button></div>
              <div className="setrow"><div><div className="sl">Support</div><div className="sd">support@unvibe.site · preston@unvibe.site</div></div><button className="act" onClick={() => void window.open('mailto:support@unvibe.site')}>Email →</button></div>
            </>
          )}

          {tab === 'Account & Plan' && <AccountPanel account={account} onChange={onAccountChange} onDeleted={onAccountDeleted} onNotice={onNotice} />}
          {tab === 'About' && <><div className="settings-about-mark"><LogoMark size={38} /></div><div className="setrow"><div><div className="sl">Unvibe for macOS</div><div className="sd">Version {info.version}. A private learning layer for understanding AI-generated code.</div></div></div><div className="setrow"><div><div className="sl">Need help?</div><div className="sd">preston@unvibe.site</div></div><button className="act" onClick={() => void window.open('mailto:preston@unvibe.site')}>Email →</button></div></>}
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
  const [queue, setQueue] = useState<LearningItem[]>([]);
  const [sync, setSync] = useState<SyncStatus>({ phase: 'local', pending: 0 });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [gate, setGate] = useState<'checking' | 'onboarding' | 'login' | 'app'>('checking');
  const [usageLine, setUsageLine] = useState<{ used: number; limit: number; remaining: number; resetsAt: string; plan?: string } | null>(null);

  const refresh = async () => {
    try {
      const [acct, prof, fd, hist, st, syncState, usage, q] = await Promise.all([
        window.unvibe.account() as Promise<Account>,
        window.unvibe.profile() as Promise<Profile>,
        window.unvibe.feed(8) as Promise<FeedItem[]>,
        window.unvibe.history(100) as Promise<LearningItem[]>,
        window.unvibe.getSettings() as Promise<Settings>,
        window.unvibe.syncStatus() as Promise<SyncStatus>,
        window.unvibe.usageGet() as Promise<{ ok: boolean; data?: { used: number; limit: number; remaining: number; resetsAt: string; plan: string } }>,
        window.unvibe.reviewQueue(20) as Promise<LearningItem[]>,
      ]);
      setAccount(acct); setProfile(prof); setFeed(fd); setHistory(hist); setQueue(q); setSettings(st); setSync(syncState);
      setUsageLine(usage.ok && usage.data
        ? { used: usage.data.used, limit: usage.data.limit, remaining: usage.data.remaining, resetsAt: usage.data.resetsAt, plan: usage.data.plan }
        : { used: 0, limit: 50, remaining: 50, resetsAt: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString(), plan: 'local' });
      return { acct, st };
    } catch {
      const st = await window.unvibe.getSettings() as Settings;
      setSettings(st);
      return { acct: null, st };
    }
  };

  useEffect(() => {
    void window.unvibe.appInfo().then((i) => setInfo(i as typeof info));
    void (async () => {
      try {
        const { acct, st } = await refresh();
        setGate(!st.onboarded ? 'onboarding' : acct ? 'app' : 'login');
      } catch {
        setGate('login');
      }
    })();
    const onFocus = () => void refresh();
    window.unvibe.onSyncStatus((next) => setSync(next as SyncStatus));
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const [themeIsDark, setThemeIsDark] = useState(false);
  useEffect(() => {
    const preference = settings?.theme ?? 'system';
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = preference === 'dark' || (preference === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      setThemeIsDark(dark);
    };
    apply();
    if (preference !== 'system') return;
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
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
    return (<><div className="titlebar" /><Onboarding shortcut={settings?.shortcut ?? 'CommandOrControl+U'} onDone={async () => { await refresh(); setGate('app'); }} /></>);
  }
  if (gate === 'login') {
    return (<><div className="titlebar" /><LoginScreen shortcut={settings?.shortcut ?? 'CommandOrControl+U'} onSignedIn={async () => { await refresh(); setGate('app'); }} onSkip={() => setGate('app')} /></>);
  }

  return (
    <>
      <div className="titlebar" />
      <div className="layout">
        <aside className="side fade-in fade-in--side">
          <div className="brand"><span className="mark"><LogoMark size={22} /></span><span className="name">Unvibe</span><span className="badge">Beta</span></div>
          <UsageChip usage={usageLine} onPlan={() => setPage('Plan')} compact />
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
          <div className="promo"><div className="t">Start free. <em>Learn daily.</em></div><div className="d">50 explanations each month on Free · 100 on Pro. AI access included—no provider API key needed.</div></div>
          <nav className="nav">{FOOT.map((f) => <button key={f.id} onClick={() => (f.id === 'Settings' ? setSettingsOpen(true) : flash(f.toast))}><Icon d={f.icon} />{f.id}</button>)}</nav>
        </aside>
        <main className="content">
          <div className="content-tools">
            <button
              type="button"
              className="theme-toggle"
              aria-label={themeIsDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={themeIsDark ? 'Light mode' : 'Dark mode'}
              onClick={() => void applySettings({ theme: themeIsDark ? 'light' : 'dark' })}
            >
              {themeIsDark ? '☀' : '☾'}
            </button>
            <span className="topline__logo" aria-hidden="true">
              <LogoMark size={22} stroke={1.8} />
            </span>
          </div>
          <div className={`page${page === 'History' || page === 'Quiz' ? ' page--learn' : ''}`}>
            <FadeIn animKey={page} stagger={page !== 'History' && page !== 'Quiz'}>
              {page === 'Home' ? <Home shortcut={shortcutLabel} profile={profile} feed={feed} usage={usageLine} onPlan={() => setPage('Plan')} />
                : page === 'Study' ? <Study
                  history={history}
                  queue={queue}
                  shortcut={shortcutLabel}
                  onReview={() => window.unvibe.companionReview()}
                  onRefresh={() => void refresh()}
                  onRestudy={async (item, level) => {
                    const r = await window.unvibe.reopenLearningItem({ ...item, level }) as { ok?: boolean; cancelled?: boolean; error?: string };
                    if (!r?.ok && !r?.cancelled) flash(r?.error ?? 'Could not reopen that lesson.');
                  }}
                />
                : page === 'History' ? <History
                  items={history}
                  onReview={() => window.unvibe.companionReview()}
                  onContinue={async (item) => {
                    const r = await window.unvibe.reopenLearningItem({ ...item, level: item.outcome === 'needs_review' ? 'beginner' : item.level }) as { ok?: boolean; cancelled?: boolean; error?: string };
                    if (!r?.ok && !r?.cancelled) flash(r?.error ?? 'Could not reopen that lesson.');
                  }}
                />
                : page === 'Quiz' ? <Quiz
                  history={history}
                  queue={queue}
                  onReview={() => window.unvibe.companionReview()}
                  onRefresh={() => void refresh()}
                />
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
