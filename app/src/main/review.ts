/**
 * Review pipeline (main process — the only place with network access).
 * capture → build context → local secret filter → (consent) → stream → record → sync.
 */
import type { BrowserWindow } from 'electron';
import { scanText, hasBlocking, type SecretFinding } from '../core/secretFilter';
import { SseParser } from '../core/sse';
import { guessLanguage } from '../core/language';
import type { ExplanationLevel, ReviewRequestPayload } from '../core/protocol';
import { localDayKey, type LocalEvent } from '../core/learning';
import { aiAuthHeaders, BACKEND, fetchQuestion } from './backend';
import { store } from './store';
import { flush } from './sync';
import { resolveAppUsage } from './usage';
import { settings } from './settings';
import { readAiKey } from './aiKey';
import { buildLocalSystemPrompt, buildLocalUserPrompt, estimateCost, streamLocalAi } from './localAi';
import { buildSelectionPayload, isProPlan, type ReviewMode } from './contextBuilder';

export type WidgetEvent =
  | { type: 'init'; tabId: string; hasCode: boolean; sourceApp?: string | null; file?: string; lines?: number; language?: string; preview?: string; autoStart?: boolean; mode?: string }
  | { type: 'status'; tabId: string; message: string }
  | { type: 'consent'; tabId: string; findings: SecretFinding[] }
  | { type: 'blocked'; tabId: string; findings: SecretFinding[] }
  | { type: 'token'; tabId: string; text: string }
  | { type: 'done'; tabId: string; model: string; mock: boolean }
  | { type: 'error'; tabId: string; message: string; code?: string; upgradePath?: string }
  | { type: 'cancelled'; tabId: string }
  | { type: 'question'; tabId: string; question: string; options: string[]; conceptLabel: string }
  | { type: 'graded'; tabId: string; correct: boolean; answerIndex: number; rationale: string }
  | { type: 'usage'; tabId: string; used: number; limit: number; remaining: number; resetsAt: string; plan: string }
  | { type: 'understood'; tabId: string };

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
  payload?: ReviewRequestPayload;
  file?: string;
  project?: string;
  sourceFilePath?: string;
  /** Raw file text for memory baselines — never the display blob for diffs/compares. */
  snapshotText?: string;
  mode?: ReviewMode;
  pendingAnswer?: { answerIndex: number; concept: string; conceptLabel: string; rationale: string };
  onRecorded?: () => void;
  onUnderstood?: () => void;
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
  const usage = await resolveAppUsage();
  const built = await buildSelectionPayload({
    code,
    level: opts.level,
    filePath: session.sourceFilePath,
    question: opts.question,
    variant: opts.variant,
    withNearby: isProPlan(usage.plan),
  });
  session.payload = built.payload;
  session.file = built.file ?? session.file;
  session.project = built.project ?? session.project;
  session.sourceFilePath = built.sourceFilePath ?? session.sourceFilePath;
  session.snapshotText = built.snapshotText ?? session.snapshotText;
  session.mode = built.mode;
  return built.payload;
}

function scanPayload(payload: ReviewRequestPayload): SecretFinding[] {
  const blocks: Array<{ label: string; text: string }> = [];
  if (payload.context.code) blocks.push({ label: 'code', text: payload.context.code });
  if (payload.context.enclosing) blocks.push({ label: 'nearby', text: payload.context.enclosing });
  for (const line of payload.context.imports) blocks.push({ label: 'import', text: line });
  for (const h of payload.context.diffHunks ?? []) {
    blocks.push({ label: h.file, text: h.lines.join('\n') });
  }
  const findings: SecretFinding[] = [];
  for (const b of blocks) findings.push(...scanText(b.text, b.label));
  return findings;
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
}

function persistUnderstoodSnapshot(session: ReviewSession): void {
  if (!session.file || !session.snapshotText) return;
  if (session.mode === 'diff' || session.mode === 'brief') return;
  store().saveFileSnapshot(session.file, session.project, session.snapshotText.slice(0, 12_000));
}

/** Mark the current review understood (Got it) and refresh the file memory baseline when safe. */
export function markUnderstood(win: BrowserWindow, session: ReviewSession): void {
  if (!session.recorded) recordReview(win, session);
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
  send(win, session, {
    type: 'init',
    hasCode: code !== null,
    sourceApp: session.sourceApp,
    file: session.file,
    lines: code ? code.split('\n').length : 0,
    language: code ? guessLanguage(code) : undefined,
    // Renderer-local only. The preview never leaves this process and is not persisted here.
    preview: code ? code.slice(0, 600) : undefined,
    autoStart: Boolean(opts?.autoStart && code),
    mode: session.mode,
  });
}

function appendExplanation(session: ReviewSession, text: string): void {
  session.explanationText = (session.explanationText ?? '') + text;
}

function recordReview(win: BrowserWindow, session: ReviewSession): void {
  if (!session.code) return;
  const explanation = session.explanationText?.trim() || undefined;
  if (session.recorded) {
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
    }
    return;
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
  };
  try {
    store().recordReview(ev);
  } catch (error) {
    session.recorded = false;
    send(win, session, {
      type: 'error',
      message: error instanceof Error ? error.message : 'The explanation could not be saved locally.',
    });
    return;
  }
  session.onRecorded?.();
  void flush();
}

export async function runReview(win: BrowserWindow, session: ReviewSession, opts: RequestOpts): Promise<void> {
  if (!session.code && !session.payload) {
    send(win, session, { type: 'error', message: 'No code captured.' });
    return;
  }
  session.level = opts.level;
  session.explanationText = '';

  const usageEarly = await resolveAppUsage();
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

  const findings = scanPayload(payload);
  if (hasBlocking(findings)) {
    send(win, session, { type: 'blocked', findings });
    return;
  }
  if (findings.length > 0 && !opts.consented) {
    send(win, session, { type: 'consent', findings });
    return;
  }

  session.abort?.abort();
  const abort = new AbortController();
  session.abort = abort;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; abort.abort(); }, 45_000);

  send(win, session, { type: 'status', message: 'thinking' });
  try {
    const token = store().token();
    const usage = await resolveAppUsage();
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
      const planName =
        usage.plan === 'pro' ? 'Pro'
          : usage.plan === 'teams' ? 'Teams'
            : usage.plan === 'trial' ? 'Trial'
              : 'Free';
      send(win, session, {
        type: 'error',
        code: 'plan_limit_reached',
        upgradePath: '/plan',
        message: `You have reached your monthly ${planName} explanation limit (${usage.limit}). Resets on ${resets}. Add your own API key in Settings → AI, or upgrade.`,
      });
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
            appendExplanation(session, text);
            send(win, session, { type: 'token', text });
          },
          signal: abort.signal,
        });
        send(win, session, { type: 'done', model, mock: false });
        recordReview(win, session);
        void resolveAppUsage().then((next) => {
          send(win, session, {
            type: 'usage',
            used: next.used,
            limit: next.limit,
            remaining: next.remaining,
            resetsAt: next.resetsAt,
            plan: next.plan,
          });
        }).catch(() => undefined);
      } catch (err) {
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

    const res = await fetch(`${BACKEND}/api/v1/reviews`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...aiAuthHeaders(token),
      },
      body: JSON.stringify(payload),
      signal: abort.signal,
    });
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
      }
      const message = res.status === 401
        ? 'Sign in to use cloud explanations, or continue with local learning history.'
        : res.status === 429
          ? (body.message ?? 'You have reached your monthly explanation limit.')
          : `The explanation service could not complete that request (${res.status}).`;
      send(win, session, {
        type: 'error',
        message,
        code: body.error === 'plan_limit_reached' ? 'plan_limit_reached' : undefined,
        upgradePath: body.upgradePath,
      });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const ev of parser.feed(decoder.decode(value, { stream: true }))) {
        if (ev.type === 'token' && typeof ev.text === 'string') appendExplanation(session, ev.text);
        send(win, session, ev);
        if (ev.type === 'done') {
          recordReview(win, session);
          void resolveAppUsage().then((next) => {
            send(win, session, {
              type: 'usage',
              used: next.used,
              limit: next.limit,
              remaining: next.remaining,
              resetsAt: next.resetsAt,
              plan: next.plan,
            });
          }).catch(() => undefined);
        }
      }
    }
  } catch (err) {
    if (abort.signal.aborted) {
      if (timedOut) send(win, session, { type: 'error', message: 'The explanation took too long. Please try again.' });
      return;
    }
    send(win, session, {
      type: 'error',
      message: `Could not reach the Unvibe service at ${BACKEND}. Is it running?`,
    });
    void err;
  } finally {
    clearTimeout(timeout);
    if (session.abort === abort) session.abort = null;
  }
}

export async function startComprehension(win: BrowserWindow, session: ReviewSession): Promise<void> {
  if (!session.code && !session.payload) return;
  try {
    const payload = await ensurePayload(session, { level: session.level });
    const q = await fetchQuestion(payload, store().token());
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
    });
  } catch {
    send(win, session, { type: 'error', message: 'Could not build a question for this one. Try again.' });
  }
}

export function gradeComprehension(win: BrowserWindow, session: ReviewSession, choice: number): void {
  const a = session.pendingAnswer;
  if (!a) return;
  const correct = choice === a.answerIndex;
  try {
    store().setOutcome(session.reviewId, correct ? 'understood' : 'needs_review', a.concept, a.conceptLabel);
    if (correct) persistUnderstoodSnapshot(session);
  } catch (error) {
    send(win, session, {
      type: 'error',
      message: error instanceof Error ? error.message : 'The check result could not be saved locally.',
    });
    return;
  }
  if (correct) session.onUnderstood?.();
  void flush();
  send(win, session, {
    type: 'graded',
    correct,
    answerIndex: a.answerIndex,
    rationale: a.rationale,
  });
}
