import { useEffect, useId, useRef, useState } from 'react';
import { CONSENT_COPY, consentText, type ConsentProvider } from '../../core/consent';
import './consentForm.css';

const TERMS_URL = 'https://unvibe.site/terms';
const PRIVACY_URL = 'https://unvibe.site/privacy';

/**
 * Asked before the person's own code first leaves this computer, and again for a different provider
 * or a new policy (BOSS ledger 299; Security's audit U6, U7, U14, U15, U19, U20; CC-2, CC-3).
 * Three separate, unticked boxes; Continue stays focusable but does nothing until all three are
 * ticked. Every word comes from CONSENT_COPY, whose hash a test pins to POLICY_VERSION. The main
 * process checks the form again and records the agreement with the provider, policy and time.
 */
export function ConsentForm({
  provider,
  buttonClass,
  onAgreed,
  onCancel,
  autoFocus = false,
}: {
  /** Who receives the code: Unvibe's server (CONSENT_PROVIDERS.unvibe) or the provider of the person's own key. */
  provider: ConsentProvider;
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
  const text = (value: string) => consentText(value, provider);

  const submit = async () => {
    if (saving) return;
    if (!ready) {
      setError(CONSENT_COPY.incomplete);
      return;
    }
    setSaving(true);
    setError('');
    const result = await window.unvibe.consentAgree({ aiSend, terms, age18, provider });
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
      <h2 id={`${id}-title`} className="consent-form__title">{CONSENT_COPY.title}</h2>
      <p className="consent-form__lead">
        {text(provider === 'unvibe' ? CONSENT_COPY.leadUnvibe : CONSENT_COPY.leadOwnKey)} {CONSENT_COPY.secrets}
      </p>
      <label className="consent-form__row" htmlFor={`${id}-send`}>
        <input id={`${id}-send`} type="checkbox" autoFocus={autoFocus} checked={aiSend} onChange={(e) => setAiSend(e.target.checked)} />
        <span>{text(CONSENT_COPY.aiSend)}</span>
      </label>
      <label className="consent-form__row" htmlFor={`${id}-terms`}>
        <input id={`${id}-terms`} type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>
          {CONSENT_COPY.termsBefore}<a href={TERMS_URL} onClick={open(TERMS_URL)}>{CONSENT_COPY.terms}</a>
          {CONSENT_COPY.termsBetween}<a href={PRIVACY_URL} onClick={open(PRIVACY_URL)}>{CONSENT_COPY.privacy}</a>
        </span>
      </label>
      <label className="consent-form__row" htmlFor={`${id}-age`}>
        <input id={`${id}-age`} type="checkbox" checked={age18} onChange={(e) => setAge18(e.target.checked)} />
        <span>{CONSENT_COPY.age18}</span>
      </label>
      <p className="consent-form__note">{CONSENT_COPY.offSwitch}</p>
      {error ? <p className="consent-form__error" role="alert" id={`${id}-error`}>{error}</p> : null}
      <div className="consent-form__actions">
        <button
          type="button"
          className={buttonClass}
          aria-disabled={!ready || saving}
          aria-describedby={error ? `${id}-error` : undefined}
          onClick={() => void submit()}
        >
          {CONSENT_COPY.continue}
        </button>
        {onCancel ? <button type="button" className={`${buttonClass} ghost`} onClick={onCancel}>{CONSENT_COPY.notNow}</button> : null}
      </div>
    </section>
  );
}

type Answer = (agreed: boolean) => void;
const ASK_EVENT = 'unvibe:consent-ask';

/**
 * From anywhere in the companion: show the consent dialog for `provider` and resolve true once the
 * person agrees, false on Not now. Callers retry what was refused only on true.
 */
export function askForConsent(provider: ConsentProvider): Promise<boolean> {
  return new Promise((resolve) => window.dispatchEvent(new CustomEvent<{ provider: ConsentProvider; answer: Answer }>(ASK_EVENT, { detail: { provider, answer: resolve } })));
}

/** Mounted once in the companion. A second ask while one is open answers the first with false. */
export function ConsentDialog({ buttonClass }: { buttonClass: string }) {
  const [provider, setProvider] = useState<ConsentProvider | null>(null);
  const answer = useRef<Answer | null>(null);
  useEffect(() => {
    const onAsk = (event: Event) => {
      const detail = (event as CustomEvent<{ provider: ConsentProvider; answer: Answer }>).detail;
      answer.current?.(false);
      answer.current = detail.answer;
      setProvider(detail.provider);
    };
    window.addEventListener(ASK_EVENT, onAsk);
    return () => window.removeEventListener(ASK_EVENT, onAsk);
  }, []);
  const close = (agreed: boolean) => {
    answer.current?.(agreed);
    answer.current = null;
    setProvider(null);
  };
  if (!provider) return null;
  return (
    <div className="consent-dialog" role="dialog" aria-modal="true" aria-label={CONSENT_COPY.title}
      onKeyDown={(event) => { if (event.key === 'Escape') close(false); }}>
      <div className="consent-dialog__card">
        {/* keyed by provider: a new ask starts with every box unticked */}
        <ConsentForm key={provider} provider={provider} buttonClass={buttonClass} autoFocus onAgreed={() => close(true)} onCancel={() => close(false)} />
      </div>
    </div>
  );
}
