import { getStore } from '@/data/store';
import { activateOriginFrom } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const device = await getStore().createDeviceCode(activateOriginFrom(req));
  return Response.json(device);
}
