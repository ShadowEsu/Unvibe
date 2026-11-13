import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RichText } from '../shared/richText';
import { ThinkingStatus } from '../shared/thinkingStatus';
import { Buddy, REACTION_HOLD_MS, setBuddyMood, useBuddyMood } from '../shared/buddy';
import { useRightPane } from '../shared/shell';
import type { ChangeBrief } from '../../core/changeBrief';
import { deviceName, isWindows, voiceHowTo } from '../shared/platform';
import { chatAskRequest } from './chatRequest';
import { askForConsent } from '../shared/consentForm';
import type { ConsentProvider } from '../../core/consent';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  ts?: string;
}

interface SavedThread {
  id: string;
  title: string;
  startedAt: string;
  updatedAt: string;
  turns: Array<{ role: 'user' | 'assistant'; content: string; ts: string }>;
}

function newThreadId(): string {
  return `ask-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function threadTitle(messages: ChatMessage[]): string {
  const first = messages.find((item) => item.role === 'user')?.content ?? 'Question';
  return first.replace(/\s+/g, ' ').trim().slice(0, 80);
}

function whenLabel(iso: string): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return '';
  const today = new Date();
  const sameDay = then.toDateString() === today.toDateString();
  if (sameDay) return then.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (then.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const sameYear = then.getFullYear() === today.getFullYear();
  return then.toLocaleDateString(undefined, sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}

const STARTERS = [
  'What just changed in this repo?',
  'What should I understand before committing?',
  'Which files are most likely to go stale?',
];

function greetName(name?: string): string {
  const clean = (name ?? '').trim();
  if (!clean || clean.toLowerCase() === 'there') return 'Hey, what are we figuring out?';
  return `Hey ${clean.split(/\s+/)[0]}, what are we figuring out?`;
}

/** A failed reply: one sentence beside an amber mark and Retry, the overlay's pattern (Design S-1 whole-app MUST 12). */
function ChatError({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="chat-error" role="alert">
      <span className="chat-error__mark" aria-hidden="true">!</span>
      <p>{error}</p>
      {onRetry ? <button type="button" className="chat-error__retry" onClick={onRetry}>Retry</button> : null}
    </div>
  );
}

function usageTone(pct: number): 'ok' | 'warn' | 'hot' {
  if (pct >= 85) return 'hot';
  if (pct >= 60) return 'warn';
  return 'ok';
}

function AiPicker({
  label,
  usingOwnAi,
  onOpenSettings,
}: {
  label: string;
  usingOwnAi: boolean;
  onOpenSettings: () => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="chat-ai" ref={rootRef}>
      <button
        type="button"
        className="chat-ai__btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <small>{label}</small>
        <svg className="chat-ai__caret" viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 6.25 8 9.75l3.5-3.5" /></svg>
      </button>
      {open ? (
        <div className="chat-ai__menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpenSettings(); }}>
            Change AI
            <span>Open settings to pick Unvibe AI or another provider.</span>
          </button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpenSettings(); }}>
            {usingOwnAi ? 'Manage API key' : 'Use an API key'}
            <span>{usingOwnAi ? `Update or remove the key kept on this ${deviceName}.` : `Keep a provider key on this ${deviceName} if you want your own model.`}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Voice uses the OS's dictation, without recording in the background. */
export function VoiceTip({ onClose }: { onClose?: () => void }) {
  return (
    <div className="voice-tip" role="note">
      <b>Ask out loud</b>
      <p>{voiceHowTo}</p>
      {!isWindows ? <p>Nothing happens? Turn on Dictation in System Settings, Keyboard. <button type="button" className="link-btn" onClick={() => void window.unvibe.openDictation()}>Open it</button></p> : null}
      {onClose ? <button type="button" className="link-btn" onClick={onClose}>Hide</button> : null}
    </div>
  );
}

/** How many of a saved brief's files "What Vibe can see" lists before it says how many more there are. */
const SEE_FILES = 6;

/** Ask Vibe's right side (Mono, `mono/grid/README.md` "Ask Vibe"): what Vibe can see, then saved conversations. */
function AskSide({ brief, repoLabel, saved, onResume }: {
  brief: ChangeBrief | null;
  repoLabel: string;
  saved: SavedThread[];
  onResume: (thread: SavedThread) => void;
}) {
  const files = brief?.files ?? [];
  return (
    <div className="ask-side">
      <section className="m-box m-box--flush ask-see" aria-labelledby="ask-see-title">
        <header className="m-box__title"><h2 id="ask-see-title">What Vibe can see</h2></header>
        <dl className="ask-see__rows">
          <div><dt>Repository</dt><dd>{repoLabel || `On this ${deviceName}`}</dd></div>
          <div><dt>Working tree</dt><dd>{brief ? `${brief.filesChanged} ${brief.filesChanged === 1 ? 'file' : 'files'}` : 'No current change'}</dd></div>
          {files[0] ? <div><dt>Current file</dt><dd><code>{files[0].path}</code></dd></div> : null}
        </dl>
        {files.length ? (
          <ul className="ask-see__files" aria-label="Changed files">
            {files.slice(0, SEE_FILES).map((file) => (
              <li key={file.path}><code>{file.path}</code><span>+{file.insertions} / -{file.deletions}</span></li>
            ))}
            {files.length > SEE_FILES ? <li className="ask-see__more">{`${files.length - SEE_FILES} more ${files.length - SEE_FILES === 1 ? 'file' : 'files'}`}</li> : null}
          </ul>
        ) : null}
      </section>
      {saved.length > 0 ? (
        <section className="m-box m-box--flush ask-saved" aria-labelledby="ask-saved-title">
          <header className="m-box__title">
            <h2 id="ask-saved-title">Saved conversations</h2>
            <span className="m-box__meta">{saved.length}</span>
          </header>
          <ul className="ask-saved__rows">
            {saved.slice(0, 6).map((thread) => (
              <li key={thread.id}>
                <button type="button" className="m-row ask-saved__row" onClick={() => onResume(thread)}>
                  <span className="m-row__main">
                    <span className="m-row__title">{thread.title}</span>
                    <span className="m-row__meta">{`${thread.turns.length} ${thread.turns.length === 1 ? 'message' : 'messages'}`}</span>
                  </span>
                  <time className="m-row__end" dateTime={thread.updatedAt}>{whenLabel(thread.updatedAt)}</time>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

export function Chat({
  initialDraft = '',
  providerLabel,
  usingOwnAi,
  providerId,
  userName,
  usage,
  onRefresh,
  onOpenAiSettings,
}: {
  initialDraft?: string;
  providerLabel: string;
  usingOwnAi: boolean;
  providerId: string;
  userName?: string;
  usage: { used: number; limit: number; remaining: number; resetsAt: string } | null;
  onRefresh: () => void | Promise<void>;
  onOpenAiSettings: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState(initialDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // The question a failed reply can be retried with (Design S-1 whole-app MUST 12).
  const [retry, setRetry] = useState('');
  const [left, setLeft] = useState(usage?.remaining ?? null);
  const [copied, setCopied] = useState<number | null>(null);
  const [modelName, setModelName] = useState('');
  const [brief, setBrief] = useState<ChangeBrief | null>(null);
  const [repoLabel, setRepoLabel] = useState('');
  const [saved, setSaved] = useState<SavedThread[]>([]);
  const [showVoice, setShowVoice] = useState(false);
  // The answer that just landed: its Vibe is happy (two hops) for REACTION_HOLD_MS, then at rest (mono/vibe/README.md).
  const [landed, setLanded] = useState<number | null>(null);
  const threadRef = useRef(newThreadId());
  const startedRef = useRef(new Date().toISOString());
  // The store's wipe generation when this conversation started; main drops saves from an older one.
  const threadGenRef = useRef<number | null>(null);
  // The wipe generation of the saved list on screen, for a resumed conversation.
  const savedGenRef = useRef<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const seededRef = useRef(false);

  useEffect(() => { areaRef.current?.focus(); }, []);

  const used = usage?.used ?? 0;
  const limit = Math.max(1, usage?.limit ?? 1);
  const pct = Math.min(100, Math.round((used / limit) * 100));
  const remaining = left ?? usage?.remaining ?? null;
  const aiLabel = usingOwnAi
    ? (modelName ? `${providerLabel}, ${modelName}` : providerLabel)
    : `${providerLabel} (default)`;

  useEffect(() => {
    if (usage?.remaining !== undefined) setLeft(usage.remaining);
  }, [usage?.remaining]);

  useEffect(() => {
    if (!usingOwnAi) {
      setModelName('');
      return;
    }
    void window.unvibe.aiModels().then((result) => {
      const catalog = result as { ok?: boolean; data?: Array<{ id: string; model?: string }> };
      const hit = catalog.data?.find((item) => item.id === providerId);
      setModelName(hit?.model ?? '');
    });
  }, [usingOwnAi, providerId]);

  const loadSaved = () => {
    void window.unvibe.chatThreads().then((result) => {
      const next = result as { ok?: boolean; threads?: SavedThread[]; wipeGeneration?: number };
      setSaved(next?.threads ?? []);
      savedGenRef.current = next?.wipeGeneration ?? null;
      if (threadGenRef.current === null) threadGenRef.current = savedGenRef.current;
    });
  };

  useEffect(() => {
    areaRef.current?.focus();
    loadSaved();
    // The brief the user last built in Briefs, for the current project; opening Ask never reads the repository (F-P1).
    void window.unvibe.lastChangeBrief().then((result) => {
      const next = result as { ok?: boolean; brief?: ChangeBrief; repoLabel?: string; branch?: string } | null;
      if (next?.ok && next.brief && !next.brief.empty) {
        setBrief(next.brief);
        setRepoLabel(next.repoLabel ?? '');
      }
    });
  }, []);

  useEffect(() => {
    if (landed === null) return undefined;
    const timer = window.setTimeout(() => setLanded(null), REACTION_HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [landed]);

  const persist = (next: ChatMessage[], wipeGeneration: number) => {
    if (next.length === 0) return;
    const now = new Date().toISOString();
    void window.unvibe
      .saveChatThread({
        id: threadRef.current,
        title: threadTitle(next),
        startedAt: startedRef.current,
        updatedAt: now,
        turns: next.map((item) => ({ role: item.role, content: item.content, ts: item.ts ?? now })),
      }, wipeGeneration)
      .then(loadSaved);
  };

  const startNew = () => {
    threadRef.current = newThreadId();
    startedRef.current = new Date().toISOString();
    threadGenRef.current = null;
    setMessages([]);
    setError('');
    setLanded(null);
    loadSaved();
    areaRef.current?.focus();
  };

  // Stable, so the right side (published through the shell) only changes when what it shows does.
  const resume = useCallback((thread: SavedThread) => {
    threadRef.current = thread.id;
    startedRef.current = thread.startedAt;
    threadGenRef.current = savedGenRef.current;
    setMessages(thread.turns.map((turn) => ({ role: turn.role, content: turn.content, ts: turn.ts })));
    setError('');
    setLanded(null);
    areaRef.current?.focus();
  }, []);

  const side = useMemo(
    () => <AskSide brief={brief} repoLabel={repoLabel} saved={saved} onResume={resume} />,
    [brief, repoLabel, saved, resume],
  );
  useRightPane(side);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.style.height = 'auto';
    area.style.height = `${Math.min(140, Math.max(40, area.scrollHeight))}px`;
  }, [draft, messages.length]);

  const send = async (text?: string) => {
    const question = (text ?? draft).trim();
    if (!question || busy) return;
    setDraft('');
    setError('');
    setRetry('');
    setBusy(true);
    setLanded(null);
    // Vibe thinks until the first words arrive (mono/vibe/README.md). The answer arrives whole, so there is no
    // writing phase to read through.
    setBuddyMood('thinking');
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: question, ts: new Date().toISOString() }];
    setMessages(nextMessages);
    const result = await window.unvibe.chatAsk(chatAskRequest(nextMessages.slice(0, -1), question, threadGenRef.current)) as {
      ok: boolean; answer?: string; error?: string; remaining?: number; code?: string; provider?: ConsentProvider; wipeGeneration?: number;
    };
    setBusy(false);
    if (result.remaining !== undefined) setLeft(result.remaining);
    if (!result.ok && (result.code === 'secret' || result.code === 'consent')) {
      // Nothing was sent: take the message back out of the log so it is not resent next turn.
      setMessages(messages);
      setDraft(question);
      setBuddyMood('idle');
      if (result.code === 'secret') {
        setError(result.error ?? '');
        return;
      }
      // First send to this provider: ask, then send this message once they agree.
      if (result.provider && await askForConsent(result.provider)) void send(question);
      return;
    }
    if (!result.ok || !result.answer || result.wipeGeneration === undefined) {
      // Nothing answered: the question comes back out of the log (Retry sends it again) and the transport's own
      // words ("fetch failed", a socket error) become one sentence; a server's sentence stays.
      setMessages(messages);
      const raw = result.error ?? '';
      setError(!raw || /fetch failed|network|ECONN|ENOTFOUND|ETIMEDOUT|socket|offline/i.test(raw) ? "Couldn't reach Unvibe. Check your connection and try again." : raw);
      setRetry(question);
      setBuddyMood('confused');
      window.setTimeout(() => setBuddyMood('idle'), 3200);
      return;
    }
    setBuddyMood('happy');
    window.setTimeout(() => setBuddyMood('idle'), REACTION_HOLD_MS);
    const answered: ChatMessage[] = [...nextMessages, { role: 'assistant', content: result.answer, ts: new Date().toISOString() }];
    setMessages(answered);
    setLanded(answered.length - 1);
    threadGenRef.current ??= result.wipeGeneration;
    persist(answered, threadGenRef.current);
    void onRefresh();
    areaRef.current?.focus();
  };

  useEffect(() => {
    const seed = initialDraft.trim();
    if (!seed || seededRef.current) return;
    seededRef.current = true;
    void send(seed);
  }, []);

  const empty = messages.length === 0 && !busy;
  const tone = usageTone(pct);
  const retryError = error ? <ChatError error={error} onRetry={retry ? () => { setError(''); void send(retry); } : undefined} /> : null;

  const vibeMood = useBuddyMood('idle');
  return (
    <div className={`ask-page${empty ? ' ask-page--empty' : ''}`}>
      <section className="m-box m-box--flush ask-thread" aria-labelledby="ask-thread-title">
        <header className="m-box__title">
          <h1 id="ask-thread-title">Ask Vibe</h1>
          {!empty ? (
            <button type="button" className="m-btn m-btn--small m-btn--outlined" onClick={startNew}>
              New question
            </button>
          ) : null}
        </header>
        {empty ? (
          <div className="ask-hello">
            <Buddy mood={vibeMood} size={56} follow label="Vibe" />
            <h2>{greetName(userName)}</h2>
            <p>Ask Vibe anything about this codebase. Replies use {aiLabel}.</p>
            <div className="ask-hello__starters">
              {STARTERS.map((item) => (
                <button key={item} type="button" className="m-btn m-btn--small m-btn--outlined" onClick={() => void send(item)}>{item}</button>
              ))}
            </div>
            {retryError}
          </div>
        ) : (
          <div className="ask-log" role="log" aria-live="polite">
            {messages.map((item, index) => (
              <article key={`${item.role}-${index}`} className={`ask-turn ask-turn--${item.role}`}>
                <span className="sr-only">{item.role === 'user' ? 'You' : providerLabel}</span>
                {item.role === 'user' ? (
                  <p className="ask-user">{item.content}</p>
                ) : (
                  <>
                    <span className="ask-turn__vibe" aria-hidden="true"><Buddy mood={landed === index ? 'happy' : 'idle'} size={28} label="Vibe" /></span>
                    <div className="ask-answer">
                      <span className="ask-answer__who" aria-hidden="true">Vibe</span>
                      <RichText className="ask-answer__body" text={item.content} />
                      <button
                        type="button"
                        className="m-btn m-btn--small m-btn--text ask-answer__copy"
                        onClick={() => {
                          void navigator.clipboard.writeText(item.content);
                          setCopied(index);
                          window.setTimeout(() => setCopied((current) => (current === index ? null : current)), 1200);
                        }}
                      >
                        {copied === index ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </>
                )}
              </article>
            ))}
            {busy ? (
              <div className="ask-turn ask-turn--thinking">
                <span className="ask-turn__vibe"><Buddy mood="thinking" size={28} label="Vibe is thinking" /></span>
                <ThinkingStatus label={providerLabel} />
              </div>
            ) : null}
            {retryError}
            <div ref={endRef} />
          </div>
        )}
      </section>

      <form
        className="m-box ask-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <label className="sr-only" htmlFor="chatDraft">Message</label>
        <textarea
          id="chatDraft"
          ref={areaRef}
          rows={1}
          value={draft}
          disabled={busy}
          placeholder={empty ? 'Ask Vibe anything about this codebase…' : 'Follow up'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {showVoice ? <VoiceTip onClose={() => setShowVoice(false)} /> : null}
        <div className="ask-composer__bar">
          <AiPicker label={aiLabel} usingOwnAi={usingOwnAi} onOpenSettings={onOpenAiSettings} />
          <span className="ask-composer__hint">
            {isWindows ? 'Enter to send' : 'Return to send'}
            {empty ? null : <span className="ask-composer__hint-more">{isWindows ? ', Shift+Enter for a new line' : ', Shift Return for a new line'}</span>}
          </span>
          {usage ? (
            <button
              type="button"
              className="ask-composer__meter"
              data-tone={tone}
              aria-label={`${pct} percent of monthly AI used. ${remaining ?? usage.remaining} of ${usage.limit} left.`}
              title={`${remaining ?? usage.remaining} of ${usage.limit} left this month. Resets ${new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.`}
              onClick={() => void onRefresh()}
            >
              {pct}% used this month
            </button>
          ) : null}
          <button className="m-btn m-btn--small m-btn--outlined ask-composer__mic" type="button" aria-pressed={showVoice} onClick={() => { setShowVoice(true); areaRef.current?.focus(); }}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1-5 0v-4A2.5 2.5 0 0 1 10 3z M5.5 9.5a4.5 4.5 0 0 0 9 0 M10 14v3 M7.5 17h5" /></svg>
            Speak
          </button>
          <button className="m-btn m-btn--filled ask-composer__send" type="submit" disabled={busy || !draft.trim()} aria-label={busy ? 'Sending' : 'Send'}>
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 16V4 M5 9l5-5 5 5" /></svg>
          </button>
        </div>
      </form>
    </div>
  );
}
