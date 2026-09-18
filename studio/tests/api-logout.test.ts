/**
 * api-logout.test.ts — logout real (C5g): el cliente avisa al servidor antes de
 * borrar la cookie, y jamás se queda bloqueado si la red falla. Fetch y cookie
 * simulados con stubs (node, sin jsdom).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiLogout, ApiError } from '../src/io/api';
import { clearSession, getSession, setSession, type AuthSession } from '../src/io/session';

const SESION: AuthSession = {
  user: { id: 'u1', login: 'chimi', nombre: 'A', apellido: 'G', emailPublico: null, rol: 'creador' },
  accessToken: 'access-vivo',
  refreshToken: 'refresh-vivo',
  refreshTokenId: 's1',
};

function stubCookie(): void {
  let jar = '';
  vi.stubGlobal('document', {
    get cookie() { return jar; },
    set cookie(v: string) { jar = v; },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  clearSession();
});

describe('apiLogout (C5g)', () => {
  it('manda el refresh con el access en el header y devuelve {loggedOut}', async () => {
    stubCookie();
    setSession(SESION);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ success: true, data: { loggedOut: true }, error: null }),
    }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    const data = await apiLogout(SESION.refreshToken);

    expect(data).toEqual({ loggedOut: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/auth/logout');
    expect(init.method).toBe('POST');
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer access-vivo');
    expect(init.body).toBe(JSON.stringify({ refreshToken: 'refresh-vivo' }));
  });

  it('no intenta renovar la sesión con un 401 (no hay bucle de refresh)', async () => {
    stubCookie();
    setSession(SESION);
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({
        success: false,
        data: null,
        error: { code: 'UNAUTHORIZED', message: 'No autenticado', details: null },
      }),
    }) as unknown as Response);
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);

    await expect(apiLogout(SESION.refreshToken)).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1); // sin llamada a /auth/refresh
  });

  it('fallo de red: lanza ApiError pero la sesión se puede limpiar igual', async () => {
    stubCookie();
    setSession(SESION);
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('offline'); }) as unknown as typeof fetch);

    await expect(apiLogout(SESION.refreshToken)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    clearSession();
    expect(getSession()).toBeNull();
  });
});
