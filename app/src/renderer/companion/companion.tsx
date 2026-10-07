import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UpdateCard } from './update';
import { createRoot } from 'react-dom/client';
import { LogoMark } from '../shared/logo';
import { Learn } from './learn';
import { Chat } from './chat';
import { Gift } from './gift';
import { configureTones, playTone, playUiTone } from '../shared/tones';
import { BETA_SURVEY_URL, limitOfferCopy } from '../shared/limitOffer';
import { prettyShortcut } from '../shared/prettyShortcut';
import { SearchPalette, type SearchPaletteGroup } from './searchPalette';
import { GoogleMark } from '../shared/googleMark';
import { Briefings } from './briefings';
import type { ChangeBrief } from '../../core/changeBrief';
import type { KnowledgeObject } from '../../core/knowledge';
import '../shared/tokens.css';
import { AccountMenu } from './accountMenu';
import { FloatingBuddy } from './floatingBuddy';
import { FeedbackCard, FEEDBACK_ASKED_KEY } from './feedback';
import { Buddy, setBuddyMood } from '../shared/buddy';

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
  note?: string;
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
  barSize: 'small' | 'medium' | 'large';
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
  sidebarHidden: boolean;
  features: {
    changeBrief: boolean;
    whyExists: boolean;
    voice: boolean;
    teachBack: boolean;
    live: boolean;
    teamKnowledge: boolean;
    githubTeams: boolean;
    localModels: boolean;
  };
  liveSnoozeUntil?: string;
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

function planLabel(plan: string | undefined): string {
  switch (plan) {
    case 'pro': return 'Pro';
    case 'teams': return 'Teams';
    case 'trial': return 'Free beta';
    case 'full': return 'Full access';
    case 'local': return 'Local';
    default: return 'Free';
  }
}

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
  if (plan === 'pro') return interval === 'annual' ? '$81/yr' : '$9/mo';
  if (plan === 'teams') return interval === 'annual' ? '$72/seat/yr' : '$8/seat';
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
  general: 'M4 5h12 M7 3v4 M4 10h12 M13 8v4 M4 15h12 M9 13v4',
  island: 'M4 7.5C4 5.6 5.6 4 7.5 4h5C14.4 4 16 5.6 16 7.5v5c0 1.9-1.6 3.5-3.5 3.5h-5C5.6 16 4 14.4 4 12.5z M8 10h4',
  sound: 'M4 8h3l4-3v10l-4-3H4z M14 7.5c1.5 1.4 1.5 3.6 0 5 M16 5.5c2.6 2.5 2.6 6.5 0 9',
  privacy: 'M10 2.5 16 5v4.4c0 3.8-2.5 6.7-6 8.1-3.5-1.4-6-4.3-6-8.1V5z M7.5 10l1.7 1.8 3.5-4',
  integrations: 'M7 3v4H3 M13 17v-4h4 M4.5 7A6.5 6.5 0 0 1 15 4.7 M15.5 13A6.5 6.5 0 0 1 5 15.3',
  ai: 'M10 2.5 12 7l4.5 2-4.5 2-2 4.5L8 11 3.5 9 8 7z',
  account: 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z M4 17c.7-3 3-4.5 6-4.5s5.3 1.5 6 4.5 M15.5 3.5v4 M13.5 5.5h4',
  info: 'M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16z M10 9v5 M10 6h.01',
};

const SETTINGS_ICONS: Record<string, string> = {
  General: IC.general,
  Island: IC.island,
  'Sound & alerts': IC.sound,
  Learning: IC.study,
  'Privacy & Data': IC.privacy,
  Integrations: IC.integrations,
  AI: IC.ai,
  'Account & Plan': IC.account,
  About: IC.info,
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

const NAV_PINNED: Array<{ id: PageId; icon: string }> = [
  { id: 'Home', icon: IC.home },
  { id: 'Chat', icon: IC.chat },
];

const NAV_SPACES: Array<{ id: PageId; icon: string }> = [
  { id: 'Learn', icon: IC.study },
  { id: 'Quiz', icon: IC.quiz },
  { id: 'Briefings', icon: IC.briefings },
  { id: 'Progress', icon: IC.progress },
  { id: 'Plan', icon: IC.plan },
  { id: 'Gift', icon: IC.gift },
];

const NAV = [...NAV_PINNED, ...NAV_SPACES];


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
function SignInForm({ onDone, label }: { onDone: (email: string, name?: string) => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [code, setCode] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [browserOpened, setBrowserOpened] = useState(true);
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => window.unvibe.onDeviceAuth((r) => { setBusy(false); if (r.ok && r.email) done.current(r.email, r.name); else if (!r.ok) setErr(r.error ?? 'Secure sign-in failed.'); }), []);
  const startDevice = async () => {
    setBusy(true); setErr('');
    const r = (await window.unvibe.startDeviceAuth()) as { ok: boolean; userCode?: string; verificationUri?: string; browserOpened?: boolean; error?: string };
    if (r.ok && r.userCode && r.verificationUri) {
      setCode(r.userCode);
      setVerificationUrl(r.verificationUri);
      setBrowserOpened(r.browserOpened !== false);
    } else { setBusy(false); setErr(r.error ?? 'Could not start secure sign-in.'); }
  };
  const openBrowser = async () => {
    const result = await window.unvibe.openDeviceAuth() as { ok?: boolean; error?: string };
    if (!result.ok) setErr(result.error ?? 'Could not open your browser.');
    else setBrowserOpened(true);
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(verificationUrl); }
    catch { setErr('Could not copy the sign-in link.'); }
  };
  return (
    <div className="signin">
      <button className="field-btn field-btn--google" disabled={busy} onClick={startDevice}>
        <GoogleMark />
        {busy ? 'Waiting for Google sign-in…' : (label ?? 'Continue with Google')}
      </button>
      {err && <div className="field-err">{err}</div>}
      {code ? (
        <div className="signin__code" aria-live="polite">
          <span>{browserOpened ? 'Finish in your browser. Check this code matches, then press Connect this device:' : 'Your browser did not open. Press Open browser, then check this code matches:'}</span>
          <b>{code}</b>
        </div>
      ) : (
        <div className="field-note">Opens your browser for Google sign-in. Unvibe never sees your Google password.</div>
      )}
      {verificationUrl ? <div className="inline-actions"><button className="field-btn" type="button" onClick={() => void openBrowser()}>Open browser</button><button className="field-btn" type="button" onClick={() => void copyLink()}>Copy link</button><button className="field-btn" type="button" onClick={() => void startDevice()}>Retry</button></div> : null}
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
      <div className="perm-why">The Unvibe Desktop Bridge handles ⌘U inside VS Code and Cursor. In Terminal and other Mac apps, Control+U reads your selection through Accessibility.</div>
      {!granted && !na && (
        <div className="perm-actions">
          <button className="act" onClick={() => window.unvibe.promptAccessibility()}>Request access</button>
          <button className="act" onClick={() => window.unvibe.openAccessibility()}>Open System Settings</button>
          <button className="act" onClick={check}>Re-check</button>
        </div>
      )}
      {!granted && !na && (
        <div className="perm-fix">
          <p><b>Switched it on but it still says Not granted?</b> macOS is holding an old Unvibe entry from a previous version. Press <b>Fix it</b>, turn Unvibe on again in the list that opens, then press <b>Restart Unvibe</b>.</p>
          <div className="perm-actions">
            <button className="act act--primary" onClick={() => void window.unvibe.resetAccessibility().then(() => window.unvibe.openAccessibility())}>Fix it</button>
            <button className="act" onClick={() => void window.unvibe.restartApp()}>Restart Unvibe</button>
          </div>
        </div>
      )}
    </div>
  );
}


/** Types a line of Vibe's speech out loud: a blip every few characters, then calls onDone. */
function useVibeSays(text: string, enabled: boolean): string {
  const [shown, setShown] = useState('');
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { setShown(text); return; }
    setShown('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (enabled && i % 3 === 0 && /\S/.test(text[i - 1] ?? '')) playTone('talk');
      if (i >= text.length) window.clearInterval(id);
    }, 26);
    return () => window.clearInterval(id);
  }, [text, enabled]);
  return shown;
}

const DEMO_LINES = [
  'function activeUsers(users) {',
  '  return users',
  '    .filter((u) => u.active)',
  '    .sort((a, b) => b.lastSeen - a.lastSeen);',
  '}',
];
const DEMO_ANSWER = 'Keeps only active users, newest activity first. The filter drops inactive accounts, then the sort puts whoever was seen most recently at the top.';

/** A 6 second, self-playing taste of the real loop: select, ⌘U, explanation, quick check. */
function OnboardingDemo({ sound, onDone }: { sound: boolean; onDone: () => void }) {
  const [phase, setPhase] = useState(0); // 0 select, 1 keys, 2 panel, 3 quiz, 4 correct
  const [typed, setTyped] = useState('');
  const [run, setRun] = useState(0);
  const tone = (kind: Parameters<typeof playTone>[0]) => { if (sound) playTone(kind); };

  useEffect(() => {
    setPhase(0); setTyped('');
    const timers: number[] = [];
    const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
    at(1200, () => { setPhase(1); tone('key'); });
    at(1450, () => tone('key'));
    at(1900, () => { setPhase(2); tone('whoosh'); });
    at(2300, () => {
      let i = 0;
      const id = window.setInterval(() => {
        i += 3;
        setTyped(DEMO_ANSWER.slice(0, i));
        if (i % 9 === 0) tone('talk');
        if (i >= DEMO_ANSWER.length) { window.clearInterval(id); tone('done'); }
      }, 22);
      timers.push(id);
    });
    at(5200, () => setPhase(3));
    return () => timers.forEach((t) => { window.clearTimeout(t); window.clearInterval(t); });
  }, [run]);

  return (
    <div className="obd">
      <div className={`obd__editor${phase >= 0 ? ' is-selecting' : ''}`}>
        <div className="obd__bar"><i /><i /><i /><span>users.ts</span></div>
        <pre>{DEMO_LINES.map((line, index) => <span key={index} className="obd__line" style={{ '--d': `${index * 160}ms` } as React.CSSProperties}>{line}{'\n'}</span>)}</pre>
        <div className={`obd__keys${phase >= 1 ? ' is-pressed' : ''}`} aria-hidden="true"><kbd>⌘</kbd><kbd>U</kbd></div>
      </div>
      <div className={`obd__panel${phase >= 2 ? ' is-in' : ''}`}>
        <div className="obd__panel-head"><Buddy mood={phase >= 4 ? 'celebrate' : phase === 2 ? 'reading' : 'happy'} size={26} label="Vibe" /><b>Unvibe</b><span>{phase >= 3 ? 'ready to learn' : 'explaining'}</span></div>
        <p className="obd__answer">{typed}<i className={typed.length < DEMO_ANSWER.length ? 'obd__caret' : 'obd__caret is-off'} /></p>
        {phase >= 3 ? (
          <div className="obd__quiz">
            <p><b>Quick check:</b> who ends up first?</p>
            <div className="obd__opts">
              <button type="button" className={phase === 4 ? 'is-right' : ''} onClick={() => { if (phase === 4) return; setPhase(4); tone('correct'); setBuddyMood('celebrate'); onDone(); }}>The user seen most recently</button>
              <button type="button" onClick={() => tone('wrong')}>The first user in the list</button>
            </div>
            {phase === 4 ? <p className="obd__yay">Nailed it. That is the whole loop.</p> : null}
          </div>
        ) : null}
      </div>
      {phase >= 3 ? <button type="button" className="obd__replay" onClick={() => setRun((r) => r + 1)}>Replay</button> : null}
    </div>
  );
}

function Onboarding({ soundEffects, soundVolume, soundStyle, onDone }: { soundEffects: boolean; soundVolume: number; soundStyle: 'soft' | 'pixel'; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [nameError, setNameError] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [celebrating, setCelebrating] = useState(false);
  const [demoDone, setDemoDone] = useState(false);
  const [signedIn, setSignedIn] = useState('');
  const steps = ['Hello', 'You', 'Connect', 'Permissions', 'Try it'];
  const firstName = displayName.trim().split(/\s+/)[0] ?? '';

  useEffect(() => { configureTones({ enabled: soundEffects, volume: soundVolume, style: soundStyle }); }, [soundEffects, soundVolume, soundStyle]);

  const lines = [
    "Hey! I'm Vibe. I explain the code AI writes for you, right beside your editor.",
    firstName ? `Nice to meet you, ${firstName}! I'll remember that.` : 'First things first. Tap Google and I fill this in for you, or just type it.',
    signedIn ? `You're signed in as ${signedIn}. Now let's hook up your editors.` : "Let's hook me up to your editors. Google sign-in is optional, it just syncs your progress.",
    'One permission so I can read code you select in Terminal and other apps. Nothing leaves without your OK.',
    demoDone ? "That's me! Ready when you are." : "Watch this. It's the whole thing in six seconds.",
  ];
  const said = useVibeSays(lines[step] ?? '', soundEffects);

  // Google sign-in hands back the account email and profile name; fill what is still empty.
  const fillFromGoogle = (email: string, name?: string) => {
    setSignedIn(email);
    if (email.includes('@')) setProfileEmail((current) => current.trim() || email);
    if (name) { setDisplayName((current) => current.trim() || name); setNameError(''); }
    if (soundEffects) playTone('correct');
    setBuddyMood('happy');
  };
  const go = (to: number) => {
    if (soundEffects) playTone('boop');
    setStep(Math.max(0, Math.min(to, steps.length - 1)));
  };
  const saveProfile = () => {
    const name = displayName.replace(/\s+/g, ' ').trim();
    if (!name) { setNameError('Add a name so I know what to call you.'); return false; }
    setNameError('');
    return true;
  };
  const finish = async () => {
    if (saving || !saveProfile()) return;
    setSaving(true);
    setSaveError('');
    try {
      await window.unvibe.setSettings({ displayName: displayName.replace(/\s+/g, ' ').trim(), profileEmail: profileEmail.trim() });
      await window.unvibe.completeOnboarding();
      if (soundEffects) playTone('celebrate');
      setBuddyMood('celebrate');
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setCelebrating(true);
        await new Promise((resolve) => window.setTimeout(resolve, 1600));
      }
      await onDone();
    } catch {
      setSaveError('Your setup could not be saved. Please try again.');
    } finally { setSaving(false); }
  };
  const advance = () => {
    if (step === 1 && !saveProfile()) return;
    if (step === steps.length - 1) void finish();
    else go(step + 1);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, select, textarea, button')) return;
      if (event.key === 'ArrowRight' || event.key === 'Enter') { event.preventDefault(); advance(); }
      if (event.key === 'ArrowLeft' || event.key === 'Escape') { event.preventDefault(); if (!saving) go(step - 1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const mood = celebrating ? 'celebrate' : step === 0 ? 'wave' : step === 1 ? (firstName ? 'happy' : 'idle') : step === 2 ? 'reading' : step === 3 ? 'thinking' : demoDone ? 'happy' : 'reading';
  const continueLabel = step === 0 ? "Let's go" : step === steps.length - 1 ? (celebrating ? 'Welcome!' : saving ? 'Saving…' : 'Start using Unvibe') : 'Continue';

  return (
    <div className={`ob ob2 ob--scene-${step}`}>
      {celebrating ? (
        <div className="ob__confetti" aria-hidden="true">
          {Array.from({ length: 48 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}
        </div>
      ) : null}
      <div className="ob__card ob2__card">
        <div className="ob2__top">
          <div className="ob__dots">{steps.map((label, i) => <span key={label} title={label} className={`ob__dot${i <= step ? ' on' : ''}`} />)}</div>
          <span className="ob2__count">{step + 1} / {steps.length}</span>
        </div>
        <div className="ob2__vibe">
          <span className="ob2__blob"><Buddy mood={mood} size={step === 0 ? 112 : 72} follow label="Vibe" key={`${step}-${mood}`} /></span>
          <p className="ob2__speech" aria-live="polite">{said}<i className={said.length < (lines[step] ?? '').length ? 'ob2__caret' : 'ob2__caret is-off'} /></p>
        </div>

        <FadeIn animKey={step} className="ob__step ob2__body">
          {step === 0 && (
            <>
              <h2 className="ob__title">Understand what AI <em>changed.</em></h2>
              <p className="ob__sub">Select code anywhere, press <span className="kbd-lg">⌘U</span>, and I explain it. Five quick steps and you are in.</p>
            </>
          )}

          {step === 1 && (
            <>
            {signedIn ? <p className="ob2__ok">✓ Filled in from Google ({signedIn})</p> : (
              <div className="ob2__google ob2__google--you">
                <SignInForm label="Fill this in with Google" onDone={fillFromGoogle} />
              </div>
            )}
            <form className="ob__form ob2__form" onSubmit={(event) => { event.preventDefault(); advance(); }}>
              <label>
                <span>Your name</span>
                <input className="field" value={displayName} autoFocus autoComplete="given-name" placeholder="What should Vibe call you?"
                  onChange={(event) => { setDisplayName(event.target.value); if (nameError) setNameError(''); }} />
              </label>
              <label>
                <span>Email <em className="ob2__opt">optional</em></span>
                <input className="field" type="email" value={profileEmail} autoComplete="email" placeholder="you@example.com" onChange={(event) => setProfileEmail(event.target.value)} />
              </label>
              {nameError ? <p className="field-err" role="alert">{nameError}</p> : null}
              <button type="submit" hidden />
            </form>
            </>
          )}

          {step === 2 && (
            <>
              <div className="ob2__google">
                {signedIn ? <p className="ob2__ok">✓ Signed in as {signedIn}</p> : <SignInForm onDone={fillFromGoogle} />}
              </div>
              <div className="ob__integrations"><IntegrationsPanel /></div>
            </>
          )}

          {step === 3 && (
            <>
              <PermRow />
              <div className="ob__trust"><span>✓</span><div><b>Private by default</b><small>Secrets are filtered on this computer before anything is sent.</small></div></div>
            </>
          )}

          {step === 4 && <OnboardingDemo sound={soundEffects} onDone={() => setDemoDone(true)} />}
        </FadeIn>

        {saveError ? <p className="field-err" role="alert">{saveError}</p> : null}
        <div className="ob__actions">
          <button className="ob__skip" disabled={step === 0 || saving} onClick={() => go(step - 1)}>Back</button>
          <button className="field-btn inline" disabled={saving || (step === 1 && !displayName.trim())} onClick={advance}>{continueLabel}</button>
        </div>
      </div>
    </div>
  );
}

function MacGlyph() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="4" width="17" height="12" rx="2.2" />
      <path d="M8 20h8" />
      <path d="M12 16v4" />
    </svg>
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
        <div className="login__actions">
          <aside className="login__card">
            <div className="login__mark"><Buddy mood="wave" size={56} follow label="Vibe" /></div>
            <div className="login__brand">UNVIBE</div>
            <h2 className="login__tag">Carry your learning <em>forward.</em></h2>
            <p className="login__card-copy">Sign in to sync permitted learning records across devices. Your code and full explanations remain local.</p>
            <SignInForm onDone={onSignedIn} />
          </aside>
          <button type="button" className="login__local" onClick={onSkip}>
            <span className="login__local-icon"><MacGlyph /></span>
            <strong>Open Unvibe on this Mac</strong>
            <small>Keep everything local. No Google needed.</small>
          </button>
        </div>
      </FadeIn>
    </div>
  );
}

function greetFirst(name?: string): string {
  const clean = (name ?? '').trim();
  if (!clean || clean.toLowerCase() === 'there') return '';
  return clean.split(/\s+/)[0] ?? '';
}

function pageLabel(id: string): string {
  if (id === 'Home') return 'Today';
  if (id === 'Chat') return 'Ask Vibe';
  if (id === 'Learn') return 'Library';
  if (id === 'Quiz') return 'Quiz';
  if (id === 'Briefings') return 'Briefs';
  if (id === 'Progress') return 'Momentum';
  if (id === 'Gift') return 'Share';
  return id;
}

/** Today or Yesterday when it is recent, otherwise a short calendar date. */
function shortDate(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  const today = new Date();
  if (when.toDateString() === today.toDateString()) return 'Today';
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (when.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const sameYear = when.getFullYear() === today.getFullYear();
  return when.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}

function dayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function freshnessLabel(status: KnowledgeObject['freshnessStatus']): { text: string; tone: 'current' | 'review' | 'stale' } {
  if (status === 'CURRENT') return { text: 'Current', tone: 'current' };
  if (status === 'MAY_BE_STALE') return { text: 'Review', tone: 'review' };
  return { text: 'Stale', tone: 'stale' };
}

function Home({ shortcut, userName, profile, feed, history, usage, onPlan, onNavigate, onTryVoice }: {
  onTryVoice: () => void;
  shortcut: string;
  userName?: string;
  profile: Profile | null;
  feed: FeedItem[];
  history: LearningItem[];
  usage: AppUsageLine | null;
  onPlan: () => void;
  onNavigate: (page: PageId) => void;
}) {
  const [brief, setBrief] = useState<ChangeBrief | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeObject[]>([]);
  useEffect(() => {
    void window.unvibe.buildChangeBrief({ scope: 'working' }).then((result) => {
      const next = result as { ok?: boolean; brief?: ChangeBrief };
      if (next?.ok && next.brief && !next.brief.empty) setBrief(next.brief);
    });
    void window.unvibe.listKnowledge().then((result) => {
      const next = result as { ok?: boolean; items?: KnowledgeObject[] };
      if (next?.ok) setKnowledge(next.items ?? []);
    });
  }, []);
  const first = greetFirst(userName);
  const explainDisabled = !!usage && usage.remaining <= 0;
  const startReview = () => window.unvibe.companionReview();
  const savedKnowledge = knowledge.filter((item) => item.freshnessStatus === 'CURRENT').slice(0, 5);
  // Until the knowledge index has entries, show the latest saved lessons instead.
  const saved = savedKnowledge.length
    ? savedKnowledge.map((item) => ({ id: item.id, title: item.title, meta: item.file || item.repositoryId || item.sourceType, ts: item.updatedAt }))
    : history.filter((item) => item.outcome !== 'needs_review').slice(0, 5).map((item) => ({ id: item.id, title: item.title, meta: item.file || item.project || item.meta, ts: item.ts }));
  const stale = knowledge.filter((item) => item.freshnessStatus !== 'CURRENT').slice(0, 4);
  const briefings = feed.slice(0, 4);
  const learningSteps: Array<{ id: string; title: string; copy: string; icon: string; done: boolean; run: () => void }> = [
    { id: '01', title: 'Review a change', copy: `Select code and press ${shortcut}.`, icon: IC.spark, done: (profile?.reviews ?? 0) > 0, run: startReview },
    { id: '02', title: 'Save the lesson', copy: 'Mark the explanation understood.', icon: IC.study, done: (profile?.understood ?? 0) > 0, run: () => onNavigate('Learn') },
    { id: '03', title: 'Take a quick quiz', copy: 'Check whether the idea stuck.', icon: IC.quiz, done: false, run: () => onNavigate('Quiz') },
    { id: '04', title: 'Ask one more thing', copy: 'Follow the question while it is fresh.', icon: IC.chat, done: false, run: () => onNavigate('Chat') },
    { id: '05', title: 'Read the change brief', copy: 'See the story before you commit.', icon: IC.briefings, done: briefings.length > 0, run: () => onNavigate('Briefings') },
    { id: '06', title: 'Build your rhythm', copy: 'Return tomorrow and keep the streak.', icon: IC.progress, done: (profile?.streak ?? 0) > 1, run: () => onNavigate('Progress') },
  ];
  const completedSteps = learningSteps.filter((step) => step.done).length;
  const nextStep = learningSteps.find((step) => !step.done) ?? learningSteps[0]!;
  const concepts = (profile?.conceptsFamiliar ?? 0) + (profile?.conceptsStrong ?? 0);
  const streak = profile?.streak ?? 0;
  const upNext = learningSteps.filter((step) => !step.done).slice(0, 3);
  const note = explainDisabled ? 'out of explains this month, catch you soon'
    : brief ? 'you changed some code, want the story?'
      : (profile?.understood ?? 0) === 0 ? 'select any code and press ' + shortcut + ', I got you'
        : streak > 1 ? `${streak} days in a row, nice!` : 'ready when you are';
  return (
    <div className="today">
      <header className="today-hero">
        <Buddy mood={explainDisabled ? 'sleepy' : 'wave'} size={68} follow label="Vibe" />
        <div className="today-hero__copy">
          <h1>{dayGreeting()}{first ? <>, <em>{first}.</em></> : <em>.</em>}</h1>
          <p className="hand-note">{note}</p>
        </div>
      </header>
      <div className="stickers" aria-label="Learning overview">
        <span className="sticker sticker--lime"><b>{profile?.linesUnderstood ?? 0}</b> lines understood</span>
        <span className="sticker sticker--sky"><b>{profile?.understood ?? 0}</b> reviews</span>
        <span className="sticker sticker--sun"><b>{streak}</b> day streak</span>
        <span className="sticker sticker--lilac"><b>{concepts}</b> concepts</span>
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
      <button type="button" className="today-cta" onClick={brief ? () => onNavigate('Briefings') : startReview} disabled={!brief && explainDisabled}>
        <span className="today-cta__text">
          <b>{brief ? `Review what changed: ${brief.filesChanged} file${brief.filesChanged === 1 ? '' : 's'}` : 'Explain any code, right where it is'}</b>
          <small>{brief
            ? `${brief.filesChanged} files changed${brief.repo ? ` in ${brief.repo.split(/[\\/]/).filter(Boolean).pop()}` : ''} · ${brief.understandBeforeCommit.length} worth reviewing`
            : 'Select code in any app. Vibe pops up beside it.'}</small>
        </span>
        <span className="today-cta__key">{brief ? 'Review' : shortcut}</span>
      </button>
      <button type="button" className="voice-cta" onClick={onTryVoice}>
        <span className="voice-cta__mic" aria-hidden="true">🎙</span>
        <span className="voice-cta__text">
          <b>Try voice: ask Vibe out loud</b>
          <small>Press fn twice, talk about your code, press Return. No typing.</small>
        </span>
        <span className="voice-cta__go" aria-hidden="true">→</span>
      </button>
      <div className="today-cols">
        {upNext.length ? (
          <section className="today-sec">
            <header><h2>Up next</h2><span>{completedSteps} of {learningSteps.length} done</span></header>
            <ol className="rows">
              {upNext.map((step) => (
                <li key={step.id}>
                  <button type="button" className={`row${step.id === nextStep.id ? ' is-next' : ''}`} onClick={step.run}>
                    <span className="row__mark" aria-hidden="true">{step.id === nextStep.id ? '→' : '○'}</span>
                    <span className="row__title">{step.title}</span>
                    <span className="row__meta">{step.copy}</span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        ) : null}
        <section className="today-sec">
          <header><h2>Recently understood</h2><button type="button" className="link-btn" onClick={() => onNavigate('Learn')}>See all</button></header>
          {saved.length ? (
            <ul className="rows">
              {saved.map((item) => (
                <li key={item.id}><button type="button" className="row" onClick={() => onNavigate('Learn')}>
                  <span className="row__mark" aria-hidden="true">✓</span>
                  <span className="row__title">{item.title}</span>
                  <span className="row__meta">{item.meta}</span>
                  <time dateTime={item.ts}>{shortDate(item.ts)}</time>
                </button></li>
              ))}
              {stale.slice(0, 2).map((item) => {
                const mark = freshnessLabel(item.freshnessStatus);
                return (
                  <li key={item.id}><button type="button" className="row" onClick={() => onNavigate('Learn')}>
                    <span className="row__mark" aria-hidden="true">!</span>
                    <span className="row__title">{item.title}</span>
                    <span className="status-pill" data-tone={mark.tone}>{mark.text}</span>
                    <time dateTime={item.updatedAt}>{shortDate(item.updatedAt)}</time>
                  </button></li>
                );
              })}
            </ul>
          ) : <p className="rows-empty hand-note">nothing yet. your first explanation lands here!</p>}
        </section>
      </div>
    </div>
  );
}

function Progress({ profile }: { profile: Profile | null }) {
  const [knowledge, setKnowledge] = useState<KnowledgeObject[] | null>(null);
  useEffect(() => {
    void window.unvibe.listKnowledge().then((result) => {
      const next = result as { ok?: boolean; items?: KnowledgeObject[] };
      if (next?.ok) setKnowledge(next.items ?? []);
    });
  }, []);
  const heat = profile?.heat ?? Array.from({ length: 182 }, () => 0);
  const coverage = profile && profile.linesReviewed > 0
    ? `${Math.round((profile.linesUnderstood / profile.linesReviewed) * 100)}%`
    : null;
  const freshness = knowledge && knowledge.length
    ? `${knowledge.filter((item) => item.freshnessStatus === 'CURRENT').length} of ${knowledge.length} current`
    : null;
  return (
    <>
      <div className="topline"><h1>Momentum</h1></div>
      <p className="lead">What you have actually understood on this Mac. No invented scores.</p>
      <div className="metrics">
        <article className="metric-card"><span className="v">{coverage ?? '—'}</span><span className="l">Understanding Coverage</span><span className="note">{coverage ? `${profile?.linesUnderstood ?? 0} of ${profile?.linesReviewed ?? 0} lines` : 'Not enough data yet.'}</span></article>
        <article className="metric-card"><span className="v">{freshness ?? '—'}</span><span className="l">Knowledge Freshness</span><span className="note">{freshness ?? 'Not enough data yet.'}</span></article>
        <article className="metric-card"><span className="v">{profile ? profile.reviews : '—'}</span><span className="l">Briefings Completed</span><span className="note">{profile ? `${profile.needsReview} still to revisit` : 'Not enough data yet.'}</span></article>
        <article className="metric-card"><span className="v">{profile ? profile.needsReview : '—'}</span><span className="l">Knowledge Revisited</span><span className="note">{profile && profile.needsReview > 0 ? 'Marked to revisit' : 'Not enough data yet.'}</span></article>
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
  const [teamsAvailable, setTeamsAvailable] = useState(false);
  const [seats, setSeats] = useState(3);
  const [teamName, setTeamName] = useState('');
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
    const result = await window.unvibe.billingOverview() as { ok: boolean; data?: { overview: BillingOverview; checkoutAvailable: boolean; teamsAvailable?: boolean }; error?: string };
    if (!result.ok || !result.data) {
      setOverview(null);
      setMessage(result.error ?? 'Could not load cloud plan. Local limits still apply.');
      return;
    }
    setOverview(result.data.overview);
    setAvailable(result.data.checkoutAvailable);
    setTeamsAvailable(Boolean(result.data.teamsAvailable));
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

  const teamsCheckout = async () => {
    if (!signedIn) {
      setMessage('Sign in to start a team. Google approval happens in the browser.');
      return;
    }
    setBusy(true); setMessage('');
    const result = await window.unvibe.startBillingCheckout({ plan: 'teams', interval, seats, workspaceName: teamName.trim() || 'My team' }) as { ok: boolean; error?: string };
    if (!result.ok) setMessage(result.error ?? 'Teams checkout could not start.');
    setBusy(false);
  };
  const teamsTotal = interval === 'annual' ? seats * 72 : seats * 8;
  const teamsCard = (
    <article className="plan-pick__card plan-pick__card--teams">
      <span>For clubs, classes and small teams</span>
      <h2>Teams $8/seat{interval === 'annual' ? ' · $72/yr' : '/mo'}</h2>
      <p>One shared workspace, invites, and who reviewed what. 2 to 20 seats. Each person keeps their explanations on their own Mac.</p>
      <div className="teams-form">
        <label>Team name<input value={teamName} maxLength={60} placeholder="My team" onChange={(e) => setTeamName(e.target.value)} /></label>
        <label>Seats
          <span className="seat-step">
            <button type="button" aria-label="Fewer seats" onClick={() => setSeats((n) => Math.max(2, n - 1))} disabled={seats <= 2}>−</button>
            <b aria-live="polite">{seats}</b>
            <button type="button" aria-label="More seats" onClick={() => setSeats((n) => Math.min(20, n + 1))} disabled={seats >= 20}>+</button>
          </span>
        </label>
      </div>
      <p className="plan-pick__terms">${teamsTotal} {interval === 'annual' ? 'per year' : 'per month'} for {seats} seats, until canceled. Change seats later from this page.</p>
      {teamsAvailable ? (
        <button type="button" className="primary-btn" onClick={() => void teamsCheckout()} disabled={busy}>{signedIn ? 'Start Teams' : 'Sign in to start Teams'}</button>
      ) : (
        <button type="button" className="soft-btn" onClick={() => void window.unvibe.openUrl(`https://unvibe.site/pricing#teams`)}>Request Teams seats</button>
      )}
    </article>
  );

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

        {showUpgrade && upgradeIsPro && (
          <article className="plan-pick__card is-upgrade">
            <span>Upgrade available</span>
            {upgradeIsPro ? (
              <>
                <h2>Pro {interval === 'annual' ? '$81/yr' : '$9/mo'}</h2>
                <p>Unlock git diffs, nearby files, and 100 explanations each month.</p>
                <div className="plan-toggle" aria-label="Billing interval">
                  <button type="button" className={interval === 'monthly' ? 'on' : ''} onClick={() => setInterval('monthly')} aria-pressed={interval === 'monthly'}>Monthly</button>
                  <button type="button" className={interval === 'annual' ? 'on' : ''} onClick={() => setInterval('annual')} aria-pressed={interval === 'annual'}>Annual<span>Save 25%</span></button>
                </div>
                <p className="plan-pick__terms" id="pro-renewal-terms">
                  {interval === 'annual'
                    ? 'Pro renews at $81 per year until canceled.'
                    : 'Pro renews at $9 per month until canceled.'}
                  {' '}Review today’s total and any promotion in Stripe Checkout. Manage or cancel later from this page.
                </p>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => void checkout()}
                  disabled={busy || (signedIn && !available)}
                  aria-describedby="pro-renewal-terms"
                >
                  {signedIn ? 'Upgrade to Pro' : 'Sign in to upgrade'}
                </button>
              </>
            ) : null}
          </article>
        )}
        {currentPlan !== 'teams' && !compact ? teamsCard : null}
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
    bridgeInstalled?: boolean;
    bridgeAvailable?: boolean;
  }> | null>(null);
  const [installing, setInstalling] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const load = () => void window.unvibe.integrations().then((result) => setItems(result as typeof items));
  useEffect(load, []);
  const installBridge = async (id: string, name: string) => {
    if (id !== 'cursor' && id !== 'vscode') return;
    if (installing) return;
    setInstalling(id);
    setMessage('');
    const result = await window.unvibe.installDesktopBridge(id) as { ok?: boolean; error?: string };
    setInstalling(null);
    if (!result?.ok) {
      setMessage(result?.error ?? `Could not install the ${name} bridge.`);
      return;
    }
    setMessage(`${name} bridge installed. Reload ${name} if it is open.`);
    load();
  };
  if (!items) return <div className="settings-empty">Checking this Mac…</div>;
  const groups = ['Editors', 'Agents', 'Shell', 'Workspace'].map((group) => ({
    group,
    rows: items.filter((item) => item.group === group),
  })).filter((item) => item.rows.length > 0);
  return (
    <div className="integ">
      <p className="integ__lead">Unvibe sits beside tools you already have. Detected means the app is on this Mac. Bridge ready means Command U can send the editor selection directly.</p>
      {message ? <div className="integ__message" role="status">{message}</div> : null}
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
                    <span className={`integration-state ${item.state}`}>{item.bridgeInstalled ? 'Bridge ready' : item.state === 'not-installed' ? 'Not installed' : item.state === 'detected' ? 'Detected' : 'Available'}</span>
                  </div>
                  <small>{item.blurb}</small>
                  <p>{item.detail}</p>
                  {(item.id === 'cursor' || item.id === 'vscode') && item.state === 'detected' && !item.bridgeInstalled ? (
                    <button
                      type="button"
                      className="act integ-card__action"
                      disabled={Boolean(installing) || !item.bridgeAvailable}
                      onClick={() => void installBridge(item.id, item.name)}
                    >
                      {installing === item.id ? 'Installing…' : item.bridgeAvailable ? 'Install Desktop Bridge' : 'Bridge package unavailable'}
                    </button>
                  ) : null}
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
  useEffect(() => setTab(initialTab), [initialTab]);
  const [recording, setRecording] = useState(false);
  const [shortcutErr, setShortcutErr] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const recRef = useRef(recording); recRef.current = recording;

  const chooseTab = (next: string) => {
    setTab(next);
    requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: 0, behavior: 'instant' }));
  };

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
          <div className="settings-brand"><span>Settings</span></div>
          <div className="mside-group">
            <div className="mh">PREFERENCES</div>
            {['General', 'Island', 'Sound & alerts', 'Learning', 'Privacy & Data'].map((t) => <button key={t} className={t === tab ? 'on' : ''} onClick={() => chooseTab(t)}><span className="settings-nav-icon"><Icon d={SETTINGS_ICONS[t]!} /></span>{t}</button>)}
          </div>
          <div className="mside-group">
            <div className="mh">UNVIBE</div>
            {['Integrations', 'AI', 'Account & Plan', 'About'].map((t) => <button key={t} className={t === tab ? 'on' : ''} onClick={() => chooseTab(t)}><span className="settings-nav-icon"><Icon d={SETTINGS_ICONS[t]!} /></span>{t}</button>)}
          </div>
          <div className="ver">Unvibe v{info.version}</div>
        </div>
        <div className="mbody" ref={bodyRef}>
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
              <div className="setrow settings-location"><div><div className="sl">Island location</div><div className="sd">Choose where the Island rests. It moves immediately.</div></div>
                <div className="location-grid" role="group" aria-label="Island location">
                  {([['top-center', 'Top'], ['top-right', 'Right'], ['bottom-center', 'Bottom'], ['bottom-right', 'Corner']] as const).map(([position, label]) => <button key={position} type="button" className={settings.barPosition === position ? 'on' : ''} onClick={() => void onSettings({ barPosition: position })}>{label}</button>)}
                </div>
              </div>
              <div className="setrow settings-location"><div><div className="sl">Island size</div><div className="sd">Medium matches the Mac notch. Change it if you want a smaller or larger pill.</div></div>
                <div className="location-grid" role="group" aria-label="Island size">
                  {([['small', 'Small'], ['medium', 'Notch'], ['large', 'Large']] as const).map(([size, label]) => <button key={size} type="button" className={settings.barSize === size ? 'on' : ''} onClick={() => void onSettings({ barSize: size })}>{label}</button>)}
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
              <div className="setrow"><div><div className="sl">Interface sounds</div><div className="sd">Little sounds when Vibe is happy, when an explanation starts and finishes, when you get a quiz right or wrong, and when you move around the app. Nothing is recorded or downloaded.</div></div><Toggle on={settings.soundEffects} onClick={() => onSettings({ soundEffects: !settings.soundEffects })} /></div>
              <div className="setrow"><div><div className="sl">Sound character</div><div className="sd">Soft is subtle. Pixel is sharper and more playful.</div></div><select className="sel-input" value={settings.soundStyle} disabled={!settings.soundEffects} onChange={(e) => onSettings({ soundStyle: e.target.value as Settings['soundStyle'] })}><option value="soft">Soft</option><option value="pixel">Pixel</option></select></div>
              <div className="setrow"><div><div className="sl">Volume</div><div className="sd">{Math.round(settings.soundVolume * 100)}% — stored on this Mac.</div></div><div className="sound-controls"><input className="range" aria-label="Sound volume" type="range" min={0} max={1} step={0.05} disabled={!settings.soundEffects} value={settings.soundVolume} onChange={(e) => onSettings({ soundVolume: Number(e.target.value) })} /><button className="act" disabled={!settings.soundEffects} onClick={() => { playUiTone('boop', settings.soundVolume, settings.soundStyle); window.setTimeout(() => playUiTone('celebrate', settings.soundVolume, settings.soundStyle), 420); }}>Preview</button></div></div>
              <div className="settings-section-label">NOTIFICATIONS</div>
              <div className="setrow"><div><div className="sl">Bar notifications</div><div className="sd">Short, rate-limited messages when an explanation is ready.</div></div><Toggle on={settings.notifications} onClick={() => onSettings({ notifications: !settings.notifications })} /></div>
              <div className="setrow"><div><div className="sl">Quiet hours</div><div className="sd">Silence notifications overnight.</div></div><Toggle on={settings.quietHours.enabled} onClick={() => onSettings({ quietHours: { ...settings.quietHours, enabled: !settings.quietHours.enabled } })} /></div>
              {settings.quietHours.enabled && <div className="setrow"><div><div className="sl">From / to</div><div className="sd">24-hour times.</div></div><div className="danger-row"><input className="time-input" type="time" value={settings.quietHours.start} onChange={(e) => onSettings({ quietHours: { ...settings.quietHours, start: e.target.value } })} /><input className="time-input" type="time" value={settings.quietHours.end} onChange={(e) => onSettings({ quietHours: { ...settings.quietHours, end: e.target.value } })} /></div></div>}
            </>
          )}

          {tab === 'Learning' && <>
            <div className="setrow"><div><div className="sl">Default explanation depth</div><div className="sd">The starting depth for a new explanation. You can always switch it in the overlay.</div></div><select className="sel-input" value={settings.defaultExplanationLevel} onChange={(e) => onSettings({ defaultExplanationLevel: e.target.value as Settings['defaultExplanationLevel'] })}>{STUDY_LEVELS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
            <div className="setrow"><div><div className="sl">Learning records</div><div className="sd">Explanations, quiz results, and concepts save immediately on this Mac. Open Learn to search, revisit, or remove a lesson.</div></div></div>
            <div className="setrow"><div><div className="sl">Change Brief</div><div className="sd">Build a structured brief from the working tree, staged files, latest commit, or branch diff.</div></div><Toggle on={settings.features?.changeBrief !== false} onClick={() => onSettings({ features: { ...settings.features, changeBrief: !settings.features?.changeBrief } })} /></div>
            <div className="setrow"><div><div className="sl">Why does this exist</div><div className="sd">Look up git blame and commit messages. Facts stay separate from inference.</div></div><Toggle on={settings.features?.whyExists !== false} onClick={() => onSettings({ features: { ...settings.features, whyExists: !settings.features?.whyExists } })} /></div>
            <div className="setrow"><div><div className="sl">Teach it back</div><div className="sd">After an explanation, write what you understood. This is evidence, not a score.</div></div><Toggle on={settings.features?.teachBack !== false} onClick={() => onSettings({ features: { ...settings.features, teachBack: !settings.features?.teachBack } })} /></div>
            <div className="setrow"><div><div className="sl">Voice questions</div><div className="sd">Shows a Speak button in the review panel. To talk: click any question box, press fn twice (or 🌐), speak, press fn, then Return. It uses Mac Dictation, so Unvibe never records in the background. <button type="button" className="link-btn" onClick={() => void window.unvibe.openDictation()}>Dictation settings</button></div></div><Toggle on={Boolean(settings.features?.voice)} onClick={() => onSettings({ features: { ...settings.features, voice: !settings.features?.voice } })} /></div>
            <div className="setrow"><div><div className="sl">Live change watch</div><div className="sd">Quiet Island notes after meaningful git edits settle. Debounced, grouped, and silent during quiet hours.</div></div><Toggle on={Boolean(settings.features?.live)} onClick={() => onSettings({ features: { ...settings.features, live: !settings.features?.live } })} /></div>
            {settings.features?.live ? <div className="setrow"><div><div className="sl">Snooze Live</div><div className="sd">Mute Live notices for two hours.</div></div><button className="act" onClick={() => void window.unvibe.snoozeLive(2)}>Snooze 2h</button></div> : null}
          </>}

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
          {tab === 'About' && <><div className="settings-about-mark"><Buddy mood="happy" size={48} label="Vibe" /></div><div className="setrow"><div><div className="sl">Unvibe for macOS</div><div className="sd">Version {info.version}. A private learning layer for understanding AI-generated code.</div></div></div><div className="setrow"><div><div className="sl">Need help?</div><div className="sd">preston@unvibe.site</div></div><button className="act" onClick={() => void window.open('mailto:preston@unvibe.site')}>Email →</button></div></>}
        </div>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState<PageId>('Home');
  const [navOpen, setNavOpen] = useState(false);
  const toggleSideRef = useRef<() => void>(() => {});
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
  const [askDraft, setAskDraft] = useState('');
  const [askSeed, setAskSeed] = useState('');
  const [voiceTip, setVoiceTip] = useState(false);
  const [gate, setGate] = useState<'checking' | 'onboarding' | 'login' | 'app'>('checking');
  const [usageLine, setUsageLine] = useState<AppUsageLine | null>(null);
  const [sideWidth, setSideWidth] = useState(232);
  const sideLive = useRef(232);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lessonSeedId, setLessonSeedId] = useState<string | null>(null);
  const [lessonSeedRevision, setLessonSeedRevision] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

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
        : { used: 0, limit: 50, remaining: 50, resetsAt: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString(), plan: 'local', selections: { used: 0, limit: 50, remaining: 50, resetsAt: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)).toISOString() } });
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
      if (next === 'Settings') {
        setSettingsTab('Island');
        setSettingsOpen(true);
        return;
      }
      const allowed: PageId[] = ['Home', 'Learn', 'Study', 'History', 'Quiz', 'Chat', 'Progress', 'Plan', 'Gift', 'Projects', 'Concepts', 'Notebook', 'Briefings', 'Library', 'Profile'];
      if (!allowed.includes(next as PageId)) return;
      setPage(next === 'History' || next === 'Study' ? 'Learn' : next as PageId);
    });
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchQuery('');
        setSearchOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === ',') {
        event.preventDefault();
        setSettingsTab('General');
        setSettingsOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key === '\\') {
        event.preventDefault();
        toggleSideRef.current();
      }
      if (event.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  // Paper and ink: a light, playful companion next to the dark explain panel.
  useEffect(() => {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.dataset.ui = 'v3';
    document.documentElement.dataset.v7 = '';
  }, []);
  useEffect(() => {
    configureTones({ enabled: settings?.soundEffects ?? true, volume: settings?.soundVolume ?? 0.3, style: settings?.soundStyle ?? 'soft' });
  }, [settings?.soundEffects, settings?.soundVolume, settings?.soundStyle]);
  // Ask for a rating once, after the third explanation, when it means something.
  useEffect(() => {
    if (gate !== 'app' || (profile?.reviews ?? 0) < 3) return;
    let asked = false;
    try { asked = window.localStorage.getItem(FEEDBACK_ASKED_KEY) === '1'; } catch { asked = true; }
    if (asked) return;
    const t = window.setTimeout(() => setFeedbackOpen(true), 2500);
    return () => window.clearTimeout(t);
  }, [gate, profile?.reviews]);
  // Vibe says hi whenever you open a new page.
  const firstPage = useRef(true);
  useEffect(() => {
    if (gate !== 'app') return;
    if (firstPage.current) firstPage.current = false;
    else playTone('nav');
    setBuddyMood('wave');
    const t = window.setTimeout(() => setBuddyMood('idle'), 1600);
    return () => window.clearTimeout(t);
  }, [page, gate]);

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
  const fillPage = isLearnPage || page === 'Chat' || page === 'Briefings';
  const chatLabel = settings?.useOwnAi
    ? settings.aiProvider.charAt(0).toUpperCase() + settings.aiProvider.slice(1)
    : 'Unvibe AI';
  const sideCompact = sideWidth < 178;
  const sideHidden = settings?.sidebarHidden ?? false;
  toggleSideRef.current = () => void applySettings({ sidebarHidden: !sideHidden });
  const searchGroups = (() => {
    const query = searchQuery.trim().toLowerCase();
    const matches = (value: string) => !query || value.toLowerCase().includes(query);
    const close = () => { setSearchOpen(false); setSearchQuery(''); };
    const lessons = history
      .filter((item) => matches([item.title, item.meta, item.file, item.project, item.language, item.concept].filter(Boolean).join(' ')))
      .slice(0, 10)
      .map((item) => ({
        id: `lesson-${item.id}`,
        title: item.title,
        detail: item.meta || [item.file, item.language, item.level].filter(Boolean).join(' · '),
        run: () => {
          setLessonSeedId(item.id);
          setLessonSeedRevision((revision) => revision + 1);
          setPage('Learn');
          close();
        },
      }));
    const pages = NAV
      .map((item) => ({
        id: `page-${item.id}`,
        title: pageLabel(item.id),
        detail: item.id === 'Learn' ? 'Saved explanations' : item.id === 'Chat' ? 'Ask about this codebase' : item.id === 'Quiz' ? 'Check understanding' : 'Open page',
        run: () => { setLessonSeedId(null); setPage(item.id); close(); },
      }))
      .filter((item) => matches(`${item.title} ${item.detail}`));
    const actions = [
      { id: 'action-review', title: 'Explain selected code', detail: `Select code and press ${shortcutLabel}`, run: () => { window.unvibe.companionReview(); close(); } },
      { id: 'action-settings', title: 'Open Settings', detail: 'Appearance, Island, AI, privacy, and account', run: () => { setSettingsTab('General'); setSettingsOpen(true); close(); } },
    ].filter((item) => matches(`${item.title} ${item.detail}`));
    return [
      { label: 'Lessons', items: lessons },
      { label: 'Navigation', items: pages },
      { label: 'Actions', items: actions },
    ].filter((group) => group.items.length > 0) as SearchPaletteGroup[];
  })();

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
    return (<><div className="titlebar" /><Onboarding soundEffects={settings?.soundEffects ?? true} soundVolume={settings?.soundVolume ?? 0.3} soundStyle={settings?.soundStyle ?? 'soft'} onDone={async () => { await refresh(); setGate('app'); }} /></>);
  }
  if (gate === 'login') {
    return (<><div className="titlebar" /><LoginScreen shortcut={settings?.shortcut ?? 'CommandOrControl+U'} onSignedIn={async () => { await refresh(); setGate('app'); }} onSkip={() => setGate('app')} /></>);
  }

  return (
    <>
      <div className="titlebar">
        <div className="shell-tools">
          <button type="button" aria-controls="companion-sidebar" aria-expanded={!sideHidden} aria-label={sideHidden ? 'Show sidebar' : 'Hide sidebar'} title={sideHidden ? 'Show sidebar (⌘\\)' : 'Hide sidebar (⌘\\)'} onClick={() => toggleSideRef.current()}>
            <Icon d="M4 4h12v12H4z M7 4v12" />
          </button>
        </div>
      </div>
      <div className={`layout${navOpen ? ' layout--nav-open' : ''}${sideHidden ? ' layout--side-hidden' : ''}`}>
        {navOpen ? <button type="button" className="nav-scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} /> : null}
        <aside id="companion-sidebar" hidden={sideHidden} className={`side fade-in fade-in--side${sideCompact ? ' side--compact' : ''}`} style={{ width: sideWidth }}>
          <div className="brand"><Buddy size={22} label="Vibe" /><span className="name">Unvibe</span><span className="badge">Beta</span></div>
          <button type="button" className="side-search" onClick={() => { setSearchQuery(''); setSearchOpen(true); }} aria-label="Search">
            <Icon d="M8.5 14a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z M12.5 12.5L16 16" />
            <span className="nav-label">Search</span>
            <kbd>⌘K</kbd>
          </button>
          <nav className="nav nav--top">{NAV_PINNED.map((p) => {
            const on = p.id === page;
            const label = pageLabel(p.id);
            return (
              <button key={p.id} type="button" className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} aria-label={label} title={sideCompact ? label : undefined} onClick={() => { setAskSeed(''); setLessonSeedId(null); setPage(p.id); setNavOpen(false); }}>
                <Icon d={p.icon} /><span className="nav-label">{label}</span>
              </button>
            );
          })}</nav>
          <p className="side-spaces">Learn</p>
          <nav className="nav nav--spaces">{NAV_SPACES.map((p) => {
            const on = p.id === page || (p.id === 'Learn' && (page === 'Study' || page === 'History'));
            const label = pageLabel(p.id);
            return (
              <button key={p.id} type="button" className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} aria-label={label} title={sideCompact ? label : undefined} onClick={() => { setAskSeed(''); setLessonSeedId(null); setPage(p.id); setNavOpen(false); }}>
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
            {sync.pending > 0 && sync.phase !== 'local' && <small>{sync.pending} pending</small>}
          </button>
          {usageLine ? (
            <button type="button" className="side-usage" onClick={() => setPage('Plan')} title="Plan and usage">
              <span className="side-usage__row"><span>{planLabel(usageLine.plan)} plan</span><b>{usageLine.remaining} left</b></span>
              <i className="side-usage__bar"><i style={{ width: `${usageLine.limit ? Math.min(100, (usageLine.used / usageLine.limit) * 100) : 0}%` }} /></i>
            </button>
          ) : null}
          <button type="button" className="side-settings" onClick={() => { setNavOpen(false); setSettingsTab('General'); setSettingsOpen(true); }}>
            <Icon d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M16.2 11.6l1.3 1-1.6 2.8-1.6-.6a6.3 6.3 0 0 1-1.6.9l-.3 1.7H9.2l-.3-1.7a6.3 6.3 0 0 1-1.6-.9l-1.6.6-1.6-2.8 1.3-1a6.4 6.4 0 0 1 0-1.8l-1.3-1 1.6-2.8 1.6.6a6.3 6.3 0 0 1 1.6-.9l.3-1.7h3.2l.3 1.7c.6.2 1.1.5 1.6.9l1.6-.6 1.6 2.8-1.3 1c.1.6.1 1.2 0 1.8z" />
            <span className="nav-label">Settings</span>
          </button>
          <AccountMenu
            name={settings?.displayName?.trim() || info.user || 'You'}
            email={account?.email || settings?.profileEmail || undefined}
            planLabel={planLabel(usageLine?.plan)}
            signedIn={Boolean(account)}
            compact={sideCompact}
            version={info.version}
            onSettings={() => { setNavOpen(false); setSettingsTab('General'); setSettingsOpen(true); }}
            onShortcuts={() => { setNavOpen(false); setSettingsTab('General'); setSettingsOpen(true); }}
            onPlan={() => { setNavOpen(false); setPage('Plan'); }}
            onInvite={() => { setNavOpen(false); setPage('Gift'); }}
            onFeedback={() => { setNavOpen(false); setFeedbackOpen(true); }}
            onSignIn={() => setGate('login')}
            onSignOut={async () => {
              await window.unvibe.signOut();
              const { acct } = await refresh();
              if (!acct) flash('Signed out. Your learning stays on this computer.');
            }}
          />
          <button type="button" className="side-resize" aria-label="Resize sidebar" title="Drag to resize, double-click to reset" onPointerDown={startSideResize} onDoubleClick={() => { sideLive.current = 204; setSideWidth(204); void applySettings({ sidebarWidth: 204 }); }} />
        </aside>
        <main className="content">
          <header className="topbar">
            <button type="button" className="nav-toggle" aria-label="Open menu" onClick={() => setNavOpen(true)}>
              <Icon d="M3 6h14 M3 10h14 M3 14h14" />
            </button>
            <h2 className="topbar__title">{pageLabel(page === 'Study' || page === 'History' ? 'Learn' : page)}</h2>
            <span className="topbar__spacer" />
            <button type="button" className="topbar__search" onClick={() => { setSearchQuery(''); setSearchOpen(true); }} aria-label="Search">
              <Icon d="M8.5 14a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z M12.5 12.5L16 16" /><kbd>⌘K</kbd>
            </button>
            <button type="button" className="topbar__explain" onClick={() => window.unvibe.companionReview()} disabled={!!usageLine && usageLine.remaining <= 0}>
              <kbd>{shortcutLabel}</kbd><span>Explain</span>
            </button>
          </header>
          <div className={`page${fillPage ? ' page--learn' : ''}${page === 'Home' ? ' page--home' : ''}`}>
            <FadeIn animKey={page} stagger={!fillPage}>
              {page === 'Home' ? <Home shortcut={shortcutLabel} userName={info.user} profile={profile} feed={feed} history={history} usage={usageLine} onPlan={() => setPage('Plan')} onNavigate={(nextPage) => setPage(nextPage)} onTryVoice={() => { setVoiceTip(true); setPage('Chat'); }} />
                : isLearnPage ? <Learn
                  key={`${page}:${lessonSeedId ?? ''}:${lessonSeedRevision}`}
                  history={history}
                  queue={queue}
                  shortcut={shortcutLabel}
                  intent={page === 'Quiz' ? 'quiz' : 'learn'}
                  initialOpenId={lessonSeedId}
                  onReview={() => window.unvibe.companionReview()}
                  onRefresh={() => void refresh()}
                  onRestudy={async (item, level) => {
                    const r = await window.unvibe.reopenLearningItem({ ...item, level }) as { ok?: boolean; cancelled?: boolean; error?: string };
                    if (!r?.ok && !r?.cancelled) flash(r?.error ?? 'Could not reopen that lesson.');
                  }}
                />
                : page === 'Chat' ? <Chat
                  initialDraft={askSeed}
                  providerLabel={chatLabel}
                  usingOwnAi={Boolean(settings?.useOwnAi)}
                  providerId={settings?.aiProvider ?? 'gemini'}
                  userName={info.user}
                  usage={usageLine}
                  onRefresh={() => void refresh()}
                  onOpenAiSettings={() => { setSettingsTab('AI'); setSettingsOpen(true); }}
                  voiceTip={voiceTip}
                />
                : page === 'Progress' ? <Progress profile={profile} />
                : page === 'Plan' ? <Plan signedIn={Boolean(account)} onSignedIn={() => { void refresh(); }} />
                : page === 'Gift' ? <Gift />
                : page === 'Briefings' ? <Briefings />
                : <Explainer page={PAGES[page]} shortcut={shortcutLabel} />}
            </FadeIn>
          </div>
          {page !== 'Chat' && (
            <form className="ask-dock" onSubmit={(event) => {
              event.preventDefault();
              setAskSeed(askDraft.trim());
              setAskDraft('');
              setPage('Chat');
            }}>
              <span className="ask-dock__shortcut" aria-hidden="true">{shortcutLabel}</span>
              <input aria-label="Ask Unvibe" placeholder="Ask Vibe about your code…" value={askDraft} onChange={(event) => setAskDraft(event.target.value)} />
              <button type="submit">{askDraft.trim() ? 'Ask ↵' : 'Ask Vibe'}</button>
            </form>
          )}
        </main>
      </div>
      <FloatingBuddy
        userName={settings?.displayName?.trim() || info.user}
        hidden={page === 'Chat' || settingsOpen}
        onOpenChat={() => { setAskSeed(''); setPage('Chat'); }}
      />
      {searchOpen && !settingsOpen ? <SearchPalette groups={searchGroups} query={searchQuery} onQuery={setSearchQuery} onClose={() => setSearchOpen(false)} /> : null}
      {settingsOpen && settings && (
        <Settings info={info} account={account} settings={settings}
          initialTab={settingsTab}
          onAccountChange={async () => { const { acct } = await refresh(); if (!acct) setGate('app'); }}
          onAccountDeleted={() => { setSettingsOpen(false); setAccount(null); setProfile(null); setFeed([]); setGate('login'); }}
          onSettings={applySettings} onClose={() => setSettingsOpen(false)} onNotice={flash} />
      )}
      <UpdateCard />
      {feedbackOpen ? <FeedbackCard onClose={() => setFeedbackOpen(false)} /> : null}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
