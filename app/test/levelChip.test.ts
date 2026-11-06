import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { LevelChip, levelItems } from '../src/renderer/widget/levelChip';
import { MenuList } from '../src/renderer/widget/panelMenu';
import type { ExplanationLevel } from '../src/core/protocol';

const noop = () => undefined;
const menu = (level: ExplanationLevel, plan?: string) =>
  renderToStaticMarkup(createElement(MenuList, { id: 'd', label: 'Explanation depth', align: 'start', onPick: noop, items: levelItems(level, plan, noop) }));

test('the depth menu renders five radio items in order, ticks only the current one, keeps data-level, and opens from the chip\'s left edge', () => {
  const html = menu('intermediate', 'pro');
  assert.match(html, /^<div class="pm-menu pm-menu--start"[^>]*role="menu" aria-label="Explanation depth"/);
  const items = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
  assert.equal(items.length, 5);
  assert.deepEqual(items.map((b) => /data-level="(\w+)"/.exec(b)?.[1]), ['new', 'beginner', 'intermediate', 'advanced', 'expert']);
  assert.ok(items.every((b) => b.includes('role="menuitemradio"')));
  assert.deepEqual(items.map((b) => /aria-checked="(\w+)"/.exec(b)?.[1]), ['false', 'false', 'true', 'false', 'false']);
  assert.ok(!html.includes('aria-disabled'), 'nothing is locked on Pro');
});

test('Expert shows a hidden lock and "Pro" and opens nothing unless the plan includes it', () => {
  for (const plan of [undefined, 'free', 'trial']) {
    const html = menu('beginner', plan);
    const expert = /<button[^>]*data-level="expert"[^>]*>.*?<\/button>/.exec(html)?.[0] ?? '';
    assert.match(expert, /aria-disabled="true"/, String(plan));
    assert.match(expert, /<svg class="pm-menu__lock"[^>]*aria-hidden="true"/);
    assert.match(expert, /<span class="pm-menu__tag">Pro<\/span>/);
    assert.equal((html.match(/aria-disabled/g) ?? []).length, 1, 'only Expert is locked');
  }
  for (const plan of ['pro', 'teams', 'full']) assert.ok(!menu('beginner', plan).includes('pm-menu__lock'), plan);
});

test('the chip names the depth it shows, and choosing a depth hands it to the panel', () => {
  const chip = renderToStaticMarkup(createElement(LevelChip, { level: 'advanced', plan: 'free', disabled: false, onPick: noop }));
  assert.match(chip, /<button[^>]*class="depth-chip"[^>]*aria-label="Depth: Advanced"[^>]*aria-haspopup="menu"/);
  assert.match(chip, />Advanced<small aria-hidden="true">▾<\/small><\/button>/);
  const picked: ExplanationLevel[] = [];
  levelItems('new', 'free', (id) => picked.push(id)).find((i) => i.id === 'advanced')!.onSelect();
  assert.deepEqual(picked, ['advanced']);
});
