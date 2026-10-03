const trimmedApi = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';

export const publicEnv = {
  apiUrl: trimmedApi || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3001'),
  turnstileSiteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITEKEY ?? '',
} as const;
