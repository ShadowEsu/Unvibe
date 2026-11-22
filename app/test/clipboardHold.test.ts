import assert from 'node:assert/strict';
import test from 'node:test';
import { autoClipboardReadable, clipboardHolder, type HeldClipboard } from '../src/core/clipboardHold';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Fake = HeldClipboard & { text: string; html: string; rtf: string; writeText(next: string): void };

function fakeClipboard(text: string, html = '', rtf = ''): Fake {
  return {
    text,
    html,
    rtf,
    readText() { return this.text; },
    readHTML() { return this.html; },
    readRTF() { return this.rtf; },
    write(data) { this.text = data.text; this.html = data.html ?? ''; this.rtf = data.rtf ?? ''; },
    writeText(next: string) { this.text = next; this.html = ''; this.rtf = ''; },
  };
}

const code = (result: { code: string | null }) => result.code;

// What a synthetic copy does inside the hold: empty the clipboard, wait for an editor that never copies.
const emptyCopy = (clip: Fake, ms: number) => async () => {
  clip.writeText('');
  await tick(ms);
  return { code: null };
};

test('two presses whose copies overlap leave the person\'s clipboard as it was (SHOULD-366d)', async () => {
  const clip = fakeClipboard('my own text');
  const hold = clipboardHolder(clip);
  // The second press comes while the first copy still waits (the Windows empty copy takes about 5 s), and its copy
  // ends last: unserialized, it would put back the empty clipboard it saved.
  const first = hold(emptyCopy(clip, 20), code);
  await tick(5);
  const second = hold(emptyCopy(clip, 40), code);
  await Promise.all([first, second]);
  assert.equal(clip.text, 'my own text');
});

test('the second copy starts only after the first has put the clipboard back', async () => {
  const clip = fakeClipboard('my own text');
  const hold = clipboardHolder(clip);
  const seen: string[] = [];
  const first = hold(emptyCopy(clip, 20), code);
  const second = hold(async () => {
    seen.push(clip.readText());
    return { code: null };
  }, code);
  await Promise.all([first, second]);
  assert.deepEqual(seen, ['my own text']);
});

test('a copy that throws still puts the clipboard back, and the next one runs', async () => {
  const clip = fakeClipboard('my own text');
  const hold = clipboardHolder(clip);
  const failing = hold(async () => {
    clip.writeText('');
    throw new Error('System Events said no');
  }, code);
  await assert.rejects(failing, /System Events said no/);
  assert.equal(clip.text, 'my own text');
  assert.deepEqual(await hold(async () => ({ code: 'copied' }), code), { code: 'copied' });
  assert.equal(clip.text, 'my own text');
});

test('a formatted copy goes back with its HTML and RTF, after the selection was copied over it', async () => {
  const clip = fakeClipboard('total', '<b>total</b>', '{\\rtf1 total}');
  const hold = clipboardHolder(clip);
  await hold(async () => {
    clip.writeText('');
    clip.writeText('function f() {}');
    return { code: 'function f() {}' };
  }, code);
  assert.deepEqual([clip.text, clip.html, clip.rtf], ['total', '<b>total</b>', '{\\rtf1 total}']);
});

test('a copy the person makes while the read runs stays: the clipboard goes back only over the read\'s own copy (MUST-A3)', async () => {
  const clip = fakeClipboard('my own text');
  const hold = clipboardHolder(clip);
  await hold(async () => {
    clip.writeText('');
    clip.writeText('const a = 1;');
    // The person copies something else before the read ends.
    clip.writeText('what I just copied');
    return { code: 'const a = 1;' };
  }, code);
  assert.equal(clip.text, 'what I just copied');
});

test('auto mode reads only over text, its HTML and RTF, and editor copy notes; never over an image or files (MUST-A1)', () => {
  assert.equal(autoClipboardReadable([]), true, 'an empty clipboard');
  assert.equal(autoClipboardReadable(['text/plain']), true);
  assert.equal(autoClipboardReadable(['text/plain', 'text/html', 'text/rtf']), true, 'a formatted copy is put back whole');
  assert.equal(autoClipboardReadable(['text/plain', 'vscode-editor-data']), true, 'a copy from VS Code');
  assert.equal(autoClipboardReadable(['image/png']), false, 'a screenshot');
  assert.equal(autoClipboardReadable(['text/plain', 'image/png']), false, 'an image with a caption');
  assert.equal(autoClipboardReadable(['text/uri-list']), false, 'files');
  assert.equal(autoClipboardReadable(['text/plain', 'application/x-custom']), false, 'anything else');
});
