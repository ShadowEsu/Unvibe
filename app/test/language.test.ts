import assert from 'node:assert/strict';
import test from 'node:test';
import { detectLanguage, guessLanguage } from '../src/core/language';

test('language detection trusts file metadata over an ambiguous snippet', () => {
  const code = 'const std::string label = "ready";';
  assert.deepEqual(detectLanguage(code, '/workspace/src/status.cpp'), {
    language: 'cpp',
    source: 'file-path',
  });
});

test('language detection covers common native and script extensions', () => {
  assert.equal(detectLanguage('', 'main.c').language, 'c');
  assert.equal(detectLanguage('', 'main.hpp').language, 'cpp');
  assert.equal(detectLanguage('', 'src/app.tsx').language, 'typescriptreact');
  assert.equal(detectLanguage('', 'scripts/release.sh').language, 'shell');
  assert.equal(detectLanguage('', 'database/query.sql').language, 'sql');
});

test('content fallback uses unknown instead of a confident false label', () => {
  assert.equal(guessLanguage('just a fragment without syntax'), 'unknown');
  assert.deepEqual(detectLanguage('just a fragment without syntax'), {
    language: 'unknown',
    source: 'unknown',
  });
});

// Reconstructed from a user report (v0.1.11): C++ written with `using namespace std`
// has no `std::` or `#include`, and used to fall through to the JavaScript rule.
const reportedCppSnippet = [
  'private:',
  '  static constexpr int kMin = -5000;',
  '  int maxProduct(const vector<int>& nums, int i, int product, State state, int k, int limit, unordered_map<string, int>& memo) {',
  '    if (i == nums.size())',
  '      return k == 0 && state != State::kFirst && product <= limit ? product : kMin;',
].join('\n');

test('content detection labels C++ from the user report as cpp', () => {
  assert.equal(guessLanguage(reportedCppSnippet), 'cpp');
  assert.deepEqual(detectLanguage(reportedCppSnippet), { language: 'cpp', source: 'content' });
});

test('content detection labels C++ without std:: or #include as cpp', () => {
  const snippets = [
    'vector<int> v;\nv.push_back(3);',
    'class Counter {\npublic:\n  int value;\n  void bump() { value++; }\n};',
    'template<typename T>\nT largest(T a, T b) { return a > b ? a : b; }',
    'int total(const string& label, int count) {\n  return count;\n}',
    'using namespace std;\nint main() { cout << "hi"; }',
    'constexpr int kLimit = 10;',
    'Node* head = nullptr;',
  ];
  for (const code of snippets) assert.equal(guessLanguage(code), 'cpp', code);
});

test('widened cpp detection keeps the labels of non-C++ snippets', () => {
  const controls: Array<[string, string]> = [
    ['const add = (a, b) => a + b;', 'javascript'],
    ['const flags = mask & bit;', 'javascript'],
    ['const options = {\n  private: true,\n};', 'javascript'],
    ['const m = new Map<string, number>();', 'typescript'],
    ['function f<T>(x: T): T { return x; }', 'typescript'],
    ['interface Point { x: number; y: number }', 'typescript'],
    ['public class A { private int x; }', 'unknown'],
    ['List<Integer> xs = new ArrayList<>();', 'unknown'],
    ['public class Greeter {\n  private string name;\n  public void Hello() { Console.WriteLine(name); }\n}', 'unknown'],
    ['fn main() { let mut total = 5; }', 'rust'],
    ['impl<T> Stack<T> { fn push(&mut self, item: T) {} }', 'rust'],
    ['def area(r):\n    return 3.14 * r * r', 'python'],
  ];
  for (const [code, expected] of controls) assert.equal(guessLanguage(code), expected, code);
});

// Marketing's report (6 Nov, film 4 on 0.1.49): this pasted TypeScript, with a generic, `: unknown` and a
// Promise<T> return type but no interface or string/number/boolean annotation, was labelled javascript.
const reportedTypescriptSnippet = [
  'export async function withRetry<T>(',
  '  task: () => Promise<T>,',
  '  attempts = 3,',
  '  baseDelayMs = 500,',
  '): Promise<T> {',
  '  let lastError: unknown;',
  '  for (let i = 0; i < attempts; i++) {',
  '    try {',
  '      return await task();',
  '    } catch (err) {',
  '      lastError = err;',
  '      if (i < attempts - 1) await sleep(baseDelayMs * 2 ** i + Math.random() * 100);',
  '    }',
  '  }',
  '  throw lastError;',
  '}',
].join('\n');

test('content detection labels the reported pasted TypeScript as typescript', () => {
  assert.deepEqual(detectLanguage(reportedTypescriptSnippet), { language: 'typescript', source: 'content' });
});

test('each TypeScript-only signal is enough on its own, and plain JavaScript stays javascript', () => {
  const typescript = [
    'let lastError: unknown;',
    'const run = (): void => {};',
    'async function load<T>(url) { return fetch(url); }',
    'const get = async (id): Promise<User> => db.find(id);',
    'let cache = new Map<string, User>();',
  ];
  for (const code of typescript) assert.equal(guessLanguage(code), 'typescript', code);
  const javascript = [
    'const el = ok ? render() : Fallback;',
    'const task = { run: () => go(), label: "retry" };',
    'export async function withRetry(task, attempts = 3) {\n  return await task();\n}',
    'const list = items.filter((x) => x < limit && y > 2);',
    'function inRange(a, b) { return a < b && b > (a); }',
  ];
  for (const code of javascript) assert.equal(guessLanguage(code), 'javascript', code);
  // Other languages with type syntax keep their labels: Swift's capitalised types, C#'s `var` with type arguments.
  assert.equal(guessLanguage('let total: Int = 5'), 'unknown');
  assert.equal(guessLanguage('var xs = new List<int>();'), 'unknown');
});
