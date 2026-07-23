import test from 'node:test';
import assert from 'node:assert/strict';
import { applyWidgetResize, snapWidget, clampToVisibleArea, isStockOldBounds, resolveWidgetBounds } from '../src/main/windowGeometry';

test('applyWidgetResize expands to the east', () => {
  const start = { x: 100, y: 200, width: 300, height: 400 };
  const result = applyWidgetResize(start, 'e', 50, 0);
  assert.equal(result.x, 100);
  assert.equal(result.y, 200);
  assert.equal(result.width, 350);
  assert.equal(result.height, 400);
});

test('applyWidgetResize expands to the south', () => {
  const start = { x: 100, y: 200, width: 300, height: 400 };
  const result = applyWidgetResize(start, 's', 0, 60);
  assert.equal(result.width, 300);
  assert.equal(result.height, 460);
  assert.equal(result.y, 200);
});

test('applyWidgetResize shrinks from the west', () => {
  const start = { x: 100, y: 200, width: 300, height: 400 };
  const result = applyWidgetResize(start, 'w', 40, 0);
  assert.equal(result.x, 120);
  assert.equal(result.width, 280);
});

test('applyWidgetResize shrinks from the north', () => {
  const start = { x: 100, y: 200, width: 300, height: 400 };
  const result = applyWidgetResize(start, 'n', 0, 30);
  assert.equal(result.y, 230);
  assert.equal(result.height, 370);
});

test('applyWidgetResize handles combined edge ne', () => {
  const start = { x: 100, y: 200, width: 300, height: 400 };
  const result = applyWidgetResize(start, 'ne', 20, -15);
  assert.equal(result.x, 100);
  assert.equal(result.y, 185);
  assert.equal(result.width, 320);
  assert.equal(result.height, 415);
});

test('applyWidgetResize handles combined edge sw', () => {
  const start = { x: 100, y: 200, width: 300, height: 400 };
  const result = applyWidgetResize(start, 'sw', -10, 25);
  assert.equal(result.x, 90);
  assert.equal(result.y, 200);
  assert.equal(result.width, 310);
  assert.equal(result.height, 425);
});

test('applyWidgetResize enforces minimum width', () => {
  const start = { x: 100, y: 200, width: 300, height: 400 };
  const result = applyWidgetResize(start, 'w', 500, 0);
  assert.equal(result.width, 280);
  assert.equal(result.x, 100 + (300 - 280));
});

test('applyWidgetResize enforces minimum height', () => {
  const start = { x: 100, y: 200, width: 300, height: 400 };
  const result = applyWidgetResize(start, 'n', 0, 500);
  assert.equal(result.height, 240);
  assert.equal(result.y, 200 + (400 - 240));
});

test('applyWidgetResize handles zero delta', () => {
  const start = { x: 100, y: 200, width: 300, height: 400 };
  const result = applyWidgetResize(start, 'se', 0, 0);
  assert.deepEqual(result, start);
});

test('applyWidgetResize handles all edges at once', () => {
  const start = { x: 100, y: 200, width: 300, height: 400 };
  const result = applyWidgetResize(start, 'se', 40, -20);
  assert.equal(result.width, 340);
  assert.equal(result.height, 380);
  assert.equal(result.x, 100);
  assert.equal(result.y, 200);
});

// --- snapWidget ---

test('snapWidget snaps x to display edge when close', () => {
  const display = { x: 0, y: 0, width: 1920, height: 1080 };
  const result = snapWidget({ x: 5, y: 100, width: 300, height: 400 }, display);
  assert.equal(result.x, 0);
  assert.equal(result.y, 100);
});

test('snapWidget snaps y to display edge when close', () => {
  const display = { x: 0, y: 0, width: 1920, height: 1080 };
  const result = snapWidget({ x: 100, y: 3, width: 300, height: 400 }, display);
  assert.equal(result.x, 100);
  assert.equal(result.y, 0);
});

test('snapWidget snaps right edge to display boundary', () => {
  const display = { x: 0, y: 0, width: 1920, height: 1080 };
  const result = snapWidget({ x: 1905, y: 100, width: 20, height: 400 }, display);
  assert.equal(result.x, 1900);
});

test('snapWidget snaps bottom edge to display boundary', () => {
  const display = { x: 0, y: 0, width: 1920, height: 1080 };
  const result = snapWidget({ x: 100, y: 1065, width: 300, height: 20 }, display);
  assert.equal(result.y, 1060);
});

test('snapWidget does not snap when far from edge', () => {
  const display = { x: 0, y: 0, width: 1920, height: 1080 };
  const result = snapWidget({ x: 100, y: 100, width: 300, height: 400 }, display);
  assert.equal(result.x, 100);
  assert.equal(result.y, 100);
});

// --- clampToVisibleArea ---

test('clampToVisibleArea keeps bounds within primary display', () => {
  const displays = [{ x: 0, y: 0, width: 1920, height: 1080 }];
  const result = clampToVisibleArea({ x: -100, y: 100, width: 300, height: 400 }, displays, displays[0]!);
  assert.equal(result.x, 12);
  assert.equal(result.y, 100);
});

test('clampToVisibleArea moves offscreen window onto visible area', () => {
  const displays = [{ x: 0, y: 0, width: 1920, height: 1080 }];
  const result = clampToVisibleArea({ x: 2000, y: 500, width: 300, height: 400 }, displays, displays[0]!);
  assert.equal(result.x, 1920 - 300 - 12);
  assert.equal(result.y, 500);
});

test('clampToVisibleArea reduces oversized window', () => {
  const displays = [{ x: 0, y: 0, width: 1920, height: 1080 }];
  const result = clampToVisibleArea({ x: 100, y: 100, width: 3000, height: 2000 }, displays, displays[0]!);
  assert.equal(result.width, 1920 - 24);
  assert.equal(result.height, 1080 - 24);
});

test('clampToVisibleArea finds matching secondary display', () => {
  const displays = [
    { x: 0, y: 0, width: 1920, height: 1080 },
    { x: 1920, y: 0, width: 2560, height: 1440 },
  ];
  const result = clampToVisibleArea({ x: 2000, y: 200, width: 400, height: 500 }, displays, displays[0]!);
  assert.ok(result.x >= 1920 + 12);
  assert.equal(result.y, 200);
});

// --- isStockOldBounds ---

test('isStockOldBounds identifies 440x560 as old stock', () => {
  assert.ok(isStockOldBounds({ width: 440, height: 560 }));
});

test('isStockOldBounds identifies 360x480 as old stock', () => {
  assert.ok(isStockOldBounds({ width: 360, height: 480 }));
});

test('isStockOldBounds identifies 340x440 as old stock', () => {
  assert.ok(isStockOldBounds({ width: 340, height: 440 }));
});

test('isStockOldBounds does not flag non-stock sizes', () => {
  assert.ok(!isStockOldBounds({ width: 300, height: 360 }));
  assert.ok(!isStockOldBounds({ width: 500, height: 500 }));
});

// --- resolveWidgetBounds ---

test('resolveWidgetBounds returns default for undefined saved', () => {
  const result = resolveWidgetBounds(undefined, { x: 500, y: 300 }, { x: 0, y: 0, width: 1920, height: 1080 });
  assert.equal(result.width, 300);
  assert.equal(result.height, 360);
  assert.ok(result.x >= 0);
  assert.ok(result.y >= 0);
});

test('resolveWidgetBounds keeps non-stock saved bounds', () => {
  const saved = { x: 400, y: 300, width: 350, height: 420 };
  const result = resolveWidgetBounds(saved, { x: 500, y: 300 }, { x: 0, y: 0, width: 1920, height: 1080 });
  assert.equal(result.width, 350);
  assert.equal(result.height, 420);
  assert.equal(result.x, 400);
  assert.equal(result.y, 300);
});

test('resolveWidgetBounds migrates stock old bounds to new defaults', () => {
  const saved = { x: 400, y: 300, width: 440, height: 560 };
  const result = resolveWidgetBounds(saved, { x: 500, y: 300 }, { x: 0, y: 0, width: 1920, height: 1080 });
  assert.equal(result.width, 300);
  assert.equal(result.height, 360);
  assert.equal(result.x, 400);
  assert.equal(result.y, 300);
});
