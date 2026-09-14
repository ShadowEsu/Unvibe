import { useEffect, useState } from 'react';
import { LogoMark } from '../shared/logo';

export function Gift() {
  const [code, setCode] = useState('');
  const [used, setUsed] = useState(0);
  const [email, setEmail] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [deviceCode, setDeviceCode] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const result = await window.unvibe.giftStatus() as {
        ok?: boolean;
        needsSignIn?: boolean;
        code?: string;
        used?: number;
        email?: string | null;
      };
      if (!alive) return;
      setNeedsSignIn(Boolean(result?.needsSignIn) || !result?.code);
      setCode(result?.code ?? '');
      setUsed(Math.min(5, Math.max(0, result.used ?? 0)));
      setEmail(result.email ?? null);
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    window.unvibe.onDeviceAuth((result) => {
      setSignInBusy(false);
      if (result.ok && result.email) {
        setNeedsSignIn(false);
        setEmail(result.email);
        setSignInError('');
        void window.unvibe.giftStatus().then((status) => {
          const next = status as { code?: string; used?: number; email?: string | null; needsSignIn?: boolean };
          setCode(next.code ?? '');
          setUsed(Math.min(5, Math.max(0, next.used ?? 0)));
          setEmail(next.email ?? result.email ?? null);
          setNeedsSignIn(Boolean(next.needsSignIn) || !next.code);
        });
        return;
      }
      if (!result.ok) setSignInError(result.error ?? 'Secure sign-in failed.');
    });
  }, []);

  const copy = () => {
    if (!code) return;
    void navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  };

  const startSignIn = async () => {
    setSignInBusy(true);
    setSignInError('');
    const result = await window.unvibe.startDeviceAuth() as { ok: boolean; userCode?: string; error?: string };
    if (result.ok && result.userCode) setDeviceCode(result.userCode);
    else {
      setSignInBusy(false);
      setSignInError(result.error ?? 'Could not start secure sign-in.');
    }
  };

  const remaining = Math.max(0, 5 - used);
  const giverEmail = email ?? 'your email';

  return (
    <div className="gift-view">
      <div className="page-head">
        <div>
          <div className="gift-view__brand">
            <LogoMark size={28} />
            <div className="eyebrow">Gift Unvibe</div>
          </div>
          <h1>Give a friend a month of Pro.</h1>
          <p>
            {needsSignIn
              ? 'Sign in with Google first. Your SPECIAL CHAR is made from your email so the waitlist can prove it is yours.'
              : `Share your 8 character SPECIAL CHAR. A friend opens unvibe.site, expands Referral or promo code, puts ${giverEmail} and this code. You both get 1 month of Pro. Five gifts max.`}
          </p>
        </div>
      </div>

      {needsSignIn ? (
        <section className="gift-signin" aria-label="Sign in to gift Unvibe">
          <button className="field-btn" type="button" disabled={signInBusy} onClick={() => void startSignIn()}>
            {signInBusy ? 'Waiting for Google sign-in…' : 'Continue with Google'}
          </button>
          {signInError && <div className="field-err">{signInError}</div>}
          <p className="field-note">
            {deviceCode
              ? `Browser open. Sign in with Google, then approve code ${deviceCode}.`
              : 'Opens your browser for Google sign-in. Unvibe never sees your Google password.'}
          </p>
        </section>
      ) : (
        <section className="gift-share" aria-label="Your SPECIAL CHAR">
          <div className="gift-share__code">
            <span>Your SPECIAL CHAR</span>
            <button type="button" onClick={copy} disabled={!code} title="Copy SPECIAL CHAR">
              {code || '········'}
              <small>{copied ? 'Copied' : 'Copy'}</small>
            </button>
          </div>
          <div className="gift-share__meter" aria-label={`${used} of 5 gifts used`}>
            <div>
              <span>Gifts used</span>
              <strong>{used}/5</strong>
            </div>
            <i><em style={{ width: `${(used / 5) * 100}%` }} /></i>
            <p>{remaining === 0 ? 'You have used all five gifts.' : remaining === 5 ? 'Five gifts left. Each successful signup gives you both 1 month of Pro.' : `${remaining} gift${remaining === 1 ? '' : 's'} left.`}</p>
          </div>
        </section>
      )}

      <ol className="gift-steps">
        <li>
          <b>1</b>
          <div>
            <strong>Send your email and SPECIAL CHAR</strong>
            <p>{needsSignIn ? 'After you sign in, copy the 8 character code. Your friend needs your email and that code.' : `Copy the code above. Your friend needs ${giverEmail} and this 8 character code.`}</p>
          </div>
        </li>
        <li>
          <b>2</b>
          <div>
            <strong>They join on unvibe.site</strong>
            <p>Name and email first. Then expand Referral or promo code. Friend&apos;s email is yours. Promo code is SPECIAL CHAR.</p>
          </div>
        </li>
        <li>
          <b>3</b>
          <div>
            <strong>You both get 1 month of Pro</strong>
            <p>Each verified gift fills the meter. Five gifts max.</p>
          </div>
        </li>
      </ol>

      <div className="gift-shots">
        <figure>
          <img src="./waitlist-form.png" alt="Unvibe waitlist form on unvibe.site. Save a seat, name, email, then Join the waitlist." />
          <figcaption>The waitlist on unvibe.site. Name and email, then Join the waitlist.</figcaption>
        </figure>
        <figure>
          <img src="./waitlist-referral.png" alt="Referral or promo code fields. Friend's email and SPECIAL CHAR promo code." />
          <figcaption>Expand Referral or promo code. Friend&apos;s email, then SPECIAL CHAR.</figcaption>
        </figure>
      </div>
    </div>
  );
}
