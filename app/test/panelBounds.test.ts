import test from 'node:test';
import assert from 'node:assert/strict';
import { PANEL_MAX_H, PANEL_MIN_H, PANEL_W, fitPanelBounds, panelHeightFor } from '../src/main/windows';

const inside = (b: { x: number; y: number; width: number; height: number }, wa: { x: number; y: number; width: number; height: number }) =>
  b.x >= wa.x + 12 && b.y >= wa.y + 12 && b.x + b.width <= wa.x + wa.width - 12 && b.y + b.height <= wa.y + wa.height - 12;
const overlaps = (a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

test('overlay B is 380 wide and its height fits the content between 360 and 560', () => {
  assert.equal(PANEL_W, 380);
  assert.equal(panelHeightFor(120), PANEL_MIN_H);
  assert.equal(panelHeightFor(431.4), 431);
  assert.equal(panelHeightFor(2000), PANEL_MAX_H, 'past 560 the answer scrolls inside instead');
  assert.equal(panelHeightFor(Number.NaN), PANEL_MIN_H);
});

test('on a 1366×768 laptop the tallest panel fits, 12 px from every edge', () => {
  const workArea = { x: 0, y: 25, width: 1366, height: 743 };
  const fitted = fitPanelBounds({ x: 900, y: 10, width: PANEL_W, height: PANEL_MAX_H }, workArea);
  assert.equal(fitted.width, PANEL_W);
  assert.equal(fitted.height, PANEL_MAX_H);
  assert.ok(inside(fitted, workArea), JSON.stringify(fitted));
});

test('on a 1024×768 screen the panel starts below the top Island instead of under it, and still fits', () => {
  const workArea = { x: 0, y: 25, width: 1024, height: 743 };
  const island = { x: 420, y: 37, width: 184, height: 38 };
  const fitted = fitPanelBounds({ x: 560, y: 0, width: PANEL_W, height: PANEL_MAX_H }, workArea, island);
  assert.equal(overlaps(fitted, island), false, JSON.stringify(fitted));
  assert.equal(fitted.y, island.y + island.height + 8);
  assert.ok(inside(fitted, workArea), JSON.stringify(fitted));
  assert.equal(fitted.height, PANEL_MAX_H);
});

test('a panel beside the Island keeps its place', () => {
  const workArea = { x: 0, y: 25, width: 1920, height: 1055 };
  const island = { x: 868, y: 37, width: 184, height: 38 };
  const beside = { x: 1400, y: 60, width: PANEL_W, height: 480 };
  assert.deepEqual(fitPanelBounds(beside, workArea, island), beside);
});

test('a panel on a monitor above the Island\'s screen stays on that monitor at its size', () => {
  const above = { x: 0, y: -1080, width: 1920, height: 1055 };
  const island = { x: 868, y: 37, width: 184, height: 38 };
  const panel = { x: 800, y: -900, width: PANEL_W, height: 480 };
  assert.deepEqual(fitPanelBounds(panel, above, island), panel);
});

test('a screen too short to fit the panel below the Island keeps it inside the work area rather than squeezing it', () => {
  const workArea = { x: 0, y: 25, width: 1024, height: 420 };
  const island = { x: 420, y: 37, width: 184, height: 38 };
  const fitted = fitPanelBounds({ x: 500, y: 0, width: PANEL_W, height: PANEL_MAX_H }, workArea, island);
  assert.equal(fitted.height, 396);
  assert.ok(inside(fitted, workArea), JSON.stringify(fitted));
});
