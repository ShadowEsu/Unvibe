import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Buddy, type BuddyMood } from '../src/renderer/shared/buddy';

const MOODS: BuddyMood[] = ['idle', 'thinking', 'reading', 'happy', 'celebrate', 'confused', 'sleepy', 'wave'];

test('every mood draws both eye sets, so a mood change can cross-fade them (buddy.css picks which shows)', () => {
  for (const mood of MOODS) {
    const html = renderToStaticMarkup(createElement(Buddy, { mood }));
    assert.match(html, new RegExp(`class="buddy buddy--${mood}"`), mood);
    assert.ok(html.includes('buddy__eyes--happy') && html.includes('buddy__eyes--open'), `${mood}: both eye sets`);
    assert.equal(html.match(/buddy__pupil/g)?.length, 2, `${mood}: pupils`);
  }
});

test('Vibe does not react when it first appears, only when something happens later', () => {
  const html = renderToStaticMarkup(createElement(Buddy, { mood: 'happy', react: 1, listen: true }));
  assert.doesNotMatch(html, /buddy--react/);
});
