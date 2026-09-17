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