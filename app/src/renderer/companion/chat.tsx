import { useEffect, useRef, useState } from 'react';
import { RichText } from '../shared/richText';
import { ThinkingStatus } from '../shared/thinkingStatus';
import type { ChangeBrief } from '../../core/changeBrief';

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
  if (!clean || clean.toLowerCase() === 'there') return 'Ask Unvibe';
  return `Ask Unvibe, ${clean.split(/\s+/)[0]}`;
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
        <em aria-hidden="true">▾</em>
      </button>
      {open ? (
        <div className="chat-ai__menu" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpenSettings(); }}>
            Change AI
            <span>Open settings to pick Unvibe AI or another provider.</span>
          </button>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); onOpenSettings(); }}>
            {usingOwnAi ? 'Manage API key' : 'Use an API key'}
            <span>{usingOwnAi ? 'Update or remove the key kept on this Mac.' : 'Keep a provider key on this Mac if you want your own model.'}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Chat({
  providerLabel,
  usingOwnAi,
  providerId,
  userName,
  usage,
  onRefresh,
  onOpenAiSettings,
}: {
  providerLabel: string;
  usingOwnAi: boolean;
  providerId: string;
  userName?: string;
  usage: { used: number; limit: number; remaining: number; resetsAt: string } | null;
  onRefresh: () => void | Promise<void>;
  onOpenAiSettings: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [left, setLeft] = useState(usage?.remaining ?? null);
  const [copied, setCopied] = useState<number | null>(null);
  const [modelName, setModelName] = useState('');
  const [brief, setBrief] = useState<ChangeBrief | null>(null);
  const [saved, setSaved] = useState<SavedThread[]>([]);
  const threadRef = useRef(newThreadId());
  const startedRef = useRef(new Date().toISOString());
  const endRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

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
      const next = result as { ok?: boolean; threads?: SavedThread[] };
      setSaved(next?.threads ?? []);
    });
  };

  useEffect(() => {
    areaRef.current?.focus();
    loadSaved();
    void window.unvibe.buildChangeBrief({ scope: 'working' }).then((result) => {
      const next = result as { ok?: boolean; brief?: ChangeBrief; branch?: string };
      if (next?.ok && next.brief && !next.brief.empty) setBrief(next.brief);
    });
  }, []);

  const persist = (next: ChatMessage[]) => {
    if (next.length === 0) return;
    const now = new Date().toISOString();
    void window.unvibe
      .saveChatThread({
        id: threadRef.current,
        title: threadTitle(next),
        startedAt: startedRef.current,
        updatedAt: now,
        turns: next.map((item) => ({ role: item.role, content: item.content, ts: item.ts ?? now })),
      })
      .then(loadSaved);
  };

  const startNew = () => {
    threadRef.current = newThreadId();
    startedRef.current = new Date().toISOString();
    setMessages([]);
    setError('');
    loadSaved();
    areaRef.current?.focus();
  };

  const resume = (thread: SavedThread) => {
    threadRef.current = thread.id;
    startedRef.current = thread.startedAt;
    setMessages(thread.turns.map((turn) => ({ role: turn.role, content: turn.content, ts: turn.ts })));
    setError('');
    areaRef.current?.focus();
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const cap = messages.length === 0 ? 180 : 140;
    const floor = messages.length === 0 ? 72 : 48;
    area.style.height = 'auto';
    area.style.height = `${Math.min(cap, Math.max(floor, area.scrollHeight))}px`;
  }, [draft, messages.length]);

  const send = async (text?: string) => {
    const question = (text ?? draft).trim();
    if (!question || busy) return;
    setDraft('');
    setError('');
    setBusy(true);
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: question, ts: new Date().toISOString() }];
    setMessages(nextMessages);
    const result = await window.unvibe.chatAsk({
      messages: nextMessages.slice(0, -1).map((item) => ({ role: item.role, content: item.content })),
      question,
    }) as { ok: boolean; answer?: string; error?: string; remaining?: number };
    setBusy(false);
    if (result.remaining !== undefined) setLeft(result.remaining);
    if (!result.ok || !result.answer) {
      setError(result.error ?? 'Chat could not reply.');
      return;
    }
    const answered: ChatMessage[] = [...nextMessages, { role: 'assistant', content: result.answer, ts: new Date().toISOString() }];
    setMessages(answered);
    persist(answered);
    void onRefresh();
    areaRef.current?.focus();
  };

  const empty = messages.length === 0 && !busy;
  const tone = usageTone(pct);

  return (
    <div className={`chat-page${empty ? ' chat-page--empty' : ''}`}>
      <header className="chat-top">
        <AiPicker label={aiLabel} usingOwnAi={usingOwnAi} onOpenSettings={onOpenAiSettings} />
        {!empty ? (
          <button type="button" className="ghost-link" onClick={startNew}>
            New question
          </button>
        ) : null}
      </header>

      <div className="chat-stage">
        {empty ? (
          <div className="chat-hello">
            <h2>{greetName(userName)}</h2>
            <p>Ask Unvibe anything about this codebase. Replies use {aiLabel}.</p>
            <div className="chat-context">
              {brief?.repo ? <span>Repository {brief.repo}</span> : <span>Repository on this Mac</span>}
              <span>{brief ? `${brief.filesChanged} files in the working tree` : 'No current change'}</span>
              {brief?.files[0] ? <span>Current file {brief.files[0].path}</span> : null}
            </div>
            {saved.length > 0 ? (
              <section className="chat-saved" aria-label="Saved conversations">
                <h3>Saved conversations</h3>
                <ul>
                  {saved.slice(0, 6).map((thread) => (
                    <li key={thread.id}>
                      <button type="button" onClick={() => resume(thread)}>
                        <strong>{thread.title}</strong>
                        <small>{thread.turns.length} messages</small>
                      </button>
                      <time dateTime={thread.updatedAt}>{whenLabel(thread.updatedAt)}</time>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="chat-log" role="log" aria-live="polite">
            {messages.map((item, index) => (
              <article key={`${item.role}-${index}`} className={`chat-turn chat-turn--${item.role}`}>
                <span className="sr-only">{item.role === 'user' ? 'You' : providerLabel}</span>
                {item.role === 'user' ? (
                  <p className="chat-user">{item.content}</p>
                ) : (
                  <div className="chat-assistant">
                    <RichText className="chat-assistant__body" text={item.content} />
                    <button
                      type="button"
                      className="chat-copy"
                      onClick={() => {
                        void navigator.clipboard.writeText(item.content);
                        setCopied(index);
                        window.setTimeout(() => setCopied((current) => (current === index ? null : current)), 1200);
                      }}
                    >
                      {copied === index ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}
              </article>
            ))}
            {busy ? <ThinkingStatus label={providerLabel} /> : null}
            {error ? <p className="form-error">{error}</p> : null}
            <div ref={endRef} />
          </div>
        )}

        <form
          className="chat-dock"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
        >
          <div className="chat-composer">
            <label className="sr-only" htmlFor="chatDraft">Message</label>
            <textarea
              id="chatDraft"
              ref={areaRef}
              rows={empty ? 3 : 1}
              value={draft}
              disabled={busy}
              placeholder={empty ? 'Ask Unvibe anything about this codebase…' : 'Follow up'}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <div className="chat-composer__bar">
              <span>{empty ? 'Return to send' : 'Return to send, Shift Return for a new line'}</span>
              <button className="chat-send" type="submit" disabled={busy || !draft.trim()} aria-label={busy ? 'Sending' : 'Send'}>
                {busy ? '·' : '↑'}
              </button>
            </div>
          </div>
          {empty ? (
            <div className="chat-starters">
              {STARTERS.map((item) => (
                <button key={item} type="button" onClick={() => void send(item)}>{item}</button>
              ))}
            </div>
          ) : null}
        </form>
      </div>

      {usage ? (
        <button
          type="button"
          className={`chat-meter chat-meter--${tone}`}
          aria-label={`${pct} percent of monthly AI used. ${remaining ?? usage.remaining} of ${usage.limit} left.`}
          title={`${remaining ?? usage.remaining} of ${usage.limit} left this month. Resets ${new Date(usage.resetsAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}.`}
          onClick={() => void onRefresh()}
        >
          <span>{pct}% used</span>
        </button>
      ) : null}
    </div>
  );
}
