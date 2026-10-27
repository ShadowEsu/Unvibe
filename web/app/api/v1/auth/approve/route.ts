import { getStore } from '@/data/store';
import { getBillingStore } from '@/billing/store';
import { createClient } from '@supabase/supabase-js';
import { accountDeleted } from '@/lib/auth';

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
  // getUser asks Supabase Auth on every call, so an access token whose user was deleted is refused here.
  const { data, error } = await auth.auth.getUser(accessToken);
  if (error || !data.user) return Response.json({ error: 'your sign-in session is invalid or expired' }, { status: 401 });
  if (await getStore().accountDeletion(data.user.id)) return accountDeleted();
  const token = await getStore().approveDeviceCode(body.userCode, data.user.id, data.user.email);
  if (!token) {
    return Response.json({ error: 'unknown code' }, { status: 404 });
  }
  // The desktop app is the only sign-in, so this is where an invited teammate's seat attaches.
  // A failure here never blocks the sign-in; the invitation stays pending for the next one.
  try {
    const billing = getBillingStore();
    for (const workspaceId of await billing.acceptPendingInvitations(data.user.id, data.user.email)) {
      await billing.recordAudit(data.user.id, workspaceId, 'invitation.accepted', { via: 'sign_in' });
    }
  } catch (err) {
    console.error('accept pending invitations failed:', err instanceof Error ? err.message : 'unknown error');
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
