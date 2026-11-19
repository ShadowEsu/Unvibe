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
 * "Question it" (BOSS ruling, 0.1.54, the 633 frame 4; behaviour unvibe-pm v1, look Design v1): three one-tap
 * questions that fill the existing Ask box and focus it. Nothing is sent until the person presses Ask, so the meter and
 * consent work exactly as for any follow-up.
 */
export const QUESTION_CHIPS = ['Why this way?', 'What breaks if I remove it?', 'What would a reviewer flag?'] as const;

/**
 * What the Ask box holds after a chip (unvibe-pm rule 4, Design's proposal): the chip's question when the box is empty
 * or holds another chip's question untouched; text the person typed or edited is never overwritten.
 */
export function prefillAsk(current: string, question: string): string {
  return current.trim() === '' || (QUESTION_CHIPS as readonly string[]).includes(current) ? question : current;
}

/**
 * The question chips, stacked full-width under a "Question it" label. A chip stays pressed while the box holds its
 * question untouched (edited or sent, it lets go). While the answer is still being revealed, they wait.
 */
export function QuestionChips({ busy, ask, onQuestion }: { busy: boolean; ask: string; onQuestion: (question: string) => void }) {
  return (
    <div className="ob-questions" role="group" aria-labelledby="ob-questions-label">
      <span className="ob-questions__label" id="ob-questions-label">Question it</span>
      {QUESTION_CHIPS.map((question) => (
        <button key={question} type="button" className="ob-question" aria-pressed={ask === question} disabled={busy} onClick={() => onQuestion(question)}>
          {question}
        </button>
      ))}
    </div>
  );
}

/**
 * The finished answer's other actions, after the Ask box: one row of frameless 28 px text buttons, so the Ask send is
 * the panel's one filled control at 320 px (Design 633). Explain differently asks again; Save pins the lesson to Saved
 * (pressed again, it unpins); Understood is the panel's existing understood action (it stays pressed, with a tick, and
 * a second press does nothing new). While the answer is still being revealed, all wait.
 */
export function ExplainActions({ busy, understood, pinned, onUnderstand, onSave, onDifferent, children }: {
  busy: boolean;
  understood: boolean;
  pinned: boolean;
  onUnderstand: () => void;
  onSave: () => void;
  onDifferent: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="ob-chips ob-chips--text">
      <button type="button" className="ob-chip" disabled={busy} onClick={onDifferent}>Explain differently</button>
      <button type="button" className={`ob-chip${pinned ? ' is-on' : ''}`} aria-pressed={pinned} disabled={busy} onClick={onSave}>
        {pinned ? <Icon name="bookmark" size={14} /> : null}Save
      </button>
      <button type="button" className={`ob-chip${understood ? ' is-on' : ''}`} aria-pressed={understood} disabled={busy}
        onClick={() => { if (!understood) onUnderstand(); }}>
        {understood ? <Icon name="check" size={14} /> : null}Understood
      </button>
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

/**
 * Whether a key in the Ask box sends it: a fresh Enter only. A held Enter's repeats don't (a chip pressed with Enter
 * moves focus into the box, and the repeat must not send its question: lead review on #346), nor an Enter that
 * finishes an input-method composition.
 */
export function enterSends(e: { key: string; repeat: boolean; isComposing: boolean }): boolean {
  return e.key === 'Enter' && !e.repeat && !e.isComposing;
}

/**
 * The 36 px Ask field, a pill with the control border and a 28 px round send button (Mono). Under a finished
 * explanation it is "Ask your own question" (0.1.54, under the question chips); in the Ask tab, a follow-up.
 */
export function AskField({ value, disabled, inputRef, placeholder = 'Ask about this code', label = 'Follow-up question', onChange, onSend, children }: {
  value: string;
  disabled: boolean;
  inputRef?: Ref<HTMLInputElement>;
  placeholder?: string;
  label?: string;
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
        placeholder={placeholder}
        value={value}
        maxLength={4000}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (ready && enterSends({ key: e.key, repeat: e.repeat, isComposing: e.nativeEvent.isComposing })) onSend(); }}
      />
      {children}
      {/* Design (Question it v1): Ask stays the filled main button while it only waits for text; it dims when the
          whole field is off (an answer still coming). */}
      <button type="button" className="ob-ask__send" aria-label="Ask" disabled={!ready} data-waiting={disabled ? undefined : ''} onClick={() => { if (ready) onSend(); }}>
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
