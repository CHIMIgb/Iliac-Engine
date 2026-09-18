/**
 * session.test.ts — persistencia de sesión en COOKIE (C5a): round-trip
 * guardar/cargar/borrar con store inyectable (Map-like, sin DOM) y tolerancia
 * a datos corruptos.
 */
import { describe, it, expect } from 'vitest';
import {
  getSession, setSession, clearSession, isAuthenticated,
  type AuthSession, type SessionStore,
} from '../src/io/session';

/** Store fake: comportamiento mínimo de cookies sobre un Map. */
function fakeStore(): SessionStore {
  const m = new Map<string, string>();
  return {
    getCookie: (n: string) => m.get(n) ?? null,
    setCookie: (n: string, v: string) => void m.set(n, v),
    removeCookie: (n: string) => void m.delete(n),
  };
}

const session: AuthSession = {
  user: { id: 'u1', login: 'chimi', nombre: 'A', apellido: 'G', emailPublico: null, rol: 'creador' },
  accessToken: 'abc',
  refreshToken: 'def',
  refreshTokenId: 'sid-1',
};

describe('session (C5a, cookie)', () => {
  it('round-trip: guardar → cargar devuelve la misma sesión', () => {
    const store = fakeStore();
    setSession(session, store);
    expect(getSession(store)).toEqual(session);
    expect(isAuthenticated(store)).toBe(true);
  });

  it('clearSession borra la sesión', () => {
    const store = fakeStore();
    setSession(session, store);
    clearSession(store);
    expect(getSession(store)).toBeNull();
    expect(isAuthenticated(store)).toBe(false);
  });

  it('store vacío o corrupto → sesión ausente (sin excepción)', () => {
    const store = fakeStore();
    expect(getSession(store)).toBeNull();
    store.setCookie('raycast_session', '{no-json');
    expect(getSession(store)).toBeNull();
    store.setCookie('raycast_session', JSON.stringify({ user: { id: 'x' } })); // sin accessToken
    expect(getSession(store)).toBeNull();
  });
});