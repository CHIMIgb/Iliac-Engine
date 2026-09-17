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
import { clearSession, getSession, setSession, type AuthSession } from './session';

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

/** Init propio: añade el flag interno de reintento (evita bucles de renovación). */
interface ApiInit extends RequestInit {
  /** true en el reintento tras renovar sesión (C5f): no vuelve a renovar. */
  _retried?: boolean;
}

// Rutas que NUNCA se auto-renuevan: un 401 ahí es credencial mala o token
// inválido, no una sesión caducada; renovar solo haría bucles.
const NO_RENEW = new Set(['/auth/login', '/auth/register', '/auth/refresh']);

// C5f: deduplicación de renovación — si varias peticiones reciben 401 a la vez,
// todas esperan la MISMA promesa y reintentan con el token recién renovado.
let renewPromise: Promise<AuthSession> | null = null;

/**
 * Renueva la sesión con el refresh token de la cookie (POST /auth/refresh,
 * rotación en el server) y re-guarda la sesión. Una sola llamada por ráfaga.
 */
function renewSession(): Promise<AuthSession> {
  if (!renewPromise) {
    renewPromise = (async () => {
      const sesion = getSession();
      if (!sesion?.refreshToken) {
        throw new ApiError({ code: 'UNAUTHORIZED', message: 'Sesión expirada', details: null });
      }
      const nueva = await apiRefresh(sesion.refreshToken);
      setSession(nueva);
      return nueva;
    })().finally(() => {
      renewPromise = null;
    });
  }
  return renewPromise;
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
export async function apiFetch<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const token = getSession()?.accessToken;
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  // Con FormData el navegador DEBE poner el Content-Type (multipart + boundary);
  // forzarlo a JSON rompería la subida de assets (C5c).
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
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

  if (!body.success) {
    // C5f: access token caducado (15 min) → renovar con el refresh y reintentar
    // UNA vez. Si la renovación falla, limpiar la sesión y fallar con el 401
    // original (el caller ya hace logout/toast).
    if (body.error?.code === 'UNAUTHORIZED' && !init._retried && !NO_RENEW.has(path)) {
      try {
        await renewSession();
        return await apiFetch<T>(path, { ...init, _retried: true });
      } catch {
        clearSession();
        throw new ApiError(body.error);
      }
    }
    throw new ApiError(body.error);
  }
  return body.data;
}

/** Renovación de sesión (C5f): refresh token → access nuevo + refresh rotado. */
export function apiRefresh(refreshToken: string) {
  return apiFetch<AuthSession>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
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

// ── Proyectos (C5b: la API es la fuente de verdad con sesión) ──

/** Resumen de un proyecto (la lista NO incluye `data` para no transferir JSONB). */
export interface ProjectMeta {
  id: string;
  nombre: string;
  estado: 'EN_DESARROLLO' | 'PUBLICADO';
  schemaVersion: number;
  renderMode: string;
  createdAt: string;
  updatedAt: string;
}

/** Proyecto completo: metadata + árbol v3 (para el editor). */
export interface FullProject extends ProjectMeta {
  data: Record<string, unknown>;
}

export function apiListProjects() {
  return apiFetch<{ projects: ProjectMeta[] }>('/api/projects');
}

export function apiGetProject(id: string) {
  return apiFetch<{ project: FullProject }>(`/api/projects/${id}`);
}

export function apiCreateProject(input: { nombre?: string; data?: unknown; plantillaId?: string }) {
  return apiFetch<{ project: FullProject }>('/api/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function apiUpdateProject(id: string, input: { nombre?: string; data?: unknown }) {
  return apiFetch<{ project: FullProject }>(`/api/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function apiDeleteProject(id: string) {
  return apiFetch<{ deleted: boolean }>(`/api/projects/${id}`, { method: 'DELETE' });
}

// ── Plantillas (C5d: el documento de partida viene de la API) ──

/** Resumen de una plantilla (la lista NO incluye `data`). */
export interface TemplateMeta {
  id: string;
  nombre: string;
  descripcion: string;
}

/** Plantilla completa: metadata + project.json (para el editor). */
export interface FullTemplate extends TemplateMeta {
  data: Record<string, unknown>;
}

/** Plantillas visibles: del sistema + las propias si hay sesión. */
export function apiListTemplates() {
  return apiFetch<{ templates: TemplateMeta[] }>('/api/templates');
}

export function apiGetTemplate(id: string) {
  return apiFetch<{ template: FullTemplate }>(`/api/templates/${id}`);
}

// ── Assets (C5c: sprites y audio van a la API, no al disco local) ──

/** Tipo de asset del backend (enum TipoAsset). */
export type AssetTipo = 'texture' | 'sprite' | 'audio' | 'font' | 'modelo';

/** Metadata de un asset de la cuenta (sin bytes). */
export interface AssetMeta {
  id: string;
  nombre: string;
  tipo: AssetTipo;
  mime: string;
  tamanoBytes: number;
  hash: string | null;
  createdAt: string;
}

/** Lista los assets de la cuenta, opcionalmente por tipo (`?tipo=audio`). */
export function apiListAssets(tipo?: AssetTipo) {
  const qs = tipo ? `?tipo=${tipo}` : '';
  return apiFetch<{ assets: AssetMeta[] }>(`/api/assets${qs}`);
}

/**
 * Sube un asset (multipart) → fila creada o la existente si el contenido ya
 * estaba (dedupe por hash en el server: `reused`).
 */
export function apiUploadAsset(input: {
  file: File | Blob;
  nombre: string;
  tipo: AssetTipo;
  proyectoId?: string | null;
}) {
  const form = new FormData();
  form.append('file', input.file, input.nombre);
  form.append('tipo', input.tipo);
  if (input.proyectoId) form.append('proyectoId', input.proyectoId);
  return apiFetch<{ asset: AssetMeta; reused: boolean }>('/api/assets', {
    method: 'POST',
    body: form,
  });
}