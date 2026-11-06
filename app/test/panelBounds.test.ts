import test from 'node:test';
import assert from 'node:assert/strict';
import { fitPanelBounds, isStockPanelSize } from '../src/main/windows';

const inside = (b: { x: number; y: number; width: number; height: number }, wa: { x: number; y: number; width: number; height: number }) =>
  b.x >= wa.x + 12 && b.y >= wa.y + 12 && b.x + b.width <= wa.x + wa.width - 12 && b.y + b.height <= wa.y + wa.height - 12;
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

test('a panel still at an old opening size (560×640 included) gets the new one; a size someone chose stays', () => {
  assert.equal(isStockPanelSize(560, 640), true);
  assert.equal(isStockPanelSize(440, 560), true);
  assert.equal(isStockPanelSize(600, 700), false);
  assert.equal(isStockPanelSize(440, 740), false, 'the new opening size is not reset again');
});

test('on a 1366×768 laptop the 440×740 panel is shortened to fit, 12 px from every edge', () => {
  const workArea = { x: 0, y: 25, width: 1366, height: 743 };
  const fitted = fitPanelBounds({ x: 900, y: 10, width: 440, height: 740 }, workArea);
  assert.equal(fitted.width, 440);
  assert.equal(fitted.height, 719);
  assert.ok(inside(fitted, workArea), JSON.stringify(fitted));
});

test('on a 1024×768 screen the panel starts below the top Island instead of under it, and still fits', () => {
  const workArea = { x: 0, y: 25, width: 1024, height: 743 };
  const island = { x: 420, y: 37, width: 184, height: 38 };
  const fitted = fitPanelBounds({ x: 560, y: 0, width: 440, height: 740 }, workArea, island);
  assert.equal(overlaps(fitted, island), false, JSON.stringify(fitted));
  assert.equal(fitted.y, island.y + island.height + 8);
  assert.ok(inside(fitted, workArea), JSON.stringify(fitted));
  assert.ok(fitted.height >= 460, 'never below the panel minimum on a 768 px screen');
});

test('a panel beside the Island keeps its place', () => {
  const workArea = { x: 0, y: 25, width: 1920, height: 1055 };
  const island = { x: 868, y: 37, width: 184, height: 38 };
  const beside = { x: 1400, y: 60, width: 440, height: 740 };
  assert.deepEqual(fitPanelBounds(beside, workArea, island), beside);
});

test('a panel on a monitor above the Island\'s screen stays on that monitor at its size', () => {
  const above = { x: 0, y: -1080, width: 1920, height: 1055 };
  const island = { x: 868, y: 37, width: 184, height: 38 };
  const panel = { x: 800, y: -900, width: 440, height: 740 };
  assert.deepEqual(fitPanelBounds(panel, above, island), panel);
});

test('a screen too short to fit the panel below the Island keeps it inside the work area rather than squeezing it', () => {
  const workArea = { x: 0, y: 25, width: 1024, height: 500 };
  const island = { x: 420, y: 37, width: 184, height: 38 };
  const fitted = fitPanelBounds({ x: 500, y: 0, width: 440, height: 740 }, workArea, island);
  assert.equal(fitted.height, 476);
  assert.ok(inside(fitted, workArea), JSON.stringify(fitted));
});
