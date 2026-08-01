import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { costOverview, estimateCost, normalizeLocalAiProvider } from '../src/main/localAi';

describe('localAi cost estimates', () => {
  it('gemini estimates stay far below a cent for small selections', () => {
    const e = estimateCost('gemini', 'intermediate', 50);
    assert.ok(e.usd < 0.01);
    assert.equal(e.provider, 'gemini');
  });

  it('anthropic costs more than gemini at the same size', () => {
    const g = estimateCost('gemini', 'advanced', 200);
    const a = estimateCost('anthropic', 'advanced', 200);
    assert.ok(a.usd > g.usd);
  });

  it('legacy gemini model ids map to the gemini provider', () => {
    assert.equal(normalizeLocalAiProvider('gemini-2.5-flash-lite'), 'gemini');
    assert.equal(normalizeLocalAiProvider('openai'), 'openai');
  });

  it('overview covers modes and line buckets', () => {
    const rows = costOverview('gemini');
    assert.equal(rows.length, 4);
    assert.deepEqual(rows[0]!.samples.map((s) => s.lines), [50, 200, 500]);
  });
});
