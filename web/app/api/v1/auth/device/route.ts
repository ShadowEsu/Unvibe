import { getStore } from '@/data/store';
import { baseUrlFrom } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(req: Request): Promise<Response> {
  const device = await getStore().createDeviceCode(baseUrlFrom(req));
  return Response.json(device);
}
