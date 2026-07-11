/**
 * Review pipeline (main process — the only place with network access).
 * capture → local secret filter → (consent if suspects) → SSE stream from backend.
 * Raw code never enters a renderer; widgets receive only events + metadata.
 */
import type { BrowserWindow } from 'electron';
import { scanText, hasBlocking, type SecretFinding } from '../core/secretFilter';
import { SseParser } from '../core/sse';
import { guessLanguage } from '../core/language';
import type { ExplanationLevel, ReviewRequestPayload } from '../core/protocol';

export const BACKEND = process.env.UNVIBE_BACKEND ?? 'http://localhost:8787';

export interface WidgetEvent {
  type:
    | 'init'
    | 'status'
    | 'consent'
    | 'blocked'
    | 'token'
    | 'done'
    | 'error';
  text?: string;
  message?: string;
  model?: string;
  mock?: boolean;
  findings?: SecretFinding[];
  sourceApp?: string | null;
  lines?: number;
  language?: string;
  hasCode?: boolean;
}

export interface ReviewSession {
  code: string | null;
  sourceApp: string | null;
  abort: AbortController | null;
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

export async function runReview(
  win: BrowserWindow,
  session: ReviewSession,
  opts: RequestOpts,
): Promise<void> {
  const code = session.code;
  if (!code) {
    send(win, { type: 'error', message: 'No code captured.' });
    return;
  }

  // Privacy gate — always, before anything leaves the machine.
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

  const payload: ReviewRequestPayload = {
    scope: 'selection',
    level: opts.level,
    variant: opts.variant ?? 'default',
    question: opts.question,
    context: {
      language: guessLanguage(code),
      projectStructure: [],
      imports: [],
      code,
    },
  };

  send(win, { type: 'status', message: 'thinking' });
  try {
    const res = await fetch(`${BACKEND}/api/v1/reviews`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: abort.signal,
    });
    if (!res.ok || !res.body) {
      send(win, { type: 'error', message: `Backend error (${res.status}).` });
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
      }
    }
  } catch (err) {
    if (abort.signal.aborted) return; // superseded by a newer request
    send(win, {
      type: 'error',
      message: `Could not reach the Unvibe service at ${BACKEND}. Is it running?`,
    });
    void err;
  }
}
