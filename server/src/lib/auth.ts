// lib/auth.ts — Middleware de autenticación JWT (DATABASE.md §8 C2) + lo que
// faltaba para el logout real (C5g):
//  - verifyAccessToken(): firma + expiración + denylist (`token_invalido`).
//    Es el ÚNICO sitio donde se valida un access token — los guards y cualquier
//    endpoint nuevo pasan por aquí (regla de AGENTS.md), así que un token
//    revocado por logout muere en TODA la API sin tocar endpoint a endpoint.
//  - requireAuth / optionalAuth: guards (401 genérico / visitante anónimo).
import type { Context, Next } from "hono";
import { AppError } from "./AppError.ts";
import { verifyToken, type TokenPayload } from "./jwt.ts";
import { prisma } from "../db.ts";

export interface AuthEnv {
  Variables: { userId: string; accessJti?: string; accessExp?: number };
}

/** Sesión opcional: el userId puede no estar (endpoints públicos con extras). */
export interface OptionalAuthEnv {
  Variables: { userId?: string };
}

/**
 * Valida un access token contra el contrato de la API: firma HS256 + `exp` +
 * denylist. Lanza si el token no vale (el caller traduce a 401 / anónimo).
 * La denylist son filas de `token_invalido` (una por logout), buscadas por el
 * `jti` unique → O(1) y solo se escribe al cerrar sesión (purga perezosa).
 */
export async function verifyAccessToken(token: string): Promise<TokenPayload> {
  const payload = await verifyToken<TokenPayload>(token);
  if (payload.jti) {
    const revocado = await prisma.tokenInvalido.findUnique({ where: { jti: payload.jti } });
    if (revocado) throw new AppError("UNAUTHORIZED");
  }
  return payload;
}

/** Extrae el bearer del header; null si falta o está vacío. */
function bearer(c: Context): string | null {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token || null;
}

export async function requireAuth(c: Context<AuthEnv>, next: Next) {
  const token = bearer(c);
  if (!token) throw new AppError("UNAUTHORIZED");
  try {
    const payload = await verifyAccessToken(token);
    c.set("userId", payload.sub);
    // El logout necesita el jti/exp del access presentado (denylist inmediata).
    c.set("accessJti", payload.jti);
    c.set("accessExp", payload.exp);
  } catch {
    throw new AppError("UNAUTHORIZED");
  }
  await next();
}

/**
 * Como requireAuth, pero sin token (o con token inválido/revocado) sigue
 * adelante sin usuario. Sirve a endpoints públicos que añaden datos extra si
 * hay sesión (C5d: `GET /api/templates` incluye las plantillas propias).
 */
export async function optionalAuth(c: Context<OptionalAuthEnv>, next: Next) {
  const token = bearer(c);
  if (token) {
    try {
      const payload = await verifyAccessToken(token);
      c.set("userId", payload.sub);
    } catch {
      // Token caducado, inválido o revocado: visitante anónimo, no error.
    }
  }
  await next();
}
