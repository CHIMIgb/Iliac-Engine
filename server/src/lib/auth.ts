// lib/auth.ts — Middleware de autenticación JWT (DATABASE.md §8 C2).
// requireAuth valida el token de acceso ("Authorization: Bearer <token>") y
// deja el userId en el contexto de Hono. Token ausente/vencido/inválido →
// 401 UNAUTHORIZED genérico (contrato), nunca detalles del porqué.
import type { Context, Next } from "hono";
import { AppError } from "./AppError.ts";
import { verifyToken, type TokenPayload } from "./jwt.ts";

export interface AuthEnv {
  Variables: { userId: string };
}

export async function requireAuth(c: Context<AuthEnv>, next: Next) {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) throw new AppError("UNAUTHORIZED");
  const token = header.slice("Bearer ".length).trim();
  if (!token) throw new AppError("UNAUTHORIZED");
  try {
    const payload = await verifyToken<TokenPayload>(token);
    c.set("userId", payload.sub);
  } catch {
    throw new AppError("UNAUTHORIZED");
  }
  await next();
}