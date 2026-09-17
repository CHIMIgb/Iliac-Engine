/**
 * io/api.ts — Cliente HTTP tipado del Studio (C5a).
 *
 * Única capa de red del Studio. Importa el contrato desde
 * `contract/api-response.d.ts` (fuente única, sin duplicados) y lanza
 * `ApiError` con el shape pinnado: `{ code, message, details }` (details
 * SIEMPRE presente — null si no hay detalle).
 *
 * apiFetch<T>(path, init?) → data tipado (sin envoltorio); si la respuesta
 * es de error, lanza ApiError. Los endpoints pasan la ruta completa
 * ('/auth/login', '/api/projects', ...); en dev el proxy de Vite reenvía
 * /api y /auth al backend (3000).
 */
import type { ApiResponse } from '../../../contract/api-response';
import { getSession, type AuthSession } from './session';

/** Error de la API con el shape del contrato (siempre details presente). */
export class ApiError extends Error {
  readonly code: string;
  readonly details: unknown;

  constructor(error: { code: string; message: string; details: unknown }) {
    super(error.message);
    this.name = 'ApiError';
    this.code = error.code;
    this.details = error.details;
  }
}

export interface RegisterFields {
  login: string;
  password: string;
  nombre: string;
  apellido: string;
  emailPublico?: string;
}

/**
 * Petición tipada al backend. Devuelve `data` del contrato; lanza ApiError
 * en respuestas de error, respuestas malformadas o fallo de red.
 */
export async function apiFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getSession()?.accessToken;
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError({ code: 'NETWORK_ERROR', message: 'No se pudo conectar con el servidor', details: null });
  }

  const body = (await res.json().catch(() => null)) as ApiResponse<T> | null;
  if (!body || typeof body !== 'object' || typeof (body as { success?: unknown }).success !== 'boolean') {
    throw new ApiError({ code: 'INVALID_RESPONSE', message: 'Respuesta del servidor inválida', details: null });
  }

  if (!body.success) throw new ApiError(body.error);
  return body.data;
}

/** Registro de usuario → sesión completa. */
export function apiRegister(input: RegisterFields) {
  return apiFetch<AuthSession>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Login → sesión completa. */
export function apiLogin(login: string, password: string) {
  return apiFetch<AuthSession>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ login, password }),
  });
}