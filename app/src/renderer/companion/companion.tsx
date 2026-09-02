import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { LogoMark } from '../shared/logo';
import { Learn } from './learn';
import { Chat } from './chat';
import { Gift } from './gift';
import { playUiTone } from '../shared/tones';
import { BETA_SURVEY_URL, limitOfferCopy } from '../shared/limitOffer';
import { prettyShortcut } from '../shared/prettyShortcut';

type PageId = 'Home' | 'Learn' | 'Study' | 'History' | 'Quiz' | 'Chat' | 'Progress' | 'Plan' | 'Gift' | 'Projects' | 'Concepts' | 'Notebook' | 'Briefings' | 'Library' | 'Profile';

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
  barVisibility: 'always' | 'during-review'; barHoverPreview: boolean;
  barHoverDelayMs: number;
  rotateIslandStats: boolean;
  followActiveDisplay: boolean; soundEffects: boolean;
  soundVolume: number; soundStyle: 'soft' | 'pixel';
  widgetOpacityInactive: number; inactiveBehavior: string;
  launchAtLogin: boolean; theme: 'system' | 'light' | 'dark'; notifications: boolean;
  quietHours: { enabled: boolean; start: string; end: string };
  defaultExplanationLevel: typeof STUDY_LEVELS[number]['id'];
  displayName: string;
  profileEmail: string;
  useOwnAi: boolean;
  aiProvider: 'gemini' | 'anthropic' | 'openai' | 'grok' | 'deepseek' | 'kimi';
  sidebarWidth: number;
}
interface BillingOverview {
  workspace: { id: string; name: string; type: 'personal' | 'team'; role: string };
  subscription: { plan: 'free' | 'pro' | 'teams'; interval: 'monthly' | 'annual' | null; status: string; seats: number; currentPeriodEnd?: string };
  usage: Array<{ kind: string; used: number; limit: number; remaining: number; resetsAt: string }>;
  canManageBilling: boolean;
  hasBillingAccount: boolean;
}

interface AppUsageLine {
  used: number;
  limit: number;
  remaining: number;
  resetsAt: string;
  plan?: string;
  selections?: { used: number; limit: number; remaining: number; resetsAt: string };
}

type PlanId = 'free' | 'pro' | 'teams' | 'local' | 'trial' | 'full';

function asPlanId(value: string | undefined): PlanId {
  if (value === 'pro' || value === 'teams' || value === 'full' || value === 'trial' || value === 'local') return value;
  return 'free';
}

function planDisplayName(plan: PlanId): string {
  if (plan === 'pro' || plan === 'full') return 'Pro';
  if (plan === 'teams') return 'Team';
  if (plan === 'trial') return 'Trial';
  return 'Free';
}

function planPriceLabel(plan: PlanId, interval: 'monthly' | 'annual' | null): string {
  if (plan === 'full') return 'Included';
  if (plan === 'pro') return interval === 'annual' ? '$72/yr' : '$8/mo';
  if (plan === 'teams') return interval === 'annual' ? '$90/seat/yr' : '$10/seat';
  return '$0';
}

function daysUntil(iso: string): number {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000));
}

function resetLabel(iso: string): string {
  const date = new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const days = daysUntil(iso);
  return `Usage limits reset on ${date} (${days} day${days === 1 ? '' : 's'} left)`;
}

function percentLeft(remaining: number, limit: number): number {
  if (limit <= 0) return 100;
  return Math.max(0, Math.min(100, Math.round((remaining / limit) * 100)));
}

function percentUsed(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((used / limit) * 100)));
}

function usageKindLabel(kind: string): string {
  if (kind === 'ai_explanation') return 'Explanations';
  if (kind === 'project_question') return 'Follow-up questions';
  if (kind === 'indexed_project') return 'Active projects';
  if (kind === 'selected_code') return 'Selected code';
  return kind.replaceAll('_', ' ');
}

type UsageMeter = { kind: string; used: number; limit: number; remaining: number; resetsAt: string };

function collectUsageMeters(
  overview: BillingOverview | null,
  local: AppUsageLine | null,
): UsageMeter[] {
  const meters: UsageMeter[] = [];
  const fromOverview = overview?.usage.filter((line) =>
    line.kind === 'ai_explanation' || line.kind === 'project_question',
  ) ?? [];
  if (fromOverview.length) {
    meters.push(...fromOverview);
  } else if (local) {
    meters.push({
      kind: 'ai_explanation',
      used: local.used,
      limit: local.limit,
      remaining: local.remaining,
      resetsAt: local.resetsAt,
    });
  }
  if (local?.selections) {
    meters.push({ kind: 'selected_code', ...local.selections });
  }
  return meters;
}

const IC = {
  home: 'M3 9.5 10 3l7 6.5V17H3z M8 17v-5h4v5',
  progress: 'M4 16V9 M10 16V4 M16 16v-6',
  projects: 'M3 6a1 1 0 0 1 1-1h4l2 2h6a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z',
  study: 'M4 4h9a3 3 0 0 1 3 3v9a3 3 0 0 0-3-3H4z M4 4v9',
  history: 'M10 3a7 7 0 1 0 7 7 M10 6v4l3 2',
  quiz: 'M10 3a7 7 0 1 0 7 7 M8.2 8.1a2 2 0 1 1 3.4 1.4c-.8.7-1.6 1.1-1.6 2.3 M10 15h.01',
  chat: 'M4 5h12v8H8l-4 4z',
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
  gift: 'M4 9h12v8H4z M10 9v8 M4 9l6-5 6 5 M7 5c0-1.4 3-1.4 3 1.2 M13 5c0-1.4-3-1.4-3 1.2',
};

const PAGES: Record<Exclude<PageId, 'Home' | 'Progress' | 'Plan' | 'Gift' | 'Learn' | 'Study' | 'History' | 'Quiz' | 'Chat'>, PageDef> = {
  Projects: { id: 'Projects', icon: IC.projects, lead: 'Every repository you point Unvibe at, distilled into something you can actually hold in your head.', features: [
    { icon: IC.eye, t: 'Plain-English summaries', d: 'What each repo is for and how it earns its keep — no folder-tree dumps.' },
    { icon: IC.layers, t: 'How it fits together', d: 'The moving parts and where they connect, so a new codebase stops feeling like a maze.' },
    { icon: IC.check, t: 'How much you grasp', d: 'A running sense of which corners you understand and which you have not opened yet.' },
    { icon: IC.map, t: 'Where to start reading', d: 'Unvibe points you at the file a newcomer should open first.' },
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
  { id: 'Learn', icon: IC.study },
  { id: 'History', icon: IC.history },
  { id: 'Quiz', icon: IC.quiz },
  { id: 'Chat', icon: IC.chat },
  { id: 'Progress', icon: IC.progress },
  { id: 'Plan', icon: IC.plan },
  { id: 'Gift', icon: IC.gift },
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
  return prettyShortcut(a);
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
function dayGroup(iso: string): string {
  const when = new Date(iso);
  const today = new Date();
  const start = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((start(today) - start(when)) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return when.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
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
      <div className="perm-why">In VS Code and Cursor, the Unvibe Desktop Bridge uses ⌘U and reads the selection directly. Everywhere else, select code and press Control+U. That path needs Accessibility.</div>
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

function playSetupTone(kind: 'step' | 'success', volume = 0.3, style: 'soft' | 'pixel' = 'soft'): void {
  playUiTone(kind, volume, style);
}

function looksLikeEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function Onboarding({ shortcut, soundEffects, soundVolume, soundStyle, onDone }: { shortcut: string; soundEffects: boolean; soundVolume: number; soundStyle: 'soft' | 'pixel'; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [nameError, setNameError] = useState('');
  const steps = ['Welcome', 'Your profile', 'Mac access'];

  const next = () => {
    if (soundEffects) playSetupTone('step', soundVolume, soundStyle);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const finish = () => { if (soundEffects) playSetupTone('success', soundVolume, soundStyle); void window.unvibe.completeOnboarding(); onDone(); };
  const saveProfile = () => {
    const name = displayName.replace(/\s+/g, ' ').trim();
    const email = profileEmail.trim();
    if (!name) {
      setNameError('Add a name so chat can greet you.');
      return false;
    }
    if (!looksLikeEmail(email)) {
      setNameError('Email needs an @ and a domain, or leave it blank.');
      return false;
    }
    setNameError('');
    void window.unvibe.setSettings({ displayName: name, profileEmail: email });
    return true;
  };
  const advanceName = () => {
    if (!saveProfile()) return;
    next();
  };
  const advance = () => {
    if (step === 1) {
      advanceName();
      return;
    }
    if (step === steps.length - 1) finish();
    else next();
  };

  // This is a presentation-sized first-run experience, but it should still feel
  // quick for keyboard-first developers. Inputs retain their own native keys.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, select, textarea, button')) return;
      if (event.key === 'ArrowRight' || event.key === 'Enter') { event.preventDefault(); advance(); }
      if (event.key === 'ArrowLeft' || event.key === 'Escape') { event.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const nav = (continueLabel = 'Continue', onContinue = next, continueDisabled = false) => (
    <div className="ob__actions">
      <button className="ob__skip" disabled={step === 0} onClick={back}>Back</button>
      <button className="field-btn inline" disabled={continueDisabled} onClick={onContinue}>{continueLabel}</button>
    </div>
  );

  return (
    <div className={`ob ob--scene-${step}`}>
      <div className="ob__scene" aria-hidden="true">
        <div className="sanFranWash" />
        <div className="ob__scene-grid" />
        <div className="ob__scene-strip">
          <div><b>▶</b><LogoMark size={15} stroke={2} /></div>
          <span className="ob__scene-camera" />
          <div><span>{step === 0 ? '⌘U' : step === 1 ? 'hi' : 'Mac'}</span><b>⌂</b></div>
        </div>
        <div className="ob__scene-code">function understand(code) {'{'}<br />&nbsp;&nbsp;return context + clarity;<br />{'}'}</div>
      </div>
      <div className="ob__card fade-in">
        <div className="ob__progress"><span>Step {step + 1} of {steps.length}</span><span>{steps[step]}</span></div>
        <div className="ob__dots">{steps.map((_, i) => <span key={i} className={`ob__dot${i <= step ? ' on' : ''}`} />)}</div>

        <FadeIn animKey={step} stagger className="ob__step">
          {step === 0 && (
            <>
              <div className="ob__mark"><LogoMark size={48} stroke={1.7} /></div>
              <div className="ob__eyebrow">HOW TO START</div>
              <h2 className="ob__title">Select code. Press Command U.</h2>
              <p className="ob__sub">Unvibe sits beside Cursor and VS Code. Highlight the code you want to keep, press the shortcut, and read the explanation in place. Nothing is sent until the on-device secret scan finishes.</p>
              <ol className="ob__list">
                <li>Select the code an AI just wrote.</li>
                <li>Press <span className="kbd-lg">⌘U</span> in Cursor or VS Code, or <span className="kbd-lg">{prettyAccel(shortcut)}</span> in other Mac apps.</li>
                <li>Read it, then keep building.</li>
              </ol>
              {nav('Get started')}
            </>
          )}

          {step === 1 && (
            <>
              <div className="ob__eyebrow">YOUR PROFILE</div>
              <h2 className="ob__title">Name and profile, on this Mac.</h2>
              <p className="ob__sub">Chat will say Hello again, then your name. Email is optional and stays on this laptop.</p>
              <form className="ob__form" onSubmit={(event) => { event.preventDefault(); advanceName(); }}>
                <label>
                  Name
                  <input
                    className="field"
                    value={displayName}
                    onChange={(event) => { setDisplayName(event.target.value); if (nameError) setNameError(''); }}
                    autoComplete="given-name"
                    autoFocus
                    placeholder="Your name"
                  />
                </label>
                <label>
                  Email, optional
                  <input
                    className="field"
                    type="email"
                    value={profileEmail}
                    onChange={(event) => { setProfileEmail(event.target.value); if (nameError) setNameError(''); }}
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </label>
                {nameError ? <p className="field-err" role="alert">{nameError}</p> : null}
              </form>
              {nav('Continue', advanceName, displayName.trim().length === 0)}
            </>
          )}

          {step === 2 && (
            <>
              <div className="ob__eyebrow">MAC ACCESS</div>
              <h2 className="ob__title">Allow Unvibe on this laptop.</h2>
              <p className="ob__sub">Cursor and VS Code already work with Command U. For Terminal and the rest of your Mac, turn Unvibe on in Accessibility so it can read the code you select.</p>
              <ol className="ob__list">
                <li>Open <b>System Settings</b>.</li>
                <li>Open <b>Privacy and Security</b>.</li>
                <li>Open <b>Accessibility</b>.</li>
                <li>Find <b>Unvibe</b> and turn it on.</li>
              </ol>
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
      <div className="sanFranWash" aria-hidden="true" />
      <div className="login__grid" aria-hidden="true" />
      <div className="login__island" aria-hidden="true"><LogoMark size={15} stroke={2} /><span>learning follows your workflow</span><i /><i /><i /></div>
      <FadeIn animKey="login" className="login__layout">
        <section className="login__story">
          <div className="login__eyebrow">YOUR PRIVATE LEARNING LAYER</div>
          <h1>Understand the work.<br />Keep the knowledge.</h1>
          <p>Unvibe turns the code you review into a learning history that stays useful across editors, terminals, and projects.</p>
          <div className="login__features">
            <div className="login__feature"><span className="lf-icon">01</span><span><b>Select anywhere</b><small>Highlight code in your current workflow.</small></span></div>
            <div className="login__feature"><span className="lf-icon">02</span><span><b>Understand in place</b><small>Press {prettyAccel(shortcut)} for a focused explanation.</small></span></div>
            <div className="login__feature"><span className="lf-icon">03</span><span><b>Build real memory</b><small>Save understanding, review it, and watch progress.</small></span></div>
          </div>
        </section>
        <aside className="login__card">
          <div className="login__mark"><LogoMark size={42} stroke={1.7} /></div>
          <div className="login__brand">UNVIBE</div>
          <h2 className="login__tag">Carry your learning forward.</h2>
          <p className="login__card-copy">Sign in to sync permitted learning records across devices. Your code and full explanations remain local.</p>
          <SignInForm onDone={onSignedIn} />
          <button className="login__skip" onClick={onSkip}>Keep everything local for now →</button>
        </aside>
      </FadeIn>
    </div>
  );
}

function UsageChip({ usage, onPlan, compact = false }: {
  usage: AppUsageLine | null;
  onPlan: () => void;
  compact?: boolean;
}) {
  if (!usage) return null;
  const low = usage.remaining <= 5;
  const out = usage.remaining <= 0;
  const planLabel = usage.plan === 'full' ? 'Full' : usage.plan === 'pro' ? 'Pro' : usage.plan === 'teams' ? 'Teams' : 'Free';
  const aiPct = Math.min(100, Math.round((usage.used / Math.max(1, usage.limit)) * 100));
  const selectionPct = Math.min(100, Math.round(((usage.selections?.used ?? 0) / Math.max(1, usage.selections?.limit ?? 100)) * 100));
  return (
    <button
      type="button"
      className={`usage-chip${compact ? ' usage-chip--side' : ''}${out ? ' usage-chip--out' : low ? ' usage-chip--low' : ''}`}
      onClick={onPlan}
      title={`${planLabel} · resets ${new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`}
    >
      <span className="usage-chip__title"><b>Usage</b><small>{planLabel}</small></span>
      <span className="usage-chip__meter"><i><em style={{ width: `${aiPct}%` }} /></i><small>AI</small><b>{usage.remaining} left</b><strong>{usage.used}/{usage.limit}</strong></span>
      <span className="usage-chip__meter"><i><em style={{ width: `${selectionPct}%` }} /></i><small>Select</small><b>{usage.selections?.remaining ?? 100} left</b><strong>{usage.selections?.used ?? 0}/{usage.selections?.limit ?? 100}</strong></span>
    </button>
  );
}

function Home({ shortcut, profile, feed, usage, onPlan, onRefresh }: {
  shortcut: string;
  profile: Profile | null;
  feed: FeedItem[];
  usage: AppUsageLine | null;
  onPlan: () => void;
  onRefresh: () => void | Promise<void>;
}) {
  const groups: Array<{ label: string; items: FeedItem[] }> = [];
  for (const item of feed) {
    const label = dayGroup(item.ts);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }
  const daily = feed.length > 0;
  return (
    <>
      <div className="topline">
        <h1>{daily ? 'Today' : 'Keep it local.'}</h1>
      </div>
      {usage && usage.remaining <= 0 && (
        <div className="limit-banner" role="status">
          <div>
            <strong>{limitOfferCopy(usage.plan, usage).title}</strong>
            <p>{limitOfferCopy(usage.plan, usage).body}</p>
          </div>
          <div className="limit-banner__actions">
            {limitOfferCopy(usage.plan, usage).primaryKind === 'survey' ? (
              <button type="button" className="primary-btn" onClick={() => void window.unvibe.openUrl(BETA_SURVEY_URL)}>
                {limitOfferCopy(usage.plan, usage).primary}
              </button>
            ) : (
              <button type="button" className="primary-btn" onClick={onPlan}>{limitOfferCopy(usage.plan, usage).primary}</button>
            )}
            {limitOfferCopy(usage.plan, usage).showPlan && limitOfferCopy(usage.plan, usage).primaryKind === 'survey' ? (
              <button type="button" className="soft-btn" onClick={onPlan}>Buy a subscription</button>
            ) : null}
          </div>
        </div>
      )}
      <div className={`cols${daily ? ' cols--daily' : ''}`}>
        <div className="main-col">
          <div className={`hero${daily ? ' hero--quiet' : ''}`}>
            <h2>{daily ? 'Keep going.' : 'Understand everything you ship.'}</h2>
            <p>{daily ? `Select code and press ${shortcut}. New reviews land in the list below.` : `Highlight code in any app and Unvibe explains it where you are working, pitched to how much you already know. Quiet until you ask.`}</p>
            <div className="row">
              <button onClick={() => window.unvibe.companionReview()} disabled={!!usage && usage.remaining <= 0}>Explain some code</button>
              <span className="kbd">or press {shortcut} anywhere</span>
            </div>
          </div>
          {feed.length === 0 ? (
            <div className="feed-empty">
              <div className="t">Nothing reviewed yet</div>
              <div className="d">Highlight some code and press {shortcut}. Reviews gather here so you can return to them.</div>
              <button type="button" className="primary-btn" onClick={() => window.unvibe.companionReview()} disabled={!!usage && usage.remaining <= 0}>Explain some code</button>
            </div>
          ) : (
            groups.map((group) => (
              <div className="feed-block" key={group.label}>
                <div className="feed-label">{group.label}</div>
                <div className="feed">
                  {group.items.map((f) => (
                    <div className="feed-row" key={f.id}>
                      <div className="feed-time">{fmtTime(f.ts)}</div>
                      <div className="feed-main"><div className="feed-title">{f.title}</div><div className="feed-meta">{f.meta}</div></div>
                      <span className={`tag tag--${f.outcome}`}>{f.outcome === 'understood' ? 'Understood' : f.outcome === 'needs_review' ? 'Revisit' : 'Reviewed'}</span>
                      <TrashButton
                        label={`Remove ${f.title}`}
                        onClick={() => {
                          if (!window.confirm('Remove this lesson from this Mac?')) return;
                          void window.unvibe.forgetLearning(f.id).then(() => void onRefresh());
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
        <div className="rail">
          <div className="stats">
            <div className="stat"><span className="v">{profile?.linesUnderstood ?? 0}</span><span className="l">lines understood</span></div>
            <div className="stat"><span className="v">{(profile?.conceptsFamiliar ?? 0) + (profile?.conceptsStrong ?? 0)}</span><span className="l">concepts familiar or strong</span></div>
            <div className="stat"><span className="v">{profile?.streak ?? 0}</span><span className="l">day streak</span></div>
          </div>
          {!daily && (
            <>
              <div className="rail-card"><div className="t">Kept on your machine</div><div className="d">Code is scanned for secrets on your device before anything is sent. The service never reads your repository.</div></div>
              <div className="rail-card"><div className="t">How it works</div><div className="d">Select code, press {shortcut}, pick a depth from New to Expert, then take a quick check to lock it in.</div></div>
            </>
          )}
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
      <p className="lead">The honest measure of what you have understood. Lines you could explain to someone else.</p>
      <div className="tiles">
        <div className="tile"><div className="v">{profile?.linesUnderstood ?? 0}</div><div className="l">lines understood</div><div className="note">of {profile?.linesReviewed ?? 0} reviewed</div></div>
        <div className="tile"><div className="v">{profile?.conceptsDeveloping ?? 0}</div><div className="l">concepts developing</div><div className="note">{profile?.conceptsSeen ?? 0} encountered · {profile?.conceptsNeedReview ?? 0} to revisit</div></div>
        <div className="tile"><div className="v">{profile?.reviews ?? 0}</div><div className="l">reviews done</div><div className="note">{profile?.needsReview ?? 0} to revisit</div></div>
        <div className="tile"><div className="v">{profile?.streak ?? 0}</div><div className="l">day streak</div><div className="note">best: {profile?.bestStreak ?? 0} days</div></div>
      </div>
      <div className="panel-card">
        <div className="ph"><span className="t">Your streak</span><span className="m">last 6 months</span></div>
        <div className="heat">{heat.map((lvl, i) => <i key={i} className={lvl ? `a${lvl}` : ''} />)}</div>
        <div className="heat-legend"><span>Less</span><i /><i className="a1" /><i className="a2" /><i className="a3" /><i className="a4" /><i className="a5" /><span>More</span><span className="heat-legend__note">5, 25, 50, 100, 200 lines explained that day.</span></div>
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


function PlanUsageBoard({ compact = false, signedIn, onSignedIn }: {
  compact?: boolean;
  signedIn: boolean;
  onSignedIn?: () => void;
}) {
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [localUsage, setLocalUsage] = useState<AppUsageLine | null>(null);
  const [available, setAvailable] = useState(false);
  const [interval, setInterval] = useState<'monthly' | 'annual'>('monthly');
  const [message, setMessage] = useState(compact ? '' : 'Loading plan…');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const usage = await window.unvibe.usageGet() as { ok: boolean; data?: AppUsageLine };
    if (usage.ok && usage.data) setLocalUsage(usage.data);
    if (!signedIn) {
      setOverview(null);
      setAvailable(false);
      setMessage('');
      return;
    }
    const result = await window.unvibe.billingOverview() as { ok: boolean; data?: { overview: BillingOverview; checkoutAvailable: boolean }; error?: string };
    if (!result.ok || !result.data) {
      setOverview(null);
      setMessage(result.error ?? 'Could not load cloud plan. Local limits still apply.');
      return;
    }
    setOverview(result.data.overview);
    setAvailable(result.data.checkoutAvailable);
    if (result.data.overview.subscription.interval) setInterval(result.data.overview.subscription.interval);
    setMessage('');
  };
  useEffect(() => {
    void load();
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [signedIn]);

  const checkout = async () => {
    if (!signedIn) {
      setMessage('Sign in to upgrade. Google approval happens in the browser.');
      return;
    }
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

  const currentPlan = asPlanId(overview?.subscription.plan ?? localUsage?.plan);
  const currentInterval = overview?.subscription.interval ?? null;
  const gifted = currentPlan === 'pro' && overview && !overview.hasBillingAccount;
  const paid = Boolean(overview?.hasBillingAccount && (currentPlan === 'pro' || currentPlan === 'teams'));
  const canPortal = Boolean(overview?.canManageBilling && overview.hasBillingAccount);
  const showUpgrade = currentPlan !== 'teams';
  const upgradeIsPro = currentPlan === 'free' || currentPlan === 'local' || currentPlan === 'trial';
  const meters = collectUsageMeters(overview, localUsage);
  const resetIso = meters[0]?.resetsAt ?? localUsage?.resetsAt;
  const unlimited = currentPlan === 'full';

  return (
    <section className={`plan-board${compact ? ' plan-board--compact' : ''}`} aria-label="Plan and usage">
      {!compact && (
        <div className="page-head">
          <div>
            <div className="eyebrow">Plan & usage</div>
            <h1>Start free. Grow when your projects do.</h1>
            <p>Your AI model access is included. You never need to paste in your own provider API key.</p>
          </div>
        </div>
      )}
      {compact && <div className="settings-section-label">PLAN & USAGE</div>}
      {message && <div className={`plan-message${message.startsWith('Sign in') || message.includes('Local limits') || message.includes('Checkout is disabled') ? ' quiet' : ''}`} role="status">{message}</div>}

      <div className="plan-pick">
        <article className="plan-pick__card is-current">
          <span>Current plan</span>
          <h2>{planDisplayName(currentPlan)} {planPriceLabel(currentPlan, currentInterval)}</h2>
          <p>
            {gifted ? 'Pro from a gift. Limits follow the Pro plan.'
              : unlimited ? 'This build is not metered locally.'
                : resetIso ? resetLabel(resetIso)
                  : 'Monthly explanation limits apply to this Mac.'}
          </p>
          {canPortal
            ? <button type="button" className="soft-btn" onClick={() => void portal()} disabled={busy}>Manage billing</button>
            : <button type="button" className="soft-btn" disabled>{gifted ? 'Included with a gift' : paid ? 'Active' : 'Included'}</button>}
        </article>

        {showUpgrade && (
          <article className="plan-pick__card is-upgrade">
            <span>Upgrade available</span>
            {upgradeIsPro ? (
              <>
                <h2>Pro {interval === 'annual' ? '$72/yr' : '$8/mo'}</h2>
                <p>Unlock git diffs, nearby files, and 100 explanations each month.</p>
                <div className="plan-toggle" aria-label="Billing interval">
                  <button type="button" className={interval === 'monthly' ? 'on' : ''} onClick={() => setInterval('monthly')} aria-pressed={interval === 'monthly'}>Monthly</button>
                  <button type="button" className={interval === 'annual' ? 'on' : ''} onClick={() => setInterval('annual')} aria-pressed={interval === 'annual'}>Annual<span>Save 25%</span></button>
                </div>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => void checkout()}
                  disabled={busy || (signedIn && !available)}
                >
                  {signedIn ? 'Upgrade to Pro' : 'Sign in to upgrade'}
                </button>
              </>
            ) : (
              <>
                <h2>Team $10/seat</h2>
                <p>Shared workspace and seat billing. Coming soon.</p>
                <button type="button" className="soft-btn" disabled>Coming soon</button>
              </>
            )}
          </article>
        )}
      </div>

      {!signedIn && (
        <div className="plan-board__signin">
          <p>Sign in to sync this Mac with your cloud plan and Stripe billing.</p>
          <SignInForm onDone={onSignedIn ?? (() => undefined)} />
        </div>
      )}
      {signedIn && !available && upgradeIsPro && <div className="plan-message quiet">Checkout is disabled until billing is configured on the server.</div>}

      <div className="plan-usage-block">
        <h3>Usage this month</h3>
        <div className="plan-usage-card">
          {meters.length === 0 && <p className="plan-usage-empty">Usage appears after the first explanation on this Mac.</p>}
          {meters.map((line) => {
            const open = line.limit >= 100_000;
            const left = percentLeft(line.remaining, line.limit);
            const usedPct = percentUsed(line.used, line.limit);
            return (
              <div className="plan-usage-row" key={line.kind}>
                <div>
                  <strong>{usageKindLabel(line.kind)}</strong>
                  <small>
                    {open
                      ? 'Unlimited on this build'
                      : `${line.used} of ${line.limit} used · ${line.remaining} left`}
                  </small>
                </div>
                <b>{open ? 'Open' : `${left}% left`}</b>
                <i aria-hidden="true"><em style={{ width: open ? '8%' : `${usedPct}%` }} /></i>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Plan({ signedIn, onSignedIn }: { signedIn: boolean; onSignedIn: () => void }) {
  return (
    <div className="plan-view">
      <PlanUsageBoard signedIn={signedIn} onSignedIn={onSignedIn} />
    </div>
  );
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

function TrashButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className="row-trash" aria-label={label} title="Remove" onClick={onClick}>
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 6h10M8 6V4.5h4V6M7 6l.5 10h5L13 6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
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
  const del = async () => {
    setBusy(true); setErr('');
    const r = (await window.unvibe.deleteAccount()) as { ok: boolean; error?: string };
    setBusy(false);
    if (r.ok) onDeleted(); else setErr(r.error ?? 'Could not delete the account.');
  };
  if (!account) {
    return (
      <>
        <PlanUsageBoard compact signedIn={false} onSignedIn={onChange} />
        <div className="settings-section-label">ACCOUNT</div>
        <div className="setrow" style={{ display: 'block' }}>
          <div className="sl">This Mac</div>
          <div className="sd">You are using Unvibe locally right now. Sign in above to attach a cloud plan.</div>
        </div>
        <div className="setrow" style={{ display: 'block' }}>
          <div className="sl">Erase learning on this Mac</div>
          <div className="sd" style={{ marginBottom: 12 }}>Removes every saved explanation on this Mac. This cannot be undone.</div>
          {!confirming ? <button className="act danger" onClick={() => setConfirming(true)}>Erase everything…</button> : (
            <div className="danger-row">
              <input className="field delete-confirm" aria-label="Type DELETE to confirm" value={phrase} placeholder="Type DELETE to confirm" onChange={(e) => setPhrase(e.target.value)} />
              <button className="act danger" disabled={busy || phrase !== 'DELETE'} onClick={del}>{busy ? 'Erasing…' : 'Erase everything'}</button>
              <button className="act" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button>
            </div>
          )}
          {err && <div className="field-err">{err}</div>}
        </div>
      </>
    );
  }
  return (
    <>
      <PlanUsageBoard compact signedIn onSignedIn={onChange} />
      <div className="settings-section-label">ACCOUNT</div>
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
      <section className="ai-container" aria-label="AI settings">
      <div className="ai-container__intro">
        <span>AI on your terms</span>
        <p>Use included Unvibe AI, or securely connect a provider key kept on this Mac.</p>
      </div>
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
      </section>
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
  const [items, setItems] = useState<Array<{
    id: string;
    name: string;
    group: string;
    detail: string;
    blurb: string;
    state: 'detected' | 'available' | 'not-installed';
  }> | null>(null);
  useEffect(() => { void window.unvibe.integrations().then((result) => setItems(result as typeof items)); }, []);
  if (!items) return <div className="settings-empty">Checking this Mac…</div>;
  const groups = ['Editors', 'Agents', 'Shell', 'Workspace'].map((group) => ({
    group,
    rows: items.filter((item) => item.group === group),
  })).filter((item) => item.rows.length > 0);
  return (
    <div className="integ">
      <p className="integ__lead">Unvibe sits beside tools you already have. It never writes into their settings. Detected means that app is on this Mac, so a selection there can be explained.</p>
      {groups.map(({ group, rows }) => (
        <section key={group} className="integ__group">
          <h3>{group}</h3>
          <div className="integ__grid">
            {rows.map((item) => (
              <article key={item.id} className={`integ-card integ-card--${item.state}`}>
                <span className="integ-card__mark" aria-hidden="true">{item.name.slice(0, 1)}</span>
                <div className="integ-card__body">
                  <div className="integ-card__row">
                    <b>{item.name}</b>
                    <span className={`integration-state ${item.state}`}>{item.state === 'not-installed' ? 'Not installed' : item.state === 'detected' ? 'Detected' : 'Available'}</span>
                  </div>
                  <small>{item.blurb}</small>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Settings({ info, account, settings, onAccountChange, onSettings, onClose, onAccountDeleted, onNotice, initialTab = 'General' }: {
  info: { version: string }; account: Account; settings: Settings;
  onAccountChange: () => void; onSettings: (patch: Partial<Settings>) => Promise<string | undefined>; onClose: () => void; onAccountDeleted: () => void; onNotice: (message: string) => void;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(initialTab);
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
          <div className="mside-group">
            <div className="mh">PREFERENCES</div>
            {['General', 'Island', 'Sound & alerts', 'Learning', 'Privacy & Data'].map((t) => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}><span className="settings-nav-icon">{t === 'General' ? '⌘' : t === 'Island' ? '◒' : t === 'Sound & alerts' ? '♪' : t === 'Learning' ? '✦' : '⌂'}</span>{t}</button>)}
          </div>
          <div className="mside-group">
            <div className="mh">UNVIBE</div>
            {['Integrations', 'AI', 'Account & Plan', 'About'].map((t) => <button key={t} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}><span className="settings-nav-icon">{t === 'Integrations' ? '↗' : t === 'AI' ? '◌' : t === 'Account & Plan' ? '◈' : 'i'}</span>{t}</button>)}
          </div>
          <div className="ver">Unvibe v{info.version}</div>
        </div>
        <div className="mbody">
          <h2>{tab}</h2>

          {tab === 'AI' && <AiSettingsPanel settings={settings} onSettings={onSettings} onNotice={onNotice} />}

          {tab === 'General' && (
            <>
              <div className="setrow"><div><div className="sl">Name</div><div className="sd">Chat greets you with Hello again, then this name.</div></div><input className="field setrow-field" value={settings.displayName ?? ''} onChange={(e) => void onSettings({ displayName: e.target.value })} autoComplete="given-name" /></div>
              <div className="setrow"><div><div className="sl">Email</div><div className="sd">Optional. Stays on this Mac for your profile.</div></div><input className="field setrow-field" type="email" value={settings.profileEmail ?? ''} onChange={(e) => void onSettings({ profileEmail: e.target.value })} autoComplete="email" /></div>
              <div className="setrow"><div><div className="sl">Launch at login</div><div className="sd">Start Unvibe automatically when you log in to your Mac.</div></div><Toggle on={settings.launchAtLogin} onClick={() => onSettings({ launchAtLogin: !settings.launchAtLogin })} /></div>
              <div className="setrow"><div><div className="sl">Activation shortcut</div><div className="sd">Select code in any app, then press this. Control+U is always registered as well.</div>{shortcutErr && <div className="field-err">{shortcutErr}</div>}</div><button className={`act kbd-cap${recording ? ' rec' : ''}`} onClick={() => { setShortcutErr(''); setRecording(true); }}>{recording ? 'Press keys…' : prettyAccel(settings.shortcut)}</button></div>
              <PermRow compact />
            </>
          )}

          {tab === 'Island' && (
            <>
              <OverlayPreview position={settings.barPosition} dimmed={settings.widgetOpacityInactive} />
              <div className="settings-section-label">OVERLAY PREVIEW</div>
              <div className="setrow"><div><div className="sl">App appearance</div><div className="sd">Choose light, dark, or follow your Mac automatically.</div></div><select className="sel-input" value={settings.theme} onChange={(e) => onSettings({ theme: e.target.value as Settings['theme'] })}><option value="system">Follow system</option><option value="light">Light</option><option value="dark">Dark</option></select></div>
              <div className="setrow settings-location"><div><div className="sl">Island location</div><div className="sd">Choose where the Island rests. It moves immediately.</div></div>
                <div className="location-grid" role="group" aria-label="Island location">
                  {([['top-center', 'Top'], ['top-right', 'Right'], ['bottom-center', 'Bottom'], ['bottom-right', 'Corner']] as const).map(([position, label]) => <button key={position} type="button" className={settings.barPosition === position ? 'on' : ''} onClick={() => void onSettings({ barPosition: position })}>{label}</button>)}
                </div>
              </div>
              <div className="setrow"><div><div className="sl">Quiet Island visibility</div><div className="sd">Recommended: show it only while learning. Select code anywhere and press {prettyAccel(settings.shortcut)} whenever you want to start.</div></div><select className="sel-input" value={settings.barVisibility} onChange={(e) => onSettings({ barVisibility: e.target.value as Settings['barVisibility'] })}><option value="always">Always available</option><option value="during-review">During reviews only</option></select></div>
              <div className="setrow"><div><div className="sl">Expand on hover</div><div className="sd">Off keeps the Island calm and click-only. Click and keyboard controls always work.</div></div><Toggle on={settings.barHoverPreview} onClick={() => onSettings({ barHoverPreview: !settings.barHoverPreview })} /></div>
              {settings.barHoverPreview && <div className="setrow"><div><div className="sl">Hover delay</div><div className="sd">Wait {Math.round(settings.barHoverDelayMs / 10) / 100}s before opening, so passing over the Island never feels jumpy.</div></div><input className="range" aria-label="Hover delay" type="range" min={120} max={600} step={20} value={settings.barHoverDelayMs} onChange={(e) => onSettings({ barHoverDelayMs: Number(e.target.value) })} /></div>}
              <div className="setrow"><div><div className="sl">Rotate learning stats</div><div className="sd">Cycle through streak, lines understood, and completed reviews in the compact top Island.</div></div><Toggle on={settings.rotateIslandStats} onClick={() => onSettings({ rotateIslandStats: !settings.rotateIslandStats })} /></div>
              <div className="setrow"><div><div className="sl">Follow active display</div><div className="sd">Place the strip on the display where your pointer is when it moves or opens.</div></div><Toggle on={settings.followActiveDisplay} onClick={() => onSettings({ followActiveDisplay: !settings.followActiveDisplay })} /></div>
              <div className="setrow"><div><div className="sl">Inactive widget</div><div className="sd">What an explanation does when you click away (and it is not pinned).</div></div>
                <select className="sel-input" value={settings.inactiveBehavior} onChange={(e) => onSettings({ inactiveBehavior: e.target.value })}>
                  <option value="dim">Dim (keep size)</option><option value="stay">Stay solid</option>
                </select>
              </div>
              <div className="setrow"><div><div className="sl">Dimmed opacity</div><div className="sd">How faint a dimmed widget becomes — {Math.round(settings.widgetOpacityInactive * 100)}%.</div></div>
                <input className="range" type="range" min={35} max={100} value={Math.round(settings.widgetOpacityInactive * 100)} onChange={(e) => onSettings({ widgetOpacityInactive: Number(e.target.value) / 100 })} />
              </div>
            </>
          )}

          {tab === 'Sound & alerts' && (
            <>
              <div className="settings-section-label">LOCAL SOUND</div>
              <div className="setrow"><div><div className="sl">Interface sounds</div><div className="sd">Cues when Unvibe starts, when you hover or open the island, and when you click island actions. Nothing is recorded or downloaded.</div></div><Toggle on={settings.soundEffects} onClick={() => onSettings({ soundEffects: !settings.soundEffects })} /></div>
              <div className="setrow"><div><div className="sl">Sound character</div><div className="sd">Soft is subtle. Pixel is sharper and more playful.</div></div><select className="sel-input" value={settings.soundStyle} disabled={!settings.soundEffects} onChange={(e) => onSettings({ soundStyle: e.target.value as Settings['soundStyle'] })}><option value="soft">Soft</option><option value="pixel">Pixel</option></select></div>
              <div className="setrow"><div><div className="sl">Volume</div><div className="sd">{Math.round(settings.soundVolume * 100)}% — stored on this Mac.</div></div><div className="sound-controls"><input className="range" aria-label="Sound volume" type="range" min={0} max={1} step={0.05} disabled={!settings.soundEffects} value={settings.soundVolume} onChange={(e) => onSettings({ soundVolume: Number(e.target.value) })} /><button className="act" disabled={!settings.soundEffects} onClick={() => playUiTone('success', settings.soundVolume, settings.soundStyle)}>Preview</button></div></div>
              <div className="settings-section-label">NOTIFICATIONS</div>
              <div className="setrow"><div><div className="sl">Bar notifications</div><div className="sd">Short, rate-limited messages when an explanation is ready.</div></div><Toggle on={settings.notifications} onClick={() => onSettings({ notifications: !settings.notifications })} /></div>
              <div className="setrow"><div><div className="sl">Quiet hours</div><div className="sd">Silence notifications overnight.</div></div><Toggle on={settings.quietHours.enabled} onClick={() => onSettings({ quietHours: { ...settings.quietHours, enabled: !settings.quietHours.enabled } })} /></div>
              {settings.quietHours.enabled && <div className="setrow"><div><div className="sl">From / to</div><div className="sd">24-hour times.</div></div><div className="danger-row"><input className="time-input" type="time" value={settings.quietHours.start} onChange={(e) => onSettings({ quietHours: { ...settings.quietHours, start: e.target.value } })} /><input className="time-input" type="time" value={settings.quietHours.end} onChange={(e) => onSettings({ quietHours: { ...settings.quietHours, end: e.target.value } })} /></div></div>}
            </>
          )}

          {tab === 'Learning' && <><div className="setrow"><div><div className="sl">Default explanation depth</div><div className="sd">The starting depth for a new explanation. You can always switch it in the overlay.</div></div><select className="sel-input" value={settings.defaultExplanationLevel} onChange={(e) => onSettings({ defaultExplanationLevel: e.target.value as Settings['defaultExplanationLevel'] })}>{STUDY_LEVELS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div><div className="setrow"><div><div className="sl">Learning records</div><div className="sd">Explanations, quiz results, and concepts save immediately on this Mac. Use the trash on History to remove a single lesson.</div></div></div></>}

          {tab === 'Integrations' && <IntegrationsPanel />}

          {tab === 'Privacy & Data' && (
            <>
              <div className="setrow"><div><div className="sl">On-device secret scan</div><div className="sd">Every selection is scanned for keys and tokens before it leaves your Mac. Always on.</div></div><button className="act" disabled>On</button></div>
              <div className="setrow"><div><div className="sl">The service never reads your repo</div><div className="sd">Only the exact, filtered snippet you review is sent — nothing else.</div></div></div>
              <div className="setrow"><div><div className="sl">Privacy policy</div><div className="sd">Read how Unvibe handles your code and data on our website.</div></div><button className="act" onClick={() => window.unvibe.openPrivacy()}>Read →</button></div>
              <div className="setrow"><div><div className="sl">Report beta feedback</div><div className="sd">Opens a draft with your app version and current screen. Attach a screenshot only if it helps.</div></div><button className="act" onClick={() => void window.unvibe.reportFeedback({ screen: `Settings · ${tab}`, version: info.version })}>Report →</button></div>
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
  const [navOpen, setNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('General');
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
  const [usageLine, setUsageLine] = useState<AppUsageLine | null>(null);
  const [sideWidth, setSideWidth] = useState(232);
  const sideLive = useRef(232);

  const refresh = async () => {
    try {
      const [acct, prof, fd, hist, st, syncState, usage, q, appInfo] = await Promise.all([
        window.unvibe.account() as Promise<Account>,
        window.unvibe.profile() as Promise<Profile>,
        window.unvibe.feed(8) as Promise<FeedItem[]>,
        window.unvibe.history(100) as Promise<LearningItem[]>,
        window.unvibe.getSettings() as Promise<Settings>,
        window.unvibe.syncStatus() as Promise<SyncStatus>,
        window.unvibe.usageGet() as Promise<{ ok: boolean; data?: AppUsageLine }>,
        window.unvibe.reviewQueue(20) as Promise<LearningItem[]>,
        window.unvibe.appInfo() as Promise<{ version: string; user: string; shortcut: string }>,
      ]);
      setAccount(acct); setProfile(prof); setFeed(fd); setHistory(hist); setQueue(q); setSettings(st); setSync(syncState);
      setInfo(appInfo);
      if (typeof st.sidebarWidth === 'number') {
        setSideWidth(st.sidebarWidth);
        sideLive.current = st.sidebarWidth;
      }
      setUsageLine(usage.ok && usage.data
        ? usage.data
        : { used: 0, limit: 30, remaining: 30, resetsAt: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString(), plan: 'local', selections: { used: 0, limit: 30, remaining: 30, resetsAt: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString() } });
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
    window.unvibe.onShowPage((next) => {
      const allowed: PageId[] = ['Home', 'Learn', 'Study', 'History', 'Quiz', 'Chat', 'Progress', 'Plan', 'Gift', 'Projects', 'Concepts', 'Notebook', 'Briefings', 'Library', 'Profile'];
      if (allowed.includes(next as PageId)) setPage(next as PageId);
    });
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const [themeIsDark, setThemeIsDark] = useState(false);
  useEffect(() => {
    const preference = settings?.theme ?? 'dark';
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
    if (patch.displayName !== undefined) {
      void window.unvibe.appInfo().then((next) => setInfo(next as typeof info));
    }
    return r.shortcutError;
  };

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 1800); };
  const shortcutLabel = prettyAccel(info.shortcut);
  const isLearnPage = page === 'Learn' || page === 'Study' || page === 'History' || page === 'Quiz';
  const fillPage = isLearnPage || page === 'Chat';
  const chatLabel = settings?.useOwnAi
    ? settings.aiProvider.charAt(0).toUpperCase() + settings.aiProvider.slice(1)
    : 'Unvibe AI';
  const sideCompact = sideWidth < 200;

  const startSideResize = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startW = sideLive.current;
    const move = (moveEvent: PointerEvent) => {
      const next = Math.min(340, Math.max(168, Math.round(startW + (moveEvent.clientX - startX))));
      sideLive.current = next;
      setSideWidth(next);
    };
    const up = () => {
      document.documentElement.classList.remove('is-side-resizing');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      void applySettings({ sidebarWidth: sideLive.current });
    };
    document.documentElement.classList.add('is-side-resizing');
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  useEffect(() => {
    if (gate !== 'app') return;
    if (!(settings?.soundEffects ?? true)) return;
    playUiTone('launch', settings?.soundVolume ?? 0.3, settings?.soundStyle ?? 'soft');
  }, [gate]);

  if (gate === 'checking') return <div className="titlebar" />;
  if (gate === 'onboarding') {
    return (<><div className="titlebar" /><Onboarding shortcut={settings?.shortcut ?? 'CommandOrControl+U'} soundEffects={settings?.soundEffects ?? true} soundVolume={settings?.soundVolume ?? 0.3} soundStyle={settings?.soundStyle ?? 'soft'} onDone={async () => { await refresh(); setGate('app'); }} /></>);
  }
  if (gate === 'login') {
    return (<><div className="titlebar" /><LoginScreen shortcut={settings?.shortcut ?? 'CommandOrControl+U'} onSignedIn={async () => { await refresh(); setGate('app'); }} onSkip={() => setGate('app')} /></>);
  }

  return (
    <>
      <div className="titlebar" />
      <div className={`layout${navOpen ? ' layout--nav-open' : ''}`}>
        {navOpen ? <button type="button" className="nav-scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} /> : null}
        <aside className={`side fade-in fade-in--side${sideCompact ? ' side--compact' : ''}`} style={{ width: sideWidth }}>
          <div className="brand"><span className="mark"><LogoMark size={22} /></span><span className="name">Unvibe</span><span className="badge">Beta</span></div>
          <UsageChip usage={usageLine} onPlan={() => setPage('Plan')} compact />
          <nav className="nav">{NAV.map((p) => {
            const on = p.id === page || (p.id === 'Learn' && page === 'Study');
            const label = p.id === 'Gift' ? 'Gift Unvibe' : p.id;
            return (
              <button key={p.id} type="button" className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} aria-label={label} title={sideCompact ? label : undefined} onClick={() => { setPage(p.id); setNavOpen(false); }}>
                <Icon d={p.icon} /><span className="nav-label">{label}</span>
              </button>
            );
          })}</nav>
          <div className="spacer" />
          <button
            className={`sync-state sync-state--${sync.phase}`}
            aria-label={`Sync status: ${sync.phase}. ${sync.pending} pending.`}
            onClick={() => void window.unvibe.retrySync()}
            disabled={sync.phase === 'syncing' || sync.phase === 'local'}
          >
            <span className="sync-state__dot" />
            <span className="sync-state__copy">{sync.phase === 'local' ? 'Saved on this Mac' : sync.phase === 'syncing' ? 'Syncing…' : sync.phase === 'synced' ? 'Synced' : sync.phase === 'auth_required' ? 'Sign in again' : 'Retry sync'}</span>
            {sync.pending > 0 && <small>{sync.pending} pending</small>}
          </button>
          <div className="promo"><div className="t">Start free. <em>Learn daily.</em></div><div className="d">30 explanations each month on Free. 100 on Pro. AI access included, no provider API key needed.</div></div>
          <nav className="nav">{FOOT.map((f) => (
            <button key={f.id} type="button" aria-label={f.id} title={sideCompact ? f.id : undefined} onClick={() => {
              setNavOpen(false);
              if (f.id === 'Settings') { setSettingsTab('General'); setSettingsOpen(true); }
              else flash(f.toast);
            }}>
              <Icon d={f.icon} /><span className="nav-label">{f.id}</span>
            </button>
          ))}</nav>
          <button type="button" className="side-resize" aria-label="Resize sidebar" title="Drag to resize" onPointerDown={startSideResize} />
        </aside>
        <main className="content">
          <div className="content-tools">
            <button
              type="button"
              className="nav-toggle"
              aria-label="Open menu"
              onClick={() => setNavOpen(true)}
            >
              <Icon d="M3 6h14 M3 10h14 M3 14h14" />
            </button>
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
          <div className={`page${fillPage ? ' page--learn' : ''}`}>
            <FadeIn animKey={page} stagger={!fillPage}>
              {page === 'Home' ? <Home shortcut={shortcutLabel} profile={profile} feed={feed} usage={usageLine} onPlan={() => setPage('Plan')} onRefresh={() => void refresh()} />
                : isLearnPage ? <Learn
                  history={history}
                  queue={queue}
                  shortcut={shortcutLabel}
                  intent={page === 'History' ? 'history' : page === 'Quiz' ? 'quiz' : 'learn'}
                  onReview={() => window.unvibe.companionReview()}
                  onRefresh={() => void refresh()}
                  onRestudy={async (item, level) => {
                    const r = await window.unvibe.reopenLearningItem({ ...item, level }) as { ok?: boolean; cancelled?: boolean; error?: string };
                    if (!r?.ok && !r?.cancelled) flash(r?.error ?? 'Could not reopen that lesson.');
                  }}
                />
                : page === 'Chat' ? <Chat
                  providerLabel={chatLabel}
                  usingOwnAi={Boolean(settings?.useOwnAi)}
                  providerId={settings?.aiProvider ?? 'gemini'}
                  userName={info.user}
                  usage={usageLine}
                  onRefresh={() => void refresh()}
                  onOpenAiSettings={() => { setSettingsTab('AI'); setSettingsOpen(true); }}
                />
                : page === 'Progress' ? <Progress profile={profile} />
                : page === 'Plan' ? <Plan signedIn={Boolean(account)} onSignedIn={() => { void refresh(); }} />
                : page === 'Gift' ? <Gift />
                : <Explainer page={PAGES[page]} shortcut={shortcutLabel} />}
            </FadeIn>
          </div>
        </main>
      </div>
      {settingsOpen && settings && (
        <Settings info={info} account={account} settings={settings}
          initialTab={settingsTab}
          onAccountChange={async () => { const { acct } = await refresh(); if (!acct) setGate('app'); }}
          onAccountDeleted={() => { setSettingsOpen(false); setAccount(null); setProfile(null); setFeed([]); setGate('login'); }}
          onSettings={applySettings} onClose={() => setSettingsOpen(false)} onNotice={flash} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
