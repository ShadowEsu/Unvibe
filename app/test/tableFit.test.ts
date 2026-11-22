import test from 'node:test';
import assert from 'node:assert/strict';
import { tableFitLine } from '../src/core/tableFit';

test('a table report logs as sizes only, and anything else a renderer sends logs nothing', () => {
  assert.equal(tableFitLine({ columns: 3, scrollWidth: 319, clientWidth: 278 }), '[table] 3 columns: 319 of 278 px (overflows by 41 px)');
  assert.equal(tableFitLine({ columns: 3, scrollWidth: 279, clientWidth: 278 }), '[table] 3 columns: 279 of 278 px (fits)');
  for (const junk of [null, 'x', [], { columns: 3, scrollWidth: 319 }, { columns: 3, scrollWidth: '319', clientWidth: 278 },
    { columns: 2.5, scrollWidth: 1, clientWidth: 1 }, { columns: 3, scrollWidth: -1, clientWidth: 278 }, { columns: 3, scrollWidth: 1e9, clientWidth: 1 },
    { columns: 3, scrollWidth: Number.NaN, clientWidth: 278 }, { columns: 3, scrollWidth: Number.POSITIVE_INFINITY, clientWidth: 278 }]) {
    assert.equal(tableFitLine(junk), null, JSON.stringify(junk));
  }
});
