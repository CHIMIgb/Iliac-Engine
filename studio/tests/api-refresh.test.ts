/**
 * api-refresh.test.ts — renovación de sesión (C5f): al recibir 401 el cliente
 * renueva con el refresh token de la cookie (una sola vez por ráfaga) y
 * reintenta la petición; login/register/refresh jamás se auto-renuevan. Fetch
 * y la cookie se simulan con stubs (node, sin jsdom).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, ApiError } from '../src/io/api';
import { clearSession, getSession, setSession, type AuthSession } from '../src/io/session';

const SESION_V1: AuthSession = {
  user: { id: 'u1', login: 'chimi', nombre: 'A', apellido: 'G', emailPublico: null, rol: 'creador' },
  accessToken: 'access-viejo',
  refreshToken: 'refresh-viejo',
  refreshTokenId: 's1',
};

const SESION_V2: AuthSession = {
  ...SESION_V1,
  accessToken: 'access-nuevo',
  refreshToken: 'refresh-nuevo',
  refreshTokenId: 's2',
};

/** Cookie falsa (patrón de api.test.ts): la sesión vive en document.cookie. */
function stubCookie(): void {
  let jar = '';
  vi.stubGlobal('document', {
    get cookie() { return jar; },
    set cookie(v: string) { jar = v; },
  });
}

const UNAUTHORIZED = {
  success: false,
  data: null,
  error: { code: 'UNAUTHORIZED', message: 'No autenticado', details: null },
};
const OK_PROJECTS = { success: true, data: { projects: [] }, error: null };

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe('apiFetch renovación (C5f)', () => {
  it('401 + refresh válido → renueva, re-guarda sesión y reintenta con éxito', async () => {
    stubCookie();
    setSession(SESION_V1);

    // Llamada 1: /api/projects original → 401 (access caducado).
    // Llamada 2: /auth/refresh → sesión nueva.
    // Llamada 3: reintento de /api/projects → 200.
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const n = fetchMock.mock.calls.length;
      if (String(url) === '/auth/refresh') return { ok: true, json: async () => ({ success: true, data: SESION_V2, error: null }) } as unknown as Response;
      if (n === 1) return { ok: true, json: async () => UNAUTHORIZED } as unknown as Response;
      return { ok: true, json: async () => OK_PROJECTS } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const data = await apiFetch<{ projects: unknown[] }>('/api/projects');
    expect(data.projects).toEqual([]);

    // Se llamó 3 veces: original 401 → refresh → reintento.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const urls = fetchMock.mock.calls.map(([u]) => String(u));
    expect(urls[0]).toBe('/api/projects');
    expect(urls[1]).toBe('/auth/refresh');
    expect(urls[2]).toBe('/api/projects');

    // La sesión re-guardada tiene el access nuevo; el reintento lo usó.
    expect(getSession()?.accessToken).toBe('access-nuevo');
    const retryInit = fetchMock.mock.calls[2]![1] as RequestInit;
    expect((retryInit.headers as Headers).get('Authorization')).toBe('Bearer access-nuevo');
  });

  it('401 + refresh falla → ApiError UNAUTHORIZED y cookie limpiada', async () => {
    stubCookie();
    setSession(SESION_V1);

    const fetchMock = vi.fn(async (url: string) => {
      if (String(url) === '/auth/refresh') {
        return { ok: true, json: async () => UNAUTHORIZED } as unknown as Response;
      }
      return { ok: true, json: async () => UNAUTHORIZED } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const err = await apiFetch('/api/projects').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(getSession()).toBeNull(); // sesión limpia: el caller hará logout/toast
  });

  it('login NO se auto-renueva: 401 en /auth/login → ApiError, sin llamar a /auth/refresh', async () => {
    stubCookie();
    setSession(SESION_V1);

    const fetchMock = vi.fn(async (url: string) => {
      if (String(url) === '/auth/refresh') throw new Error('NO debe renovar en login');
      return { ok: true, json: async () => UNAUTHORIZED } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const err = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ login: 'x', password: 'mala' }),
    }).catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(fetchMock).toHaveBeenCalledTimes(1); // solo la llamada original
  });

  it('ráfaga concurrente: varias llamadas 401 → UNA sola renovación', async () => {
    stubCookie();
    setSession(SESION_V1);

    const fetchMock = vi.fn(async (url: string) => {
      // Cualquier llamada original (n=1 o 2, orden no determinista) → 401;
      // los reintentos (n=3+) → 200. El refresh siempre devuelve sesión nueva.
      if (String(url) === '/auth/refresh') {
        return { ok: true, json: async () => ({ success: true, data: SESION_V2, error: null }) } as unknown as Response;
      }
      const n = fetchMock.mock.calls.length;
      if (n <= 2) return { ok: true, json: async () => UNAUTHORIZED } as unknown as Response;
      return { ok: true, json: async () => OK_PROJECTS } as unknown as Response;
    });
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const resultados = await Promise.all([
      apiFetch('/api/projects').catch((e) => ({ err: e })),
      apiFetch('/api/projects').catch((e) => ({ err: e })),
    ]);
    expect(resultados.every((r) => !('err' in (r as Record<string, unknown>)))).toBe(true); // ambas resuelven (retry OK)

    const refreshCalls = fetchMock.mock.calls.filter(([u]) => String(u) === '/auth/refresh').length;
    expect(refreshCalls).toBe(1); // deduplicada
  });
});