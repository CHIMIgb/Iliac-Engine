/**
 * api.test.ts — cliente HTTP tipado (C5a): valida el contrato pinnado
 * {success,data,error} y lanza ApiError con el shape acordado (details
 * siempre presente). Fetch y la cookie de sesión se simulan con stubs
 * (node, sin jsdom).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, ApiError } from '../src/io/api';
import { setSession } from '../src/io/session';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Simula una respuesta HTTP que devuelve el body dado. */
function mockFetch(body: unknown, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, json: async () => body } as unknown as Response)),
  );
}

describe('apiFetch (C5a)', () => {
  it('éxito → devuelve data tipado sin envoltorio', async () => {
    mockFetch({ success: true, data: { ok: 1 }, error: null });
    await expect(apiFetch<{ ok: number }>('/x')).resolves.toEqual({ ok: 1 });
  });

  it('error → lanza ApiError con code/message/details (null si no hay detalle)', async () => {
    mockFetch({ success: false, data: null, error: { code: 'NOT_FOUND', message: 'No existe', details: null } });
    const err = await apiFetch('/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'NOT_FOUND', message: 'No existe', details: null });
  });

  it('error con details → ApiError conserva el detalle (shape pinnado)', async () => {
    mockFetch({ success: false, data: null, error: { code: 'LOGIN_IN_USE', message: 'Ya existe', details: { login: 'x' } } });
    const err = await apiFetch('/x').catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'LOGIN_IN_USE', details: { login: 'x' } });
  });

  it('red caída → NETWORK_ERROR sin excepción cruda', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    const err = await apiFetch('/x').catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('respuesta no-JSON → INVALID_RESPONSE', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => { throw new SyntaxError('bad'); } } as unknown as Response)));
    const err = await apiFetch('/x').catch((e: unknown) => e);
    expect(err).toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('envía Authorization Bearer cuando hay sesión (cookie)', async () => {
    // Falso document.cookie: la sesión vive en una cookie (C5a, decisión usuario).
    let jar = '';
    vi.stubGlobal('document', {
      get cookie() { return jar; },
      set cookie(v: string) { jar = v; },
    });
    setSession({
      user: { id: 'u1', login: 'chimi', nombre: 'A', apellido: 'G', emailPublico: null, rol: 'creador' },
      accessToken: 'tok-1',
      refreshToken: 'r',
      refreshTokenId: 's',
    });

    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      ({ json: async () => ({ success: true, data: null, error: null }) } as unknown as Response),
    );
    vi.stubGlobal('fetch', fetchMock as unknown as typeof fetch);
    await apiFetch('/api/projects');
    const init = fetchMock.mock.calls[0]![1]!;
    expect((init.headers as Headers).get('Authorization')).toBe('Bearer tok-1');
  });
});