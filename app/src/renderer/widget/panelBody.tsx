import type { ReactNode, Ref } from 'react';
import type { SecretFinding } from '../../core/secretFilter';
import { Icon } from './icons';
import { firstCodeLine } from './selectionName';

/**
 * The code row (Mono, OPTIONS.md "Overlay window and Island"): one 36 px line on the grey fill, the selection's first
 * line in mono 12 and "Show code" as a link with a chevron. Show code opens the whole selection inline and pushes
 * the answer down; the whole selection is always in the DOM (folded by CSS), so copy, search and screen readers get
 * all of it.
 */
export function CodeRow({ id, code, open, onToggle }: {
  id: string;
  code: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <section className={`ob-code${open ? ' is-open' : ''}`} aria-label="Selected code context">
      <div className="ob-code__row">
        <span className="ob-code__line" aria-hidden={open || undefined}>{firstCodeLine(code)}</span>
        <button type="button" className="ob-link" aria-expanded={open} aria-controls={id} onClick={onToggle}>
          {open ? 'Show less' : 'Show code'}<Icon name="chevron-right" size={12} className="ob-link__chev" />
        </button>
      </div>
      <pre id={id} className="ob-code__all" tabIndex={open ? 0 : -1}><code>{code}</code></pre>
    </section>
  );
}

/**
 * The finished answer's actions (Mono): 28 px pills. Understand is the one filled button and the panel's existing
 * understood action (it stays pressed, with a tick, and a second press does nothing new); Save pins the lesson to
 * Saved (pressed again, it unpins); Explain differently asks again. While the answer is still being revealed, all wait.
 */
export function ExplainChips({ busy, understood, pinned, onUnderstand, onSave, onDifferent, children }: {
  busy: boolean;
  understood: boolean;
  pinned: boolean;
  onUnderstand: () => void;
  onSave: () => void;
  onDifferent: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="ob-chips">
      <button type="button" className={`ob-btn ob-btn--small${understood ? ' is-on' : ''}`} aria-pressed={understood} disabled={busy}
        onClick={() => { if (!understood) onUnderstand(); }}>
        {understood ? <Icon name="check" size={14} /> : null}Understand
      </button>
      <button type="button" className={`ob-chip${pinned ? ' is-on' : ''}`} aria-pressed={pinned} disabled={busy} onClick={onSave}>
        {pinned ? <Icon name="bookmark" size={14} /> : null}Save
      </button>
      <button type="button" className="ob-chip" disabled={busy} onClick={onDifferent}>Explain differently</button>
      {children}
    </div>
  );
}

/** While an answer streams, the footer holds only this (Security). */
export function StopButton({ onStop }: { onStop: () => void }) {
  return (
    <div className="ob-chips">
      <button type="button" className="ob-chip" onClick={onStop}>Stop generating</button>
    </div>
  );
}

/** The 36 px Ask field, a pill with the control border and a 28 px round send button (Mono). */
export function AskField({ value, disabled, inputRef, onChange, onSend, children }: {
  value: string;
  disabled: boolean;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (value: string) => void;
  onSend: () => void;
  children?: ReactNode;
}) {
  const ready = !disabled && Boolean(value.trim());
  return (
    <div className="ob-ask">
      <input
        ref={inputRef}
        className="ob-ask__input"
        placeholder="Ask about this code"
        value={value}
        maxLength={4000}
        disabled={disabled}
        aria-label="Follow-up question"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && ready) onSend(); }}
      />
      {children}
      <button type="button" className="ob-ask__send" aria-label="Ask" disabled={!ready} onClick={() => { if (ready) onSend(); }}>
        <Icon name="arrow-up" size={16} />
      </button>
    </div>
  );
}

/** How long the understood note stays (Design Q1), with or without motion. */
export const TOAST_MS = 2400;
/** Its exit (obToastOut); under reduced motion it simply goes after this. */
export const TOAST_EXIT_MS = 160;
/** Vibe's happy squash (buddy.css, 240 ms): the note rises after it, so the order reads press → squash → note. */
export const SQUASH_MS = 240;

/** A short note over the footer with the check icon. It goes inside a live region that is always there. */
export function PanelToast({ text, leaving }: { text: string; leaving?: boolean }) {
  return (
    <div className={`ob-toast${leaving ? ' is-leaving' : ''}`}>
      <Icon name="check" size={14} className="ob-toast__tick" />
      <span>{text}</span>
    </div>
  );
}

/** A finding row for the secret and blocked states: rule · file line N · masked. */
export function Findings({ findings }: { findings: SecretFinding[] }) {
  return (
    <div className="ob-findings">
      {findings.map((f, i) => (
        <div key={i}>{f.rule} · {f.file} line {f.line} · {f.masked}</div>
      ))}
    </div>
  );
}
