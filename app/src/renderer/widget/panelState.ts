import type { WidgetEvent } from '../../main/review';
import type { ExplanationLevel } from '../../core/protocol';
import type { SecretFinding } from '../../core/secretFilter';
import { CONSENT_PROVIDERS, type ConsentProvider } from '../../core/consent';
import type { Quiz } from './panelQuiz';
import type { FollowUp } from './askTab';

/**
 * `aiConsent`: the first-send agreement (sending code to the provider, Terms, 18+);
 * `confirm`: a link started this review, Explain sends it; `consent`: a secret was found.
 *
 * Where each phase goes in overlay B (Design b-refined SPEC + b-states mocks). Every phase keeps the 50 pt
 * header and the four bottom tabs; the body is the Explain tab unless noted, with main's strings:
 * - boot: "Capturing selection…" status line.
 * - ready: depth + code row, then "Reading your code in context…" with its three progress steps.
 * - aiConsent: the consent form (b-consent), Continue primary, Not now quiet.
 * - confirm: "Explain this code?" sheet with the clipboard preview; Explain primary, Cancel quiet.
 * - empty: the picker (b-empty): "Ready when you are." with keycaps, Explain my clipboard, Choose a file…,
 *   Review project changes (Pro tags) and the paste box. A Mac without Accessibility keeps the paste-first picker.
 * - consent: "Possible secret detected" (b-secret): amber badge, findings card, Cancel primary, Send anyway quiet.
 * - blocked: "Blocked: credential detected" (b-blocked): amber lock badge, findings card, no action.
 * - streaming: depth + code row; Vibe's three thinking steps until words arrive (b-thinking), then the answer
 *   (b-streaming). The footer holds only "Stop generating".
 * - done: the answer with code-word chips, Understand · Save · Explain differently, the Ask field.
 * - error: "Couldn't explain that" (b-error): amber badge, the message, Retry (or the limit / Pro offers).
 * - limit pause: the survey offer replaces the body; the tabs stay.
 * Test me (quiz loading/answering/graded/failed) is the Test me tab (b-graded); follow-ups, Why and Teach it back
 * are the Ask tab; pinned and recent lessons are the Saved tab.
 */
export type Phase = 'boot' | 'ready' | 'aiConsent' | 'confirm' | 'empty' | 'consent' | 'blocked' | 'streaming' | 'done' | 'error';

interface EntryMeta {
  sourceApp?: string | null;
  file?: string;
  lines?: number;
  language?: string;
  preview?: string;
}

interface DetailState {
  phase: 'idle' | 'streaming' | 'done' | 'error';
  text: string;
  error: string;
  open: boolean;
}

/** Everything about the current selection. A new one (main's `init`) replaces it all (Design ruling b). */
export interface PanelState {
  phase: Phase;
  meta: EntryMeta;
  text: string;
  level: ExplanationLevel;
  findings: SecretFinding[];
  error: string;
  mock: boolean;
  ask: string;
  quiz: Quiz | null;
  followUps: FollowUp[];
  originOpen: boolean;
  originError: string;
  originFacts: Array<{ label: string; value: string }>;
  originInference: string;
  teachAnswer: string;
  teachNote: string;
  teachChecks: Array<{ topic: string; mark: 'covered' | 'partial' | 'missed' }>;
  teachEvidence: string;
  /** The provider the consent form names while phase is `aiConsent`. */
  consentProvider: ConsentProvider | null;
  /**
   * A follow-up that main held back for a sheet on Explain (the AI agreement or a possible secret). Send anyway sends
   * this question, not a new explanation; Cancel or Agree put it back in the Ask field.
   */
  refusedQuestion: string;
  /** A link started this review: after agreeing, show the confirm sheet, not an explanation. */
  confirmAfterConsent: boolean;
  /** Agree was just pressed with nothing captured; main is reading the clipboard it asked for. */
  agreedJustNow: boolean;
  /** The confirm sheet shows the clipboard read right after Agree, not a link's capture. */
  confirmAfterAgree: boolean;
  /** Linux: the confirm sheet shows the last highlighted text (PRIMARY), which may be from earlier. */
  confirmFromHighlight: boolean;
  /** Who Explain sends the code to, for the confirm sheet (Security U10). */
  providerName: string;
  /** The answer is the short default (2 to 4 sentences), so "More detail" is offered under it. */
  short: boolean;
  /** "More detail": the full-depth text streamed under the short answer, and whether it is shown. */
  detail: DetailState;
  /** Understand was pressed for this explanation: the chip stays pressed and a second press does nothing (Design Q1). */
  understood: boolean;
  /** Save pinned this explanation's lesson to Saved. */
  pinned: boolean;
  /** "Show code" is open on the code row. */
  codeOpen: boolean;
}

export const NO_DETAIL: DetailState = { phase: 'idle', text: '', error: '', open: false };
/** A follow-up with a credential in it: the blocked sheet's own words, shown in the Ask thread. */
export const FOLLOW_UP_BLOCKED = 'Blocked: credential detected. Nothing was sent. Remove the secret from the selection or your question and try again.';

export function freshState(): PanelState {
  return {
    phase: 'boot',
    meta: {},
    text: '',
    level: 'intermediate',
    findings: [],
    error: '',
    mock: false,
    ask: '',
    quiz: null,
    followUps: [],
    originOpen: false,
    originError: '',
    originFacts: [],
    originInference: '',
    teachAnswer: '',
    teachNote: '',
    teachChecks: [],
    teachEvidence: '',
    consentProvider: null,
    refusedQuestion: '',
    confirmAfterConsent: false,
    agreedJustNow: false,
    confirmAfterAgree: false,
    confirmFromHighlight: false,
    providerName: CONSENT_PROVIDERS.unvibe,
    short: false,
    detail: NO_DETAIL,
    understood: false,
    pinned: false,
    codeOpen: false,
  };
}

/**
 * The question "Send anyway" sends with consent, or null when the sheet is about the explanation itself. Only the
 * held question, the exact text the findings came from, ever goes out with consent; the Ask field is never read here
 * (Security C1, file 2102). Text typed into the field afterwards is sent by the field's own Send, without consent, so
 * main scans it again and asks again.
 */
export function heldFollowUp(s: Pick<PanelState, 'refusedQuestion'>): string | null {
  return s.refusedQuestion || null;
}

/** The last follow-up, rewritten; the rest stay. */
function withLastFollowUp(s: PanelState, patch: Partial<FollowUp> | null): PanelState {
  const followUps = s.followUps.slice(0, -1);
  const last = s.followUps.at(-1);
  if (patch && last) followUps.push({ ...last, ...patch });
  return { ...s, followUps };
}

/**
 * Main's review events applied to the panel. A follow-up asked from the Ask field streams like an explanation; while
 * one is on its way its events go to the Ask thread, so the explanation on the Explain tab stays as it is.
 */
export function reduceEvent(s: PanelState, ev: WidgetEvent): PanelState {
  // "More detail" streams under the short answer; the answer and its actions stay as they are.
  if ('part' in ev && ev.part === 'detail') {
    switch (ev.type) {
      case 'status': return { ...s, detail: { phase: 'streaming', text: '', error: '', open: true } };
      case 'token': return { ...s, detail: { ...s.detail, phase: 'streaming', text: s.detail.text + (ev.text ?? '') } };
      case 'done': return { ...s, detail: { ...s.detail, phase: 'done' } };
      case 'error': return { ...s, detail: { ...s.detail, phase: 'error', error: ev.message ?? 'Something went wrong.' } };
      default: return s;
    }
  }
  const asking = s.followUps.at(-1);
  if (asking && (asking.phase === 'waiting' || asking.phase === 'streaming')) {
    switch (ev.type) {
      case 'status': return withLastFollowUp(s, { phase: 'streaming' });
      case 'token': return withLastFollowUp(s, { answer: asking.answer + (ev.text ?? '') });
      case 'done': return withLastFollowUp(s, { phase: 'done' });
      case 'error': return withLastFollowUp(s, { phase: 'error', error: ev.message ?? 'Something went wrong.' });
      case 'cancelled': return withLastFollowUp(s, null);
      // Asked to agree first, or a possible secret in the question: the follow-up is held; the sheet on Explain says
      // why and keeps the question. A credential is never sent, so that refusal stays in the Ask thread.
      case 'consentNeeded':
      case 'consent':
        s = { ...withLastFollowUp(s, null), refusedQuestion: asking.question };
        break;
      case 'blocked':
        return withLastFollowUp(s, { phase: 'error', error: FOLLOW_UP_BLOCKED });
      default: break;
    }
  }
  switch (ev.type) {
    case 'init':
      return {
        ...freshState(),
        meta: { sourceApp: ev.sourceApp, file: ev.file, lines: ev.lines, language: ev.language, preview: ev.preview },
        phase: ev.consentProvider ? 'aiConsent' : ev.hasCode ? (ev.confirm ? 'confirm' : 'ready') : 'empty',
        consentProvider: ev.consentProvider ?? null,
        confirmAfterConsent: Boolean(ev.confirm),
        confirmAfterAgree: Boolean(ev.confirm) && s.agreedJustNow,
        confirmFromHighlight: ev.confirmFrom === 'highlight',
        providerName: ev.providerName,
        level: ev.level,
      };
    case 'understood':
      return { ...s, understood: true };
    case 'pinned':
      return { ...s, pinned: ev.pinned };
    case 'status':
      // A new explanation (Explain differently, another depth) starts afresh; one about the same lesson keeps Test me.
      return {
        ...s,
        text: '',
        short: ev.short === true,
        detail: NO_DETAIL,
        understood: ev.resetQuiz === false ? s.understood : false,
        phase: 'streaming',
        quiz: ev.resetQuiz === false ? s.quiz : null,
      };
    case 'consentNeeded':
      return { ...s, phase: 'aiConsent', consentProvider: ev.provider };
    case 'consent':
      return { ...s, findings: ev.findings ?? [], phase: 'consent' };
    case 'blocked':
      return { ...s, findings: ev.findings ?? [], phase: 'blocked' };
    case 'token':
      return { ...s, text: s.text + (ev.text ?? ''), phase: 'streaming' };
    case 'done':
      return { ...s, mock: Boolean(ev.mock), phase: 'done', short: ev.short === true };
    case 'error':
      return { ...s, error: ev.message ?? 'Something went wrong.', phase: 'error', quiz: s.quiz && s.quiz.phase !== 'graded' ? null : s.quiz };
    case 'quizError':
      return { ...s, quiz: { phase: 'failed', error: ev.message } };
    case 'cancelled':
      return { ...s, text: '', short: false, detail: NO_DETAIL, quiz: null, phase: 'ready' };
    case 'question':
      return { ...s, quiz: { phase: 'answering', question: ev.question, options: ev.options, index: ev.index, total: ev.total, mode: ev.mode } };
    case 'graded':
      return s.quiz
        ? { ...s, quiz: { ...s.quiz, phase: 'graded', correct: ev.correct, answerIndex: ev.answerIndex, rationale: ev.rationale, hasMissed: ev.hasMissed } }
        : s;
    default:
      return s;
  }
}
