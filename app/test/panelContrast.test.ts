import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Colours the review panel really paints, worked out from widget.css's tokens: a small cascade over
 * the top-level rules (no @media or @container blocks) for one combination of the app theme
 * (`data-theme`) and the panel look (`data-panel`: paper or ink).
 */
const css = readFileSync(path.join(__dirname, '../src/renderer/widget/widget.css'), 'utf8');

interface Rule { selectors: string[]; decls: Array<[string, string]>; order: number }

function topLevelRules(source: string): Rule[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: Rule[] = [];
  let i = 0;
  let order = 0;
  while (i < text.length) {
    const open = text.indexOf('{', i);
    if (open < 0) break;
    const prelude = text.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < text.length && depth > 0) {
      if (text[j] === '{') depth += 1;
      else if (text[j] === '}') depth -= 1;
      j += 1;
    }
    const body = text.slice(open + 1, j - 1);
    if (!prelude.startsWith('@')) {
      const decls = body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
        const at = d.indexOf(':');
        return [d.slice(0, at).trim(), d.slice(at + 1).trim()] as [string, string];
      });
      rules.push({ selectors: prelude.split(',').map((s) => s.trim().replace(/\s+/g, ' ')), decls, order: order++ });
    }
    i = j;
  }
  return rules;
}

const RULES = topLevelRules(css);

interface Look { theme: 'light' | 'dark'; panel: 'light' | 'dark' }

/** Root prefixes that match <html> for this look; the rest of a selector must name the element. */
function rootPrefixes({ theme, panel }: Look): string[] {
  const out = [':root', `:root[data-theme="${theme}"]`];
  if (panel === 'light') out.push(':root[data-panel="light"]');
  if (theme === 'dark' && panel === 'dark') out.push(':root[data-theme="dark"]:not([data-panel="light"])');
  return out;
}

function specificity(selector: string): number {
  const ids = (selector.match(/#[\w-]+/g) ?? []).length;
  const classes = (selector.match(/\.[\w-]+|\[[^\]]+\]|:(?!not\b)(?!:)[\w-]+/g) ?? []).length;
  const types = (selector.replace(/\[[^\]]+\]|\([^)]*\)/g, '').match(/(^|[\s>+~])[a-z][\w-]*/g) ?? []).length;
  return ids * 10_000 + classes * 100 + types;
}

/** The winning value of `prop` among rules whose selector is `<root prefix> <one of targets>` (or the root itself when targets has ''). */
function cascade(look: Look, targets: string[], prop: string): string | undefined {
  const prefixes = rootPrefixes(look);
  let best: { spec: number; order: number; value: string } | undefined;
  for (const rule of RULES) {
    for (const sel of rule.selectors) {
      const matches = targets.some((t) => (t === '' ? prefixes.includes(sel) : sel === t || prefixes.some((p) => sel === `${p} ${t}`)));
      if (!matches) continue;
      for (const [name, value] of rule.decls) {
        if (name !== prop || value.includes('!important')) continue;
        const spec = specificity(sel);
        if (!best || spec > best.spec || (spec === best.spec && rule.order > best.order)) best = { spec, order: rule.order, value };
      }
    }
  }
  return best?.value;
}

/** A custom property as the card element sees it: set on .card, or inherited from <html>. */
function token(look: Look, name: string): string {
  const raw = cascade(look, ['.card', '.card.card'], name) ?? cascade(look, [''], name);
  assert.ok(raw, `${name} is defined for ${JSON.stringify(look)}`);
  return resolve(look, raw);
}

function resolve(look: Look, value: string): string {
  return value.replace(/var\((--[\w-]+)(?:,\s*([^)]+))?\)/g, (_m, name: string, fallback?: string) => {
    const raw = cascade(look, ['.card', '.card.card'], name) ?? cascade(look, [''], name) ?? fallback;
    assert.ok(raw, `${name} resolves for ${JSON.stringify(look)}`);
    return resolve(look, raw);
  });
}

/** The colour an element's rules give `prop`, resolved through the card's tokens. */
function painted(look: Look, targets: string[], prop = 'color'): string {
  const raw = cascade(look, targets, prop);
  assert.ok(raw, `${targets.join(' | ')} sets ${prop}`);
  return resolve(look, raw);
}

type Rgba = [number, number, number, number];

function parseColor(value: string): Rgba {
  const v = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.split('').map((c) => c + c).join('') : hex[1]!;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
  }
  const fn = /^rgba?\(([^)]+)\)$/i.exec(v);
  if (fn) {
    const parts = fn[1]!.split(/[\s,/]+/).filter(Boolean).map(Number);
    return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
  }
  throw new Error(`not a plain colour: ${value}`);
}

function luminance([r, g, b]: Rgba): number {
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: string, bg: string): number {
  const back = parseColor(bg);
  const front = parseColor(fg);
  const a = front[3];
  const mixed: Rgba = [front[0] * a + back[0] * (1 - a), front[1] * a + back[1] * (1 - a), front[2] * a + back[2] * (1 - a), 1];
  const [hi, lo] = [luminance(mixed), luminance(back)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const LOOKS: Look[] = [
  { theme: 'light', panel: 'dark' },
  { theme: 'dark', panel: 'dark' },
  { theme: 'light', panel: 'light' },
  { theme: 'dark', panel: 'light' },
];

test('the graded Test me line, its tick and the marked options pass AA (4.5:1) on paper and ink, under either app theme', () => {
  for (const look of LOOKS) {
    const checks: Array<[string, string]> = [
      ['result line (correct)', painted(look, ['.verdict', '.verdict.ok', '.card .verdict', '.card .verdict.ok'])],
      ['result line (missed)', painted(look, ['.verdict', '.verdict.no', '.card .verdict', '.card .verdict.no'])],
      ['result tick', painted(look, ['.verdict.ok::before', '.card .verdict.ok::before'])],
      ['correct option text', painted(look, ['.opt', '.card .opt', '.opt.right', '.card .opt.right'])],
      ['chosen wrong option text', painted(look, ['.opt', '.card .opt', '.opt.wrong', '.card .opt.wrong'])],
      ['option tag', painted(look, ['.card .opt__tag'])],
      ['rationale', painted(look, ['.quiz__why', '.card .quiz__why'])],
    ];
    // The Test me rail and its options sit on the panel background and the raised option surface.
    for (const bg of [token(look, '--p-bg'), token(look, '--p-surface')]) {
      for (const [what, fg] of checks) {
        const ratio = contrast(fg, bg);
        assert.ok(ratio >= 4.5, `${what} is ${ratio.toFixed(2)}:1 (${fg} on ${bg}) for ${JSON.stringify(look)}`);
      }
    }
  }
});

test('the panel hint and success tokens read on the panel look, whichever app theme is set', () => {
  for (const look of LOOKS) {
    for (const name of ['--test', '--diff', '--ask', '--fill-strong']) {
      const ratio = contrast(token(look, name), token(look, '--p-bg'));
      assert.ok(ratio >= 4.5, `${name} is ${ratio.toFixed(2)}:1 for ${JSON.stringify(look)}`);
    }
  }
});

test('a consent Continue that cannot be pressed yet is dimmed to 40% with no key shadow on paper and on ink', () => {
  for (const look of LOOKS) {
    const targets = ['.consent-form__actions [aria-disabled=\'true\']', '.card .consent-form__actions .btn[aria-disabled="true"]'];
    const opacity = Number(painted(look, targets, 'opacity'));
    assert.ok(opacity <= 0.4, `opacity ${opacity} for ${JSON.stringify(look)}`);
    assert.equal(painted(look, targets, 'box-shadow'), 'none');
  }
});
