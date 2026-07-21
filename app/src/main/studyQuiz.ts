/**
 * Companion Study assistant + Quiz cards (main process).
 * Network stays here; code/explanations used as context never sync as lesson bodies.
 */
import { SseParser } from '../core/sse';
import { guessLanguage } from '../core/language';
import type { ExplanationLevel, QuizMode, ReviewRequestPayload } from '../core/protocol';
import type { LocalEvent } from '../core/learning';
import { BACKEND, fetchQuestion } from './backend';
import { store } from './store';
import { flush } from './sync';
import { readAiKey } from './aiKey';
import { settings } from './settings';
import { buildLocalSystemPrompt, buildLocalUserPrompt, streamLocalAi } from './localAi';
import { resolveAppUsage } from './usage';

interface PendingQuiz {
  eventId: string;
  answerIndex: number;
  concept: string;
  conceptLabel: string;
  rationale: string;
}

const pendingQuizzes = new Map<string, PendingQuiz>();

function lessonPayload(
  eventId: string,
  level?: ExplanationLevel,
): { payload: ReviewRequestPayload; event: LocalEvent } | { error: string } {
  const event = store().eventById(eventId);
  if (!event) return { error: 'That lesson is no longer on this Mac.' };
  if (!event.code?.trim()) return { error: 'This lesson has no saved code yet. Open a fresh explanation first.' };
  const payload: ReviewRequestPayload = {
    scope: (event.scope as ReviewRequestPayload['scope']) || 'selection',
    level: level ?? (event.level as ExplanationLevel) ?? 'intermediate',
    context: {
      language: event.language ?? guessLanguage(event.code),
      primaryFile: event.file,
      projectStructure: event.project ? [event.project] : [],
      imports: [],
      code: event.code.slice(0, 12_000),
    },
  };
  return { payload, event };
}

async function collectReviewText(payload: ReviewRequestPayload): Promise<{ text: string; model: string; mock: boolean }> {
  const token = store().token();
  const prefs = settings().all();
  const localKey = readAiKey();
  const usage = await resolveAppUsage();
  const wantLocal = Boolean(localKey) && (prefs.useOwnAi || usage.remaining <= 0);

  if (wantLocal && localKey) {
    let text = '';
    const model = await streamLocalAi({
      provider: prefs.aiProvider,
      apiKey: localKey,
      system: buildLocalSystemPrompt(payload),
      user: buildLocalUserPrompt(payload),
      onToken: (chunk) => { text += chunk; },
    });
    return { text: text.trim(), model, mock: false };
  }

  if (usage.remaining <= 0 && !localKey) {
    throw new Error('Monthly explanation limit reached. Add your own API key in Settings → AI, or upgrade.');
  }

  const abort = new AbortController();
  const timeout = setTimeout(() => abort.abort(), 45_000);
  try {
    const res = await fetch(`${BACKEND}/api/v1/reviews`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: abort.signal,
    });
    if (!res.ok || !res.body) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? `Could not reach the explanation service (${res.status}).`);
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    let text = '';
    let model = 'unvibe';
    let mock = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const ev of parser.feed(decoder.decode(value, { stream: true }))) {
        if (ev.type === 'token' && typeof ev.text === 'string') text += ev.text;
        if (ev.type === 'done') {
          model = ev.model ?? model;
          mock = Boolean(ev.mock);
        }
        if (ev.type === 'error') throw new Error(ev.message || 'The assistant could not answer.');
      }
    }
    return { text: text.trim(), model, mock };
  } finally {
    clearTimeout(timeout);
  }
}

export function studyAskStatus(): { used: number; limit: number; remaining: number } {
  return store().studyAskUsage();
}

export function quizCardStatus(): { used: number; limit: number; remaining: number } {
  return store().quizUsage();
}

export async function askStudyAssistant(input: {
  eventId: string;
  question: string;
}): Promise<{ ok: true; answer: string; remaining: number } | { ok: false; error: string; remaining?: number }> {
  const question = input.question?.trim();
  if (!question) return { ok: false, error: 'Ask a short question about this lesson.' };
  if (question.length > 800) return { ok: false, error: 'Keep questions under 800 characters.' };

  const built = lessonPayload(input.eventId);
  if ('error' in built) return { ok: false, error: built.error };

  const status = store().studyAskUsage();
  if (status.remaining <= 0) {
    return { ok: false, error: `Daily study assistant limit reached (${status.limit}). Resets tomorrow.`, remaining: 0 };
  }

  const prior = built.event.explanation?.slice(0, 4_000);
  const payload: ReviewRequestPayload = {
    ...built.payload,
    question: prior
      ? `The learner already saw this explanation:\n\n${prior}\n\nTheir follow-up question:\n${question}`
      : question,
  };

  try {
    const result = await collectReviewText(payload);
    if (!result.text) return { ok: false, error: 'The assistant returned an empty answer. Try again.', remaining: status.remaining };
    const quota = store().consumeStudyAsk();
    if (!quota.ok) return { ok: false, error: quota.error, remaining: quota.remaining };
    return { ok: true, answer: result.text, remaining: quota.remaining };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'The study assistant could not answer.',
      remaining: status.remaining,
    };
  }
}

const QUIZ_LEVELS: ExplanationLevel[] = ['new', 'beginner', 'intermediate', 'advanced', 'expert'];

/** Wrong or unproven lessons receive a more approachable check; understood lessons stretch one level. */
export function adaptiveQuizLevel(event: Pick<LocalEvent, 'level' | 'outcome'>): ExplanationLevel {
  const base = (QUIZ_LEVELS.includes(event.level as ExplanationLevel) ? event.level : 'intermediate') as ExplanationLevel;
  const index = QUIZ_LEVELS.indexOf(base);
  if (event.outcome === 'needs_review') return QUIZ_LEVELS[Math.max(0, index - 1)]!;
  if (event.outcome === 'understood') return QUIZ_LEVELS[Math.min(QUIZ_LEVELS.length - 1, index + 1)]!;
  return base;
}

function localLessonQuiz(event: LocalEvent, mode: QuizMode): {
  question: string; options: string[]; answerIndex: number; rationale: string; concept: string; conceptLabel: string;
} {
  const label = event.conceptLabel || event.file || 'this code';
  const lang = event.language || 'the reviewed';
  const question = mode === 'recall'
    ? `Which statement best captures the purpose of the lesson about ${label}?`
    : mode === 'scenario'
      ? `If this ${lang} code changed, which understanding from ${label} should guide your review first?`
      : `In the lesson about ${label}, what should you be able to explain after a review?`;
  return {
    question,
    options: [
      `What this ${lang} code is doing and why it matters in context`,
      'How to delete the entire repository safely',
      'How to ignore types and ship without reading the change',
      'How to turn off all error checking permanently',
    ],
    answerIndex: 0,
    rationale: `You kept this lesson so you can explain ${label} in your own words.`,
    concept: event.concept || 'lesson-check',
    conceptLabel: event.conceptLabel || 'Lesson check',
  };
}

export async function startQuizCard(eventId: string, mode: QuizMode = 'quick-check'): Promise<
  | { ok: true; question: string; options: string[]; conceptLabel: string; remaining: number }
  | { ok: false; error: string; remaining?: number }
> {
  const built = lessonPayload(eventId);
  if ('error' in built) return { ok: false, error: built.error };

  const status = store().quizUsage();
  if (status.remaining <= 0) {
    return { ok: false, error: `Daily quiz limit reached (${status.limit}). Resets tomorrow.`, remaining: 0 };
  }

  try {
    let q: {
      question: string; options: string[]; answerIndex: number; rationale: string; concept: string; conceptLabel: string;
    };
    try {
      q = await fetchQuestion({ ...built.payload, level: adaptiveQuizLevel(built.event), quizMode: mode }, store().token());
    } catch {
      // Keep demos usable when the cloud quiz endpoint is unavailable or requires sign-in.
      q = localLessonQuiz(built.event, mode);
    }
    const quota = store().consumeQuiz();
    if (!quota.ok) return { ok: false, error: quota.error, remaining: quota.remaining };
    pendingQuizzes.set(eventId, {
      eventId,
      answerIndex: q.answerIndex,
      concept: q.concept,
      conceptLabel: q.conceptLabel,
      rationale: q.rationale,
    });
    return {
      ok: true,
      question: q.question,
      options: q.options,
      conceptLabel: q.conceptLabel,
      remaining: quota.remaining,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not build a quiz for this lesson.',
      remaining: status.remaining,
    };
  }
}

export function answerQuizCard(eventId: string, choice: number):
  | { ok: true; correct: true; answerIndex: number; rationale: string }
  | { ok: true; correct: false; rationale: string }
  | { ok: false; error: string } {
  const pending = pendingQuizzes.get(eventId);
  if (!pending) return { ok: false, error: 'Start a quiz card first.' };
  if (!Number.isInteger(choice) || choice < 0) return { ok: false, error: 'Pick one of the options.' };

  const correct = choice === pending.answerIndex;
  // Soft mode: wrong answers stay open so the learner can try again.
  if (!correct) {
    try {
      store().setOutcome(eventId, 'needs_review', pending.concept, pending.conceptLabel);
      void flush();
    } catch {
      // Keep grading even if the outcome write fails.
    }
    return {
      ok: true,
      correct: false,
      rationale: 'Sorry — wrong. Try another option; the card stays open.',
    };
  }
  try {
    store().setOutcome(eventId, 'understood', pending.concept, pending.conceptLabel);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Could not save the quiz result.' };
  }
  pendingQuizzes.delete(eventId);
  void flush();
  return {
    ok: true,
    correct: true,
    answerIndex: pending.answerIndex,
    rationale: pending.rationale,
  };
}
