import { z } from 'zod';
import { backendUrl } from './backend';

const ACCESS_KEY = 'admin.accessToken';
const REFRESH_KEY = 'admin.refreshToken';
const ADMIN_KEY = 'admin.profile';

const adminSchema = z.object({
  id: z.string(),
  email: z.string(),
  role: z.enum(['SUPER_ADMIN', 'TENANT_ADMIN', 'DOORMAN']),
  tenantId: z.string(),
  name: z.string().optional(),
});

const sessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  admin: adminSchema,
});

const unitSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  block: z.string().nullable(),
  floor: z.string().nullable(),
  _count: z
    .object({
      residents: z.number(),
      visitRequests: z.number(),
    })
    .optional(),
});

const residentSchema = z.object({
  id: z.string(),
  name: z.string(),
  nickname: z.string().nullable(),
  showPhotoInSearch: z.boolean(),
  units: z.array(
    z.object({
      unit: z.object({
        id: z.string(),
        identifier: z.string(),
        block: z.string().nullable(),
      }),
    }),
  ),
});

const gateSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(['ONLINE', 'OFFLINE', 'DISABLED']),
  lastAgentSeenAt: z.string().nullable(),
  createdAt: z.string(),
  agentKey: z.string().optional(),
});

const eventSchema = z.object({
  id: z.string(),
  type: z.string(),
  actor: z.string(),
  createdAt: z.string(),
  metadata: z.unknown(),
  gate: z.object({ name: z.string() }).nullable(),
  visitRequest: z
    .object({
      visitorName: z.string().nullable(),
      status: z.string(),
    })
    .nullable(),
});

export type AdminProfile = z.infer<typeof adminSchema>;
export type AdminUnit = z.infer<typeof unitSchema>;
export type AdminResident = z.infer<typeof residentSchema>;
export type AdminGate = z.infer<typeof gateSchema>;
export type AdminEvent = z.infer<typeof eventSchema>;

export function readAdminAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_KEY);
}

export function readAdminProfile(): AdminProfile | null {
  const raw = sessionStorage.getItem(ADMIN_KEY);
  if (!raw) {
    return null;
  }
  const parsed = adminSchema.safeParse(JSON.parse(raw));
  return parsed.success ? parsed.data : null;
}

export function clearAdminSession(): void {
  sessionStorage.removeItem(ACCESS_KEY);
  sessionStorage.removeItem(REFRESH_KEY);
  sessionStorage.removeItem(ADMIN_KEY);
}

function persistSession(session: z.infer<typeof sessionSchema>): void {
  sessionStorage.setItem(ACCESS_KEY, session.accessToken);
  sessionStorage.setItem(REFRESH_KEY, session.refreshToken);
  sessionStorage.setItem(ADMIN_KEY, JSON.stringify(session.admin));
}

async function rawRequest(path: string, init?: RequestInit, token?: string): Promise<Response> {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }
  return fetch(backendUrl(path), {
    ...init,
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
  });
}

async function parseError(response: Response): Promise<Error> {
  const body: unknown = await response.json().catch(() => null);
  const message =
    body && typeof body === 'object' && 'message' in body
      ? String((body as { message: unknown }).message)
      : 'Não foi possível concluir a solicitação';
  return new Error(message);
}

async function refreshAccess(): Promise<string | null> {
  const refreshToken = sessionStorage.getItem(REFRESH_KEY);
  if (!refreshToken) {
    return null;
  }

  const response = await rawRequest('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearAdminSession();
    return null;
  }

  const session = sessionSchema.parse(await response.json());
  persistSession(session);
  return session.accessToken;
}

async function adminRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  let token = readAdminAccessToken();
  let response = await rawRequest(path, init, token ?? undefined);

  if (response.status === 401) {
    token = await refreshAccess();
    if (!token) {
      throw new Error('Sessão expirada');
    }
    response = await rawRequest(path, init, token);
  }

  if (!response.ok) {
    throw await parseError(response);
  }

  if (response.status === 204) {
    return schema.parse({});
  }

  return schema.parse(await response.json());
}

export async function loginAdmin(input: {
  email: string;
  password: string;
  tenantSlug?: string;
}): Promise<AdminProfile> {
  const response = await rawRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      password: input.password,
      tenantSlug: input.tenantSlug ?? 'demo',
    }),
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  const session = sessionSchema.parse(await response.json());
  persistSession(session);
  return session.admin;
}

export function fetchAdminMe() {
  return adminRequest('/auth/me', adminSchema);
}

export function fetchUnits() {
  return adminRequest('/admin/units', z.array(unitSchema));
}

export function createUnit(input: { identifier: string; block?: string; floor?: string }) {
  return adminRequest('/admin/units', unitSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteUnit(id: string) {
  return adminRequest('/admin/units/' + id, z.object({ ok: z.boolean() }), {
    method: 'DELETE',
  });
}

export function fetchResidents() {
  return adminRequest('/admin/residents', z.array(residentSchema));
}

export function createResident(input: {
  name: string;
  nickname?: string;
  unitIds: string[];
  showPhotoInSearch?: boolean;
}) {
  return adminRequest('/admin/residents', residentSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteResident(id: string) {
  return adminRequest('/admin/residents/' + id, z.object({ ok: z.boolean() }), {
    method: 'DELETE',
  });
}

export function fetchGates() {
  return adminRequest('/admin/gates', z.array(gateSchema));
}

export function createGate(name: string) {
  return adminRequest('/admin/gates', gateSchema, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function rotateGateKey(id: string) {
  return adminRequest('/admin/gates/' + id, gateSchema, {
    method: 'PATCH',
    body: JSON.stringify({ rotateKey: true }),
  });
}

export function openGate(id: string) {
  return adminRequest('/admin/gates/' + id + '/open', z.object({ ok: z.boolean() }), {
    method: 'POST',
  });
}

export function fetchEvents() {
  return adminRequest('/admin/events?take=80', z.array(eventSchema));
}
