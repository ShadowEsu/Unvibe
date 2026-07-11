import { getStore } from '@/data/store';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { deviceCode?: string };
  if (!body.deviceCode) {
    return Response.json({ error: 'missing deviceCode' }, { status: 400 });
  }
  const result = await getStore().redeemDeviceCode(body.deviceCode);
  if (result === 'unknown') {
    return Response.json({ error: 'unknown device code' }, { status: 404 });
  }
  if (result === 'pending') {
    return Response.json({ status: 'pending' }, { status: 202 });
  }
  return Response.json(result);
}
