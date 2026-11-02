/**
 * Review pipeline (main process — the only place with network access).
 * capture → build context → local secret filter → (consent) → stream → record → sync.
 */
import { net, type BrowserWindow } from 'electron';
import { scanReviewPayload, hasBlocking, type SecretFinding } from '../core/secretFilter';
import { SseParser } from '../core/sse';
import { explanationFailure, serviceMessage } from '../core/serviceError';
import { guessLanguage } from '../core/language';
import type { ExplanationLevel, QuizMode, ReviewRequestPayload } from '../core/protocol';
import { localDayKey, type LocalEvent } from '../core/learning';
import { fetchQuestion, PlanLimitError, postReview } from './backend';
import { store } from './store';

/** Longest wait for the first words of an explanation. */
const FIRST_TOKEN_MS = 30_000;
/** Longest silence allowed once words are streaming. */
const STREAM_IDLE_MS = 30_000;
import { flush } from './sync';
import { cachedAppUsage, refreshAppUsage } from './usage';
import { settings } from './settings';
import { readAiKey } from './aiKey';
import { buildLocalSystemPrompt, buildLocalUserPrompt, estimateCost, streamLocalAi } from './localAi';
import { buildSelectionPayload, sendNearbyFiles, type ReviewMode } from './contextBuilder';
import { isProPlan } from '../core/plan';
import { raiseLimitPause } from './windows';
import { pulseBar } from './notify';
import { knowledgeStore } from './knowledgeStore';
import { noteOwnCodeExplained } from './ownCodeStep';
import { productEvent } from '../core/productEvents';
import { CONSENT_PROVIDERS, ConsentRequiredError, type ConsentProvider } from '../core/consent';
import { codeConsented } from './consentStore';
import { providerInUse } from './consent';

export type WidgetEvent =
  /**
   * `consentProvider`: ask first, for this provider (the person hasn't agreed to sending code to it);
   * `confirm`: a link started this review, and Explain must be pressed before anything is sent.
   */
  | { type: 'init'; tabId: string; hasCode: boolean; sourceApp?: string | null; file?: string; lines?: number; language?: string; preview?: string; autoStart?: boolean; consentProvider?: ConsentProvider; confirm?: boolean; providerName: string; mode?: string; level: ExplanationLevel }
  /** The person hasn't agreed to sending their code to this provider: the panel asks first. */
  | { type: 'consentNeeded'; tabId: string; provider: ConsentProvider }
  | { type: 'status'; tabId: string; message: string; resetQuiz?: boolean }
  | { type: 'consent'; tabId: string; findings: SecretFinding[] }
  | { type: 'blocked'; tabId: string; findings: SecretFinding[] }
  | { type: 'token'; tabId: string; text: string }
  | { type: 'done'; tabId: string; model: string; mock: boolean }
  | { type: 'error'; tabId: string; message: string; code?: string; upgradePath?: string }
  | { type: 'cancelled'; tabId: string }
  | { type: 'question'; tabId: string; question: string; options: string[]; conceptLabel: string; index: number; total: number; mode: QuizMode }
  | { type: 'graded'; tabId: string; correct: boolean; answerIndex: number; rationale: string; hasMissed: boolean }
  | { type: 'usage'; tabId: string; used: number; limit: number; remaining: number; resetsAt: string; plan: string }
  | { type: 'understood'; tabId: string }
  /** Test me could not get a question; the panel keeps the explanation and offers to ask again. */
  | { type: 'quizError'; tabId: string; message: string };

export interface ReviewSession {
  reviewId: string;
  tabId: string;
  code: string | null;
  sourceApp: string | null;
  abort: AbortController | null;
  recorded: boolean;
  level: ExplanationLevel;
  /** Accumulated streamed explanation for local history (on-device only). */
  explanationText?: string;
  /** Prevents a pulse event for every streamed token. */
  islandStreaming?: boolean;
  payload?: ReviewRequestPayload;
  file?: string;
  project?: string;
  sourceFilePath?: string;
  /** Raw file text for memory baselines — never the display blob for diffs/compares. */
  snapshotText?: string;
  mode?: ReviewMode;
  pendingAnswer?: { answerIndex: number; concept: string; conceptLabel: string; rationale: string };
  /** Per-explanation progress, kept in main so renderer clicks cannot choose angles or exceed three. */
  comprehension?: { asked: number; hasMissed: boolean; understood: boolean; loading: boolean };
  /** True while the session holds the built-in first-run sample rather than the user's own code. */
  isSample?: () => boolean;
  /**
   * True when an `unvibe://review` link captured this code: any web page can open that link, so
   * nothing is sent until the person presses Explain in the panel (Security 10-22 LOW #8).
   */
  awaitingConfirm?: boolean;
  onRecorded?: () => void;
  onUnderstood?: () => void;
  /** store().wipeGeneration() when the latest run started: a run that outlives a wipe records nothing. */
  wipeGeneration?: number;
}

export interface RequestOpts {
  level: ExplanationLevel;
  question?: string;
  variant?: 'default' | 'different';
  consented?: boolean;
}

function send(win: BrowserWindow, session: ReviewSession, ev: object): void {
  if (!win.isDestroyed()) {
    win.webContents.send('review:event', { ...ev, tabId: session.tabId } as WidgetEvent);
  }
  const typed = ev as { type?: string; message?: string };
  if (typed.type === 'status') pulseBar({ phase: 'thinking', label: 'Thinking' });
  else if (typed.type === 'token' && !session.islandStreaming) {
    session.islandStreaming = true;
    pulseBar({ phase: 'generating', label: 'Generating' });
  }
  else if (typed.type === 'done') pulseBar({ phase: 'finalizing', label: 'Finalizing' });
  else if (typed.type === 'understood') pulseBar({ phase: 'understood', label: 'Understood' });
  else if (typed.type === 'error') {
    const offline = /could not reach|network|offline|connection/i.test(typed.message ?? '');
    pulseBar({ phase: offline ? 'offline' : 'error', label: offline ? 'Offline' : 'Issue' });
  }
  else if (typed.type === 'blocked') pulseBar({ phase: 'error', label: 'Blocked' });
  else if (typed.type === 'cancelled') pulseBar({ phase: 'idle', label: 'Ready' });
}

async function ensurePayload(session: ReviewSession, opts: RequestOpts): Promise<ReviewRequestPayload> {
  if (session.payload) {
    return {
      ...session.payload,
      level: opts.level,
      question: opts.question ?? session.payload.question,
      variant: opts.variant ?? session.payload.variant ?? 'default',
    };
  }
  const code = session.code;
  if (!code) throw new Error('No code captured.');
  const usage = await cachedAppUsage();
  const sample = session.isSample?.() === true;
  const built = await buildSelectionPayload({
    code,
    level: opts.level,
    filePath: session.sourceFilePath,
    question: opts.question,
    variant: opts.variant,
    // The sample is Unvibe's own code: no project name or nearby files of the person's go with it.
    noRepo: sample,
    withNearby: !sample && sendNearbyFiles(usage.plan),
  });
  session.payload = built.payload;
  session.file = built.file ?? session.file;
  session.project = built.project ?? session.project;
  session.sourceFilePath = built.sourceFilePath ?? session.sourceFilePath;
  session.snapshotText = built.snapshotText ?? session.snapshotText;
  session.mode = built.mode;
  return built.payload;
}

export function applyBuiltReview(session: ReviewSession, built: {
  payload: ReviewRequestPayload;
  displayCode: string;
  file?: string;
  project?: string;
  sourceFilePath?: string;
  snapshotText?: string;
  mode: ReviewMode;
}): void {
  session.code = built.displayCode;
  session.payload = built.payload;
  session.file = built.file;
  session.project = built.project;
  session.sourceFilePath = built.sourceFilePath;
  session.snapshotText = built.snapshotText;
  session.mode = built.mode;
  session.level = built.payload.level;
  session.recorded = false;
  session.comprehension = undefined;
  session.pendingAnswer = undefined;
  // Built from something the person picked (a file, a brief, a Study lesson), not a link capture.
  session.awaitingConfirm = false;
}

function persistUnderstoodSnapshot(session: ReviewSession): void {
  if (!session.file || !session.snapshotText) return;
  if (session.mode === 'diff' || session.mode === 'brief') return;
  store().saveFileSnapshot(session.file, session.project, session.snapshotText.slice(0, 12_000));
}

/** True once the store was wiped (account deletion, Erase everything) after this session's latest run started. */
function wipedSinceRun(session: ReviewSession): boolean {
  return session.wipeGeneration !== undefined && session.wipeGeneration !== store().wipeGeneration();
}

/**
 * Mark the current review understood (Got it) and refresh the file memory baseline when safe. On a
 * panel that outlived a wipe nothing is saved: no lesson, outcome or file snapshot.
 */
export function markUnderstood(win: BrowserWindow, session: ReviewSession): void {
  if (wipedSinceRun(session)) return;
  if (!session.recorded) recordReview(win, session, false);
  try {
    store().setOutcome(session.reviewId, 'understood');
    persistUnderstoodSnapshot(session);
  } catch (error) {
    send(win, session, {
      type: 'error',
      message: error instanceof Error ? error.message : 'Could not save that you understood this.',
    });
    return;
  }
  session.onUnderstood?.();
  void flush();
  send(win, session, { type: 'understood' });
}

export function initWidget(
  win: BrowserWindow,
  session: ReviewSession,
  opts?: { autoStart?: boolean },
): void {
  const code = session.code;
  // Asked when the panel opens, before anything can be sent; an empty panel asks too, so a
  // shortcut or link that captured nothing still shows what Unvibe would do (Security CC-4, CC-5).
  const consentProvider = consentNeededFor(session);
  send(win, session, {
    type: 'init',
    hasCode: code !== null,
    sourceApp: session.sourceApp,
    file: session.file,
    lines: code ? code.split('\n').length : 0,
    language: code ? guessLanguage(code) : undefined,
    // Renderer-local only. The preview never leaves this process and is not persisted here.
    preview: code ? code.slice(0, 600) : undefined,
    autoStart: Boolean(opts?.autoStart && code && !session.awaitingConfirm) && !consentProvider,
    ...(consentProvider ? { consentProvider } : {}),
    providerName: CONSENT_PROVIDERS[providerInUse()],
    confirm: Boolean(session.awaitingConfirm && code),
    mode: session.mode,
    // The panel's depth row and every re-request it sends start from the session depth (the user's default).
    level: session.level,
  });
}

/**
 * The provider this run would send to, when the person hasn't agreed to sending code there; null
 * when it may go. The built-in sample is exempt while nothing of the person's is added (a typed
 * question is theirs). `remaining` lets the automatic switch to an own key count.
 */
function consentNeededFor(session: ReviewSession, remaining?: number, question?: string): ConsentProvider | null {
  if (session.isSample?.() && !question) return null;
  const provider = providerInUse(remaining);
  return codeConsented(provider) ? null : provider;
}

function askConsent(win: BrowserWindow, session: ReviewSession, provider: ConsentProvider): void {
  send(win, session, { type: 'consentNeeded', provider });
  pulseBar({ phase: 'idle', label: 'Ready' });
}

function appendExplanation(session: ReviewSession, text: string): void {
  session.explanationText = (session.explanationText ?? '') + text;
}

/**
 * Saves the finished run as the lesson. A follow-up answer is shown in the panel but never replaces
 * the saved explanation of the code (its first run still records the lesson, so nothing is lost).
 * A run that started before the store was wiped (account deletion, Erase everything) saves nothing.
 */
function recordReview(win: BrowserWindow, session: ReviewSession, followUp: boolean): boolean {
  if (!session.code) return false;
  if (wipedSinceRun(session)) return false;
  const explanation = session.explanationText?.trim() || undefined;
  if (session.recorded) {
    if (followUp) return true;
    try {
      store().updateLesson(session.reviewId, {
        code: session.code,
        explanation,
        level: session.level,
      });
    } catch (error) {
      send(win, session, {
        type: 'error',
        message: error instanceof Error ? error.message : 'The explanation could not be saved locally.',
      });
      return false;
    }
    return true;
  }
  session.recorded = true;
  const now = new Date();
  const ev: LocalEvent = {
    id: session.reviewId,
    ts: now.toISOString(),
    eventType: 'explanation_completed',
    localDate: localDayKey(now),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    scope: session.payload?.scope ?? 'selection',
    level: session.level,
    outcome: 'reviewed',
    lines: session.code.split('\n').length,
    language: guessLanguage(session.code),
    sourceApp: session.sourceApp ?? undefined,
    file: session.file,
    project: session.project,
    code: session.code.slice(0, 40_000),
    explanation: explanation?.slice(0, 60_000),
    ...(session.isSample?.() ? { sample: true as const } : {}),
  };
  try {
    store().recordReview(ev);
  } catch (error) {
    session.recorded = false;
    send(win, session, {
      type: 'error',
      message: error instanceof Error ? error.message : 'The explanation could not be saved locally.',
    });
    return false;
  }
  // Every explanation path saves here, so the companion's own-code step ends after whichever came first.
  if (!ev.sample) noteOwnCodeExplained();
  try {
    if (explanation && session.file) {
      knowledgeStore().upsert({
        objectType: session.mode === 'brief' ? 'change_brief' : 'file',
        objectId: `${session.project ?? 'local'}:${session.file}:${session.reviewId}`,
        title: session.file,
        summary: explanation.slice(0, 240),
        body: explanation,
        sourceType: 'review',
        sourceRefs: [session.file],
        visibility: 'PRIVATE',
        verificationStatus: 'AI_GENERATED',
        code: session.snapshotText ?? session.code ?? explanation,
        repositoryId: session.project,
        file: session.file,
      });
      productEvent('knowledge_saved');
    }
    productEvent('explanation_completed');
  } catch {
    /* learning already saved */
  }
  session.onRecorded?.();
  void flush();
  return true;
}

export async function runReview(win: BrowserWindow, session: ReviewSession, opts: RequestOpts): Promise<void> {
  // Fails closed: link-captured code is only sent after Explain (widget:request clears the flag first).
  if (session.awaitingConfirm) return;
  // Fails closed: nothing of the person's is sent before they agree; the panel shows the form.
  const before = consentNeededFor(session, undefined, opts.question);
  if (before) {
    askConsent(win, session, before);
    return;
  }
  if (!session.code && !session.payload) {
    send(win, session, { type: 'error', message: 'No code captured.' });
    return;
  }
  session.level = opts.level;
  if (!opts.question) {
    session.comprehension = undefined;
    session.pendingAnswer = undefined;
  }
  session.explanationText = '';
  session.islandStreaming = false;
  // A lesson this panel saved before a wipe went with it: this run saves a new one.
  if (wipedSinceRun(session)) session.recorded = false;
  session.wipeGeneration = store().wipeGeneration();
  pulseBar({ phase: 'contextualizing', label: 'Contextualizing' });

  const usageEarly = await cachedAppUsage();
  // With the free allowance used up, a saved key takes over: that provider needs its own agreement.
  const switched = consentNeededFor(session, usageEarly.remaining, opts.question);
  if (switched) {
    askConsent(win, session, switched);
    return;
  }
  if (opts.level === 'expert' && !isProPlan(usageEarly.plan)) {
    send(win, session, {
      type: 'error',
      code: 'pro_required',
      upgradePath: '/plan',
      message: 'Expert explanations are included with Unvibe Pro.',
    });
    return;
  }

  let payload: ReviewRequestPayload;
  try {
    payload = await ensurePayload(session, opts);
  } catch (err) {
    send(win, session, { type: 'error', message: err instanceof Error ? err.message : 'Could not build review context.' });
    return;
  }

  pulseBar({ phase: 'analyzing', label: 'Analyzing' });
  const findings = scanReviewPayload(payload);
  if (hasBlocking(findings)) {
    send(win, session, { type: 'blocked', findings });
    return;
  }
  if (findings.length > 0 && !opts.consented) {
    send(win, session, { type: 'consent', findings });
    pulseBar({ phase: 'idle', label: 'Ready' });
    return;
  }

  session.abort?.abort();
  const abort = new AbortController();
  session.abort = abort;
  let timedOut = false;
  // Wait up to FIRST_TOKEN_MS for the first words, then only fail if the stream goes quiet.
  // A long answer that keeps streaming is never cut off.
  let watchdog = setTimeout(() => { timedOut = true; abort.abort(); }, FIRST_TOKEN_MS);
  const stillStreaming = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => { timedOut = true; abort.abort(); }, STREAM_IDLE_MS);
  };

  send(win, session, { type: 'status', message: 'thinking', resetQuiz: !opts.question });
  try {
    const token = store().token();
    const usage = await cachedAppUsage();
    send(win, session, {
      type: 'usage',
      used: usage.used,
      limit: usage.limit,
      remaining: usage.remaining,
      resetsAt: usage.resetsAt,
      plan: usage.plan,
    });

    const prefs = settings().all();
    const localKey = readAiKey();
    const wantLocal = Boolean(localKey) && (prefs.useOwnAi || usage.remaining <= 0);
    if (usage.remaining <= 0 && !localKey) {
      const resets = new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' });
      const planName = usage.plan === 'pro' ? 'Pro' : usage.plan === 'teams' ? 'Teams' : 'Free';
      send(win, session, {
        type: 'error',
        code: 'plan_limit_reached',
        upgradePath: '/plan',
        message: `You have reached your ${usage.plan === 'trial' ? '30-day' : 'monthly'} ${planName} explanation limit (${usage.limit}). ${usage.plan === 'trial' ? 'Free explanations on this computer end' : 'Resets'} on ${resets}. Add your own API key in Settings → AI, or upgrade.`,
      });
      raiseLimitPause(win);
      return;
    }

    if (wantLocal && localKey) {
      const lines = (payload.context.code ?? '').split('\n').length;
      const cost = estimateCost(prefs.aiProvider, opts.level, lines);
      send(win, session, { type: 'status', message: `your AI · ${cost.label} · ${session.mode ?? 'selection'}` });
      try {
        const model = await streamLocalAi({
          provider: prefs.aiProvider,
          apiKey: localKey,
          system: buildLocalSystemPrompt(payload),
          user: buildLocalUserPrompt(payload),
          onToken: (text) => {
            stillStreaming();
            appendExplanation(session, text);
            send(win, session, { type: 'token', text });
          },
          signal: abort.signal,
        });
        send(win, session, { type: 'done', model, mock: false });
        if (recordReview(win, session, Boolean(opts.question))) pulseBar({ phase: 'ready', label: 'Ready' });
        void refreshAppUsage().then((next) => {
          send(win, session, {
            type: 'usage',
            used: next.used,
            limit: next.limit,
            remaining: next.remaining,
            resetsAt: next.resetsAt,
            plan: next.plan,
          });
          if (next.remaining <= 0) raiseLimitPause(win);
        }).catch(() => undefined);
      } catch (err) {
        if (err instanceof ConsentRequiredError) {
          askConsent(win, session, err.provider);
          return;
        }
        if (abort.signal.aborted) {
          if (timedOut) send(win, session, { type: 'error', message: 'The explanation took too long. Please try again.' });
          return;
        }
        send(win, session, {
          type: 'error',
          message: err instanceof Error ? err.message : 'Your local AI provider could not complete that request.',
        });
      }
      return;
    }

    const res = await postReview(payload, token, abort.signal);
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as {
        error?: string; message?: string; upgradePath?: string;
        usage?: { used: number; limit: number; remaining: number; resetsAt: string };
      };
      if (body.usage) {
        send(win, session, {
          type: 'usage',
          used: body.usage.used,
          limit: body.usage.limit,
          remaining: body.usage.remaining,
          resetsAt: body.usage.resetsAt,
          plan: usage.plan,
        });
        if (body.usage.remaining <= 0) raiseLimitPause(win);
      }
      const failure = explanationFailure(res.status, body);
      send(win, session, {
        type: 'error',
        message: failure.message,
        // 402 pro_required opens the Pro upgrade panel; only a used-up allowance is plan_limit_reached.
        code: failure.proRequired ? 'pro_required' : failure.planLimit ? 'plan_limit_reached' : undefined,
        upgradePath: body.upgradePath ?? (failure.planLimit || failure.proRequired ? '/plan' : undefined),
      });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    let completed = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      stillStreaming();
      for (const ev of parser.feed(decoder.decode(value, { stream: true }))) {
        // The service streams only token, done and error (web/app/api/v1/reviews/route.ts). Each is
        // rebuilt from the checked fields the panel reads, so nothing else the service sends reaches
        // it; any other type is dropped (init, usage, consent and the rest come from the app).
        if (ev.type === 'token') {
          if (typeof ev.text !== 'string') continue;
          appendExplanation(session, ev.text);
          send(win, session, { type: 'token', text: ev.text });
        } else if (ev.type === 'error') {
          // The service's error text reaches the panel only as a capped string.
          send(win, session, { type: 'error', message: serviceMessage(ev) || 'The explanation service could not complete that request. Please try again.' });
        } else if (ev.type === 'done') {
          send(win, session, { type: 'done', model: typeof ev.model === 'string' ? ev.model.slice(0, 80) : undefined, mock: ev.mock === true });
          completed = true;
          if (recordReview(win, session, Boolean(opts.question))) pulseBar({ phase: 'ready', label: 'Ready' });
          void refreshAppUsage().then((next) => {
            send(win, session, {
              type: 'usage',
              used: next.used,
              limit: next.limit,
              remaining: next.remaining,
              resetsAt: next.resetsAt,
              plan: next.plan,
            });
            if (next.remaining <= 0) raiseLimitPause(win);
          }).catch(() => undefined);
        }
      }
    }
    if (!completed) send(win, session, { type: 'error', message: 'The explanation ended before it was complete. Please try again.' });
  } catch (err) {
    if (err instanceof ConsentRequiredError) {
      askConsent(win, session, err.provider);
      return;
    }
    if (abort.signal.aborted) {
      if (timedOut) send(win, session, { type: 'error', message: 'The explanation stopped responding. Check your connection and try again.' });
      return;
    }
    send(win, session, {
      type: 'error',
      message: net.isOnline()
        ? 'Unvibe could not reach its explanation service. Try again in a moment.'
        : 'You appear to be offline. Reconnect to the internet and try again.',
    });
    void err;
  } finally {
    clearTimeout(watchdog);
    if (session.abort === abort) session.abort = null;
  }
}

const QUESTION_MODES: readonly QuizMode[] = ['quick-check', 'scenario', 'recall'];

export async function startComprehension(win: BrowserWindow, session: ReviewSession): Promise<void> {
  // Questions always come from Unvibe's server; the sample's are exempt (fetchQuestion checks again).
  if (!session.isSample?.() && !codeConsented('unvibe')) {
    askConsent(win, session, 'unvibe');
    return;
  }
  if (!session.code && !session.payload) return;
  const progress = session.comprehension ??= { asked: 0, hasMissed: false, understood: false, loading: false };
  if (progress.loading || progress.asked >= QUESTION_MODES.length) return;
  const mode = QUESTION_MODES[progress.asked];
  progress.loading = true;
  session.pendingAnswer = undefined;
  try {
    pulseBar({ phase: 'thinking', label: 'Thinking' });
    const payload = await ensurePayload(session, { level: session.level });
    if (session.comprehension !== progress) return;
    const q = await fetchQuestion({ ...payload, quizMode: mode }, store().token());
    if (session.comprehension !== progress) return;
    progress.asked++;
    session.pendingAnswer = {
      answerIndex: q.answerIndex,
      concept: q.concept,
      conceptLabel: q.conceptLabel,
      rationale: q.rationale,
    };
    send(win, session, {
      type: 'question',
      question: q.question,
      options: q.options,
      conceptLabel: q.conceptLabel,
      index: progress.asked,
      total: QUESTION_MODES.length,
      mode,
    });
    pulseBar({ phase: 'ready', label: 'Ready' });
  } catch (error) {
    if (session.comprehension !== progress) return;
    if (error instanceof ConsentRequiredError) {
      askConsent(win, session, error.provider);
      return;
    }
    send(win, session, { type: 'quizError', message: error instanceof PlanLimitError
      ? error.message
      : 'Could not write a question for this one. Your explanation is still here.' });
  } finally {
    progress.loading = false;
  }
}

export function gradeComprehension(win: BrowserWindow, session: ReviewSession, choice: number): void {
  if (wipedSinceRun(session)) return;
  const a = session.pendingAnswer;
  const progress = session.comprehension;
  if (!a || !progress) return;
  const correct = choice === a.answerIndex;
  const hasMissed = progress.hasMissed || !correct;
  const firstRight = correct && !progress.understood;
  try {
    store().setOutcome(session.reviewId, hasMissed ? 'needs_review' : 'understood', a.concept, a.conceptLabel, new Date());
    if (firstRight) persistUnderstoodSnapshot(session);
  } catch (error) {
    send(win, session, {
      type: 'error',
      message: error instanceof Error ? error.message : 'The check result could not be saved locally.',
    });
    return;
  }
  progress.hasMissed = hasMissed;
  if (firstRight) {
    progress.understood = true;
    session.onUnderstood?.();
  }
  session.pendingAnswer = undefined;
  void flush();
  send(win, session, {
    type: 'graded',
    correct,
    answerIndex: a.answerIndex,
    rationale: a.rationale,
    hasMissed,
  });
}
