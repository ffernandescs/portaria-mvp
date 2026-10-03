import { z } from 'zod';

const healthSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  uptime: z.number(),
  timestamp: z.string(),
  database: z
    .object({
      status: z.enum(['up', 'down']),
      latencyMs: z.number(),
      error: z.string().optional(),
    })
    .optional(),
  storage: z
    .object({
      status: z.enum(['up', 'down']),
      latencyMs: z.number(),
      error: z.string().optional(),
    })
    .optional(),
});

export type HealthSnapshot = z.infer<typeof healthSchema>;

export async function fetchHealth(): Promise<HealthSnapshot> {
  const response = await fetch('/api/health', {
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });

  return healthSchema.parse(await response.json());
}
