// A stand-in for Unvibe's API for motion-qa.mjs on a CI runner, so the error, reduced-motion and loop checks
// make no production calls and use no AI. It answers only what a signed-out app asks for during the first run;
// everything else is 404. Request bodies and headers are never logged (the app sends its trial headers).
//
//   PORT=8787 [TLS_CERT=cert.pem TLS_KEY=key.pem] node motion-mock.mjs        (binds 127.0.0.1 only)
//
// With TLS_CERT/TLS_KEY it serves https: release builds from 0.1.50 accept only https://unvibe-mock.test (with
// UNVIBE_CI_MOCK=1) as an override (app/src/main/backendUrl.ts, Security 20261104-0637).
//
// The test sets how the next explanations are answered with POST /__qa/mode {"mode": ...}:
//   stream   an answer with code spans and bold, cut into 3-character tokens 30 ms apart, so a span or a bold
//            run is always split across tokens (the panel must still never show half of one). Its length
//            follows the request: `detail:"short"` (a selection, 0.1.50+) gets 3 sentences; "More detail"
//            (`detail:"full"` with `shortAnswer`) gets the rest plus a fenced code block (the panel's only
//            Copy button); anything else (0.1.47 sends no `detail`) gets the whole 6-sentence answer
//   unsure   the short answer starts "Not sure:"
//   boldcode every answer starts with inline code inside bold (`**The check (`!user`):**`), the one widget spot
//            whose JetBrains Mono weight the self-hosted fonts could change (Design's M5 weight stills)
//   500      HTTP 500 {"error":"internal"}
//   429      HTTP 429 plan_limit_reached with a used-up allowance
//   drop     the connection is cut before any answer (what "can't reach the service" looks like)
//   hold     headers sent, then nothing until the test switches mode; the held answer then streams as stream/unsure
// GET /__qa/stats returns how many requests each route got.
import { readFileSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';

const PORT = Number(process.env.PORT ?? 8787);
const SHORT = 'This function adds up an order. For each item it multiplies `item.price` by `item.qty` and keeps a running total with **reduce**. The total starts at `0`, so an empty list gives 0 rather than an error.';
const REST = 'Nothing outside the function changes, which makes it **safe to call** more than once. If a price is missing, the result becomes `NaN`. A check before the multiplication would catch that.';
const ANSWERS = {
  short: { stream: SHORT, unsure: 'Not sure: this calls `f`, which is not defined in the code you selected. It most likely transforms `y` and returns the result, but the code that defines **f** is somewhere else.' },
  detail: `${REST}\n\nA guarded version:\n\n\`\`\`js\nconst total = (items) => items.reduce((sum, item) => sum + (item.price ?? 0) * item.qty, 0);\n\`\`\`\n\nIt treats a missing price as 0.`,
  full: `${SHORT} ${REST}`,
};
const BOLD_CODE = '**The check (`!user`):** it returns early when nobody is signed in.';
let mode = 'stream';
let release = null; let releaseNow = () => {}; // `release` settles when the mode leaves "hold"
const stats = {};
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const resetsAt = () => new Date(Date.now() + 86400000).toISOString();

async function review(req, res, body) {
  if (mode === '500') return json(res, 500, { error: 'internal' });
  if (mode === '429') return json(res, 429, { error: 'plan_limit_reached', message: 'You have used all of your free explanations.', usage: { used: 50, limit: 50, remaining: 0, resetsAt: resetsAt() } });
  if (mode === 'drop') { req.socket.destroy(); return; }
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
  if (mode === 'hold') await (release ??= new Promise((r) => { releaseNow = r; }));
  const kind = body?.detail === 'short' ? 'short' : body?.detail === 'full' && body?.shortAnswer ? 'detail' : 'full';
  const answer = kind === 'short' ? ANSWERS.short[mode] ?? ANSWERS.short.stream : ANSWERS[kind];
  const text = mode === 'boldcode' ? `${BOLD_CODE} ${answer}` : answer;
  for (let i = 0; i < text.length && !res.destroyed; i += 3) {
    res.write(`data: ${JSON.stringify({ type: 'token', text: text.slice(i, i + 3) })}\n\n`);
    await new Promise((r) => setTimeout(r, 30));
  }
  res.end(`data: ${JSON.stringify({ type: 'done', model: 'qa-mock', mock: true })}\n\n`);
}

const tls = process.env.TLS_CERT && process.env.TLS_KEY ? { cert: readFileSync(process.env.TLS_CERT), key: readFileSync(process.env.TLS_KEY) } : null;
const handle = (req, res) => {
  const route = (req.url ?? '').split('?')[0];
  stats[`${req.method} ${route}`] = (stats[`${req.method} ${route}`] ?? 0) + 1;
  res.on('finish', () => console.log(`${new Date().toISOString()} ${req.method} ${route} ${res.statusCode} (mode ${mode})`));
  if (req.method === 'POST' && route === '/__qa/mode') {
    let body = ''; req.on('data', (d) => { body += d; });
    req.on('end', () => {
      const next = JSON.parse(body || '{}').mode;
      if (!['stream', 'unsure', 'boldcode', '500', '429', 'drop', 'hold'].includes(next)) return json(res, 400, { error: 'unknown mode' });
      mode = next;
      // Leaving "hold" lets a held explanation stream the new mode's answer (stream or unsure).
      if (mode !== 'hold' && release) { releaseNow(); release = null; }
      json(res, 200, { mode });
    });
    return;
  }
  if (req.method === 'GET' && route === '/__qa/stats') return json(res, 200, stats);
  if (req.method === 'POST' && route === '/api/v1/reviews') {
    let body = ''; req.on('data', (d) => { body += d; });
    req.on('end', () => {
      let parsed = null; try { parsed = JSON.parse(body); } catch { /* the app always sends JSON; an empty test body is fine */ }
      const kind = parsed?.detail ?? 'none';
      stats[`reviews detail=${kind}`] = (stats[`reviews detail=${kind}`] ?? 0) + 1;
      void review(req, res, parsed);
    });
    return;
  }
  req.resume();
  if (req.method === 'GET' && route === '/api/v1/health') return json(res, 200, { ok: true });
  if (req.method === 'GET' && route === '/api/v1/trial/usage') return json(res, 200, { plan: 'trial', usage: [{ kind: 'ai_explanation', used: 1, limit: 50, remaining: 49, resetsAt: resetsAt() }] });
  if (req.method === 'POST' && route === '/api/v1/trial/progress') { res.writeHead(204); return res.end(); }
  json(res, 404, { error: 'not_found' });
};
(tls ? createHttpsServer(tls, handle) : createHttpServer(handle))
  .listen(PORT, '127.0.0.1', () => console.log(`motion mock on ${tls ? 'https' : 'http'}://127.0.0.1:${PORT}`));
