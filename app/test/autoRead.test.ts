import assert from 'node:assert/strict';
import test from 'node:test';
import { autoRead, parseAutoLine, type AutoReadDeps } from '../src/core/autoRead';
import { clipboardHolder } from '../src/core/clipboardHold';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A clipboard that counts writes, so a test can say none happened before the keystroke. */
function fakeClipboard(text: string, html = '') {
  const clip = {
    text,
    html,
    rtf: '',
    formats: ['text/plain', ...(html ? ['text/html'] : [])],
    writes: 0,
    readText: () => clip.text,
    readHTML: () => clip.html,
    readRTF: () => clip.rtf,
    write(data: { text: string; html?: string; rtf?: string }) {
      clip.writes += 1;
      clip.text = data.text;
      clip.html = data.html ?? '';
      clip.rtf = data.rtf ?? '';
    },
    /** What the editor does when the copy keystroke lands. */
    editorCopies(next: string) {
      clip.text = next;
      clip.html = '';
    },
  };
  return clip;
}

type Clip = ReturnType<typeof fakeClipboard>;

function deps(clip: Clip, native: AutoReadDeps['native'], inputSince: AutoReadDeps['inputSince'] = async () => false): AutoReadDeps {
  return { formats: () => clip.formats, readText: clip.readText, hold: clipboardHolder(clip), native, inputSince, wait: tick };
}

test('nothing is written to the clipboard before the keystroke, and a paste then gets the person\'s own text (QA C-3 row 1)', async () => {
  const clip = fakeClipboard('my own text', '<b>my own text</b>');
  let seenAtKeystroke: { writes: number; text: string } | null = null;
  const result = await autoRead(
    deps(clip, async () => {
      seenAtKeystroke = { writes: clip.writes, text: clip.readText() };
      clip.editorCopies('const x = compute(input);');
      return 'copied 1,2,3';
    }),
    'com.microsoft.VSCode',
    1000,
  );
  assert.deepEqual(seenAtKeystroke, { writes: 0, text: 'my own text' });
  assert.equal(result.code, 'const x = compute(input);');
  assert.equal(result.skipped, undefined);
  // Put back, formatting included, the moment the copy's text was read.
  assert.equal(clip.text, 'my own text');
  assert.equal(clip.html, '<b>my own text</b>');
});

test('the person\'s clipboard is back before the input check runs', async () => {
  const clip = fakeClipboard('my own text');
  let clipboardAtCheck = '';
  await autoRead(
    deps(
      clip,
      async () => {
        clip.editorCopies('selected code here');
        return 'copied 42';
      },
      async () => {
        clipboardAtCheck = clip.readText();
        return false;
      },
    ),
    'Code.exe',
    1000,
  );
  assert.equal(clipboardAtCheck, 'my own text');
});

test('input since the mouse-up skips the read with the clipboard untouched (busy)', async () => {
  const clip = fakeClipboard('my own text');
  const result = await autoRead(deps(clip, async () => 'skip busy Code'), 'Code.exe', 1000);
  assert.deepEqual(result, { code: null, sourceApp: 'Code', skipped: 'busy' });
  assert.equal(clip.writes, 0);
  assert.equal(clip.text, 'my own text');
});

test('the copy is detected by the change count even when the selection matches the clipboard\'s text', async () => {
  const clip = fakeClipboard('return total;');
  const result = await autoRead(deps(clip, async () => 'copied 7'), 'com.todesktop.230313mzl4w4u92', 1000);
  assert.equal(result.code, 'return total;');
});

test('no change in the count means nothing was copied, and the clipboard is never written', async () => {
  const clip = fakeClipboard('my own text');
  const result = await autoRead(deps(clip, async () => 'none 7'), 'com.microsoft.VSCode', 1000);
  assert.equal(result.code, null);
  assert.equal(result.error, 'empty');
  assert.equal(clip.writes, 0);
});

test('input between the idle check and the restore drops the result, after the clipboard is put back', async () => {
  const clip = fakeClipboard('my own text');
  const result = await autoRead(
    deps(
      clip,
      async () => {
        clip.editorCopies('selected code here');
        return 'copied 42 Code';
      },
      async (mark) => {
        assert.equal(mark, '42');
        return true;
      },
    ),
    'Code.exe',
    1000,
  );
  assert.deepEqual(result, { code: null, sourceApp: 'Code', skipped: 'busy' });
  assert.equal(clip.text, 'my own text');
});

test('an input check that fails drops the result too', async () => {
  const clip = fakeClipboard('my own text');
  const result = await autoRead(
    deps(
      clip,
      async () => {
        clip.editorCopies('selected code here');
        return 'copied 42';
      },
      async () => {
        throw new Error('powershell failed');
      },
    ),
    'Code.exe',
    1000,
  );
  assert.equal(result.code, null);
  assert.equal(result.skipped, 'busy');
});

test('an editor that clears the clipboard a beat before writing is still read', async () => {
  const clip = fakeClipboard('my own text');
  const result = await autoRead(
    deps(clip, async () => {
      clip.editorCopies('');
      setTimeout(() => clip.editorCopies('late but here'), 20);
      return 'copied 1,2,3';
    }),
    'com.microsoft.VSCode',
    1000,
  );
  assert.equal(result.code, 'late but here');
  assert.equal(clip.text, 'my own text');
});

test('an image on the clipboard stops the read before the native call', async () => {
  const clip = fakeClipboard('caption');
  clip.formats = ['text/plain', 'image/png'];
  let called = false;
  const result = await autoRead(
    deps(clip, async () => {
      called = true;
      return 'none 1';
    }),
    'com.microsoft.VSCode',
    1000,
  );
  assert.deepEqual(result, { code: null, skipped: 'clipboard' });
  assert.equal(called, false);
});

test('the native line: app names with spaces, and anything unexpected is a failed read', async () => {
  assert.deepEqual(parseAutoLine('skip app Code - Insiders'), { kind: 'skip', reason: 'app', sourceApp: 'Code - Insiders' });
  assert.deepEqual(parseAutoLine('copied 0.1,0.2,3.5\n'), { kind: 'copied', mark: '0.1,0.2,3.5', sourceApp: null });
  assert.equal(parseAutoLine(''), null);
  assert.equal(parseAutoLine('skip later'), null);
  assert.equal(parseAutoLine('copied'), null);
  const clip = fakeClipboard('my own text');
  const result = await autoRead(deps(clip, async () => 'execution of script failed'), 'Code.exe', 1000);
  assert.deepEqual(result, { code: null, error: 'failed' });
  assert.equal(clip.text, 'my own text');
});
