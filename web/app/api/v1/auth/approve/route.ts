import { getStore } from '@/data/store';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { userCode?: string; email?: string };
  if (!body.userCode) {
    return Response.json({ error: 'missing userCode' }, { status: 400 });
  }
  const token = await getStore().approveDeviceCode(body.userCode, body.email);
  if (!token) {
    return Response.json({ error: 'unknown code' }, { status: 404 });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'content-type': 'application/json',
      'set-cookie': `uncode_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
    },
  });
}
