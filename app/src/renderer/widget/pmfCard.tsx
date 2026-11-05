import { Fragment, useState } from 'react';
import {
  PMF_CONSENT_LINE,
  PMF_MAX_ANSWER_CHARS,
  PMF_Q1_OPTIONS,
  PMF_QUESTIONS,
  type PmfDraft,
  type PmfTextKey,
} from '../../core/pmf';

/** `form`: answering (a failed send shows `error` and a retry); `sending`; `thanks`: sent. */
export interface PmfCardModel {
  draft: PmfDraft;
  stage: 'form' | 'sending' | 'thanks';
  error: string;
  /** A secret block: the answer the filter flagged, so the message sits under it. */
  errorField?: PmfTextKey;
  /** A network failure: the button offers Try again instead of Send. */
  retry?: boolean;
  /** After Send: the install ID the answers are filed under, for a deletion request. */
  installId: string;
}

const TEXT_QUESTIONS = ['q2', 'q3', 'q4'] as const;

/**
 * The PMF survey (FE-09), inline under a finished explanation, never over work in progress. The
 * panel owns the state; this only draws it. Not now and × close it for good in one click.
 */
export function PmfCard({ model, onChange, onSend, onDismiss, onClose }: {
  model: PmfCardModel;
  onChange: (draft: PmfDraft) => void;
  onSend: () => void;
  onDismiss: () => void;
  /** After the thanks: hides the card (the survey is already sent). */
  onClose: () => void;
}) {
  const { draft, stage, error, errorField, retry } = model;
  // Same clipboard call and "copied" timing as CodeBlock in shared/richText.tsx.
  const [copied, setCopied] = useState(false);
  if (stage === 'thanks') {
    return (
      <section className="pmf-card pmf-card--thanks" aria-label="Unvibe survey" aria-live="off">
        <p role="status">
          Thanks. Your answers help us decide what to improve in Unvibe. To delete them later, email
          support@unvibe.site with this install ID: <code className="pmf-card__id">{model.installId}</code>{' '}
          <button
            type="button"
            className="btn ghost pmf-card__copy"
            aria-label="Copy install ID"
            onClick={() => {
              void navigator.clipboard.writeText(model.installId);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </p>
        <button type="button" className="pmf-card__close" aria-label="Close" title="Close" onClick={onClose}>×</button>
      </section>
    );
  }
  const sending = stage === 'sending';
  return (
    <section className="pmf-card" aria-label="Unvibe survey" aria-live="off">
      <div className="pmf-card__head">
        <div>
          <div className="quiz__kicker">Help shape Unvibe</div>
          <p className="pmf-card__sub">4 short questions. Only the first one is needed.</p>
        </div>
        <button type="button" className="pmf-card__close" aria-label="Close survey" title="Not now" disabled={sending} onClick={onDismiss}>×</button>
      </div>
      <fieldset className="pmf-card__q" disabled={sending}>
        <legend>{PMF_QUESTIONS.q1}</legend>
        <div className="pmf-card__options" role="radiogroup">
          {PMF_Q1_OPTIONS.map((option) => (
            <label key={option.id} className={`opt${draft.q1 === option.id ? ' sel' : ''}`}>
              <input
                type="radio"
                name="pmf-q1"
                value={option.id}
                checked={draft.q1 === option.id}
                onChange={() => onChange({ ...draft, q1: option.id })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {TEXT_QUESTIONS.map((key) => {
        const flagged = Boolean(error) && errorField === key;
        return (
          <Fragment key={key}>
            <label className="pmf-card__q">
              <span>{PMF_QUESTIONS[key]}</span>
              <textarea
                className="pmf-card__field"
                rows={2}
                maxLength={PMF_MAX_ANSWER_CHARS}
                disabled={sending}
                value={draft[key]}
                aria-invalid={flagged || undefined}
                aria-describedby={flagged ? `pmf-error-${key}` : undefined}
                onChange={(e) => onChange({ ...draft, [key]: e.target.value })}
              />
            </label>
            {flagged ? (
              <p id={`pmf-error-${key}`} className="pmf-card__error pmf-card__error--field" role="alert">
                <span className="pmf-card__error-icon" aria-hidden="true">!</span>
                {error}
              </p>
            ) : null}
          </Fragment>
        );
      })}
      <p className="pmf-card__consent">{PMF_CONSENT_LINE}</p>
      {error && !errorField ? <p className="pmf-card__error" role="alert">{error}</p> : null}
      <div className="quiz__actions">
        <button type="button" className="btn" disabled={sending || !draft.q1} onClick={onSend}>
          {sending ? 'Sending…' : error && retry ? 'Try again' : 'Send'}
        </button>
        <button type="button" className="btn ghost" disabled={sending} onClick={onDismiss}>
          Not now
        </button>
      </div>
    </section>
  );
}
