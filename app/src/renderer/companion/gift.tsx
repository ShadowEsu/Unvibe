import { useEffect, useState } from 'react';
import { LogoMark } from '../shared/logo';

export function Gift() {
  const [code, setCode] = useState('');
  const [used, setUsed] = useState(0);
  const [email, setEmail] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const result = await window.unvibe.giftStatus() as { ok?: boolean; code?: string; used?: number; email?: string | null };
      if (!alive || !result?.code) return;
      setCode(result.code);
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

  const copy = () => {
    if (!code) return;
    void navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
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
            Share your 8 character SPECIAL CHAR. A friend opens unvibe.site, expands Referral or promo code, puts {giverEmail} and this code. You both get 1 month of Pro. Five gifts max.
          </p>
        </div>
      </div>

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

      <ol className="gift-steps">
        <li>
          <b>1</b>
          <div>
            <strong>Send your email and SPECIAL CHAR</strong>
            <p>Copy the code above. Your friend needs {giverEmail} and this 8 character code.</p>
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
            <p>Each successful referral fills the meter. Five gifts max.</p>
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
