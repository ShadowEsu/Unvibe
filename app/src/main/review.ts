/**
 * Review pipeline (main process — the only place with network access).
 * capture → local secret filter → (consent if suspects) → SSE stream → record locally → sync.
 * Raw code never enters a renderer; widgets receive only events + metadata.
 */
import type { BrowserWindow } from 'electron';
import { scanText, hasBlocking, type SecretFinding } from '../core/secretFilter';
import { SseParser } from '../core/sse';
import { guessLanguage } from '../core/language';
import type { ExplanationLevel, ReviewRequestPayload } from '../core/protocol';
import { localDayKey, type LocalEvent } from '../core/learning';
import { BACKEND, fetchQuestion } from './backend';
import { store } from './store';
import { flush } from './sync';

export type WidgetEvent =
  | { type: 'init'; hasCode: boolean; sourceApp?: string | null; lines?: number; language?: string }
  | { type: 'status'; message: string }
  | { type: 'consent'; findings: SecretFinding[] }
  | { type: 'blocked'; findings: SecretFinding[] }
  | { type: 'token'; text: string }
  | { type: 'done'; model: string; mock: boolean }
  | { type: 'error'; message: string }
  | { type: 'cancelled' }
  | { type: 'question'; question: string; options: string[]; conceptLabel: string }
  | { type: 'graded'; correct: boolean; answerIndex: number; rationale: string };

export interface ReviewSession {
  reviewId: string;
  code: string | null;
  sourceApp: string | null;
  abort: AbortController | null;
  recorded: boolean;
  level: ExplanationLevel;
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

function send(win: BrowserWindow, ev: WidgetEvent): void {
  if (!win.isDestroyed()) win.webContents.send('review:event', ev);
}

function payloadFor(code: string, level: ExplanationLevel, opts?: Partial<RequestOpts>): ReviewRequestPayload {
  return {
    scope: 'selection',
    level,
    variant: opts?.variant ?? 'default',
    question: opts?.question,
    context: { language: guessLanguage(code), projectStructure: [], imports: [], code },
  };
}

export function initWidget(win: BrowserWindow, session: ReviewSession): void {
  const code = session.code;
  send(win, {
    type: 'init',
    hasCode: code !== null,
    sourceApp: session.sourceApp,
    lines: code ? code.split('\n').length : 0,
    language: code ? guessLanguage(code) : undefined,
  });
}

function recordReview(win: BrowserWindow, session: ReviewSession): void {
  if (session.recorded || !session.code) return;
  session.recorded = true;
  const now = new Date();
  const ev: LocalEvent = {
    id: session.reviewId,
    ts: now.toISOString(),
    eventType: 'explanation_completed',
    localDate: localDayKey(now),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    scope: 'selection',
    level: session.level,
    outcome: 'reviewed',
    lines: session.code.split('\n').length,
    language: guessLanguage(session.code),
    sourceApp: session.sourceApp ?? undefined,
  };
  try {
    store().recordReview(ev);
  } catch (error) {
    session.recorded = false;
    send(win, { type: 'error', message: error instanceof Error ? error.message : 'The explanation could not be saved locally.' });
    return;
  }
  session.onRecorded?.();
  void flush();
}

export async function runReview(win: BrowserWindow, session: ReviewSession, opts: RequestOpts): Promise<void> {
  const code = session.code;
  if (!code) {
    send(win, { type: 'error', message: 'No code captured.' });
    return;
  }
  session.level = opts.level;

  const findings = scanText(code, 'selection');
  if (hasBlocking(findings)) {
    send(win, { type: 'blocked', findings });
    return;
  }
  if (findings.length > 0 && !opts.consented) {
    send(win, { type: 'consent', findings });
    return;
  }

  session.abort?.abort();
  const abort = new AbortController();
  session.abort = abort;
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; abort.abort(); }, 30_000);

  send(win, { type: 'status', message: 'thinking' });
  try {
    const res = await fetch(`${BACKEND}/api/v1/reviews`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(store().token() ? { authorization: `Bearer ${store().token()}` } : {}),
      },
      body: JSON.stringify(payloadFor(code, opts.level, opts)),
      signal: abort.signal,
    });
    if (!res.ok || !res.body) {
      const message = res.status === 401
        ? 'Sign in to use cloud explanations, or continue with local learning history.'
        : res.status === 429
          ? 'Too many requests. Wait a moment, then try again.'
          : `The explanation service could not complete that request (${res.status}).`;
      send(win, { type: 'error', message });
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const ev of parser.feed(decoder.decode(value, { stream: true }))) {
        send(win, ev as WidgetEvent);
        if (ev.type === 'done') recordReview(win, session);
      }
    }
  } catch (err) {
    if (abort.signal.aborted) {
      if (timedOut) send(win, { type: 'error', message: 'The explanation took too long. Please try again.' });
      return;
    }
    send(win, { type: 'error', message: `Could not reach the Unvibe service at ${BACKEND}. Is it running?` });
    void err;
  } finally {
    clearTimeout(timeout);
    if (session.abort === abort) session.abort = null;
  }
}

export async function startComprehension(win: BrowserWindow, session: ReviewSession): Promise<void> {
  if (!session.code) return;
  try {
    const q = await fetchQuestion(payloadFor(session.code, session.level), store().token());
    session.pendingAnswer = {
      answerIndex: q.answerIndex,
      concept: q.concept,
      conceptLabel: q.conceptLabel,
      rationale: q.rationale,
    };
    // Send only what the renderer may see — never the answer.
    send(win, { type: 'question', question: q.question, options: q.options, conceptLabel: q.conceptLabel });
  } catch {
    send(win, { type: 'error', message: 'Could not build a question for this one. Try again.' });
  }
}

export function gradeComprehension(win: BrowserWindow, session: ReviewSession, choice: number): void {
  const a = session.pendingAnswer;
  if (!a) return;
  const correct = choice === a.answerIndex;
  try {
    store().setOutcome(session.reviewId, correct ? 'understood' : 'needs_review', a.concept, a.conceptLabel);
  } catch (error) {
    send(win, { type: 'error', message: error instanceof Error ? error.message : 'The check result could not be saved locally.' });
    return;
  }
  if (correct) session.onUnderstood?.();
  void flush();
  send(win, { type: 'graded', correct, answerIndex: a.answerIndex, rationale: a.rationale });
}
