import test from 'node:test';
import assert from 'node:assert/strict';
import { sendFeedback } from '../src/main/feedback';

/** A fetcher that answers every request with `response`, or throws like a network failure. */
function answering(response: Response | 'offline') {
  const sent: Array<{ url: string; body: unknown }> = [];
  const fetcher = async (url: string, init: RequestInit): Promise<Response> => {
    sent.push({ url, body: JSON.parse(String(init.body)) });
    if (response === 'offline') throw new TypeError('fetch failed');
    return response;
  };
  return { sent, fetcher };
}

test('a refused feedback shows the site\'s error only as a capped string, or the fixed fallback', async () => {
  const long = await sendFeedback({ rating: 5, message: 'Nice.' }, { fetcher: answering(Response.json({ error: ` ${'f'.repeat(5_000)} ` }, { status: 400 })).fetcher, appVersion: '1.2.3' });
  assert.deepEqual(long, { ok: false, error: 'f'.repeat(300) });
  for (const error of [{ html: '<img src=x onerror=alert(1)>' }, ['a'], 42, true, '   ']) {
    const result = await sendFeedback({ rating: 4 }, { fetcher: answering(Response.json({ error }, { status: 429 })).fetcher, appVersion: '1.2.3' });
    assert.deepEqual(result, { ok: false, error: 'Could not send feedback.' }, JSON.stringify(error));
  }
  const notJson = await sendFeedback({ rating: 4 }, { fetcher: answering(new Response('<html>busy</html>', { status: 503 })).fetcher, appVersion: '1.2.3' });
  assert.deepEqual(notJson, { ok: false, error: 'Could not send feedback.' });
});

test('feedback checks the stars and the 100-word limit before sending, and says when the site is unreachable', async () => {
  const unused = answering(Response.json({}));
  for (const rating of [undefined, 0, 6, '5']) {
    assert.deepEqual(await sendFeedback({ rating, message: 'Hi.' }, { fetcher: unused.fetcher, appVersion: '1.2.3' }), { ok: false, error: 'Pick a star rating first.' });
  }
  assert.deepEqual(await sendFeedback({ rating: 3, message: Array.from({ length: 101 }, () => 'word').join(' ') }, { fetcher: unused.fetcher, appVersion: '1.2.3' }), { ok: false, error: 'Keep it under 100 words.' });
  assert.equal(unused.sent.length, 0, 'nothing sent for invalid input');
  const sent = answering(Response.json({ ok: true }));
  assert.deepEqual(await sendFeedback({ rating: 4.6, message: '  Works well.  ' }, { fetcher: sent.fetcher, appVersion: '1.2.3' }), { ok: true });
  assert.deepEqual(sent.sent, [{ url: 'https://unvibe.site/feedback', body: { rating: 5, message: 'Works well.', email: '', source: 'app', appVersion: '1.2.3' } }]);
  assert.deepEqual(await sendFeedback({ rating: 2 }, { fetcher: answering('offline').fetcher, appVersion: '1.2.3' }), { ok: false, error: 'Could not reach unvibe.site. Check your connection and try again.' });
});
