import { useEffect, useId, useRef, useState } from 'react';
import './consentForm.css';

const TERMS_URL = 'https://unvibe.site/terms';
const PRIVACY_URL = 'https://unvibe.site/privacy';

/**
 * Asked once, before the user's own code first leaves this computer (BOSS ledger 299; Security's
 * consent audit U6, U7, U14, U15, U19, U20). Three separate, unticked boxes; Continue stays
 * focusable but does nothing until all three are ticked. The main process checks the form again
 * and records the agreement with the policy version and time.
 */
export function ConsentForm({
  buttonClass,
  onAgreed,
  onCancel,
  autoFocus = false,
}: {
  /** The calling window's primary button class (panel `btn`, companion `field-btn`). */
  buttonClass: string;
  onAgreed: () => void;
  onCancel?: () => void;
  /** Put focus on the first box (the companion's dialog). */
  autoFocus?: boolean;
}) {
  const [aiSend, setAiSend] = useState(false);
  const [terms, setTerms] = useState(false);
  const [age18, setAge18] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const id = useId();
  const ready = aiSend && terms && age18;

  const submit = async () => {
    if (!ready) {
      setError('Tick all three boxes to continue.');
      return;
    }
    setSaving(true);
    setError('');
    const result = await window.unvibe.consentAgree({ aiSend, terms, age18 });
    setSaving(false);
    if (result.ok) onAgreed();
    else setError(result.error);
  };

  const open = (url: string) => (event: React.MouseEvent) => {
    event.preventDefault();
    void window.unvibe.openUrl(url);
  };

  return (
    <section className="consent-form" aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="consent-form__title">Before Vibe explains your code</h2>
      <p className="consent-form__lead">
        To write an explanation, Unvibe sends the code you select, paste or pick, the git changes you
        explain in Briefs, and your questions to Google Gemini, through Unvibe's server. If you add
        your own AI key in Settings, they go to that key's provider instead. Unvibe looks for keys
        and tokens on this computer first and stops, or asks you, before sending one. Nothing has
        been sent yet.
      </p>
      <label className="consent-form__row" htmlFor={`${id}-send`}>
        <input id={`${id}-send`} type="checkbox" autoFocus={autoFocus} checked={aiSend} onChange={(e) => setAiSend(e.target.checked)} />
        <span>Send my code and questions to Google Gemini to explain them</span>
      </label>
      <label className="consent-form__row" htmlFor={`${id}-terms`}>
        <input id={`${id}-terms`} type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>
          I agree to the <a href={TERMS_URL} onClick={open(TERMS_URL)}>Terms</a> and the{' '}
          <a href={PRIVACY_URL} onClick={open(PRIVACY_URL)}>Privacy Policy</a>
        </span>
      </label>
      <label className="consent-form__row" htmlFor={`${id}-age`}>
        <input id={`${id}-age`} type="checkbox" checked={age18} onChange={(e) => setAge18(e.target.checked)} />
        <span>I'm 18 or older</span>
      </label>
      <p className="consent-form__note">You can turn this off any time in Settings, Privacy &amp; Data.</p>
      {error ? <p className="consent-form__error" role="alert" id={`${id}-error`}>{error}</p> : null}
      <div className="consent-form__actions">
        <button
          type="button"
          className={buttonClass}
          aria-disabled={!ready || saving}
          aria-describedby={error ? `${id}-error` : undefined}
          onClick={() => void submit()}
        >
          {saving ? 'Saving…' : 'Continue'}
        </button>
        {onCancel ? <button type="button" className={`${buttonClass} ghost`} onClick={onCancel}>Not now</button> : null}
      </div>
    </section>
  );
}

type Answer = (agreed: boolean) => void;
const ASK_EVENT = 'unvibe:consent-ask';

/**
 * From anywhere in the companion: show the consent dialog and resolve true once the person agrees,
 * false if they choose Not now. Callers retry what was refused only on true.
 */
export function askForConsent(): Promise<boolean> {
  return new Promise((resolve) => window.dispatchEvent(new CustomEvent<Answer>(ASK_EVENT, { detail: resolve })));
}

/** Mounted once in the companion. A second ask while one is open answers the first with false. */
export function ConsentDialog({ buttonClass }: { buttonClass: string }) {
  const [open, setOpen] = useState(false);
  const answer = useRef<Answer | null>(null);
  useEffect(() => {
    const onAsk = (event: Event) => {
      answer.current?.(false);
      answer.current = (event as CustomEvent<Answer>).detail;
      setOpen(true);
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, []);
  const close = (agreed: boolean) => {
    answer.current?.(agreed);
    answer.current = null;
    setOpen(false);
  };
  if (!open) return null;
  return (
    <div className="consent-dialog" role="dialog" aria-modal="true" aria-label="Before Vibe explains your code"
      onKeyDown={(event) => { if (event.key === 'Escape') close(false); }}>
      <div className="consent-dialog__card">
        <ConsentForm buttonClass={buttonClass} autoFocus onAgreed={() => close(true)} onCancel={() => close(false)} />
      </div>
    </div>
  );
}
