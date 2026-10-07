import { useEffect, useState } from 'react';
import { GoogleMark } from '../shared/googleMark';

export function Gift() {
  const [code, setCode] = useState('');
  const [used, setUsed] = useState(0);
  const [, setEmail] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [deviceCode, setDeviceCode] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [browserOpened, setBrowserOpened] = useState(true);

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

  const startSignIn = async () => {
    setSignInBusy(true);
    setSignInError('');
    const result = await window.unvibe.startDeviceAuth() as { ok: boolean; userCode?: string; verificationUri?: string; browserOpened?: boolean; error?: string };
    if (result.ok && result.userCode && result.verificationUri) {
      setDeviceCode(result.userCode);
      setVerificationUrl(result.verificationUri);
      setBrowserOpened(result.browserOpened !== false);
    }
    else {
      setSignInBusy(false);
      setSignInError(result.error ?? 'Could not start secure sign-in.');
    }
  };
  const openBrowser = async () => {
    const result = await window.unvibe.openDeviceAuth() as { ok?: boolean; error?: string };
    if (!result.ok) setSignInError(result.error ?? 'Could not open your browser.');
    else setBrowserOpened(true);
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(verificationUrl); }
    catch { setSignInError('Could not copy the sign-in link.'); }
  };

  const remaining = Math.max(0, 5 - used);
  const link = code ? `https://unvibe.site/?ref=${code}` : '';
  const message = `I've been using Unvibe to actually understand the code AI writes for me. It's free. Join with my link and we both get a month of Pro: ${link}`;
  const [linkCopied, setLinkCopied] = useState(false);
  const [msgCopied, setMsgCopied] = useState(false);
  const copyText = (text: string, done: (v: boolean) => void) => {
    if (!text) return;
    void navigator.clipboard.writeText(text);
    done(true);
    window.setTimeout(() => done(false), 1400);
  };
  const open = (url: string) => { window.open(url, '_blank'); };
  const shareTargets = [
    { label: 'Email', url: `mailto:?subject=${encodeURIComponent('Try Unvibe with me')}&body=${encodeURIComponent(message)}` },
    { label: 'X', url: `https://x.com/intent/post?text=${encodeURIComponent(message)}` },
    { label: 'WhatsApp', url: `https://wa.me/?text=${encodeURIComponent(message)}` },
    { label: 'LinkedIn', url: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}` },
  ];

  return (
    <div className="gift-view">
      <div className="page-head">
        <div>
          <div className="gift-view__brand">
            <div className="eyebrow">Share Unvibe</div>
          </div>
          <h1>Send one link. You both get a month of Pro.</h1>
          <p>
            {needsSignIn
              ? 'Sign in with Google first so your invite link is tied to you.'
              : 'When a friend opens your link and joins with their email, a month of Pro lands on both accounts. Up to five friends, and the months stack.'}
          </p>
        </div>
      </div>

      {needsSignIn ? (
        <section className="gift-signin" aria-label="Sign in to share Unvibe">
          <button className="field-btn field-btn--google" type="button" disabled={signInBusy} onClick={() => void startSignIn()}>
            <GoogleMark />
            {signInBusy ? 'Waiting for Google sign-in…' : 'Continue with Google'}
          </button>
          {signInError && <div className="field-err">{signInError}</div>}
          {deviceCode ? <div className="signin__code"><span>Approve this code in your browser</span><b>{deviceCode}</b></div> : null}
          <p className="field-note">
            {deviceCode
              ? `${browserOpened ? 'Finish in your browser.' : 'Your browser did not open.'} Sign in with Google, then approve the code above.`
              : 'Opens your browser for Google sign-in. Unvibe never sees your Google password.'}
          </p>
          {verificationUrl ? <div className="inline-actions"><button className="field-btn" type="button" onClick={() => void openBrowser()}>Open browser</button><button className="field-btn" type="button" onClick={() => void copyLink()}>Copy link</button><button className="field-btn" type="button" onClick={() => void startSignIn()}>Retry</button></div> : null}
        </section>
      ) : (
        <>
          <section className="share-link" aria-label="Your invite link">
            <span className="share-link__label">Your invite link</span>
            <div className="share-link__row">
              <code>{link || 'unvibe.site/?ref=········'}</code>
              <button type="button" className="act act--primary" onClick={() => copyText(link, setLinkCopied)} disabled={!link}>{linkCopied ? 'Copied!' : 'Copy link'}</button>
            </div>
            <div className="share-link__targets">
              {shareTargets.map((t) => (
                <button key={t.label} type="button" className="act" disabled={!link} onClick={() => open(t.url)}>{t.label}</button>
              ))}
              <button type="button" className="act" disabled={!link} onClick={() => copyText(message, setMsgCopied)}>{msgCopied ? 'Message copied' : 'Copy a message'}</button>
            </div>
            <p className="share-link__fine">Your code is <b>{code}</b> if a friend would rather type it in the Referral box on unvibe.site.</p>
          </section>
          <section className="gift-share__meter share-meter" aria-label={`${used} of 5 friends joined`}>
            <div>
              <span>Friends joined</span>
              <strong>{used}/5</strong>
            </div>
            <i><em style={{ width: `${(used / 5) * 100}%` }} /></i>
            <p>{remaining === 0 ? 'All five used. Thank you for spreading Unvibe!' : used === 0 ? 'Nobody yet. Your first friend gets you a free month.' : `${used} month${used === 1 ? '' : 's'} of Pro earned. ${remaining} to go.`}</p>
          </section>
        </>
      )}

      <ol className="gift-steps">
        <li><b>1</b><div><strong>Copy or share your link</strong><p>One tap above. It opens unvibe.site with your invite already filled in.</p></div></li>
        <li><b>2</b><div><strong>Your friend pops in their email</strong><p>They see a small &ldquo;A friend invited you&rdquo; card and download Unvibe.</p></div></li>
        <li><b>3</b><div><strong>You both get a month of Pro</strong><p>It shows up when they sign in to the app with the same email.</p></div></li>
      </ol>
    </div>
  );
}
