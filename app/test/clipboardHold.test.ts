import assert from 'node:assert/strict';
import test from 'node:test';
import { clipboardHolder, type TextClipboard } from '../src/core/clipboardHold';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeClipboard(text: string): TextClipboard & { text: string } {
  return {
    text,
    readText() { return this.text; },
    writeText(next: string) { this.text = next; },
  };
}

// What a synthetic copy does inside the hold: empty the clipboard, wait for an editor that never copies.
const emptyCopy = (clip: TextClipboard, ms: number) => async () => {
  clip.writeText('');
  await tick(ms);
  return clip.readText();
};

test('two presses whose copies overlap leave the person\'s clipboard as it was (SHOULD-366d)', async () => {
  const clip = fakeClipboard('my own text');
  const hold = clipboardHolder(clip);
  // The second press comes while the first copy still waits (the Windows empty copy takes about 5 s), and its copy
  // ends last: unserialized, it would put back the empty clipboard it saved.
  const first = hold(emptyCopy(clip, 20));
  await tick(5);
  const second = hold(emptyCopy(clip, 40));
  assert.deepEqual(await Promise.all([first, second]), ['', '']);
  assert.equal(clip.text, 'my own text');
});

test('the second copy starts only after the first has put the clipboard back', async () => {
  const clip = fakeClipboard('my own text');
  const hold = clipboardHolder(clip);
  const seen: string[] = [];
  const first = hold(emptyCopy(clip, 20));
  const second = hold(async () => {
    seen.push(clip.readText());
    return '';
  });
  await Promise.all([first, second]);
  assert.deepEqual(seen, ['my own text']);
});

test('a copy that throws still puts the clipboard back, and the next one runs', async () => {
  const clip = fakeClipboard('my own text');
  const hold = clipboardHolder(clip);
  const failing = hold(async () => {
    clip.writeText('');
    throw new Error('System Events said no');
  });
  await assert.rejects(failing, /System Events said no/);
  assert.equal(clip.text, 'my own text');
  assert.equal(await hold(async () => 'copied'), 'copied');
  assert.equal(clip.text, 'my own text');
});
