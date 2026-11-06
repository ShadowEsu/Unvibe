import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Buddy, type BuddyMood } from '../src/renderer/shared/buddy';
import { VibeBubble } from '../src/renderer/shared/vibeBubble';

const MOODS: BuddyMood[] = ['idle', 'thinking', 'reading', 'happy', 'celebrate', 'confused', 'sleepy', 'wave'];

test('every mood keeps its existing art: arc eyes when glad, eyes with pupils otherwise', () => {
  for (const mood of MOODS) {
    const html = renderToStaticMarkup(createElement(Buddy, { mood }));
    assert.match(html, new RegExp(`class="buddy buddy--${mood}"`), mood);
    const glad = mood === 'happy' || mood === 'celebrate' || mood === 'wave';
    assert.equal(html.includes('buddy__eyes--happy'), glad, `${mood}: arc eyes`);
    assert.equal(html.includes('buddy__pupil'), !glad, `${mood}: pupils`);
  }
});

test('Vibe does not react when it first appears, only when something happens later', () => {
  const html = renderToStaticMarkup(createElement(Buddy, { mood: 'happy', react: 1, listen: true }));
  assert.doesNotMatch(html, /buddy--react/);
});

test("Vibe's bubble is signed with its name and is announced only when live", () => {
  const live = renderToStaticMarkup(createElement(VibeBubble, null, 'Nice, that\'s it.'));
  assert.equal(live, '<p class="vibe-bubble" role="status"><span class="vibe-bubble__name">Vibe</span>Nice, that&#x27;s it.</p>');
  const quiet = renderToStaticMarkup(createElement(VibeBubble, { large: true, live: false, children: "Hey! I'm Vibe. I explain your AI's code." }));
  assert.match(quiet, /^<p class="vibe-bubble vibe-bubble--large"><span class="vibe-bubble__name">Vibe<\/span>/);
  assert.doesNotMatch(quiet, /role=/);
});
