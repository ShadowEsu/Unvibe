import { getStore } from '@/data/store';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { deviceCode?: string };
  if (!body.deviceCode) {
    return Response.json({ error: 'missing deviceCode' }, { status: 400 });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.deviceCode)) {
    return Response.json({ error: 'invalid deviceCode' }, { status: 400 });
  }
  const result = await getStore().redeemDeviceCode(body.deviceCode);
  if (result === 'unknown') {
    return Response.json({ error: 'unknown device code' }, { status: 404 });
  }
  if (result === 'expired') {
    return Response.json({ error: 'device code expired' }, { status: 410 });
  }
  if (result === 'used') {
    return Response.json({ error: 'device code already redeemed' }, { status: 409 });
  }
  if (result === 'pending') {
    return Response.json({ status: 'pending' }, { status: 202 });
  }
  return Response.json(result);
}
