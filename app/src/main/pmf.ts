/**
 * The PMF survey card's main-process side (FE-09; rules in core/pmf.ts). The panel asks for the
 * card after an explanation has finished; answers are saved here as a local draft and leave this
 * computer only when the person presses Send, after the secret filter passes. Closing sends
 * nothing. A failed send keeps the draft and is never retried in the background. Storage and the
 * network come in as `PmfDeps` so the behaviour can be tested.
 */
import {
  cleanPmfDraft,
  EMPTY_PMF_DRAFT,
  PMF_MAX_BODY_BYTES,
  PMF_SECRET_BLOCKED,
  pmfDraftHasSecret,
  pmfEligible,
  pmfRequestBody,
  type PmfDraft,
  type PmfRequestBody,
  type PmfStatus,
} from '../core/pmf';

export interface PmfDeps {
  now: () => Date;
  explanations: () => number;
  firstRunAt: (now: Date) => string;
  status: () => PmfStatus | undefined;
  draft: () => PmfDraft;
  saveDraft: (draft: PmfDraft) => void;
  setStatus: (status: PmfStatus) => void;
  /** Whether the card was shown earlier in this run of the app (memory only), and marking it so. */
  shownThisRun: () => boolean;
  markShownThisRun: () => void;
  /** The random install ID the answers are filed under, shown after Send for deletion requests. */
  installId: () => string;
  /** Null when this build has no trial token, so answers could never be sent: the card stays hidden. */
  post: ((body: PmfRequestBody) => Promise<number | null>) | null;
  appVersion: string;
}

export interface PmfCardState {
  show: boolean;
  draft: PmfDraft;
}

export type PmfSendResult = { ok: true; installId: string } | { ok: false; error: string };

export const PMF_SEND_FAILED = 'Could not send. Your answers are still here, so you can try again.';

/**
 * Whether the panel shows the card now, with the saved draft. The first time it shows, it is
 * marked `shown` on disk and for this run, so it stays until Send or close in this run of the app
 * and never comes back after a restart.
 */
export function pmfCardState(deps: PmfDeps): PmfCardState {
  const now = deps.now();
  const status = deps.status();
  const show = deps.post !== null && pmfEligible({
    explanations: deps.explanations(),
    firstRunAt: deps.firstRunAt(now),
    status,
    shownThisRun: deps.shownThisRun(),
    now,
  });
  if (!show) return { show, draft: { ...EMPTY_PMF_DRAFT } };
  deps.markShownThisRun();
  if (status !== 'shown') deps.setStatus('shown');
  return { show, draft: deps.draft() };
}

/** Typing: the answers are saved on this computer only. Nothing is posted. */
export function savePmfDraft(input: unknown, deps: PmfDeps): void {
  deps.saveDraft(cleanPmfDraft(input));
}

/** Not now or ×: the draft deleted, a local "closed" flag, nothing posted, never shown again. */
export function dismissPmf(deps: PmfDeps): void {
  deps.saveDraft({ ...EMPTY_PMF_DRAFT });
  deps.setStatus('dismissed');
}

/**
 * Send pressed: save the answers as they are, refuse any text the secret filter flags, then post
 * them once. 201 stores them; 409 means this install already answered within 90 days and the
 * server kept that answer. Either way the survey is done. Anything else keeps the draft for a
 * retry the person starts.
 */
export async function sendPmfAnswer(input: unknown, deps: PmfDeps): Promise<PmfSendResult> {
  const status = deps.status();
  if (status === 'sent') return { ok: true, installId: deps.installId() };
  if (status === 'dismissed' || !deps.post) return { ok: false, error: 'This survey is closed.' };
  const draft = cleanPmfDraft(input);
  deps.saveDraft(draft);
  const body = pmfRequestBody(draft, deps.appVersion);
  if (!body) return { ok: false, error: 'Pick an answer to the first question.' };
  if (pmfDraftHasSecret(draft)) return { ok: false, error: PMF_SECRET_BLOCKED };
  if (Buffer.byteLength(JSON.stringify(body)) > PMF_MAX_BODY_BYTES) return { ok: false, error: 'Your answers are a little too long. Shorten them and try again.' };
  const code = await deps.post(body).catch(() => null);
  if (code === 201 || code === 409) {
    deps.saveDraft({ ...EMPTY_PMF_DRAFT });
    deps.setStatus('sent');
    return { ok: true, installId: deps.installId() };
  }
  // The app checks everything the server does, so a 400 is almost always its own key detector.
  if (code === 400) return { ok: false, error: 'Unvibe could not accept these answers. Take out anything that looks like a key or password and try again.' };
  if (code === 429) return { ok: false, error: 'Too many answers from this network right now. Your answers are still here; try again later.' };
  return { ok: false, error: PMF_SEND_FAILED };
}
