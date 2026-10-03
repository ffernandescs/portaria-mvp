import { z } from 'zod';
import {
  approvalPreviewSchema,
  residentSearchSchema,
  selfiePresignSchema,
  startVisitSchema,
  faceVerifySchema,
  visitMeSchema,
  visitRequestSchema,
  visitStatusSchema,
  type ResidentSearchResult,
} from './schemas';
import { backendUrl } from './backend';
import { readVisitorToken } from './session';

const okSchema = z.object({ ok: z.boolean() });

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set('content-type', 'application/json');

  const token = readVisitorToken();
  if (token) {
    headers.set('authorization', `Bearer ${token}`);
  }

  const response = await fetch(backendUrl(path), {
    ...init,
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body
        ? String((body as { message: unknown }).message)
        : 'Não foi possível concluir a solicitação';
    throw new Error(message);
  }

  return schema.parse(body);
}

export function startVisit(token: string, turnstileToken?: string) {
  return request('/visits/start', startVisitSchema, {
    method: 'POST',
    body: JSON.stringify({ token, turnstileToken }),
  });
}

export function fetchVisitMe() {
  return request('/visits/me', visitMeSchema);
}

export function acceptConsent() {
  return request('/visits/consent', okSchema.extend({ consentVersion: z.string() }), {
    method: 'POST',
    body: JSON.stringify({ accepted: true }),
  });
}

export function presignSelfie() {
  return request('/visits/selfie/presign', selfiePresignSchema, {
    method: 'POST',
    body: JSON.stringify({ contentType: 'image/jpeg' }),
  });
}

export function completeSelfie(key: string) {
  return request('/visits/selfie/complete', okSchema, {
    method: 'POST',
    body: JSON.stringify({ key }),
  });
}

export function uploadSelfieViaApi(data: string) {
  return request('/visits/selfie/upload', okSchema.extend({ key: z.string() }), {
    method: 'POST',
    body: JSON.stringify({ contentType: 'image/jpeg', data }),
  });
}

export async function sendSelfie(blob: Blob): Promise<void> {
  try {
    const { key, putUrl } = await presignSelfie();
    const uploaded = await fetch(putUrl, {
      method: 'PUT',
      headers: { 'content-type': 'image/jpeg' },
      body: blob,
    });
    if (uploaded.ok) {
      await completeSelfie(key);
      return;
    }
  } catch {
    // CORS no R2 ou URL pré-assinada inválida: sobe pelo backend.
  }

  const data = await blobToBase64(blob);
  await uploadSelfieViaApi(data);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Falha ao ler a selfie'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Falha ao ler a selfie'));
    reader.readAsDataURL(blob);
  });
}

export async function searchResidents(q: string): Promise<ResidentSearchResult[]> {
  const params = new URLSearchParams({ q });
  const payload = await request(`/residents/search?${params.toString()}`, residentSearchSchema);
  return payload.results;
}

export function createVisitRequest(input: {
  residentId: string;
  unitId: string;
  visitorName: string;
}) {
  return request('/visits/requests', visitRequestSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchVisitStatus(visitRequestId: string) {
  return request(`/visits/requests/${visitRequestId}`, visitStatusSchema);
}

export function verifyVisitFace(
  visitRequestId: string,
  input: { matchScore: number; distance: number; livenessPassed: boolean },
) {
  return request(`/visits/requests/${visitRequestId}/verify-face`, faceVerifySchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function fetchApproval(token: string) {
  return request(`/approvals/${token}`, approvalPreviewSchema);
}

export function decideApproval(token: string, decision: 'APPROVED' | 'DENIED') {
  return request(`/approvals/${token}`, visitStatusSchema.pick({ status: true }), {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
}
