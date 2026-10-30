import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, type ReactElement } from 'react';
import { BriefsProCard, briefsAiLabel } from '../src/renderer/companion/briefsPro';

test('Free, trial and local plans see "· Pro" on the Briefs AI buttons; Pro plans and a loading plan do not', () => {
  for (const plan of ['trial', 'free', 'local']) {
    assert.equal(briefsAiLabel('Understand Change', plan), 'Understand Change · Pro', plan);
    assert.equal(briefsAiLabel('Explain the change', plan), 'Explain the change · Pro', plan);
  }
  for (const plan of ['pro', 'teams', 'full']) assert.equal(briefsAiLabel('Understand Change', plan), 'Understand Change', plan);
  assert.equal(briefsAiLabel('Understand Change', null), 'Understand Change', 'no label is guessed before the plan loads');
});

/** Every call the card could make through the preload bridge, recorded. */
function recordBridge(): string[] {
  const calls: string[] = [];
  const unvibe = new Proxy({}, { get: (_target, name) => () => { calls.push(String(name)); return Promise.resolve({}); } });
  (globalThis as { window?: unknown }).window = { unvibe };
  return calls;
}

/** The card's one button, as rendered, so its click can run without a DOM. */
function cardButton(card: ReactElement): { label: string; click: () => void } {
  const section = card.type === BriefsProCard ? (BriefsProCard(card.props as Parameters<typeof BriefsProCard>[0]) as ReactElement) : card;
  const children = (section.props as { children: ReactElement[] }).children;
  const button = children.find((child) => child?.type === 'button') as ReactElement<{ children: string; onClick: () => void }>;
  return { label: button.props.children, click: button.props.onClick };
}

test('while sales are closed the card says "Pro opens soon", and its button only opens Plan: no checkout or other call', () => {
  const calls = recordBridge();
  let planOpened = 0;
  const card = createElement(BriefsProCard, { proOpen: false, onPlan: () => { planOpened += 1; } });
  const html = renderToStaticMarkup(card);
  assert.match(html, /Explaining a change is part of Pro/);
  assert.match(html, /The brief stays free/);
  assert.match(html, />Pro opens soon</);
  assert.doesNotMatch(html, /Buy|\$|checkout|Stripe/i);
  const button = cardButton(card);
  assert.equal(button.label, 'Pro opens soon');
  button.click();
  assert.equal(planOpened, 1);
  assert.deepEqual(calls, [], 'no checkout, billing or AI call from the card');
});

test('once sales open, the same button names buying and still goes through Plan', () => {
  const calls = recordBridge();
  let planOpened = 0;
  const button = cardButton(createElement(BriefsProCard, { proOpen: true, onPlan: () => { planOpened += 1; } }));
  assert.equal(button.label, 'Buy a subscription');
  button.click();
  assert.deepEqual([planOpened, calls], [1, []]);
});
