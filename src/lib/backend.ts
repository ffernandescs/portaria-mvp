import { publicEnv } from './env';

export function backendUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;

  if (process.env.NODE_ENV !== 'production' || !publicEnv.apiUrl) {
    return `/backend${normalized}`;
  }

  return `${publicEnv.apiUrl}${normalized}`;
}
