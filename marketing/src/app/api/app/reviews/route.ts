import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createWebAppPayload } from '@/lib/webAppReview';
import { webAppBackendUrl } from '@/lib/webAppBackend';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const session = cookies().get('unvibe_web_session')?.value;
  if (!session) return NextResponse.json({ error: 'Sign in before requesting a cloud explanation.' }, { status: 401 });
  const input = (await request.json().catch(() => null)) as { code?: string; language?: string; fileName?: string; level?: string } | null;
  const payload = createWebAppPayload({ code: input?.code ?? '', language: input?.language ?? '', fileName: input?.fileName, level: input?.level ?? '' });
  if ('error' in payload) return NextResponse.json({ error: payload.error }, { status: 400 });
  try {
    const response = await fetch(`${webAppBackendUrl()}/api/v1/reviews`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session}` }, body: JSON.stringify(payload), cache: 'no-store',
    });
    if (!response.ok || !response.body) return new Response(await response.text(), { status: response.status, headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' } });
    return new Response(response.body, { status: 200, headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache, no-transform' } });
  } catch {
    return NextResponse.json({ error: 'Could not reach the explanation service.' }, { status: 503 });
  }
}
