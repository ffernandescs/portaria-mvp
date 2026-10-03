import { publicEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await fetch(`${publicEnv.apiUrl}/health/ready`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    const body: unknown = await response.json();
    return Response.json(body, { status: response.status });
  } catch {
    return Response.json(
      {
        status: 'degraded',
        uptime: 0,
        timestamp: new Date().toISOString(),
        database: { status: 'down', latencyMs: 0, error: 'database_unavailable' },
        storage: { status: 'down', latencyMs: 0, error: 'storage_unavailable' },
      },
      { status: 503 },
    );
  }
}
