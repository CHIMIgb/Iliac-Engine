// jwt.ts — Firma/verificación de tokens con hono/jwt (HS256, incluye Hono).
// Access: 15 min. Refresh: 7 días con `sid` (id del registro RefreshToken) para
// rotación/revocación futuras. El secret vive en JWT_SECRET (.env, gitignored).
import { createHash } from "node:crypto";
import { sign, verify } from "hono/jwt";

const SECRET = process.env.JWT_SECRET ?? "";
if (!SECRET) {
  throw new Error("Falta JWT_SECRET en el entorno. Copia server/.env.example a server/.env.");
}

export interface TokenPayload {
  sub: string; // usuario.id
  login: string;
  rol: string;
  sid?: string; // id del RefreshToken en DB (solo refresh)
}

export function signToken(payload: TokenPayload, expiresInSec: number): Promise<string> {
  return sign(
    { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSec },
    SECRET,
    "HS256",
  );
}

export async function verifyToken<T = TokenPayload>(token: string): Promise<T> {
  // hono/jwt lanza JwtTokenInvalid/JwtTokenExpired si falla; el caller decide
  // cómo traducirlo al contrato.
  return (await verify(token, SECRET, "HS256")) as unknown as T;
}

/** Hash SHA-256 hex de un token: identificador opaco para la tabla RefreshToken. */
export function sha256hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}