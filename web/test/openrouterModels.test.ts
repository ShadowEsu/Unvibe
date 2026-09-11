import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_OPENROUTER_MODEL,
  listFreeChatModels,
  normalizeOpenRouterModel,
} from '../src/ai/openrouterModels';

test('default OpenRouter model is the cheapest free chat model', () => {
  assert.equal(DEFAULT_OPENROUTER_MODEL, 'liquid/lfm-2.5-2.6b:free');
  assert.equal(normalizeOpenRouterModel('auto'), DEFAULT_OPENROUTER_MODEL);
  assert.equal(normalizeOpenRouterModel('paid/not-allowed'), DEFAULT_OPENROUTER_MODEL);
  assert.equal(normalizeOpenRouterModel('cohere/north-mini-code:free'), 'cohere/north-mini-code:free');
});

test('free chat catalog excludes non-chat utilities', () => {
  const ids = listFreeChatModels().map((m) => m.id);
  assert.ok(ids.includes('liquid/lfm-2.5-2.6b:free'));
  assert.ok(ids.includes('cohere/north-mini-code:free'));
  assert.equal(ids.some((id) => id.includes('embed')), false);
  assert.equal(ids.some((id) => id.includes('tts')), false);
  assert.equal(listFreeChatModels()[0]?.id, DEFAULT_OPENROUTER_MODEL);
});
