import { auth } from '@/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

/**
 * Server-only fetch to the NestJS API with the ZITADEL bearer token attached.
 * The raw access token never reaches the browser. Use for protected endpoints.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const session = await auth();
  const token = (session as { accessToken?: string } | null)?.accessToken;
  if (!token) throw new Error('Not authenticated');

  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });
}

/** Unauthenticated fetch for public endpoints (published posts). */
export async function publicFetch(path: string, init: RequestInit = {}) {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
    cache: 'no-store',
  });
}
