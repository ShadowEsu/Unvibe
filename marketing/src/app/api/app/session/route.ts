import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { webAppBackendUrl, webAppSessionCookieOptions } from '@/lib/webAppBackend';

export const runtime = 'nodejs';

const cookieName = 'unvibe_web_session';

function token() {
  return cookies().get(cookieName)?.value ?? null;
}

export async function GET() {
  const session = token();
  if (!session) return NextResponse.json({ signedIn: false });
  try {
    const response = await fetch(`${webAppBackendUrl()}/api/v1/account`, { headers: { authorization: `Bearer ${session}` }, cache: 'no-store' });
    if (!response.ok) {
      const result = NextResponse.json({ signedIn: false });
      result.cookies.set(cookieName, '', { ...webAppSessionCookieOptions(), maxAge: 0 });
      return result;
    }
    const account = await response.json() as { userId?: string; email?: string };
    return NextResponse.json({ signedIn: true, email: account.email ?? null });
  } catch {
    return NextResponse.json({ signedIn: false, unavailable: true }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string; mode?: 'signin' | 'signup' } | null;
  const email = body?.email?.trim() ?? '';
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  const action = body?.mode === 'signup' ? 'signup' : 'signin';
  try {
    const response = await fetch(`${webAppBackendUrl()}/api/v1/auth/${action}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }), cache: 'no-store',
    });
    const data = await response.json().catch(() => ({})) as { token?: string; email?: string; error?: string };
    if (!response.ok || !data.token) return NextResponse.json({ error: data.error ?? 'Sign-in is not available right now.' }, { status: response.status || 502 });
    const result = NextResponse.json({ signedIn: true, email: data.email ?? email });
    result.cookies.set(cookieName, data.token, webAppSessionCookieOptions());
    return result;
  } catch {
    return NextResponse.json({ error: 'Could not reach the Unvibe service.' }, { status: 503 });
  }
}

export async function DELETE() {
  const session = token();
  if (session) {
    await fetch(`${webAppBackendUrl()}/api/v1/auth/signout`, { method: 'POST', headers: { authorization: `Bearer ${session}` }, cache: 'no-store' }).catch(() => undefined);
  }
  const result = NextResponse.json({ signedIn: false });
  result.cookies.set(cookieName, '', { ...webAppSessionCookieOptions(), maxAge: 0 });
  return result;
}
