'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Check, ChevronDown, CircleAlert, Code2, LockKeyhole, LogIn, Send, Sparkles, X } from 'lucide-react';
import { findSecret, WEB_APP_LEVELS, type WebAppLevel } from '@/lib/webAppReview';

type Account = { signedIn: boolean; email?: string | null; unavailable?: boolean };
type StreamState = 'idle' | 'streaming' | 'complete' | 'error';

const levelDescriptions: Record<WebAppLevel, string> = {
  new: 'Plain language and key terms',
  beginner: 'What each part does',
  intermediate: 'Execution flow and tradeoffs',
  advanced: 'Architecture and edge cases',
  expert: 'Deep implementation reasoning',
};

export function UnvibeWebApp() {
  const [account, setAccount] = useState<Account | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [code, setCode] = useState('');
  const [fileName, setFileName] = useState('selection.ts');
  const [language, setLanguage] = useState('typescript');
  const [level, setLevel] = useState<WebAppLevel>('beginner');
  const [answer, setAnswer] = useState('');
  const [streamState, setStreamState] = useState<StreamState>('idle');
  const [error, setError] = useState('');
  const [model, setModel] = useState('');
  const [isMock, setIsMock] = useState(false);

  useEffect(() => {
    void fetch('/api/app/session').then(async (response) => {
      const data = await response.json().catch(() => ({ signedIn: false }));
      setAccount(data as Account);
    }).catch(() => setAccount({ signedIn: false, unavailable: true }));
  }, []);

  const secret = useMemo(() => (code ? findSecret(code) : null), [code]);

  async function authenticate(mode: 'signin' | 'signup') {
    setAuthBusy(true);
    setAuthError('');
    try {
      const response = await fetch('/api/app/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, mode }) });
      const data = await response.json().catch(() => ({})) as Account & { error?: string };
      if (!response.ok || !data.signedIn) {
        setAuthError(data.error ?? 'Sign-in could not be completed.');
        return;
      }
      setAccount(data);
      setAuthOpen(false);
    } catch {
      setAuthError('Could not reach Unvibe. Try again shortly.');
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    await fetch('/api/app/session', { method: 'DELETE' }).catch(() => undefined);
    setAccount({ signedIn: false });
    setAnswer('');
    setStreamState('idle');
  }

  async function explain() {
    if (!account?.signedIn) {
      setAuthOpen(true);
      return;
    }
    if (secret) {
      setError(`This selection may contain a ${secret.label}. It will not leave this browser.`);
      return;
    }
    setError('');
    setAnswer('');
    setModel('');
    setIsMock(false);
    setStreamState('streaming');
    try {
      const response = await fetch('/api/app/reviews', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code, language, fileName, level }) });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(data.error ?? 'Unvibe could not start that explanation.');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';
        for (const event of events) {
          const json = event.split('\n').find((line) => line.startsWith('data: '))?.slice(6);
          if (!json) continue;
          const data = JSON.parse(json) as { type: string; text?: string; message?: string; model?: string; mock?: boolean };
          if (data.type === 'token' && data.text) setAnswer((current) => current + data.text);
          if (data.type === 'error') throw new Error(data.message ?? 'The explanation service returned an error.');
          if (data.type === 'done') {
            setModel(data.model ?? 'Unvibe');
            setIsMock(Boolean(data.mock));
          }
        }
      }
      setStreamState('complete');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unvibe could not complete that explanation.');
      setStreamState('error');
    }
  }

  return (
    <main className="min-h-screen bg-[#171323] px-4 py-5 text-[#f7f4ff] sm:px-7 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-[#8064a2]/35 pb-5">
          <a href="/" className="inline-flex items-center gap-3"><span className="grid h-9 w-9 place-items-center border border-[#af8cff] text-[#c8b1ff]"><Code2 size={19} /></span><span><b className="block text-lg tracking-tight">Unvibe</b><small className="font-mono text-[10px] tracking-[.16em] text-[#a99caf]">WEB WORKSPACE</small></span></a>
          {account?.signedIn ? <div className="flex items-center gap-3"><span className="text-sm text-[#c8bfd5]">{account.email}</span><button type="button" onClick={() => void signOut()} className="border border-[#8064a2]/50 px-3 py-2 text-sm font-semibold hover:border-[#bda4ff]">Sign out</button></div> : <button type="button" onClick={() => setAuthOpen(true)} className="inline-flex items-center gap-2 bg-[#9e80f4] px-4 py-2.5 text-sm font-bold text-[#1b1429] hover:bg-[#b49afb]"><LogIn size={16} /> Sign in</button>}
        </header>

        <section className="mb-7 grid gap-5 border border-[#8064a2]/55 bg-[#211a30] p-6 shadow-[8px_8px_0_#6f45a8] sm:p-9 lg:grid-cols-[1.2fr_.8fr]">
          <div>
            <p className="font-mono text-xs font-bold tracking-[.18em] text-[#bda4ff]">BROWSER-LOCAL WORKSPACE</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-[.96] tracking-[-.06em] sm:text-6xl">Paste code. <span className="font-serif font-normal italic text-[#aa88ff]">Keep the thread.</span></h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#c2b9d2]">Use this workspace for a deliberate code review in your browser. Your code stays in this tab until you explicitly ask for a cloud explanation; common credentials are blocked locally first.</p>
          </div>
          <div className="border-l border-[#8064a2]/45 pl-5 lg:pl-7"><p className="font-mono text-[11px] font-bold tracking-[.15em] text-[#bda4ff]">HOW IT WORKS</p><ol className="mt-4 grid gap-3 text-sm leading-relaxed text-[#c9c0d7]"><li><b className="mr-2 text-[#bda4ff]">01</b>Paste a focused snippet.</li><li><b className="mr-2 text-[#bda4ff]">02</b>Choose the explanation depth.</li><li><b className="mr-2 text-[#bda4ff]">03</b>Review a streamed explanation.</li></ol></div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
          <section className="border border-[#8064a2]/55 bg-[#211a30] p-5 sm:p-7">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[11px] font-bold tracking-[.15em] text-[#bda4ff]">YOUR SELECTION</p><p className="mt-1 text-sm text-[#aaa0ba]">Paste only the code you want to understand.</p></div><span className="inline-flex items-center gap-2 text-xs text-[#a99caf]"><LockKeyhole size={14} /> Local scan before sending</span></div>
            <div className="grid gap-3 sm:grid-cols-[1fr_150px]"><label className="grid gap-1 text-xs font-semibold text-[#cfc5df]">File name<input value={fileName} onChange={(event) => setFileName(event.target.value)} className="border border-[#71588f] bg-[#171323] px-3 py-2.5 text-sm text-white outline-none focus:border-[#bda4ff]" /></label><label className="grid gap-1 text-xs font-semibold text-[#cfc5df]">Language<select value={language} onChange={(event) => setLanguage(event.target.value)} className="border border-[#71588f] bg-[#171323] px-3 py-2.5 text-sm text-white outline-none focus:border-[#bda4ff]"><option value="typescript">TypeScript</option><option value="javascript">JavaScript</option><option value="python">Python</option><option value="java">Java</option><option value="go">Go</option><option value="rust">Rust</option><option value="html">HTML</option><option value="css">CSS</option><option value="text">Text / other</option></select></label></div>
            <textarea value={code} onChange={(event) => setCode(event.target.value)} spellCheck={false} aria-label="Code selection" placeholder={'Paste a function, diff, or AI-generated snippet…\n\nExample:\nasync function loadUser(id: string) {\n  return fetch(`/api/users/${id}`).then((r) => r.json());\n}'} className="mt-4 min-h-[420px] w-full resize-y border border-[#71588f] bg-[#120e1c] p-4 font-mono text-sm leading-6 text-[#e8e2f1] outline-none placeholder:text-[#756b83] focus:border-[#bda4ff]" />
            {secret && <p className="mt-3 flex items-start gap-2 border border-[#bd736d]/65 bg-[#3a2028] p-3 text-sm text-[#ffd5d0]"><CircleAlert className="mt-0.5 shrink-0" size={16} />Possible {secret.label} detected. This code will not be sent.</p>}
          </section>

          <section className="border border-[#8064a2]/55 bg-[#211a30] p-5 sm:p-7">
            <p className="font-mono text-[11px] font-bold tracking-[.15em] text-[#bda4ff]">EXPLANATION</p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">{WEB_APP_LEVELS.map((item) => <button key={item} type="button" onClick={() => setLevel(item)} className={`border px-2 py-2 text-left text-xs font-bold capitalize transition ${level === item ? 'border-[#bda4ff] bg-[#9e80f4] text-[#1b1429]' : 'border-[#71588f] text-[#c9c0d7] hover:border-[#bda4ff]'}`}>{item}</button>)}</div>
            <p className="mt-3 min-h-5 text-sm text-[#aaa0ba]">{levelDescriptions[level]}</p>
            <button type="button" onClick={() => void explain()} disabled={streamState === 'streaming' || Boolean(secret)} className="mt-5 inline-flex w-full items-center justify-center gap-2 bg-[#9e80f4] px-5 py-3.5 text-sm font-bold text-[#1b1429] transition hover:bg-[#b49afb] disabled:cursor-not-allowed disabled:opacity-45">{streamState === 'streaming' ? 'Explaining…' : account?.signedIn ? 'Explain this code' : 'Sign in to explain'} <ArrowRight size={17} /></button>
            {error && <p role="alert" className="mt-4 border border-[#bd736d]/65 bg-[#3a2028] p-3 text-sm leading-relaxed text-[#ffd5d0]">{error}</p>}
            <div aria-live="polite" className="mt-5 min-h-[355px] border border-[#71588f] bg-[#120e1c] p-5"><div className="flex items-center justify-between gap-3 border-b border-[#5f4b76] pb-3"><span className="text-sm font-semibold text-[#e8e2f1]">{streamState === 'idle' ? 'Ready when you are' : streamState === 'streaming' ? 'Reading your code…' : 'Explanation'}</span>{model && <span className="font-mono text-[10px] text-[#a99caf]">{model}</span>}</div>{answer ? <div className="whitespace-pre-wrap pt-4 text-sm leading-7 text-[#ded6e9]">{answer}</div> : <p className="pt-5 text-sm leading-relaxed text-[#8e839c]">{account?.signedIn ? 'Choose a depth, then ask Unvibe to explain the code in the left panel.' : 'Sign in to connect this browser workspace to your Unvibe account and request an explanation.'}</p>}{isMock && <p className="mt-5 border-l-2 border-[#e6ad68] pl-3 text-xs leading-relaxed text-[#f2c98c]">This backend returned a labelled mock response. Configure a real provider before relying on it for production learning.</p>}</div>
          </section>
        </div>
      </div>

      {authOpen && <div role="dialog" aria-modal="true" aria-labelledby="signin-title" className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-4"><form onSubmit={(event: FormEvent) => { event.preventDefault(); void authenticate('signin'); }} className="relative w-full max-w-md border border-[#9e80f4] bg-[#211a30] p-6 shadow-[10px_10px_0_#6f45a8]"><button type="button" aria-label="Close sign-in" onClick={() => setAuthOpen(false)} className="absolute right-4 top-4 text-[#bfb5cc] hover:text-white"><X size={19} /></button><p className="font-mono text-[11px] font-bold tracking-[.16em] text-[#bda4ff]">UNVIBE WEB</p><h2 id="signin-title" className="mt-3 text-3xl font-semibold tracking-[-.05em]">Sign in to learn across sessions.</h2><p className="mt-3 text-sm leading-relaxed text-[#bcb3ca]">Your browser workspace stays local until you request an explanation. Sign-in connects permitted learning activity to your account.</p><label className="mt-6 grid gap-2 text-sm font-semibold text-[#e4deed]">Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required className="border border-[#71588f] bg-[#120e1c] px-3 py-3 font-normal text-white outline-none focus:border-[#bda4ff]" placeholder="you@example.com" /></label>{authError && <p role="alert" className="mt-3 text-sm text-[#ffd5d0]">{authError}</p>}<div className="mt-6 grid gap-3 sm:grid-cols-2"><button disabled={authBusy} className="inline-flex items-center justify-center gap-2 bg-[#9e80f4] px-4 py-3 text-sm font-bold text-[#1b1429] disabled:opacity-50"><LogIn size={16} />{authBusy ? 'Connecting…' : 'Sign in'}</button><button type="button" disabled={authBusy} onClick={() => void authenticate('signup')} className="border border-[#8064a2] px-4 py-3 text-sm font-bold text-white hover:border-[#bda4ff] disabled:opacity-50">Create account</button></div><p className="mt-4 text-xs leading-relaxed text-[#9e93ac]">If cloud sign-in is not configured yet, Unvibe will tell you directly rather than create a placeholder account.</p></form></div>}
    </main>
  );
}
