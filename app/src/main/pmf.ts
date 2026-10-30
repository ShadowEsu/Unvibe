/**
 * The PMF survey card's main-process side (FE-09; rules in core/pmf.ts). The panel asks for the
 * card after an explanation has finished; answers are saved here as a local draft and leave this
 * computer only when the person presses Send. A failed send keeps the draft and is never retried
 * in the background. Storage and the network come in as `PmfDeps` so the behaviour can be tested.
 */
import {
  cleanPmfDraft,
  daysSinceFirstRun,
  EMPTY_PMF_DRAFT,
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
  /** Null when this build has no trial token, so answers could never be sent: the card stays hidden. */
  post: ((body: PmfRequestBody) => Promise<number | null>) | null;
  appVersion: string;
}

export interface PmfCardState {
  show: boolean;
  draft: PmfDraft;
}

export type PmfSendResult = { ok: true } | { ok: false; error: string };

export const PMF_SEND_FAILED = 'Could not send. Your answers are still here, so you can try again.';

/** Whether the panel shows the card now, with the saved draft. */
export function pmfCardState(deps: PmfDeps): PmfCardState {
  const now = deps.now();
  const show = deps.post !== null && pmfEligible({
    explanations: deps.explanations(),
    firstRunAt: deps.firstRunAt(now),
    status: deps.status(),
    now,
  });
  return { show, draft: show ? deps.draft() : { ...EMPTY_PMF_DRAFT } };
}

/**
 * Send pressed: save the answers as they are, then post them once. 201 stores them; 409 means this
 * install already answered within 90 days and the server kept that answer. Either way the survey
 * is done. Anything else keeps the draft for a retry the person starts.
 */
export async function sendPmfAnswer(input: unknown, deps: PmfDeps): Promise<PmfSendResult> {
  const status = deps.status();
  if (status === 'sent') return { ok: true };
  if (status === 'dismissed' || !deps.post) return { ok: false, error: 'This survey is closed.' };
  const draft = cleanPmfDraft(input);
  deps.saveDraft(draft);
  const now = deps.now();
  const body = pmfRequestBody(draft, {
    explanations: deps.explanations(),
    daysSinceInstall: daysSinceFirstRun(deps.firstRunAt(now), now),
    appVersion: deps.appVersion,
  });
  if (!body) return { ok: false, error: 'Pick an answer to the first question.' };
  const code = await deps.post(body).catch(() => null);
  if (code === 201 || code === 409) {
    deps.setStatus('sent');
    return { ok: true };
  }
  if (code === 429) return { ok: false, error: 'Too many answers from this network today. Your answers are still here; try again tomorrow.' };
  return { ok: false, error: PMF_SEND_FAILED };
}
