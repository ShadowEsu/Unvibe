import { giftProgressForCode } from '@/billing/gifts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { code: string } },
): Promise<Response> {
  const code = params.code?.trim() ?? '';
  if (!/^[a-f0-9]{8}$/i.test(code)) {
    return Response.json({ error: 'invalid_code', message: 'Enter the 8-character code from Unvibe.' }, { status: 400 });
  }
  try {
    const progress = await giftProgressForCode(code);
    return Response.json(progress, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gift progress could not load.';
    return Response.json({ error: 'gift_error', message }, { status: 503 });
  }
}
