import { publicEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ gateId: string }>;
};

export async function POST(request: Request, { params }: Props) {
  const { gateId } = await params;
  const response = await fetch(`${publicEnv.apiUrl}/gates/${gateId}/qr`, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });

  const body: unknown = await response.json().catch(() => ({ message: 'Falha ao gerar QR' }));
  if (!response.ok || !body || typeof body !== 'object' || !('visitUrl' in body)) {
    return Response.json(body, { status: response.status });
  }

  const visitUrl = rewriteVisitUrl(String((body as { visitUrl: string }).visitUrl), request);
  return Response.json({ ...body, visitUrl }, { status: response.status });
}

function rewriteVisitUrl(visitUrl: string, request: Request): string {
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  if (!host) {
    return visitUrl;
  }
  const url = new URL(visitUrl);
  url.protocol = `${proto}:`;
  url.host = host;
  return url.toString();
}
