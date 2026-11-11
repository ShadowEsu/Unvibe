import { useEffect, useRef, useState, type ReactNode } from 'react';
import { UpdateCard } from './update';
import { createRoot } from 'react-dom/client';
import { LogoMark } from '../shared/logo';
import { Learn } from './learn';
import { linesLabel } from '../../core/linesLabel';
import { Chat } from './chat';
import { Gift } from './gift';
import { configureTones, playTone, playUiTone } from '../shared/tones';
import { prettyShortcut, shortcutCaps } from '../shared/prettyShortcut';
import { giftStatusLine, paidStatusLine, proCard, resetLabel } from '../shared/planStatus';
import { deviceName, isMac, isWindows, modKey, platformAttr, reviewKeyHint } from '../shared/platform';
import { SearchPalette, type SearchPaletteGroup } from './searchPalette';
import { GoogleMark } from '../shared/googleMark';
import { Briefings } from './briefings';
import type { KnowledgeObject } from '../../core/knowledge';
import '../shared/tokens.css';
import { AccountMenu } from './accountMenu';
import { FeedbackCard, FEEDBACK_ASKED_KEY } from './feedback';
import { DeletionNotice } from './deletionNotice';
import { Buddy, setBuddyMood } from '../shared/buddy';
import { VibeBubble } from '../shared/vibeBubble';
import { firstNameOf, forwardAction, onboardingSteps, stepAction, vibeLine, welcomeBackLine, type OnboardingState } from './onboardingFlow';
import { accessibilityRow, type AccessibilityState } from './settingsRows';
import { FADE_OPACITY } from '../widget/clickAway';
import { Home, type TodayGoal } from './home';
import { IC } from './icons';
import { InkTitle } from './inkTitle';
import { NAV, NAV_PINNED, NAV_SPACES, pageLabel, type PageId } from './nav';
import { trackWindowAway } from '../shared/windowAway';
import { askForConsent, ConsentDialog } from '../shared/consentForm';
import { CONSENT_PROVIDERS } from '../../core/consent';
import { SUPPORT_EMAIL } from '../../core/support';
import type { ConsentStatus } from '../../main/consent';
import { PasteTarget } from '../shared/pasteTarget';
import { ShortcutGuide, turnOnShortcut, watchGrant } from '../shared/shortcutGuide';
import { SettingsIcon } from './settingsIcons';
import { SharksIntro, type IntroPhase } from '../shared/sharks/SharksIntro';
import { CountUp } from '../shared/countUp';
import { SlidingPill } from '../shared/slidingThumb';

/** The last-known "Start animation" setting, read before the settings arrive so the stage is on from the first frame. */
const START_ANIMATION_KEY = 'unvibe.startAnimation';

interface Feature { icon: string; t: string; d: string }
interface PageDef { id: PageId; icon: string; lead: string; features: Feature[] }

interface Profile {
  reviews: number; understood: number; needsReview: number;
  linesUnderstood: number; linesReviewed: number;
  conceptsSeen: number; conceptsDeveloping: number; conceptsFamiliar: number;
  conceptsStrong: number; conceptsNeedReview: number;
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
  barSize: 'small' | 'medium' | 'large';
  followActiveDisplay: boolean; soundEffects: boolean; startAnimation?: boolean;
  soundVolume: number; soundStyle: 'soft' | 'pixel';
  inactiveBehavior: 'fade' | 'hide';
  launchAtLogin: boolean; theme: 'system' | 'light' | 'dark'; notifications: boolean;
  quietHours: { enabled: boolean; start: string; end: string };
  defaultExplanationLevel: typeof STUDY_LEVELS[number]['id'];
  displayName: string;
  profileEmail: string;
  useOwnAi: boolean;
  aiProvider: 'gemini' | 'anthropic' | 'openai' | 'grok' | 'deepseek' | 'kimi';
  sidebarWidth: number;
  sidebarHidden: boolean;
  shareSetupProgress: boolean;
  nearbyFiles: boolean;
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
  subscription: { plan: 'free' | 'pro' | 'teams'; interval: 'monthly' | 'annual' | null; status: string; seats: number; currentPeriodEnd?: string; cancelAtPeriodEnd?: boolean };
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

/** The free plan has one name everywhere, "Free": signed in, the public-beta trial, or counted locally. */
function planLabel(plan: string | undefined): string {
  switch (plan) {
    case 'pro': return 'Pro';
    case 'teams': return 'Teams';
    case 'full': return 'Full access';
    default: return 'Free';
  }
}

function asPlanId(value: string | undefined): PlanId {
  if (value === 'pro' || value === 'teams' || value === 'full' || value === 'trial' || value === 'local') return value;
  return 'free';
}

/** Shown after the plan name; the free plan has none. */
function planPriceLabel(plan: PlanId, interval: 'monthly' | 'annual' | null): string | null {
  if (plan === 'full') return 'Included';
  if (plan === 'pro') return interval === 'annual' ? '$81/yr' : '$9/mo';
  if (plan === 'teams') return interval === 'annual' ? '$72/seat/yr' : '$8/seat';
  return null;
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
    { icon: IC.code, t: 'Gotchas and near-misses', d: 'The mistakes people make with each idea, so you spot them early.' },
    { icon: IC.check, t: 'A quick check', d: 'One question adds evidence without pretending Unvibe knows exactly what you understand.' },
  ] },
  Notebook: { id: 'Notebook', icon: IC.notebook, lead: 'The keeper for anything worth a second look — explanations, diagrams, and the back-and-forth you had with Unvibe.', features: [
    { icon: IC.notebook, t: 'Saved explanations', d: 'Star an explanation in any widget and it lands here, searchable.' },
    { icon: IC.layers, t: 'Diagrams', d: 'Execution flows and structure sketches, kept next to the code they describe.' },
    { icon: IC.code, t: 'Threads', d: 'Whole follow-up conversations, not just the first answer.' },
    { icon: IC.clock, t: 'Nothing evaporates', d: 'Close a widget without worry — what you kept is still here tomorrow.' },
  ] },
  Briefings: { id: 'Briefings', icon: IC.briefings, lead: 'Short recaps of what changed and what you picked up — a two-minute read each morning, a longer one each week.', features: [
    { icon: IC.clock, t: 'Morning recap', d: 'What the agents changed overnight, told as a story rather than a diff.' },
    { icon: IC.check, t: 'Weekly review', d: 'The concepts you locked in and the ones worth revisiting.' },
    { icon: IC.eye, t: 'Written for skimming', d: 'Headline first, detail underneath — read as deep as you have time for.' },
    { icon: IC.code, t: 'Only what moved', d: 'Quiet days stay quiet. Briefings appear when there is something to say.' },
  ] },
  Library: { id: 'Library', icon: IC.library, lead: 'Hand-picked reading matched to whatever you are learning right now — guides and roadmaps, minus the rabbit holes.', features: [
    { icon: IC.map, t: 'Roadmaps', d: 'The shape of a topic end to end, so you know what is left to learn.' },
    { icon: IC.eye, t: 'Focused guides', d: 'Chosen to match your open concepts — no endless tab-hoarding.' },
    { icon: IC.layers, t: 'Reference you keep', d: 'The pages you return to, gathered in one calm place.' },
    { icon: IC.check, t: 'Tied to your work', d: 'Every pick connects back to code you are actually reviewing.' },
  ] },
  Profile: { id: 'Profile', icon: IC.profile, lead: 'The long view of your learning — evidence you have built, ideas to revisit, and everything you have reviewed.', features: [
    { icon: IC.code, t: 'Milestones', d: 'Quiet, earned markers — first repo understood, first concept you can teach back.' },
    { icon: IC.check, t: 'Evidence map', d: 'Concepts use cautious labels such as developing, familiar, strong, or needs review.' },
    { icon: IC.clock, t: 'Review history', d: 'A full trail of what you looked at and when.' },
    { icon: IC.layers, t: 'Your history', d: 'The record stays grounded in checks you actually completed.' },
  ] },
};

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

function PermRow() {
  const [state, setState] = useState<AccessibilityState | null>(null);
  const check = () => void window.unvibe.accessibility().then((r) => setState(r as AccessibilityState));
  useEffect(() => {
    check();
    const t = setInterval(check, 2500); // reflect a grant made in System Settings without a manual re-check
    return () => clearInterval(t);
  }, []);
  const row = accessibilityRow(state);
  const [asked, setAsked] = useState(false);
  // One button does what a person expects: macOS shows its prompt and the right Settings pane opens.
  const allow = async () => {
    setAsked(true);
    await window.unvibe.promptAccessibility();
    await window.unvibe.openAccessibility();
  };
  return (
    <div className="setrow">
      <div>
        <div className="sl">Accessibility</div>
        <div className="sd">{isWindows
          ? `Nothing to allow on Windows. Ctrl+Alt+U copies the code you selected in any app, then sends it to ${CONSENT_PROVIDERS.unvibe} through Unvibe to explain it.`
          : `macOS asks once. Unvibe uses it only to copy the code you selected when you press Control+U, then sends that code to ${CONSENT_PROVIDERS.unvibe} through Unvibe to explain it. It never reads your keystrokes or your screen.`}</div>
        {row.canAllow && asked && (
          <p className="perm-steps">In the list that opened, switch <b>Unvibe</b> on. This screen updates by itself.</p>
        )}
        {row.canAllow && asked && (
          <div className="perm-fix">
            <p><b>Switched it on but it still says Not allowed?</b> macOS is holding an old Unvibe entry from a previous version. Press <b>Fix it</b>, turn Unvibe on again in the list that opens, then press <b>Restart Unvibe</b>.</p>
            <div className="perm-actions">
              <button className="act" onClick={() => void window.unvibe.resetAccessibility().then(() => window.unvibe.openAccessibility())}>Fix it</button>
              <button className="act" onClick={() => void window.unvibe.restartApp()}>Restart Unvibe</button>
            </div>
          </div>
        )}
      </div>
      <div className="setrow__end">
        {/* A status, so a screen reader hears "Allowed" when the grant lands and "Allow Accessibility" goes away. */}
        {row.label ? <span className={`perm-chip perm-chip--${row.tone}`} role="status">{row.label}</span> : null}
        {row.canAllow ? <button className="act act--primary" onClick={() => void allow()}>Allow Accessibility</button> : null}
      </div>
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

/** Shown on step 2; main/main.ts FIRST_RUN_SAMPLE is what actually gets explained. Keep them equal. */
const SAMPLE_LINES = [
  'function debounce(fn, wait) {',
  '  let timer;',
  '  return (...args) => {',
  '    clearTimeout(timer);',
  '    timer = setTimeout(() => fn(...args), wait);',
  '  };',
  '}',
];

/**
 * First run, built so the first real explanation lands within a minute: 1 hello (name and where you
 * heard about Unvibe, both optional), 2 explain a sample for real (no permission needed), then one
 * skippable level question, 3 try it on your own code: one paste target (no permission), with Choose a
 * file under it. On a Mac, step 4 offers the shortcut only once that own code has been explained
 * (onboarding:ownCodeDone): value first, permission second. Windows needs no permission, so it keeps
 * three steps and names its shortcut on step 3. Google sign-in and editor bridges are optional and
 * stay reachable later.
 */
function Onboarding({ soundEffects, soundVolume, soundStyle, shortcut, onDone }: { soundEffects: boolean; soundVolume: number; soundStyle: 'soft' | 'pixel'; shortcut: string; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState('');
  const [heardFrom, setHeardFrom] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [celebrating, setCelebrating] = useState(false);
  const [explained, setExplained] = useState(false);
  const [sampleDone, setSampleDone] = useState(false);
  const [levelSaved, setLevelSaved] = useState('');
  const [signedIn, setSignedIn] = useState('');
  const [ownCodeDone, setOwnCodeDone] = useState(false);
  // Mac step 4: the offer, the guide while System Settings is open, then the shortcut is on.
  const [offer, setOffer] = useState<'offer' | 'waiting' | 'on'>('offer');
  const shortcutHeading = useRef<HTMLHeadingElement>(null);
  const paste = useOwnCodePaste();
  const steps = onboardingSteps(isWindows);
  const pasteStep = step === 2;
  const macShortcut = !isWindows && step === 3;
  const firstName = firstNameOf(displayName);
  const keys = prettyAccel(shortcut);
  // Glyphs on the key caps; words in sentences, since many people don't know ⌃ is Control.
  const spoken = isWindows ? keys : shortcut.replace(/CommandOrControl|Command/g, 'Command').replace(/Alt/g, 'Option');

  useEffect(() => { configureTones({ enabled: soundEffects, volume: soundVolume, style: soundStyle }); }, [soundEffects, soundVolume, soundStyle]);
  useEffect(() => window.unvibe.onSampleDone(() => setSampleDone(true)), []);
  // The user's own code was explained: a Mac on the paste step moves on to the shortcut offer; Windows
  // stays and finishes from there, with a fresh paste target (no stale "Explaining in the panel").
  useEffect(() => window.unvibe.onOwnCodeDone(() => {
    setOwnCodeDone(true);
    if (isWindows) paste.reset();
    else setStep((current) => (current === 2 ? 3 : current));
  }), []);
  // Announce the card, without making Enter trigger the permission prompt.
  useEffect(() => {
    if (macShortcut) shortcutHeading.current?.focus();
  }, [macShortcut, offer]);
  // Already allowed (an earlier install, say): nothing to offer, the shortcut is on.
  useEffect(() => {
    if (!macShortcut) return undefined;
    let alive = true;
    void window.unvibe.accessibility().then((result: { granted?: boolean }) => {
      if (alive && result.granted) setOffer('on');
    });
    return () => { alive = false; };
  }, [macShortcut]);
  // Only the open guide checks for the grant.
  useEffect(() => {
    if (!macShortcut || offer !== 'waiting') return undefined;
    return watchGrant(window.unvibe, () => {
      setOffer('on');
      if (soundEffects) playTone('correct');
    });
  }, [macShortcut, offer, soundEffects]);

  const flow: OnboardingState = { step, windows: isWindows, firstName, explained, pasteStarted: paste.started, ownCodeDone, offer };
  const line = vibeLine(flow);
  const said = useVibeSays(line, soundEffects);

  // Google sign-in hands back the account email and profile name; fill what is still empty.
  const fillFromGoogle = (email: string, name?: string) => {
    setSignedIn(email);
    if (email.includes('@')) setProfileEmail((current) => current.trim() || email);
    if (name) setDisplayName((current) => current.trim() || name);
    if (soundEffects) playTone('correct');
    setBuddyMood('happy');
  };
  const go = (to: number) => {
    if (soundEffects) playTone('boop');
    // Navigation remounts the paste target without a preview; its speech must reset with it.
    paste.setStarted(false);
    setStep(Math.max(0, Math.min(to, steps.length - 1)));
  };
  const explainSample = () => {
    if (explained) return;
    window.unvibe.explainSample();
    setExplained(true);
    setBuddyMood('reading');
  };
  const answerLevel = async (answer: 'too_basic' | 'about_right' | 'too_advanced') => {
    const result = await window.unvibe.answerLevel(answer);
    if (!result.ok) return;
    if (soundEffects) playTone('boop');
    setLevelSaved(STUDY_LEVELS.find((item) => item.id === result.level)?.label ?? result.level);
  };
  const finish = async () => {
    if (saving) return;
    setSaving(true);
    setSaveError('');
    try {
      await window.unvibe.setSettings({ displayName: displayName.replace(/\s+/g, ' ').trim(), profileEmail: profileEmail.trim() });
      await window.unvibe.completeOnboarding();
      if (soundEffects) playTone('celebrate');
      setBuddyMood('celebrate');
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        setCelebrating(true);
        await new Promise((resolve) => window.setTimeout(resolve, 900));
      }
      await onDone();
    } catch {
      setSaveError('Your setup could not be saved. Please try again.');
    } finally { setSaving(false); }
  };
  const turnOn = async () => {
    setOffer('waiting');
    await turnOnShortcut(window.unvibe);
  };
  // The footer's one forward button (onboardingFlow.ts).
  const forward = forwardAction(flow);
  const advance = () => {
    // Optional and never awaited: a blank answer sends nothing and setup never waits on it.
    if (step === 0 && heardFrom.trim()) window.unvibe.answerHeardFrom(heardFrom);
    if (forward.finishes) void finish();
    else go(step + 1);
  };
  const back = () => {
    if (saving) return;
    if (macShortcut && offer === 'waiting') setOffer('offer');
    else go(step - 1);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, select, textarea, button, summary, [role="textbox"]')) return;
      // On the paste and shortcut steps only the buttons move on, so a stray Enter never skips them.
      if ((event.key === 'ArrowRight' || event.key === 'Enter') && step < 2) { event.preventDefault(); advance(); }
      if (event.key === 'ArrowLeft' || event.key === 'Escape') { event.preventDefault(); back(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const mood = celebrating ? 'celebrate' : step === 0 ? 'wave' : step === 1 ? (explained ? 'reading' : 'happy')
    : pasteStep && paste.started ? 'reading' : macShortcut && offer === 'on' ? 'happy' : 'thinking';
  const continueLabel = forward.finishes && celebrating ? 'Welcome!' : forward.finishes && saving ? 'Saving…' : forward.label;
  // The shortcut's keys on the card; the line beside them says "press it", so the caps carry the name for screen readers.
  const macCaps = shortcutCaps('Control+U', false);
  const shortcutCard = (title: string, note: string, allowed: boolean) => (
    <div className="onboard__perm">
      <span className="onboard__caps" role="img" aria-label="Control U">{macCaps.map((key) => <kbd key={key}>{key}</kbd>)}</span>
      <span className="onboard__perm-text"><b>{title}</b><small>{note}</small></span>
      {allowed ? <span className="onboard__ok">Allowed</span> : null}
    </div>
  );

  return (
    <div className={`onboard onboard--step-${step}`}>
      {celebrating ? (
        <div className="onboard__confetti" aria-hidden="true">
          {Array.from({ length: 48 }, (_, i) => <i key={i} style={{ '--i': i } as React.CSSProperties} />)}
        </div>
      ) : null}
      <div className="onboard__top">
        <div className="onboard__steps" aria-hidden="true">{steps.map((label, i) => <i key={label} className={i <= step ? 'on' : undefined} />)}</div>
        <span className="onboard__count">{step + 1} / {steps.length}</span>
      </div>
      <div className="onboard__vibe">
        <Buddy mood={mood} size={56} follow label="Vibe" key={`${step}-${mood}`} />
        {/* The bubble types its line out, so it isn't live: screen readers hear each whole line once, from the status. */}
        <VibeBubble large live={false}>{said}</VibeBubble>
        <p className="sr-only" role="status">{line}</p>
      </div>

      <FadeIn animKey={step} className="onboard__body">
        {step === 0 && (
          <>
            <h1>Understand the code AI writes.</h1>
            <form className="onboard__form" onSubmit={(event) => { event.preventDefault(); advance(); }}>
              <label>
                <span>What should I call you? <small>optional</small></span>
                <input value={displayName} autoFocus autoComplete="given-name" placeholder="Your name"
                  onChange={(event) => setDisplayName(event.target.value)} />
              </label>
              <label>
                <span>Where did you hear about Unvibe? <small>optional</small></span>
                <input value={heardFrom} maxLength={200} autoComplete="off" placeholder="A friend, a subreddit, a video…"
                  aria-describedby="heard-from-note" onChange={(event) => setHeardFrom(event.target.value)} />
                {/* Security 0046 (option A): typing an answer is its own opt-in, so the line says what happens. */}
                <span className="onboard__note" id="heard-from-note">Sent once to Unvibe with this install&apos;s random ID. Leave it blank to send nothing.</span>
              </label>
              <button type="submit" hidden />
            </form>
          </>
        )}

        {step === 1 && (
          <div className="onboard__try">
            <div className="onboard__editor">
              <div className="onboard__editor-bar"><i /><i /><i /><span>debounce.js</span></div>
              <pre>{SAMPLE_LINES.join('\n')}</pre>
            </div>
            {/* aria-disabled, not disabled: the button keeps focus as its label changes, and a second press does nothing. */}
            <button type="button" className={stepAction(flow) ? 'onboard__primary' : 'onboard__quiet'} onClick={explainSample} aria-disabled={explained}>
              {explained ? 'Explaining in the panel →' : 'Explain this code'}
            </button>
            <p className="onboard__lead">{explained
              ? `That's what ${spoken} does with any code you select. Test me asks you a question about this exact code. Then press Next.`
              : 'Uses one of your free explanations. No setup needed.'}</p>
            {sampleDone ? (
              <div className="onboard__level" role="group" aria-label="How was that explanation pitched?">
                {levelSaved ? <p role="status">Got it. The next ones start at {levelSaved}.</p> : (
                  <>
                    <p>Was that too basic, about right, or too advanced? I'll pitch the next ones there.</p>
                    <div className="onboard__choices">
                      <button type="button" className="onboard__outline" onClick={() => void answerLevel('too_basic')}>Too basic</button>
                      <button type="button" className="onboard__outline" onClick={() => void answerLevel('about_right')}>About right</button>
                      <button type="button" className="onboard__outline" onClick={() => void answerLevel('too_advanced')}>Too advanced</button>
                    </div>
                  </>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* The own-code step needs no permission: one paste target. On a Mac the shortcut, which needs
            Accessibility, is offered in step 4 once this has worked; Windows names it here. */}
        {pasteStep && (
          <div className="onboard__paste">
            <PasteTarget key={paste.attempt} hint={OWN_CODE_HINT} onPaste={paste.explainPaste} onChooseFile={() => void paste.chooseFile()} />
            {paste.fileError ? <p className="field-err" role="alert">{paste.fileError}</p> : null}
            {isWindows ? <p className="onboard__lead">Or select code in any app and press {keys}.</p> : null}
            <details className="onboard__more">
              <summary>Use VS Code or Cursor? Add {isWindows ? 'Ctrl+U' : '⌘U'} there too</summary>
              <div className="onboard__integrations"><IntegrationsPanel /></div>
            </details>
          </div>
        )}

        {macShortcut && offer === 'offer' && (
          <>
            <h1 ref={shortcutHeading} tabIndex={-1}>Turn on the shortcut</h1>
            {shortcutCard('Select code in any app, then press it', 'No copying, no pasting.', false)}
            <p className="onboard__why"><LockGlyph /><span>macOS calls this permission Accessibility. Unvibe uses it only to copy your selection when you press Control U, then sends that code to {CONSENT_PROVIDERS.unvibe} through Unvibe to explain it. It never reads your keystrokes or your screen.</span></p>
            <button type="button" className={stepAction(flow) ? 'onboard__primary' : 'onboard__quiet'} onClick={() => void turnOn()}>Turn on the shortcut</button>
            <p className="onboard__lead">Pasting keeps working without it.</p>
          </>
        )}
        {macShortcut && offer === 'waiting' && <ShortcutGuide buttonClass="onboard__outline" illustration />}
        {macShortcut && offer === 'on' && (
          <>
            <h1 ref={shortcutHeading} tabIndex={-1}>Shortcut is on</h1>
            {shortcutCard('Select code in any app, then press it', 'Pasting keeps working without it.', true)}
          </>
        )}
      </FadeIn>

      {saveError ? <p className="field-err" role="alert">{saveError}</p> : null}
      <div className="onboard__foot">
        {step > 0 ? <button type="button" className="onboard__back" disabled={saving} onClick={back}>Back</button> : <span />}
        <div className="onboard__forward">
          <button type="button" className={forward.quiet ? 'onboard__quiet' : 'onboard__primary'} disabled={saving} onClick={advance}>{continueLabel}</button>
          {/* Design Q11: the Google sign-in disclosure sits directly under Hello's primary. */}
          {step === 0 ? (signedIn ? <p className="onboard__signed">✓ Signed in as {signedIn}</p> : (
            <details className="onboard__more onboard__google">
              <summary>Sync across devices with Google (optional)</summary>
              <SignInForm label="Fill this in with Google" onDone={fillFromGoogle} />
            </details>
          )) : null}
        </div>
      </div>
    </div>
  );
}

const OWN_CODE_HINT = "Copy a few lines from a file you didn't write. Pasting explains it in the panel and uses one free explanation.";

/**
 * The own-code paste step's two ways in, used by setup's step 3 and by the next open's paste step: a
 * paste explains the clipboard, which holds what was just pasted (main reads it there, as Explain my
 * clipboard does), and Choose a file explains a file. Neither needs a permission.
 */
function useOwnCodePaste() {
  const [started, setStarted] = useState(false);
  const [fileError, setFileError] = useState('');
  // Bumped to remount the paste target without its preview and "Explaining in the panel" pill.
  const [attempt, setAttempt] = useState(0);
  // A paste or file went to the panel and hasn't been explained yet.
  const waiting = useRef(false);
  const explainPaste = () => {
    setFileError('');
    setStarted(true);
    waiting.current = true;
    window.unvibe.explainClipboard();
  };
  const chooseFile = async () => {
    setFileError('');
    const result = await window.unvibe.companionPickFile();
    if (result.ok) {
      setStarted(true);
      waiting.current = true;
    } else if (result.error) setFileError(result.error);
  };
  useEffect(() => window.unvibe.onOwnCodeDone(() => { waiting.current = false; }), []);
  // The panel closed before explaining it (Cancel on the confirm sheet, say): ask again instead of
  // saying it's opening.
  useEffect(() => window.unvibe.onPanelClosed(() => {
    if (!waiting.current) return;
    waiting.current = false;
    setStarted(false);
    setAttempt((n) => n + 1);
  }), []);
  // A fresh target, for another paste after one was explained.
  const reset = () => {
    setStarted(false);
    setAttempt((n) => n + 1);
  };
  return { started, setStarted, fileError, explainPaste, chooseFile, attempt, reset };
}

function LockGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </svg>
  );
}

/**
 * The next open after a first session that explained only the sample: the same paste step as setup,
 * before Today. Pasting or choosing a file explains in the panel, with no permission needed. Windows
 * also names its shortcut. "Not now" goes to Today until the next open (ownCodeStep.ts).
 */
function OwnCodeWelcome({ soundEffects, shortcut, onNotNow }: { soundEffects: boolean; shortcut: string; onNotNow: () => void }) {
  const { started, fileError, explainPaste, chooseFile, attempt } = useOwnCodePaste();
  const line = welcomeBackLine(started);
  const said = useVibeSays(line, soundEffects);
  return (
    <div className="onboard onboard--welcome">
      <div className="onboard__vibe">
        <Buddy mood={started ? 'reading' : 'wave'} size={56} follow label="Vibe" />
        <VibeBubble large live={false}>{said}</VibeBubble>
        <p className="sr-only" role="status">{line}</p>
      </div>
      <div className="onboard__body">
        <div className="onboard__paste">
          <PasteTarget key={attempt} hint={OWN_CODE_HINT}
            onPaste={explainPaste} onChooseFile={() => void chooseFile()} />
          {fileError ? <p className="field-err" role="alert">{fileError}</p> : null}
          {isWindows ? <p className="onboard__lead">Or select code in any app and press {prettyAccel(shortcut)}.</p> : null}
        </div>
      </div>
      <div className="onboard__foot">
        <span />
        <div className="onboard__forward">
          <button type="button" className="onboard__quiet" onClick={onNotNow}>Not now</button>
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

function LoginScreen({ onSignedIn, onSkip, shortcut, notice = '' }: { onSignedIn: (email: string) => void; onSkip: () => void; shortcut: string; notice?: string }) {
  return (
    <div className="login">
      <div className="sanFranWash" aria-hidden="true" />
      <div className="login__grid" aria-hidden="true" />
      <div className="login__island" aria-hidden="true"><LogoMark size={15} stroke={2} /><span>learning follows your workflow</span><i /><i /><i /></div>
      <FadeIn animKey="login" className="login__layout">
        <section className="login__story">
          <div className="login__eyebrow">Your private learning layer</div>
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
            <div className="login__brand">Unvibe</div>
            <h2 className="login__tag">Carry your learning <em>forward.</em></h2>
            <DeletionNotice message={notice} />
            <p className="login__card-copy">Sign in to sync permitted learning records across devices. Your code and full explanations remain local.</p>
            <SignInForm onDone={onSignedIn} />
          </aside>
          <button type="button" className="login__local" onClick={onSkip}>
            <span className="login__local-icon"><MacGlyph /></span>
            <strong>Open Unvibe on this {deviceName}</strong>
            <small>Keep everything local. No Google needed.</small>
          </button>
        </div>
      </FadeIn>
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
    ? Math.round((profile.linesUnderstood / profile.linesReviewed) * 100)
    : null;
  const currentKnowledge = knowledge ? knowledge.filter((item) => item.freshnessStatus === 'CURRENT').length : 0;
  // Like coverage: the share as the figure, the count under it (Design P3: the card repeated "5 of 6 current").
  const freshness = knowledge && knowledge.length
    ? { share: Math.round((currentKnowledge / knowledge.length) * 100), count: `${currentKnowledge} of ${knowledge.length} current` }
    : null;
  return (
    <>
      <div className="topline"><h1><InkTitle text="Momentum" /></h1></div>
      <p className="lead">What you have actually understood on this {deviceName}. No invented scores.</p>
      <div className="metrics">
        <article className="metric-card"><span className="v">{coverage !== null ? <><CountUp value={coverage} />%</> : '–'}</span><span className="l">Understanding coverage</span><span className="note">{coverage !== null ? `${profile?.linesUnderstood ?? 0} of ${linesLabel(profile?.linesReviewed ?? 0)}` : 'Not enough data yet.'}</span></article>
        <article className="metric-card"><span className="v">{freshness ? <><CountUp value={freshness.share} />%</> : '–'}</span><span className="l">Knowledge freshness</span><span className="note">{freshness?.count ?? 'Not enough data yet.'}</span></article>
        <article className="metric-card"><span className="v">{profile ? <CountUp value={profile.reviews} /> : '–'}</span><span className="l">Explanations saved</span><span className="note">{profile ? `${profile.needsReview} still to revisit` : 'Not enough data yet.'}</span></article>
        <article className="metric-card"><span className="v">{profile ? <CountUp value={profile.needsReview} /> : '–'}</span><span className="l">Marked to revisit</span><span className="note">{profile && profile.needsReview > 0 ? 'Saved to check again' : 'Not enough data yet.'}</span></article>
      </div>
      <div className="panel-card">
        <div className="ph"><span className="t">Explained per day</span><span className="m">last 6 months</span></div>
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
          <p className="soft-note">Unvibe notes which app you were in when you asked, never what you typed.</p>
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
  // Signed out there is no cloud plan to load, so nothing says "Loading plan…" (only the local usage line fills in).
  const [message, setMessage] = useState(compact || !signedIn ? '' : 'Loading plan…');
  const [busy, setBusy] = useState(false);
  const [paymentsOpen, setPaymentsOpen] = useState(true);
  // Public checkout status (GET /api/v1/billing/status). Until it says open, Pro reads "opens soon".
  const [proOpen, setProOpen] = useState(false);

  const load = async () => {
    void window.unvibe.billingStatus().then((status) => setProOpen(status.paymentsOpen));
    if (!signedIn) {
      setOverview(null);
      setAvailable(false);
      setMessage('');
    }
    const usage = await window.unvibe.usageGet() as { ok: boolean; data?: AppUsageLine };
    if (usage.ok && usage.data) setLocalUsage(usage.data);
    if (!signedIn) return;
    const result = await window.unvibe.billingOverview() as { ok: boolean; data?: { overview: BillingOverview; checkoutAvailable: boolean; teamsAvailable?: boolean; paymentsOpen?: boolean }; error?: string };
    if (!result.ok || !result.data) {
      setOverview(null);
      setMessage(result.error ?? 'Could not load cloud plan. Local limits still apply.');
      return;
    }
    setOverview(result.data.overview);
    setAvailable(result.data.checkoutAvailable);
    setPaymentsOpen(result.data.paymentsOpen !== false);
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
  const teamsCard = proOpen ? (
    <article className="plan-pick__card plan-pick__card--teams">
      <span>For clubs, classes and small teams</span>
      <h2>Teams $8/seat{interval === 'annual' ? ' · $72/yr' : '/mo'}</h2>
      <p>One shared workspace, invites, and who reviewed what. 2 to 20 seats. Each person keeps their explanations on their own computer.</p>
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
  ) : (
    <article className="plan-pick__card plan-pick__card--teams">
      <span>Teams opens soon</span>
      <h2>Teams</h2>
      <p>One shared workspace, invites, and who reviewed what. 2 to 20 seats. Each person keeps their explanations on their own computer.</p>
      <button type="button" className="soft-btn" onClick={() => void window.unvibe.openUrl(`https://unvibe.site/pricing#teams`)}>Request Teams seats</button>
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
  const pro = proCard(proOpen, interval, localUsage);

  return (
    <section className={`plan-board${compact ? ' plan-board--compact' : ''}`} aria-label="Plan and usage">
      {!compact && (
        <div className="page-head">
          <div>
            <div className="eyebrow">Plan & usage</div>
            <h1><InkTitle text="Start free. Grow when your projects do." /></h1>
            <p>Your AI model access is included. You never need to paste in your own provider API key.</p>
          </div>
        </div>
      )}
      {compact && <div className="settings-section-label">Plan & usage</div>}
      {message && <div className={`plan-message${message.startsWith('Sign in') || message.includes('Local limits') || message.includes('Checkout is disabled') ? ' quiet' : ''}`} role="status">{message}</div>}

      <div className="plan-pick">
        <article className="plan-pick__card is-current">
          <span>Current plan</span>
          <h2>{[planLabel(currentPlan), planPriceLabel(currentPlan, currentInterval)].filter(Boolean).join(' ')}</h2>
          <p>
            {gifted && overview ? giftStatusLine(overview.subscription.currentPeriodEnd)
              : unlimited ? 'This build is not metered locally.'
                : (paid && overview && paidStatusLine(overview.subscription, planLabel(currentPlan)))
                  || (resetIso ? resetLabel(resetIso, currentPlan)
                    : `Monthly explanation limits apply to this ${deviceName}.`)}
          </p>
          {canPortal
            ? <button type="button" className="soft-btn" onClick={() => void portal()} disabled={busy}>Manage billing</button>
            : <button type="button" className="soft-btn" disabled>{gifted ? 'Included with a gift' : paid ? 'Active' : 'Included'}</button>}
        </article>

        {showUpgrade && upgradeIsPro && (
          <article className="plan-pick__card is-upgrade">
            <span>{pro.open ? 'Upgrade available' : 'Pro opens soon'}</span>
            {pro.open ? (
              <>
                <h2>Pro {pro.price}</h2>
                <p>Unlock git diffs, nearby files, and 100 explanations each month.</p>
                <div className="plan-toggle" aria-label="Billing interval">
                  <button type="button" className={interval === 'monthly' ? 'on' : ''} onClick={() => setInterval('monthly')} aria-pressed={interval === 'monthly'}>Monthly</button>
                  <button type="button" className={interval === 'annual' ? 'on' : ''} onClick={() => setInterval('annual')} aria-pressed={interval === 'annual'}>Annual<span>Save 25%</span></button>
                </div>
                <p className="plan-pick__terms" id="pro-renewal-terms">
                  {pro.terms}
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
            ) : (
              <>
                <h2>Pro</h2>
                <p>Unlock git diffs, nearby files, and 100 explanations each month.</p>
                <p>{pro.line}</p>
              </>
            )}
          </article>
        )}
        {currentPlan !== 'teams' && !compact ? teamsCard : null}
      </div>

      {!signedIn && (
        <div className="plan-board__signin">
          <p>Sign in to sync this {deviceName} with your cloud plan{proOpen ? ' and Stripe billing' : ''}.</p>
          <SignInForm onDone={onSignedIn ?? (() => undefined)} />
        </div>
      )}
      {proOpen && signedIn && !available && upgradeIsPro && <div className="plan-message quiet">{paymentsOpen ? 'Checkout is disabled until billing is configured on the server.' : 'Payments open soon. Your Free plan keeps working until then.'}</div>}

      <div className="plan-usage-block">
        <h3>Usage this month</h3>
        <div className="plan-usage-card">
          {meters.length === 0 && <p className="plan-usage-empty">Usage appears after the first explanation on this {deviceName}.</p>}
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

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return <button type="button" className={`toggle${on ? ' on' : ''}`} role="switch" aria-checked={on} aria-label={label} onClick={onClick}><span className="knob" /></button>;
}

/**
 * The off switch for sending code (Security U36, CC-5). Off takes effect on the next request:
 * every send checks the stored record, and the global shortcuts are unregistered. On asks with
 * the same three boxes, naming the provider in use.
 */
function AiSendRow() {
  const [status, setStatus] = useState<ConsentStatus | null>(null);
  const [error, setError] = useState('');
  const refresh = () => void window.unvibe.consentStatus().then(setStatus);
  useEffect(refresh, []);
  const toggle = async () => {
    if (!status) return;
    setError('');
    if (status.allowed) {
      const result = await window.unvibe.consentRevoke();
      if (result.ok) setStatus(result.status);
      else setError(result.error);
      return;
    }
    if (await askForConsent(status.provider)) refresh();
  };
  const name = status?.providerName ?? CONSENT_PROVIDERS.unvibe;
  return (
    <div className="setrow">
      <div>
        <div className="sl">Send code to {name}</div>
        <div className="sd">
          {status?.allowed === false
            ? `Off. Nothing you select, paste or ask is sent${status.switchedOff ? ', and the shortcut is off' : ''}. Explaining code asks you first.`
            : `On. The code you ask about and your questions go to ${name}${status?.ownKey ? ' with your own key' : ''} to write explanations. Turn this off to stop sending at once.`}
          {error ? <> {error}</> : null}
        </div>
      </div>
      {status ? <Toggle label={`Send code to ${name}`} on={status.allowed} onClick={() => void toggle()} /> : null}
    </div>
  );
}

function AccountPanel({ account, onChange, onDeleted, onNotice }: { account: Account; onChange: () => void; onDeleted: (message?: string) => void; onNotice: (message: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const del = async () => {
    setBusy(true); setErr('');
    const r = (await window.unvibe.deleteAccount()) as { ok: boolean; error?: string; message?: string };
    setBusy(false);
    if (r.ok) onDeleted(r.message); else setErr(r.error ?? 'Could not delete the account.');
  };
  if (!account) {
    return (
      <>
        <PlanUsageBoard compact signedIn={false} onSignedIn={onChange} />
        <div className="settings-section-label">Account</div>
        <div className="setrow setrow--stack">
          <div className="sl">This {deviceName}</div>
          <div className="sd">You are using Unvibe locally right now. Sign in above to attach a cloud plan.</div>
        </div>
        <div className="setrow setrow--stack">
          <div className="sl">Erase learning on this {deviceName}</div>
          <div className="sd" style={{ marginBottom: 12 }}>Removes every saved explanation on this {deviceName}. This cannot be undone.</div>
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
      <div className="settings-section-label">Account</div>
      <div className="setrow"><div><div className="sl">Signed in</div><div className="sd">{account.email}</div></div>
        <button className="act" onClick={async () => {
          const result = (await window.unvibe.signOut()) as { ok: boolean; error?: string; warning?: string };
          onChange();
          onNotice(result.ok
            ? result.warning ? `Signed out locally. ${result.warning}` : 'Signed out securely.'
            : result.error ?? `Sign-out could not be saved on this ${deviceName}.`);
        }}>Sign out</button></div>
      <div className="setrow setrow--stack">
        <div className="sl sl--danger">Delete account</div>
        <div className="sd" style={{ marginBottom: 12 }}>Permanently deletes your Unvibe account and your learning data (every review and concept) on this {deviceName} and on our servers. This also removes the API key you saved in Unvibe on this {deviceName}, if there is one, plus the name, email and last project folder saved in Unvibe. This cannot be undone.</div>
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
    onNotice(`API key saved on this ${deviceName} only.`);
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
        <span><SettingsIcon tab="AI" className="ai-container__icon" />AI on your terms</span>
        <p>Use included Unvibe AI, or securely connect a provider key kept on this {deviceName}.</p>
      </div>
      <div className="setrow setrow--stack">
        <div className="sl">Your own API key</div>
        <div className="sd" style={{ marginBottom: 12 }}>
          Works with Gemini, OpenAI, Anthropic, Grok, DeepSeek, or Kimi. The key stays encrypted on this {deviceName} and is never sent to Unvibe.
        </div>
        <div className="ai-key-row">
          <input
            className="field"
            aria-label="API key"
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
          <div className="sd">Always call your provider from this {deviceName} instead of Unvibe cloud AI.</div>
        </div>
        <Toggle label="Use my own AI" on={Boolean(settings.useOwnAi)} onClick={() => void onSettings({ useOwnAi: !settings.useOwnAi })} />
      </div>
      <div className="setrow">
        <div>
          <div className="sl">Provider</div>
          <div className="sd">Each option uses a cheap default model. Cost estimates update below.</div>
        </div>
        <select
          className="sel-input"
          aria-label="Provider"
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
            <option key={m.id} value={m.id}>{m.label}{m.id === 'gemini' ? ' (usually cheapest)' : ''}</option>
          ))}
        </select>
      </div>
      <div className="setrow setrow--stack">
        <div className="sl">Rough cost per explanation · {selected?.label ?? provider}{selected?.model ? ` · ${selected.model}` : ''}</div>
        <div className="sd" style={{ marginBottom: 10 }}>
          Estimates update when you change the provider. List prices only; your provider bill may differ.
        </div>
        {costs ? (
          <div className="cost-table" role="table" aria-label="Estimated cost by mode and lines">
            <div className="cost-row head" role="row">
              <span role="columnheader">Mode</span><span role="columnheader">~50 lines</span><span role="columnheader">~200 lines</span><span role="columnheader">~500 lines</span>
            </div>
            {costs.map((row) => (
              <div className="cost-row" role="row" key={row.level}>
                <span role="rowheader">{row.level}</span>
                {row.samples.map((s) => <span role="cell" key={s.lines}>{s.label}</span>)}
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
  const load = () => void window.unvibe.integrations().then((result) => setItems(Array.isArray(result) ? result as typeof items : []));
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
  if (!items) return <div className="settings-empty">Checking this {deviceName}…</div>;
  const groups = ['Editors', 'Agents', 'Shell', 'Workspace'].map((group) => ({
    group,
    rows: items.filter((item) => item.group === group),
  })).filter((item) => item.rows.length > 0);
  return (
    <div className="integ">
      <p className="integ__lead">Unvibe sits beside tools you already have. Detected means the app is on this {deviceName}. Bridge ready means {isWindows ? 'Ctrl+U' : 'Command U'} can send the editor selection directly.</p>
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

const SETTINGS_FOCUSABLE = 'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function Settings({ info, account, settings, onAccountChange, onSettings, onClose, onAccountDeleted, onNotice, initialTab = 'General' }: {
  info: { version: string; sendsSetupProgress?: boolean }; account: Account; settings: Settings;
  onAccountChange: () => void; onSettings: (patch: Partial<Settings>) => Promise<string | undefined>; onClose: () => void; onAccountDeleted: (message?: string) => void; onNotice: (message: string) => void;
  initialTab?: string;
}) {
  const [tab, setTab] = useState(initialTab);
  useEffect(() => setTab(initialTab), [initialTab]);
  const [recording, setRecording] = useState(false);
  const [shortcutErr, setShortcutErr] = useState('');
  const bodyRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const recRef = useRef(recording); recRef.current = recording;
  const closeRef = useRef(onClose); closeRef.current = onClose;

  const chooseTab = (next: string) => {
    setTab(next);
    requestAnimationFrame(() => bodyRef.current?.scrollTo({ top: 0, behavior: 'instant' }));
  };

  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      if (!recRef.current) return;
      e.preventDefault();
      // Escape cancels recording instead of closing Settings.
      if (e.key === 'Escape') {
        e.stopPropagation();
        setRecording(false);
        return;
      }
      const accel = accelFromEvent(e);
      if (!accel) return;
      setRecording(false);
      const err = await onSettings({ shortcut: accel });
      setShortcutErr(err ?? '');
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onSettings]);

  // Modal behaviour: focus moves in on open, Tab stays inside, Escape closes, focus returns on close.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    modalRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeRef.current();
        return;
      }
      const modal = modalRef.current;
      if (e.key !== 'Tab' || !modal) return;
      const items = Array.from(modal.querySelectorAll<HTMLElement>(SETTINGS_FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      const inside = active instanceof Node && modal.contains(active);
      if (e.shiftKey && (!inside || active === first || active === modal)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previous?.isConnected) previous.focus();
      else document.querySelector<HTMLElement>('.side-settings')?.focus();
    };
  }, []);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Settings" onClick={onClose}>
      <div className="modal" ref={modalRef} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="settings-close" aria-label="Close settings" title="Close (Esc)" onClick={onClose}>
          <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 5l10 10 M15 5L5 15" /></svg>
        </button>
        <div className="mside">
          <div className="settings-brand"><span>Settings</span></div>
          <div className="mside-group">
            <div className="mh">Preferences</div>
            {['General', 'Island', 'Sound & alerts', 'Learning', 'Privacy & Data'].map((t) => <button key={t} type="button" className={t === tab ? 'on' : ''} aria-current={t === tab ? 'true' : undefined} onClick={() => chooseTab(t)}><SettingsIcon tab={t} />{t}</button>)}
          </div>
          <div className="mside-group">
            <div className="mh">Unvibe</div>
            {['Integrations', 'AI', 'Account & Plan', 'About'].map((t) => <button key={t} type="button" className={t === tab ? 'on' : ''} aria-current={t === tab ? 'true' : undefined} onClick={() => chooseTab(t)}><SettingsIcon tab={t} />{t}</button>)}
          </div>
          <div className="ver">Unvibe v{info.version}</div>
        </div>
        <div className="mbody" ref={bodyRef} tabIndex={0} role="region" aria-label="Settings content">
          <h2>{tab}</h2>

          {tab === 'AI' && <AiSettingsPanel settings={settings} onSettings={onSettings} onNotice={onNotice} />}

          {tab === 'General' && (
            <>
              <div className="setrow"><div><div className="sl">Name</div><div className="sd">Chat greets you with Hello again, then this name.</div></div><input className="field setrow-field" aria-label="Name" value={settings.displayName ?? ''} onChange={(e) => void onSettings({ displayName: e.target.value })} autoComplete="given-name" /></div>
              <div className="setrow"><div><div className="sl">Email</div><div className="sd">Optional. Stays on this {deviceName} for your profile.</div></div><input className="field setrow-field" aria-label="Email" type="email" value={settings.profileEmail ?? ''} onChange={(e) => void onSettings({ profileEmail: e.target.value })} autoComplete="email" /></div>
              <div className="setrow"><div><div className="sl">Launch at login</div><div className="sd">Start Unvibe automatically when you log in to your {deviceName}.</div></div><Toggle label="Launch at login" on={settings.launchAtLogin} onClick={() => onSettings({ launchAtLogin: !settings.launchAtLogin })} /></div>
              <div className="setrow"><div><div className="sl">Start animation</div><div className="sd">The sharks that swim in when Unvibe opens. Drawn on this {deviceName}; nothing is downloaded.</div></div><Toggle label="Start animation" on={settings.startAnimation !== false} onClick={() => onSettings({ startAnimation: settings.startAnimation === false })} /></div>
              <div className="setrow"><div><div className="sl">Activation shortcut</div><div className="sd">Select code in any app, then press this.{isMac ? ' Control+U is always registered as well.' : ''}{recording ? ' Press Escape to cancel.' : ''}</div>{shortcutErr && <div className="field-err" role="alert">{shortcutErr}</div>}</div><button type="button" className={`act kbd-cap${recording ? ' rec' : ''}`} aria-label={recording ? 'Recording shortcut. Press the new keys' : `Activation shortcut ${prettyAccel(settings.shortcut)}. Change`} onClick={() => { setShortcutErr(''); setRecording(true); }}>{recording ? 'Press keys…' : prettyAccel(settings.shortcut)}</button></div>
              <PermRow />
            </>
          )}

          {tab === 'Island' && (
            <>
              <div className="settings-section-label">Overlay preview</div>
              <OverlayPreview position={settings.barPosition} dimmed={settings.inactiveBehavior === 'hide' ? 0 : FADE_OPACITY} />
              <div className="setrow settings-location"><div><div className="sl">Island location</div><div className="sd">Choose where the Island rests. It moves immediately.</div></div>
                <div className="location-grid" role="group" aria-label="Island location">
                  {([['top-center', 'Top'], ['top-right', 'Right'], ['bottom-center', 'Bottom'], ['bottom-right', 'Corner']] as const).map(([position, label]) => <button key={position} type="button" className={settings.barPosition === position ? 'on' : ''} onClick={() => void onSettings({ barPosition: position })}>{label}</button>)}
                </div>
              </div>
              <div className="setrow settings-location"><div><div className="sl">Island size</div><div className="sd">{isWindows ? 'Medium is the default size.' : 'Medium matches the Mac notch.'} Change it if you want a smaller or larger pill.</div></div>
                <div className="location-grid" role="group" aria-label="Island size">
                  {([['small', 'Small'], ['medium', 'Notch'], ['large', 'Large']] as const).map(([size, label]) => <button key={size} type="button" className={settings.barSize === size ? 'on' : ''} onClick={() => void onSettings({ barSize: size })}>{label}</button>)}
                </div>
              </div>
              <div className="setrow"><div><div className="sl">Quiet Island visibility</div><div className="sd">Always available keeps the Island at the edge of your screen between reviews. During reviews only hides it until you press {prettyAccel(settings.shortcut)}.</div></div><select className="sel-input" aria-label="Quiet Island visibility" value={settings.barVisibility} onChange={(e) => onSettings({ barVisibility: e.target.value as Settings['barVisibility'] })}><option value="always">Always available</option><option value="during-review">During reviews only</option></select></div>
              <div className="setrow"><div><div className="sl">Expand on hover</div><div className="sd">Off keeps the Island calm and click-only. Click and keyboard controls always work.</div></div><Toggle label="Expand on hover" on={settings.barHoverPreview} onClick={() => onSettings({ barHoverPreview: !settings.barHoverPreview })} /></div>
              {settings.barHoverPreview && <div className="setrow"><div><div className="sl">Hover delay</div><div className="sd">Wait {Math.round(settings.barHoverDelayMs / 10) / 100}s before opening, so passing over the Island never feels jumpy.</div></div><input className="range" aria-label="Hover delay" type="range" min={120} max={600} step={20} value={settings.barHoverDelayMs} onChange={(e) => onSettings({ barHoverDelayMs: Number(e.target.value) })} /></div>}
              <div className="setrow"><div><div className="sl">Follow active display</div><div className="sd">Place the strip on the display where your pointer is when it moves or opens.</div></div><Toggle label="Follow active display" on={settings.followActiveDisplay} onClick={() => onSettings({ followActiveDisplay: !settings.followActiveDisplay })} /></div>
              <div className="settings-section-label">Panel</div>
              <div className="setrow settings-location"><div><div className="sl">When I click away</div></div>
                <div className="location-grid" role="group" aria-label="When I click away">
                  {([['fade', 'Fade'], ['hide', 'Hide']] as const).map(([behavior, label]) => <button key={behavior} type="button" className={settings.inactiveBehavior === behavior ? 'on' : ''} aria-pressed={settings.inactiveBehavior === behavior} onClick={() => void onSettings({ inactiveBehavior: behavior })}>{label}</button>)}
                </div>
              </div>
            </>
          )}

          {tab === 'Sound & alerts' && (
            <>
              <div className="settings-section-label">Local sound</div>
              <div className="setrow"><div><div className="sl">Interface sounds</div><div className="sd">Little sounds when Vibe is happy, when an explanation starts and finishes, when you get a quiz right or wrong, and when you move around the app. Nothing is recorded or downloaded.</div></div><Toggle label="Interface sounds" on={settings.soundEffects} onClick={() => onSettings({ soundEffects: !settings.soundEffects })} /></div>
              <div className="setrow"><div><div className="sl">Sound character</div><div className="sd">Soft is subtle. Pixel is sharper and more playful.</div></div><select className="sel-input" aria-label="Sound character" value={settings.soundStyle} disabled={!settings.soundEffects} onChange={(e) => onSettings({ soundStyle: e.target.value as Settings['soundStyle'] })}><option value="soft">Soft</option><option value="pixel">Pixel</option></select></div>
              <div className="setrow"><div><div className="sl">Volume</div><div className="sd">{Math.round(settings.soundVolume * 100)}%, stored on this {deviceName}.</div></div><div className="sound-controls"><input className="range" aria-label="Sound volume" type="range" min={0} max={1} step={0.05} disabled={!settings.soundEffects} value={settings.soundVolume} onChange={(e) => onSettings({ soundVolume: Number(e.target.value) })} /><button className="act" disabled={!settings.soundEffects} onClick={() => { playUiTone('boop', settings.soundVolume, settings.soundStyle); window.setTimeout(() => playUiTone('celebrate', settings.soundVolume, settings.soundStyle), 420); }}>Preview</button></div></div>
              <div className="settings-section-label">Notifications</div>
              <div className="setrow"><div><div className="sl">Bar notifications</div><div className="sd">Short, rate-limited messages when an explanation is ready.</div></div><Toggle label="Bar notifications" on={settings.notifications} onClick={() => onSettings({ notifications: !settings.notifications })} /></div>
              <div className="setrow"><div><div className="sl">Quiet hours</div><div className="sd">Silence notifications overnight.</div></div><Toggle label="Quiet hours" on={settings.quietHours.enabled} onClick={() => onSettings({ quietHours: { ...settings.quietHours, enabled: !settings.quietHours.enabled } })} /></div>
              {settings.quietHours.enabled && <div className="setrow"><div><div className="sl">From / to</div><div className="sd">24-hour times.</div></div><div className="danger-row"><input className="time-input" aria-label="Quiet hours start" type="time" value={settings.quietHours.start} onChange={(e) => onSettings({ quietHours: { ...settings.quietHours, start: e.target.value } })} /><input className="time-input" aria-label="Quiet hours end" type="time" value={settings.quietHours.end} onChange={(e) => onSettings({ quietHours: { ...settings.quietHours, end: e.target.value } })} /></div></div>}
            </>
          )}

          {tab === 'Learning' && <>
            <div className="setrow"><div><div className="sl">Default explanation depth</div><div className="sd">The starting depth for a new explanation. You can always switch it in the overlay.</div></div><select className="sel-input" aria-label="Default explanation depth" value={settings.defaultExplanationLevel} onChange={(e) => onSettings({ defaultExplanationLevel: e.target.value as Settings['defaultExplanationLevel'] })}>{STUDY_LEVELS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
            <div className="setrow"><div><div className="sl">Learning records</div><div className="sd">Explanations, quiz results, and concepts save immediately on this {deviceName}. Open Learn to search, revisit, or remove a lesson.</div></div></div>
            <div className="setrow"><div><div className="sl">Briefs</div><div className="sd">Build a brief from the working tree, staged files, latest commit, or branch diff.</div></div><Toggle label="Briefs" on={settings.features?.changeBrief !== false} onClick={() => onSettings({ features: { ...settings.features, changeBrief: !settings.features?.changeBrief } })} /></div>
            <div className="setrow"><div><div className="sl">Why does this exist</div><div className="sd">Look up git blame and commit messages. Facts stay separate from inference.</div></div><Toggle label="Why does this exist" on={settings.features?.whyExists !== false} onClick={() => onSettings({ features: { ...settings.features, whyExists: !settings.features?.whyExists } })} /></div>
            <div className="setrow"><div><div className="sl">Teach it back</div><div className="sd">After an explanation, write what you understood. This is evidence, not a score.</div></div><Toggle label="Teach it back" on={settings.features?.teachBack !== false} onClick={() => onSettings({ features: { ...settings.features, teachBack: !settings.features?.teachBack } })} /></div>
            <div className="setrow"><div><div className="sl">Voice questions</div><div className="sd">Shows a Speak button in the review panel. {isWindows
                ? 'To talk: click any question box, press Win+H, speak, then press Enter. It uses Windows voice typing, so Unvibe never records in the background.'
                : <>To talk: click any question box, press fn twice (or 🌐), speak, press fn, then Return. It uses Mac Dictation, so Unvibe never records in the background. <button type="button" className="link-btn" onClick={() => void window.unvibe.openDictation()}>Dictation settings</button></>}</div></div><Toggle label="Voice questions" on={Boolean(settings.features?.voice)} onClick={() => onSettings({ features: { ...settings.features, voice: !settings.features?.voice } })} /></div>
            <div className="setrow"><div><div className="sl">Live change watch</div><div className="sd">Quiet Island notes after meaningful git edits settle. Debounced, grouped, and silent during quiet hours.</div></div><Toggle label="Live change watch" on={Boolean(settings.features?.live)} onClick={() => onSettings({ features: { ...settings.features, live: !settings.features?.live } })} /></div>
            {settings.features?.live ? <div className="setrow"><div><div className="sl">Snooze Live</div><div className="sd">Mute Live notices for two hours.</div></div><button className="act" onClick={() => void window.unvibe.snoozeLive(2)}>Snooze 2h</button></div> : null}
          </>}

          {tab === 'Integrations' && <IntegrationsPanel />}

          {tab === 'Privacy & Data' && (
            <>
              <AiSendRow />
              <div className="setrow"><div><div className="sl">On-device secret scan</div><div className="sd">Selections, questions, and Chat messages are checked for keys, tokens, and passwords before they leave your {deviceName}.</div></div><span className="status-pill setting-status" data-tone="current">Always on</span></div>
              <div className="setrow"><div><div className="sl">The service never reads your repo</div><div className="sd">Unvibe sends only what you ask about, after the secret scan: the code you select, your questions and Chat messages. Change Briefs and diff explanations send the git diff you chose.</div></div></div>
              <div className="setrow"><div><div className="sl">Include nearby files (Pro)</div><div className="sd">Also sends parts of up to 2 files that the selected code imports from the same project, for better explanations. Off unless you turn it on.</div></div><Toggle label="Include nearby files" on={settings.nearbyFiles === true} onClick={() => onSettings({ nearbyFiles: settings.nearbyFiles !== true })} /></div>
              {info.sendsSetupProgress && <div className="setrow"><div><div className="sl">Send setup progress</div><div className="sd">Tells Unvibe when this install finished setup, was asked for and allowed Accessibility, signed in, and answered the level question. Tied to a random install ID, never your code, files or email. Off unless you turn it on. The dates of your first launch, first explanations and a first-week return come from free-allowance requests, so they are kept with this off too.</div></div><Toggle label="Send setup progress" on={settings.shareSetupProgress === true} onClick={() => onSettings({ shareSetupProgress: settings.shareSetupProgress !== true })} /></div>}
              <div className="setrow"><div><div className="sl">Privacy policy</div><div className="sd">Read how Unvibe handles your code and data on our website.</div></div><button className="act" onClick={() => window.unvibe.openPrivacy()}>Read →</button></div>
              <div className="setrow"><div><div className="sl">Report beta feedback</div><div className="sd">Opens a draft with your app version and current screen. Attach a screenshot only if it helps.</div></div><button className="act" onClick={() => void window.unvibe.reportFeedback({ screen: `Settings · ${tab}`, version: info.version })}>Report →</button></div>
              <div className="setrow"><div><div className="sl">Support</div><div className="sd">{SUPPORT_EMAIL}</div></div><button className="act" onClick={() => void window.open(`mailto:${SUPPORT_EMAIL}`)}>Email →</button></div>
            </>
          )}

          {tab === 'Account & Plan' && <AccountPanel account={account} onChange={onAccountChange} onDeleted={onAccountDeleted} onNotice={onNotice} />}
          {tab === 'About' && <><div className="settings-about-mark"><Buddy mood="happy" size={48} label="Vibe" /></div><div className="setrow"><div><div className="sl">Unvibe for {isWindows ? 'Windows' : 'macOS'}</div><div className="sd">Version {info.version}. A private learning layer for understanding AI-generated code.</div></div></div><div className="setrow"><div><div className="sl">Need help?</div><div className="sd">{SUPPORT_EMAIL}</div></div><button className="act" onClick={() => void window.open(`mailto:${SUPPORT_EMAIL}`)}>Email →</button></div><div className="setrow"><div><div className="sl">Credits</div><div className="sd">Inter, © 2016 The Inter Project Authors; Instrument Serif, © 2022 The Instrument Serif Project Authors; Bricolage Grotesque, © 2022 The Bricolage Grotesque Project Authors; JetBrains Mono, © 2020 The JetBrains Mono Project Authors: all SIL Open Font License 1.1. ascii-sharks, © 2026 drewdi, MIT License. Background photo: Tim Marshall (Unsplash), CC0, recoloured.</div></div></div></>}
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
  const [info, setInfo] = useState({ version: '0.1.0', user: 'there', shortcut: reviewKeyHint, sendsSetupProgress: false });
  const [account, setAccount] = useState<Account>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [history, setHistory] = useState<LearningItem[]>([]);
  const [queue, setQueue] = useState<LearningItem[]>([]);
  const [today, setToday] = useState<TodayGoal | null>(null);
  const [sync, setSync] = useState<SyncStatus>({ phase: 'local', pending: 0 });
  const [settings, setSettings] = useState<Settings | null>(null);
  const [askDraft, setAskDraft] = useState('');
  const [askSeed, setAskSeed] = useState('');
  const [gate, setGate] = useState<'checking' | 'onboarding' | 'login' | 'app'>('checking');
  /** The service's note after a confirmed account deletion, shown on the sign-in screen until it is left. */
  const [deletionNotice, setDeletionNotice] = useState('');
  const [usageLine, setUsageLine] = useState<AppUsageLine | null>(null);
  const [sideWidth, setSideWidth] = useState(232);
  const sideLive = useRef(232);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lessonSeedId, setLessonSeedId] = useState<string | null>(null);
  const [lessonSeedRevision, setLessonSeedRevision] = useState(0);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [ownCodeStep, setOwnCodeStep] = useState(false);

  const refresh = async () => {
    try {
      const [acct, prof, hist, st, syncState, usage, q, goal, appInfo, ownCode] = await Promise.all([
        window.unvibe.account() as Promise<Account>,
        window.unvibe.profile() as Promise<Profile>,
        window.unvibe.history(100) as Promise<LearningItem[]>,
        window.unvibe.getSettings() as Promise<Settings>,
        window.unvibe.syncStatus() as Promise<SyncStatus>,
        window.unvibe.usageGet() as Promise<{ ok: boolean; data?: AppUsageLine }>,
        window.unvibe.reviewQueue(20) as Promise<LearningItem[]>,
        window.unvibe.learningToday() as Promise<TodayGoal>,
        window.unvibe.appInfo(),
        window.unvibe.ownCodeStep(),
      ]);
      setAccount(acct); setProfile(prof); setHistory(hist); setQueue(q); setToday(goal); setSettings(st); setSync(syncState);
      setOwnCodeStep(ownCode);
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
        const { st } = await refresh();
        // Local mode is a full product: no sign-in wall on every launch. Sign in stays in the
        // sidebar account menu for people who want sync.
        setGate(!st.onboarded ? 'onboarding' : 'app');
      } catch {
        setGate('app');
      }
    })();
    const onFocus = () => void refresh();
    const offLearning = window.unvibe.onLearningChanged(() => void refresh());
    const offOwnCode = window.unvibe.onOwnCodeChanged(() => void refresh());
    window.unvibe.onSyncStatus((next) => setSync(next as SyncStatus));
    window.unvibe.onShowPage((next) => {
      // A page asked for by name (Island Settings, Plan) wins over the paste step, as Not now does.
      setOwnCodeStep(false);
      void window.unvibe.ownCodeNotNow();
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
      offLearning();
      offOwnCode();
    };
  }, []);

  // The 0.1.51 glass has a real dark theme: follow the Theme setting (System follows macOS/Windows,
  // live). Until the settings load, light.
  useEffect(() => {
    document.documentElement.dataset.ui = 'v3';
    document.documentElement.dataset.v7 = '';
    // Round 2 glass (G1): the motion tokens key off it (app-0151.css `html[data-r2]`).
    document.documentElement.dataset.r2 = 'g1';
    // Windows draws its caption buttons over the top-right corner; CSS reserves room for them.
    document.documentElement.dataset.platform = platformAttr;
  }, []);
  const themePreference = settings?.theme ?? 'light';
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = themePreference === 'dark' || (themePreference === 'system' && media.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [themePreference]);
  useEffect(() => {
    configureTones({ enabled: settings?.soundEffects ?? true, volume: settings?.soundVolume ?? 0.3, style: settings?.soundStyle ?? 'soft' });
  }, [settings?.soundEffects, settings?.soundVolume, settings?.soundStyle]);
  // The cold-launch ocean (shared/sharks, Design r2-motion SPEC §2): on from the first frame (before the settings
  // arrive, so the first paint is never an empty field), unless the window starts hidden or the last-known setting
  // (mirrored in localStorage) is off. When the settings land with the row off, the stage goes at once. The app
  // renders under it, inert, and arrives as it leaves. Onboarding and sign-in never get a stage.
  const [intro, setIntro] = useState<IntroPhase | 'off'>(() => {
    let off = false;
    try { off = window.localStorage.getItem(START_ANIMATION_KEY) === 'off'; } catch { off = false; }
    return !off && document.visibilityState === 'visible' ? 'swim' : 'off';
  });
  const startAnimation = settings?.startAnimation;
  useEffect(() => {
    if (startAnimation === undefined) return;
    try { window.localStorage.setItem(START_ANIMATION_KEY, startAnimation ? 'on' : 'off'); } catch { /* private mode */ }
    if (!startAnimation) setIntro('off');
  }, [startAnimation]);
  useEffect(() => {
    // No stage over the first run, sign-in or the paste step: those screens are full-window moments of their own.
    if (gate === 'onboarding' || gate === 'login' || ownCodeStep) setIntro('off');
  }, [gate, ownCodeStep]);
  // Main darkened the window chrome for the stage (MUST 14); as the stage leaves, or when there is none, it goes back.
  useEffect(() => {
    if (intro === 'leaving' || intro === 'gone' || intro === 'off') window.unvibe.companionStageDone?.();
  }, [intro]);
  const introOn = intro === 'swim' || intro === 'leaving';
  // Ask for a rating once, after the third explanation, when it means something: only once an explanation has
  // finished or a lesson was marked understood in this session (the counts moved past what they were when the app
  // opened), never at launch and never while the start stage is up (Design S-1 whole-app MUST 15).
  const countsAtOpen = useRef<{ reviews: number; understood: number } | null>(null);
  useEffect(() => {
    if (gate !== 'app' || !profile) return;
    const reviews = profile.reviews ?? 0;
    const understood = profile.understood ?? 0;
    if (!countsAtOpen.current) {
      countsAtOpen.current = { reviews, understood };
      return;
    }
    if (reviews < 3 || (reviews <= countsAtOpen.current.reviews && understood <= countsAtOpen.current.understood)) return;
    if (intro === 'swim' || intro === 'leaving') return;
    let asked = false;
    try { asked = window.localStorage.getItem(FEEDBACK_ASKED_KEY) === '1'; } catch { asked = true; }
    if (asked) return;
    const t = window.setTimeout(() => setFeedbackOpen(true), 2500);
    return () => window.clearTimeout(t);
  }, [gate, profile, intro]);
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

  const [toastLeaving, setToastLeaving] = useState(false);
  const toastTimers = useRef<number[]>([]);
  const flash = (m: string) => {
    for (const t of toastTimers.current) window.clearTimeout(t);
    setToastLeaving(false);
    setToast(m);
    toastTimers.current = [window.setTimeout(() => setToastLeaving(true), 1650), window.setTimeout(() => { setToast(''); setToastLeaving(false); }, 1800)];
  };
  const shortcutLabel = prettyAccel(info.shortcut);
  const shortcutKeys = shortcutCaps(info.shortcut);
  const isLearnPage = page === 'Learn' || page === 'Study' || page === 'History' || page === 'Quiz';
  const fillPage = isLearnPage || page === 'Chat' || page === 'Briefings';
  const navButton = (p: { id: PageId; icon: string }, on: boolean) => {
    const label = pageLabel(p.id);
    return (
      <button key={p.id} type="button" className={on ? 'on' : ''} aria-current={on ? 'page' : undefined} aria-label={label} title={sideCompact ? label : undefined} onClick={() => { setAskSeed(''); setLessonSeedId(null); setPage(p.id); setNavOpen(false); }}>
        <Icon d={p.icon} /><span className="nav-label">{label}</span>
      </button>
    );
  };
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

  if (gate === 'checking') return <>{introOn ? <SharksIntro onPhase={setIntro} /> : null}<div className="titlebar" /></>;
  if (gate === 'onboarding') {
    return (<><div className="titlebar" /><Onboarding soundEffects={settings?.soundEffects ?? true} soundVolume={settings?.soundVolume ?? 0.3} soundStyle={settings?.soundStyle ?? 'soft'} shortcut={settings?.shortcut ?? (isMac ? 'Control+U' : 'Control+Alt+U')} onDone={async () => { await refresh(); setGate('app'); }} /></>);
  }
  if (gate === 'login') {
    return (<><div className="titlebar" /><LoginScreen shortcut={settings?.shortcut ?? 'CommandOrControl+U'} notice={deletionNotice} onSignedIn={async () => { setDeletionNotice(''); await refresh(); setGate('app'); }} onSkip={() => { setDeletionNotice(''); setGate('app'); }} /></>);
  }
  if (ownCodeStep) {
    // Hidden at once, and again once main has it, so a refresh already under way can't bring it back.
    const notNow = () => { setOwnCodeStep(false); void window.unvibe.ownCodeNotNow().then(() => setOwnCodeStep(false)); };
    return (<><div className="titlebar" /><OwnCodeWelcome soundEffects={settings?.soundEffects ?? true} shortcut={settings?.shortcut ?? (isMac ? 'Control+U' : 'Control+Alt+U')} onNotNow={notNow} /></>);
  }

  // The stage is the first child here and in the `checking` fragment above, so React keeps the same instance (and
  // the same swimming sharks) when the gate opens instead of remounting it with a blank frame between.
  return (
    <>
      {introOn ? <SharksIntro onPhase={setIntro} /> : null}
      <ConsentDialog buttonClass="field-btn" />
      {/* Drag strip only. Clickable controls live in the topbar: macOS drag regions swallow
          clicks on anything layered over them, whatever the z-index. */}
      <div className="titlebar" />
      <div className={`layout${navOpen ? ' layout--nav-open' : ''}${sideHidden ? ' layout--side-hidden' : ''}${intro === 'leaving' || intro === 'gone' ? ' layout--arrive' : ''}`} inert={intro === 'swim'}>
        {navOpen ? <button type="button" className="nav-scrim" aria-label="Close menu" onClick={() => setNavOpen(false)} /> : null}
        <aside id="companion-sidebar" hidden={sideHidden} className={`side fade-in fade-in--side${sideCompact ? ' side--compact' : ''}`} style={{ width: sideWidth }}>
          <div className="brand"><Buddy size={26} label="Vibe" /><span className="name">Unvibe</span><span className="badge">Beta</span></div>
          <button type="button" className="side-search" onClick={() => { setSearchQuery(''); setSearchOpen(true); }} aria-label="Search">
            <Icon d="M8.5 14a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11z M12.5 12.5L16 16" />
            <span className="nav-label">Search</span>
            <kbd>{modKey}K</kbd>
          </button>
          {/* One sliding pill for both navs (motion row 2): it lives in the wrapper so Today → Library is one move. */}
          <div className="side-navs">
            <SlidingPill />
            <nav className="nav nav--top">{NAV_PINNED.map((p) => navButton(p, p.id === page))}</nav>
            <p className="side-spaces">Learn</p>
            <nav className="nav nav--spaces">
              {NAV_SPACES.map((p) => navButton(p, p.id === page || (p.id === 'Learn' && (page === 'Study' || page === 'History'))))}
            </nav>
          </div>
          <div className="spacer" />
          {usageLine ? (
            <button type="button" className="side-usage" onClick={() => setPage('Plan')} title="Plan and usage">
              {/* The signed-out trial is Free too, but its 50 never refill, so it isn't called a plan (Security INFO 30 Oct). */}
              <span className="side-usage__row"><span>{usageLine.plan === 'trial' ? 'Free on this computer' : `${planLabel(usageLine.plan)} plan`}</span><b><CountUp value={usageLine.remaining} /> left</b></span>
              <i className="side-usage__bar"><i style={{ width: `${usageLine.limit ? Math.min(100, (usageLine.used / usageLine.limit) * 100) : 0}%` }} /></i>
            </button>
          ) : null}
          <button
            className={`sync-state sync-state--${sync.phase}`}
            aria-label={`Sync status: ${sync.phase}. ${sync.pending} pending.`}
            onClick={() => void window.unvibe.retrySync()}
            disabled={sync.phase === 'syncing' || sync.phase === 'local'}
          >
            <span className="sync-state__dot" />
            <span className="sync-state__copy">{sync.phase === 'local' ? `Saved on this ${deviceName}` : sync.phase === 'syncing' ? 'Syncing…' : sync.phase === 'synced' ? 'Synced' : sync.phase === 'auth_required' ? 'Sign in again' : 'Retry sync'}</span>
            {sync.pending > 0 && sync.phase !== 'local' && <small>{sync.pending} pending</small>}
          </button>
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
            <button type="button" className="topbar__side" aria-controls="companion-sidebar" aria-expanded={!sideHidden} aria-label={sideHidden ? 'Show sidebar' : 'Hide sidebar'} title={sideHidden ? `Show sidebar (${modKey}\\)` : `Hide sidebar (${modKey}\\)`} onClick={() => toggleSideRef.current()}>
              <Icon d="M4 4h12v12H4z M7 4v12" />
            </button>
            <h2 id="companion-page-title" className="topbar__title">{pageLabel(page === 'Study' || page === 'History' ? 'Learn' : page)}</h2>
            <span className="topbar__spacer" />
            <button type="button" className="topbar__explain" onClick={() => window.unvibe.companionReview()} disabled={!!usageLine && usageLine.remaining <= 0}>
              <kbd>{shortcutLabel}</kbd><span>Explain</span>
            </button>
          </header>
          <div className={`page${fillPage ? ' page--learn' : ''}${page === 'Home' ? ' page--home' : ''}`} tabIndex={0} role="region" aria-labelledby="companion-page-title">
            <FadeIn animKey={page} stagger={!fillPage}>
              {page === 'Home' ? <Home shortcut={shortcutLabel} shortcutKeys={shortcutKeys} userName={info.user} reviews={profile?.reviews ?? 0} understood={profile?.understood ?? 0} stats={{ reviews: profile?.reviews ?? 0, linesReviewed: profile?.linesReviewed ?? 0, linesUnderstood: profile?.linesUnderstood ?? 0, concepts: (profile?.conceptsFamiliar ?? 0) + (profile?.conceptsStrong ?? 0) }} today={today} history={history} usage={usageLine} onPlan={() => setPage('Plan')} onLibrary={() => setPage('Learn')} onBriefs={() => setPage('Briefings')} onQuiz={() => setPage('Quiz')} onAsk={() => { setAskSeed(''); setPage('Chat'); }} />
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
                />
                : page === 'Progress' ? <Progress profile={profile} />
                : page === 'Plan' ? <Plan signedIn={Boolean(account)} onSignedIn={() => { void refresh(); }} />
                : page === 'Gift' ? <Gift />
                : page === 'Briefings' ? <Briefings plan={usageLine?.plan ?? null} onPlan={() => setPage('Plan')} />
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
      {searchOpen && !settingsOpen ? <SearchPalette groups={searchGroups} query={searchQuery} onQuery={setSearchQuery} onClose={() => setSearchOpen(false)} /> : null}
      {settingsOpen && settings && (
        <Settings info={info} account={account} settings={settings}
          initialTab={settingsTab}
          onAccountChange={async () => { const { acct } = await refresh(); if (!acct) setGate('app'); }}
          onAccountDeleted={(message) => { setSettingsOpen(false); setAccount(null); setProfile(null); setDeletionNotice(message ?? ''); setGate('login'); void refresh(); }}
          onSettings={applySettings} onClose={() => setSettingsOpen(false)} onNotice={flash} />
      )}
      <UpdateCard />
      {feedbackOpen ? <FeedbackCard onClose={() => setFeedbackOpen(false)} /> : null}
      {toast && <div className={`toast${toastLeaving ? ' is-leaving' : ''}`} role="status">{toast}</div>}
    </>
  );
}

trackWindowAway();
createRoot(document.getElementById('root')!).render(<App />);
