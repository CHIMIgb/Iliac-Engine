/**
 * io/session.ts — Sesión del Studio (C5a), guardada en COOKIE.
 *
 * Decisión 2026-09-16 (usuario): la sesión vive en una cookie (`raycast_session`,
 * Path=/, Max-Age 7 días = TTL del refresh) y NO en localStorage. Se almacena
 * el JSON completo (user + tokens) porque el backend (C1) espera el access
 * token en el header `Authorization: Bearer` — el front lo lee de la cookie.
 *
 * Nota: es una cookie legible por JS (no httpOnly). Hacerla httpOnly exige que
 * el backend la fije con Set-Cookie y cambiar el contrato C1 validado — queda
 * como trabajo posterior junto a la rotación de refresh (DATABASE.md §8).
 *
 * El store es inyectable para testear en node (vitest, sin DOM).
 */

export interface AuthUser {
  id: string;
  login: string;
  nombre: string;
  apellido: string;
  emailPublico: string | null;
  rol: string;
}

/** Sesión completa devuelta por /auth/register y /auth/login. */
export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
}

/** Mínimo de operaciones de cookie para inyectar en tests (Map-like). */
export interface SessionStore {
  getCookie(name: string): string | null;
  setCookie(name: string, value: string, maxAgeSec?: number): void;
  removeCookie(name: string): void;
}

const COOKIE = 'raycast_session';
const MAX_AGE_SEC = 7 * 24 * 60 * 60; // coincide con el refresh token (7 días)

/** Store por defecto: document.cookie (solo en navegador; null en node). */
function defaultStore(): SessionStore | null {
  if (typeof document === 'undefined') return null;
  return {
    getCookie(name) {
      const match = document.cookie
        .split(';')
        .map((p) => p.trim())
        .find((p) => p.startsWith(`${name}=`));
      if (!match) return null;
      try {
        return decodeURIComponent(match.slice(name.length + 1));
      } catch {
        return null; // cookie corrupta → se trata como ausente
      }
    },
    setCookie(name, value, maxAgeSec) {
      document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax`;
    },
    removeCookie(name) {
      document.cookie = `${name}=; Path=/; Max-Age=0`;
    },
  };
}

/** Lee la sesión desde la cookie. null si no hay, está corrupta o no es sesión. */
export function getSession(store?: SessionStore): AuthSession | null {
  const s = store ?? defaultStore();
  if (!s) return null;
  const raw = s.getCookie(COOKIE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthSession;
    if (parsed && typeof parsed.accessToken === 'string' && parsed.user?.id) {
      return parsed;
    }
  } catch {
    // JSON corrupto → se trata como sesión ausente.
  }
  return null;
}

/** Guarda la sesión en la cookie (7 días). */
export function setSession(session: AuthSession, store?: SessionStore): void {
  (store ?? defaultStore())?.setCookie(COOKIE, JSON.stringify(session), MAX_AGE_SEC);
}

/** Borra la sesión (logout). */
export function clearSession(store?: SessionStore): void {
  (store ?? defaultStore())?.removeCookie(COOKIE);
}

/** ¿Hay sesión activa? */
export function isAuthenticated(store?: SessionStore): boolean {
  return getSession(store) !== null;
}