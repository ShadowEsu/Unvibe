import { app } from 'electron';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { BUBBLE_COPY_VERSION, bubbleState, isBubbleChoice, type BubbleChoice, type BubbleItem } from '../core/bubble';

/**
 * The Unvibe button's two controls (Security G1, A2), kept like the AI agreement: in their own file, written only
 * by main, each choice with the copy version and the time it was made (ledger 299 rule 5). Settings can be
 * patched by any renderer, so neither the choice's time nor its version comes from one. Both start off.
 */
class BubbleStore {
  private choices: BubbleChoice[] = [];
  private readonly file = path.join(app.getPath('userData'), 'unvibe-bubble.json');

  constructor() {
    try {
      const loaded = JSON.parse(readFileSync(this.file, 'utf8')) as { choices?: unknown };
      if (Array.isArray(loaded.choices)) this.choices = loaded.choices.filter(isBubbleChoice);
    } catch {
      /* never turned on */
    }
  }

  state(): { ghost: boolean; preview: boolean } {
    return bubbleState(this.choices);
  }

  /**
   * Throws when the file can't be written, so a switch never shows on (or off) without its record. Turning the
   * button off records Quick look off too, and Quick look can't be turned on while the button is off: it never comes
   * back on by itself when the button does (Security NIT N2).
   */
  set(item: BubbleItem, on: boolean, now: Date = new Date()): { ghost: boolean; preview: boolean } {
    const at = now.toISOString();
    const added: BubbleChoice[] = [];
    const last = (which: BubbleItem) => this.choices.filter((choice) => choice.item === which).at(-1)?.on === true;
    if (item === 'preview' && on && !last('ghost')) return this.state();
    if (last(item) !== on) added.push({ item, on, copyVersion: BUBBLE_COPY_VERSION, at });
    if (item === 'ghost' && !on && last('preview')) added.push({ item: 'preview', on: false, copyVersion: BUBBLE_COPY_VERSION, at });
    if (added.length === 0) return this.state();
    const next = [...this.choices, ...added];
    mkdirSync(path.dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify({ choices: next }), { mode: 0o600 });
    this.choices = next;
    return this.state();
  }
}

let instance: BubbleStore | null = null;

export function bubbleStore(): BubbleStore {
  instance ??= new BubbleStore();
  return instance;
}
