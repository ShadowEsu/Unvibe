import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import type { KnowledgeObject } from '../src/core/knowledge';
import { Home, homeRows, homeVibeMood, learningSteps, lessonSource, type HomeLesson, type HomeProps } from '../src/renderer/companion/home';
import { NAV_PINNED, NAV_SPACES, pageLabel } from '../src/renderer/companion/nav';

const noop = () => undefined;
const props: HomeProps = {
  shortcutKeys: ['Ctrl', 'Alt', 'U'], shortcut: 'Ctrl+Alt+U', userName: 'Sam Lee', reviews: 3, understood: 0,
  stats: { reviews: 3, linesReviewed: 0, linesUnderstood: 0, concepts: 0 },
  today: { explained: true, answered: false }, history: [],
  usage: { used: 8, limit: 50, remaining: 42, resetsAt: '2026-12-01T00:00:00Z', plan: 'trial' },
  onPlan: noop, onLibrary: noop, onBriefs: noop, onQuiz: noop, onAsk: noop,
};
const home = (over: Partial<HomeProps> = {}) => renderToStaticMarkup(createElement(Home, { ...props, ...over }));
const lesson = (id: string, over: Partial<HomeLesson> = {}): HomeLesson => ({ id, ts: '2026-11-01T10:00:00Z', title: `Lesson ${id}`, meta: 'Unvibe · Understood', outcome: 'understood', ...over });
const known = (id: string, freshnessStatus: KnowledgeObject['freshnessStatus']) =>
  ({ id, title: `Known ${id}`, sourceType: 'explanation', updatedAt: '2026-11-01T10:00:00Z', freshnessStatus, file: `src/${id}.js` }) as KnowledgeObject;

test('Home has one action: the explain card with the shortcut as separate keys', () => {
  const html = home();
  assert.equal(html.match(/class="home-card home-cta"/g)?.length, 1);
  assert.ok(!html.includes('primary-btn'));
  assert.deepEqual([...html.matchAll(/<kbd>(.*?)<\/kbd>/g)].map((m) => m[1]), ['Ctrl', 'Alt', 'U']);
});

test('at the limit, the banner takes the card\'s place and its action is the one primary', () => {
  const html = home({ usage: { ...props.usage!, used: 50, remaining: 0 } });
  assert.ok(!html.includes('home-cta'));
  assert.match(html, /class="[^"]*\blimit-banner\b[^"]*"/);
  assert.equal(html.match(/class="primary-btn"/g)?.length, 1);
});

test('Up next lists the first three learning steps not done yet, with how many are done', () => {
  const html = home({ reviews: 3, understood: 0, history: [] });
  const titles = [...html.matchAll(/class="home-step".*?class="home-row__title">(.*?)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(titles, ['Save the lesson', 'Take a quick quiz', 'Ask one more thing']);
  // The done count is a count-up: the digits are aria-hidden and the final value is read from an sr-only span.
  assert.match(html, /<span class="sr-only">1<\/span><\/span> of 5 done/);
});

test('learning steps: explained, understood and a saved lesson mark their steps done; quiz and ask never are', () => {
  const none = learningSteps({ shortcut: '⌃U', reviews: 0, understood: 0, saved: 0 });
  assert.deepEqual(none.filter((s) => s.done).map((s) => s.id), []);
  assert.equal(none[0]!.copy, 'Select code and press ⌃U.');
  const all = learningSteps({ shortcut: '⌃U', reviews: 2, understood: 1, saved: 1 });
  assert.deepEqual(all.filter((s) => !s.done).map((s) => s.title), ['Take a quick quiz', 'Ask one more thing']);
});

test('the stat stickers count what was done: no zeros, one or many, and no voice card', () => {
  const html = home({ history: [lesson('a')], stats: { reviews: 1, linesReviewed: 1397, linesUnderstood: 0, concepts: 3 } });
  const stickers = [...html.matchAll(/class="home-stat" data-stat="(\w+)"><b>(\d+)<\/b> (.*?)<\/li>/g)].map((m) => `${m[1]}:${m[2]} ${m[3]}`);
  assert.deepEqual(stickers, ['reviews:1 explanation', 'lines:1397 lines explained', 'concepts:3 concepts']);
  assert.ok(!home({ stats: { reviews: 0, linesReviewed: 0, linesUnderstood: 0, concepts: 0 } }).includes('home-stats'));
  for (const gone of ['Try voice', 'voice-cta']) assert.ok(!html.includes(gone), gone);
});

test('the goal line shows each step done or not', () => {
  const html = home();
  assert.match(html, /aria-label="Done"[^>]*>(?:<[^>]+>)?✓(?:<\/span>)?<\/span> explain 1 piece of code/);
  assert.match(html, /aria-label="Not done yet"[^>]*><\/span> answer 1 question/);
});

test('the sidebar keeps Today and Ask Vibe, then Library, Quiz, Briefs, Momentum, Plan and Share under Learn', () => {
  const labels = (pages: typeof NAV_SPACES) => pages.map((p) => pageLabel(p.id));
  assert.deepEqual(labels(NAV_PINNED), ['Today', 'Ask Vibe']);
  assert.deepEqual(labels(NAV_SPACES), ['Library', 'Quiz', 'Briefs', 'Momentum', 'Plan', 'Share']);
});

test('Vibe waves the first time Home opens on a day, is still after that, and sleeps at the limit', () => {
  assert.equal(homeVibeMood(null, '2026-11-06', false), 'wave');
  assert.equal(homeVibeMood('2026-11-05', '2026-11-06', false), 'wave');
  assert.equal(homeVibeMood('2026-11-06', '2026-11-06', false), 'idle');
  assert.equal(homeVibeMood('2026-11-05', '2026-11-06', true), 'sleepy');
});

test('rows: five at most, one of them may need a look again, none before anything is understood', () => {
  const history = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => lesson(id));
  assert.deepEqual(homeRows([], history).map((row) => row.id), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(homeRows([known('k1', 'CURRENT'), known('k2', 'CURRENT'), known('k3', 'CURRENT'), known('k4', 'CURRENT'), known('k5', 'CURRENT'), known('s1', 'MAY_BE_STALE'), known('s2', 'STALE')], history)
    .map((row) => `${row.id}:${row.tone}:${row.pill}`).slice(4), ['s1:review:Review']);
  assert.deepEqual(homeRows([known('s1', 'MAY_BE_STALE')], [lesson('n', { outcome: 'needs_review' })]), []);
});

test('a row says where the lesson came from: project and file name', () => {
  assert.equal(lessonSource({ project: 'sample-app', file: 'src/lib/debounce.js', meta: 'x' }), 'sample-app · debounce.js');
  assert.equal(lessonSource({ file: 'C:\\work\\totals.js', meta: 'x' }), 'totals.js');
  assert.equal(lessonSource({ meta: 'Unvibe · Understood' }), 'Unvibe · Understood');
});
