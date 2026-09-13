import test from 'node:test';
import assert from 'node:assert/strict';
import { guessLanguage } from '../src/core/language';

test('recognizes C++ class selections without includes or std namespace', () => {
  const selections = [
    'private:\n  static constexpr int kMin = -5000;',
    'int maxProduct(const vector<int>& nums, const int i) { return nums[i]; }',
    'enum class State { Positive, Negative };',
  ];
  for (const code of selections) assert.equal(guessLanguage(code), 'cpp', code);
});

test('preserves other language guesses and ambiguous text fallback', () => {
  const cases = [
    ['const result = values.map(value => value * 2);', 'javascript'],
    ['const vector = [1, 2];', 'javascript'],
    ['const value: number = 2;', 'typescript'],
    ['interface Vector<T> { value: T }', 'typescript'],
    ['def double(value):\n  return value * 2', 'python'],
    ['fn double(value: i32) -> i32 { value * 2 }', 'rust'],
    ['func double(value int) int { return value * 2 }', 'go'],
    ['return value;', 'plaintext'],
  ];
  for (const [code, language] of cases) assert.equal(guessLanguage(code), language, code);
});
