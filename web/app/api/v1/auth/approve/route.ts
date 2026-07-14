import { getStore } from '@/data/store';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { userCode?: string; email?: string };
  if (!body.userCode) {
    return Response.json({ error: 'missing userCode' }, { status: 400 });
  }
  const authHeader = req.headers.get('authorization') ?? '';
  const accessToken = /^Bearer\s+(.+)$/i.exec(authHeader)?.[1];
  const url = process.env.SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!accessToken || !url || !serviceRole) {
    return Response.json({ error: 'sign in with Supabase before approving this device' }, { status: 401 });
  }
  const auth = createClient(url, serviceRole, { auth: { persistSession: false } });
  const { data, error } = await auth.auth.getUser(accessToken);
  if (error || !data.user) return Response.json({ error: 'your sign-in session is invalid or expired' }, { status: 401 });
  const token = await getStore().approveDeviceCode(body.userCode, data.user.id, data.user.email);
  if (!token) {
    return Response.json({ error: 'unknown code' }, { status: 404 });
  }
  // Secure only over HTTPS (so local http dev still works).
  const isHttps = new URL(req.url).protocol === 'https:' || process.env.NODE_ENV === 'production';
  const cookie =
    `uncode_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000` +
    (isHttps ? '; Secure' : '');
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': cookie },
  });
}
