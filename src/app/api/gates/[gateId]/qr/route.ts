import { publicEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ gateId: string }>;
};

export async function POST(_request: Request, { params }: Props) {
  const { gateId } = await params;
  const response = await fetch(`${publicEnv.apiUrl}/gates/${gateId}/qr`, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });

  const body: unknown = await response.json().catch(() => ({ message: 'Falha ao gerar QR' }));
  return Response.json(body, { status: response.status });
}
