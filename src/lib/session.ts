const KEY = 'portaria.visitor.token';

export function saveVisitorToken(token: string): void {
  sessionStorage.setItem(KEY, token);
}

export function readVisitorToken(): string | null {
  return sessionStorage.getItem(KEY);
}

export function clearVisitorToken(): void {
  sessionStorage.removeItem(KEY);
}
