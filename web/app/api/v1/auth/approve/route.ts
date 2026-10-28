import { getStore } from '@/data/store';
import { accountAgreement, consentsTableOn } from '@/lib/accountConsent';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { userCode?: string; email?: string; agreement?: unknown };
  if (!body.userCode) {
    return Response.json({ error: 'missing userCode' }, { status: 400 });
  }
  // No app is signed in with an account until the person has ticked both boxes on /activate (Terms
  // and Privacy; 18 or older). Checked here too, so a request that skips the page is refused.
  const agreement = accountAgreement(body);
  if (!agreement) {
    return Response.json({ error: 'agree to the Terms and Privacy Policy and confirm you are 18 or older' }, { status: 400 });
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
  if (consentsTableOn()) {
    // The user row exists only after the approve, so the record follows it; with no record the new
    // session is withdrawn, so no app stays signed in without a stored agreement.
    try {
      await getStore().recordConsents(data.user.id, agreement.kinds, agreement.policyVersion, new Date());
    } catch {
      await getStore().revokeToken(token).catch(() => undefined);
      return Response.json({ error: 'could not save your agreement; try again' }, { status: 503 });
    }
  }
  // Keep the Google profile name so the app can greet people without asking again.
  const meta = (data.user.user_metadata ?? {}) as Record<string, unknown>;
  const googleName = [meta.full_name, meta.name].find((v): v is string => typeof v === 'string' && v.trim().length > 0);
  if (googleName) {
    await getStore().rememberName(data.user.id, googleName.replace(/\s+/g, ' ').trim().slice(0, 80)).catch(() => undefined);
  }
  // Secure only over HTTPS (so local http dev still works).
  const isHttps = new URL(req.url).protocol === 'https:' || process.env.NODE_ENV === 'production';
  const cookie =
    `uncode_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000` +
    (isHttps ? '; Secure' : '');
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'set-cookie': cookie },
  });
}
