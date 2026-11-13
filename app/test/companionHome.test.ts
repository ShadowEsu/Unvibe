import test from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { Home, codePreview, homeVibeMood, learningSteps, lessonSource, recentLessons, stripDays, type HomeLesson, type HomeProps } from '../src/renderer/companion/home';
import { NAV_FOOT, NAV_PINNED, NAV_SPACES, pageLabel } from '../src/renderer/companion/nav';

const noop = () => undefined;
const props: HomeProps = {
  shortcutKeys: ['Ctrl', 'Alt', 'U'], shortcut: 'Ctrl+Alt+U', userName: 'Sam Lee', reviews: 3, understood: 0,
  stats: { reviews: 3, linesReviewed: 0, linesUnderstood: 0 },
  history: [],
  usage: { used: 8, limit: 50, remaining: 42, resetsAt: '2026-12-01T00:00:00Z', plan: 'trial' },
  onPlan: noop, onLibrary: noop, onBriefs: noop, onQuiz: noop, onAsk: noop,
};
const home = (over: Partial<HomeProps> = {}) => renderToStaticMarkup(createElement(Home, { ...props, ...over }));
const lesson = (id: string, over: Partial<HomeLesson> = {}): HomeLesson => ({ id, ts: '2026-11-01T10:00:00Z', title: `Lesson ${id}`, meta: 'Unvibe · Understood', outcome: 'understood', ...over });

test('Explain is one box with the shortcut as separate keys, and three steps', () => {
  const html = home();
  assert.equal(html.match(/class="m-box today-explain"/g)?.length, 1);
  assert.deepEqual([...html.matchAll(/<kbd>(.*?)<\/kbd>/g)].map((m) => m[1]), ['Ctrl', 'Alt', 'U']);
  assert.deepEqual([...html.matchAll(/class="today-step__label">(.*?)<\/span>/g)].map((m) => m[1]), ['Select code', 'Press the keys', 'Vibe explains']);
});

test('at the limit, the banner takes the Explain box\'s place and its action is the one filled button', () => {
  const html = home({ usage: { ...props.usage!, used: 50, remaining: 0 } });
  assert.ok(!html.includes('today-explain'));
  assert.match(html, /class="[^"]*\blimit-banner\b[^"]*"/);
  assert.equal(html.match(/m-btn--filled/g)?.length, 1);
});

test('Up next lists the first three learning steps not done yet, with how many are done', () => {
  const html = home({ reviews: 3, understood: 0, history: [] });
  const titles = [...html.matchAll(/class="m-row today-next__row".*?class="m-row__title">(.*?)<\/span>/g)].map((m) => m[1]);
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

test('four number tiles: understood with its lines, explanations saved, to revisit, explanations left', () => {
  const html = home({ stats: { reviews: 5, linesReviewed: 22, linesUnderstood: 18 } });
  const labels = [...html.matchAll(/class="m-tile__label">(.*?)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(labels, ['Understood', 'Explanations saved', 'To revisit', 'Explanations left']);
  assert.match(html, /<span class="sr-only">82<\/span><\/span>%/);
  assert.ok(html.includes('18 of 22 lines'));
  assert.ok(html.includes('Free on this computer'));
});

test('with no saved brief, the Brief box shows its empty state and nothing is filled', () => {
  const html = home();
  assert.ok(html.includes('No brief yet.'));
  assert.ok(!html.includes('m-btn--filled'));
});

test('the rail keeps Today and Ask Vibe, then Library, Quiz, Briefs, Momentum under Learn; Share and Plan sit at its foot', () => {
  const labels = (pages: typeof NAV_SPACES) => pages.map((p) => pageLabel(p.id));
  assert.deepEqual(labels(NAV_PINNED), ['Today', 'Ask Vibe']);
  assert.deepEqual(labels(NAV_SPACES), ['Library', 'Quiz', 'Briefs', 'Momentum']);
  assert.deepEqual(labels(NAV_FOOT), ['Share', 'Plan']);
});

test('Vibe waves the first time Home opens on a day, is still after that, and sleeps at the limit', () => {
  assert.equal(homeVibeMood(null, '2026-11-06', false), 'wave');
  assert.equal(homeVibeMood('2026-11-05', '2026-11-06', false), 'wave');
  assert.equal(homeVibeMood('2026-11-06', '2026-11-06', false), 'idle');
  assert.equal(homeVibeMood('2026-11-05', '2026-11-06', true), 'sleepy');
});

test('Recently understood: four lessons not marked to revisit, each with the first four lines of its code', () => {
  const history = ['a', 'b', 'c', 'd', 'e'].map((id) => lesson(id));
  assert.deepEqual(recentLessons([lesson('n', { outcome: 'needs_review' }), ...history]).map((row) => row.id), ['a', 'b', 'c', 'd']);
  assert.equal(codePreview('\n\nconst a = 1;  \r\nb();\nc();\nd();\ne();'), 'const a = 1;\nb();\nc();\nd();');
  assert.equal(codePreview(undefined), '');
});

test('the 14-day strip is the last 14 days of the heat, padded at the start', () => {
  assert.deepEqual(stripDays([1, 2]), [...Array(12).fill(0), 1, 2]);
  assert.deepEqual(stripDays(Array.from({ length: 20 }, (_, i) => i % 6)), Array.from({ length: 20 }, (_, i) => i % 6).slice(-14));
});

test('a row says where the lesson came from: project and file name', () => {
  assert.equal(lessonSource({ project: 'sample-app', file: 'src/lib/debounce.js', meta: 'x' }), 'sample-app · debounce.js');
  assert.equal(lessonSource({ file: 'C:\\work\\totals.js', meta: 'x' }), 'totals.js');
  assert.equal(lessonSource({ meta: 'Unvibe · Understood' }), 'Unvibe · Understood');
});
