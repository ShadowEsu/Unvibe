import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { Provider } from './providers/provider.js';
import { MockProvider } from './providers/mock.js';
import { AnthropicProvider } from './providers/anthropic.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt.js';
import type { ReviewRequestPayload, StreamEvent } from './protocol.js';

const PORT = Number(process.env.PORT ?? 8787);
const MAX_BODY = 2 * 1024 * 1024;

function selectProvider(): Provider {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    return new AnthropicProvider(key);
  }
  return new MockProvider();
}

const server = createServer((req, res) => {
  // Dev CORS (extension host is not a browser, but harmless and helps local tools).
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type, accept');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204).end();
    return;
  }
  if (req.method === 'GET' && req.url === '/health') {
    const provider = selectProvider();
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true, provider: provider.name, mock: provider.mock }));
    return;
  }
  if (req.method === 'POST' && req.url === '/api/v1/reviews') {
    handleReview(req, res).catch((err) => {
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json' });
      }
      res.end();
      console.error('[uncode-server] unhandled', err);
    });
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

async function handleReview(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const raw = await readBody(req);
  let payload: ReviewRequestPayload;
  try {
    payload = JSON.parse(raw) as ReviewRequestPayload;
  } catch {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'invalid JSON' }));
    return;
  }
  if (!payload?.scope || !payload?.level || !payload?.context) {
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'missing scope, level, or context' }));
    return;
  }

  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });

  const send = (event: StreamEvent) => res.write(`data: ${JSON.stringify(event)}\n\n`);
  const provider = selectProvider();
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const system = buildSystemPrompt(payload);
    const user = buildUserPrompt(payload);
    await provider.stream(system, user, (text) => send({ type: 'token', text }), controller.signal);
    send({ type: 'done', model: provider.name, mock: provider.mock });
  } catch (err) {
    send({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  } finally {
    res.end();
  }
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('body too large'));
        req.destroy();
        return;
      }
      data += chunk.toString('utf8');
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

server.listen(PORT, () => {
  const provider = selectProvider();
  console.log(
    `[uncode-server] listening on http://localhost:${PORT} — provider: ${provider.name}` +
      (provider.mock ? ' (MOCK — set ANTHROPIC_API_KEY for real analysis)' : ''),
  );
});
