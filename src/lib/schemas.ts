import { z } from 'zod';

export const issuedQrSchema = z.object({
  gateId: z.string(),
  gateName: z.string(),
  visitUrl: z.string().url(),
  expiresAt: z.string(),
  issuedAt: z.string(),
});

export const startVisitSchema = z.object({
  accessToken: z.string(),
  consentVersion: z.string(),
  expiresIn: z.number(),
});

export const visitMeSchema = z.object({
  sessionId: z.string(),
  consented: z.boolean(),
  hasSelfie: z.boolean(),
  consentVersion: z.string().nullable().optional(),
});

export const residentSearchSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      unit: z.object({
        id: z.string(),
        label: z.string(),
      }),
      photoUrl: z.string().nullable(),
    }),
  ),
});

export const visitRequestSchema = z.object({
  visitRequestId: z.string(),
  status: z.string(),
  expiresAt: z.string(),
  approvalUrl: z.string().url().optional(),
});

export const approvalPreviewSchema = z.object({
  visitorName: z.string(),
  unit: z.string(),
  residentName: z.string(),
  selfieUrl: z.string().nullable(),
  expiresAt: z.string(),
  status: z.string(),
});

export const visitStatusSchema = z.object({
  visitRequestId: z.string(),
  status: z.enum(['PENDING', 'APPROVED', 'DENIED', 'EXPIRED', 'COMPLETED', 'CANCELLED']),
  expiresAt: z.string().optional(),
  selfieUrl: z.string().nullable().optional(),
  faceVerified: z.boolean().optional(),
});

export const faceVerifySchema = z.object({
  status: z.enum(['COMPLETED']),
  accepted: z.boolean(),
});

export const selfiePresignSchema = z.object({
  key: z.string(),
  putUrl: z.string().url(),
  expiresIn: z.number(),
});

export type IssuedQr = z.infer<typeof issuedQrSchema>;
export type ResidentSearchResult = z.infer<typeof residentSearchSchema>['results'][number];
