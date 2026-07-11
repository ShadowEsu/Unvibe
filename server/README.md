# Uncode AI service

Streaming explanation endpoint with a swappable model provider. Dependency-free (Node built-ins
+ `fetch`); `tsx` is the only dev tool. Framework-agnostic on purpose — the provider/prompt
modules move into the Next.js app's API routes at Milestone 5 unchanged.

## Run
```
cd server
npm install
npm run dev            # http://localhost:8787  (MOCK provider — no key needed)
# real analysis:
ANTHROPIC_API_KEY=sk-ant-... npm run dev
```

## Endpoints
- `GET /health` → `{ ok, provider, mock }`
- `POST /api/v1/reviews` → `text/event-stream`; each message is `data: {StreamEvent}\n\n`
  where `StreamEvent` is `{type:'token',text}` | `{type:'done',model,mock}` | `{type:'error',message}`.

## Env
- `ANTHROPIC_API_KEY` — enables the real provider (else mock).
- `UNCODE_MODEL` — default `claude-sonnet-5`.
- `UNCODE_MAX_TOKENS` — default `1024`.
- `PORT` — default `8787`.

The service only ever receives context the extension already built and secret-filtered locally.
It never reads the repository.
