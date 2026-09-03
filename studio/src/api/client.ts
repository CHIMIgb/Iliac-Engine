/**
 * api/client.ts — Cliente tipado para la API REST
 * Contrato: { success: true, data } | { success: false, error: { code, message, details } }
 * Ver ROADMAP §5b
 */

export interface ApiError {
  code: string;
  message: string;
  details?: any;
}

export class ApiError extends Error {
  code: string;
  details?: any;

  constructor(error: { code: string; message: string; details?: any }) {
    super(error.message);
    this.name = 'ApiError';
    this.code = error.code;
    this.details = error.details;
  }
}

/**
 * Fetch tipado que desenvuelve el contrato estándar.
 * Lanza ApiError si success=false.
 */
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  let body: any;
  try {
    body = await res.json();
  } catch {
    body = { success: false, error: { code: 'PARSE_ERROR', message: 'Respuesta no es JSON válido' } };
  }

  if (!body.success) {
    throw new ApiError(body.error);
  }

  return body.data as T;
}

/**
 * Helper para GET
 */
export function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, { ...init, method: 'GET' });
}

/**
 * Helper para POST
 */
export function apiPost<T>(path: string, data: any, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, { ...init, method: 'POST', body: JSON.stringify(data) });
}

/**
 * Helper para PATCH
 */
export function apiPatch<T>(path: string, data: any, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, { ...init, method: 'PATCH', body: JSON.stringify(data) });
}

/**
 * Helper para DELETE
 */
export function apiDelete<T>(path: string, init?: RequestInit): Promise<T> {
  return apiFetch<T>(path, { ...init, method: 'DELETE' });
}

/**
 * Convierte ApiError a mensaje legible para toast/UI.
 */
export function formatApiError(err: ApiError): string {
  // Mapear códigos comunes a mensajes amigables
  const messages: Record<string, string> = {
    VALIDATION_ERROR: 'Datos inválidos',
    UNAUTHORIZED: 'Sesión expirada, inicia sesión de nuevo',
    FORBIDDEN: 'No tienes permisos para esta acción',
    NOT_FOUND: 'Recurso no encontrado',
    PROJECT_NOT_FOUND: 'Proyecto no encontrado',
    ASSET_NOT_FOUND: 'Asset no encontrado',
    EMAIL_IN_USE: 'El email ya está registrado',
    INVALID_CREDENTIALS: 'Credenciales incorrectas',
    SLUG_TAKEN: 'Ese slug ya está en uso',
    STORAGE_WRITE_ERROR: 'Error guardando en el servidor',
    INTERNAL_ERROR: 'Error interno del servidor',
  };

  return messages[err.code] || err.message;
}

/**
 * Interceptor global opcional para manejar errores de auth (ej: redirigir a login en 401)
 */
export function setupAuthInterceptor(onUnauthorized: () => void): void {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const res = await originalFetch(...args);
    if (res.status === 401) {
      onUnauthorized();
    }
    return res;
  };
}