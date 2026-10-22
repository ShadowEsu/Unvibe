import { useEffect, useState } from 'react';
import { GoogleMark } from '../shared/googleMark';

export function Gift() {
  const [code, setCode] = useState('');
  const [link, setLink] = useState('');
  const [loadError, setLoadError] = useState('');
  const [used, setUsed] = useState(0);
  const [, setEmail] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [signInBusy, setSignInBusy] = useState(false);
  const [signInError, setSignInError] = useState('');
  const [deviceCode, setDeviceCode] = useState('');
  const [verificationUrl, setVerificationUrl] = useState('');
  const [browserOpened, setBrowserOpened] = useState(true);
  const [friendCode, setFriendCode] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimNote, setClaimNote] = useState('');
  const [claimError, setClaimError] = useState('');

  type GiftStatus = { ok?: boolean; needsSignIn?: boolean; code?: string; shareUrl?: string; used?: number; email?: string | null; error?: string };
  const applyStatus = (status: GiftStatus, fallbackEmail?: string | null) => {
    setNeedsSignIn(Boolean(status.needsSignIn));
    setCode(status.code ?? '');
    setLink(status.shareUrl ?? '');
    setLoadError(status.ok === false ? status.error ?? 'Your invite link could not load.' : '');
    setUsed(Math.min(5, Math.max(0, status.used ?? 0)));
    setEmail(status.email ?? fallbackEmail ?? null);
  };

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const result = await window.unvibe.giftStatus() as GiftStatus;
      if (alive) applyStatus(result);
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
        void window.unvibe.giftStatus().then((status) => applyStatus(status as GiftStatus, result.email));
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

  const claimFriendCode = async () => {
    setClaimBusy(true);
    setClaimError('');
    setClaimNote('');
    const result = await window.unvibe.giftClaim(friendCode);
    setClaimBusy(false);
    if (!result.ok) {
      setClaimError(result.error ?? 'The gift could not be used.');
      return;
    }
    setFriendCode('');
    setClaimNote(result.monthAdded
      ? 'Done. A month of Pro was added to your account. Thanks for joining your friend.'
      : "Done. Your friend's code is applied. Your paid plan stays as it is, so no gift month was added to it.");
  };

  const remaining = Math.max(0, 5 - used);
  const message = `I've been using Unvibe to actually understand the code AI writes for me. It's free. When you sign in to the Unvibe app and enter my code, we each get a month of Pro: ${link}`;
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
          <h1>Invite friends to Unvibe.</h1>
          <p>
            {needsSignIn
              ? 'Sign in with Google first so your invite code is tied to your account.'
              : 'When a friend signs in to the Unvibe app and enters your code, you each get a month of Pro. It counts for up to five friends, months stack up to 12 ahead, and it never changes an active paid subscription.'}
          </p>
        </div>
      </div>

      {needsSignIn ? (
        <section className="gift-signin" aria-label="Sign in to share Unvibe">
          <button className="field-btn field-btn--google" type="button" disabled={signInBusy} onClick={() => void startSignIn()}>
            <GoogleMark />
            {signInBusy ? 'Waiting for Google sign-in…' : 'Continue with Google'}
          </button>
          {signInError && <div className="field-err" role="alert">{signInError}</div>}
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
              <code>{link || 'unvibe.site/?ref=················'}</code>
              <button type="button" className="act act--primary" onClick={() => copyText(link, setLinkCopied)} disabled={!link}>{linkCopied ? 'Copied!' : 'Copy link'}</button>
            </div>
            {loadError ? <div className="field-err" role="alert">{loadError}</div> : null}
            <div className="share-link__targets">
              {shareTargets.map((t) => (
                <button key={t.label} type="button" className="act" disabled={!link} onClick={() => open(t.url)}>{t.label}</button>
              ))}
              <button type="button" className="act" disabled={!link} onClick={() => copyText(message, setMsgCopied)}>{msgCopied ? 'Message copied' : 'Copy a message'}</button>
            </div>
            {code ? <p className="share-link__fine">Your code is <b>{code}</b>. Your friend enters it, or pastes the whole link, on the Share page in the Unvibe app.</p> : null}
          </section>
          <section className="gift-share__meter share-meter" aria-label={`${used} of 5 friends joined`}>
            <div>
              <span>Friends joined</span>
              <strong>{used}/5</strong>
            </div>
            <i><em style={{ width: `${(used / 5) * 100}%` }} /></i>
            <p>{remaining === 0 ? 'All five invites used. Thank you for spreading Unvibe!' : used === 0 ? 'Nobody yet. Share your link to invite your first friend.' : `${used} joined. ${remaining} invite${remaining === 1 ? '' : 's'} left.`}</p>
          </section>
          <section className="gift-signin gift-claim" aria-label="Use a friend's gift code">
            <label className="share-link__label" htmlFor="gift-friend-code">Got a code from a friend?</label>
            <input id="gift-friend-code" className="field" value={friendCode} placeholder="Paste their code or link" autoComplete="off" spellCheck={false}
              onChange={(e) => setFriendCode(e.target.value)} />
            <button className="field-btn" type="button" disabled={claimBusy || !friendCode.trim()} onClick={() => void claimFriendCode()}>
              {claimBusy ? 'Checking the code…' : 'Use code'}
            </button>
            {claimError ? <div className="field-err" role="alert">{claimError}</div> : null}
            {claimNote ? <p className="field-note" role="status">{claimNote}</p> : null}
            <p className="field-note">Each account can use one friend's code.</p>
          </section>
        </>
      )}

      <ol className="gift-steps">
        <li><b>1</b><div><strong>Copy or share your link</strong><p>One tap above. It shows your code to your friend.</p></div></li>
        <li><b>2</b><div><strong>Your friend signs in to the Unvibe app</strong><p>They download Unvibe and sign in with their own email.</p></div></li>
        <li><b>3</b><div><strong>You each get a month of Pro</strong><p>When they enter your code on their Share page, the month is added to both accounts right away.</p></div></li>
      </ol>
    </div>
  );
}
