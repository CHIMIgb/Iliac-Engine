// routes/auth.ts — Autenticación (DATABASE.md §8 C1).
//  POST /auth/register — crea Persona + Usuario (rol creador) en transacción.
//  POST /auth/login    — rate limit → bcrypt → access (15 min) + refresh (7 d).
// El refresh se guarda HASHEADO (sha256) en RefreshToken para rotación futura.
// Toda respuesta usa el contrato {success,data,error}; los errores de Zod se
// convierten con AppError.fromZod (422).
import { Hono } from "hono";
import type { z } from "zod";
import { prisma } from "../db.ts";
import { AppError } from "../lib/AppError.ts";
import { sha256hex, signToken } from "../lib/jwt.ts";
import { hashPassword, verifyPassword } from "../lib/password.ts";
import { loginLimiter } from "../lib/rateLimit.ts";
import { loginSchema, registerSchema } from "../schemas/auth.ts";

const ACCESS_TTL_SEC = 15 * 60; // 15 min
const REFRESH_TTL_SEC = 7 * 24 * 60 * 60; // 7 días

/** Valida el body con Zod; lanza AppError 422 con issues aplanados si falla. */
function parseBody<T>(schema: z.ZodType<T>, json: unknown): T {
  const r = schema.safeParse(json);
  if (!r.success) throw AppError.fromZod(r.error);
  return r.data;
}

async function tokensFor(usuario: { id: string; login: string; rol: string; sid?: string }) {
  const [accessToken, refreshToken] = await Promise.all([
    signToken({ sub: usuario.id, login: usuario.login, rol: usuario.rol }, ACCESS_TTL_SEC),
    signToken({ sub: usuario.id, login: usuario.login, rol: usuario.rol }, REFRESH_TTL_SEC),
  ]);
  return { accessToken, refreshToken };
}

/** Resumen público del usuario para la respuesta (nunca passwordHash). */
function userSummary(u: {
  id: string;
  login: string;
  persona: { nombre: string; apellido: string; emailPublico: string | null } | null;
  rol: { nombre: string };
}) {
  return {
    id: u.id,
    login: u.login,
    nombre: u.persona?.nombre ?? "",
    apellido: u.persona?.apellido ?? "",
    emailPublico: u.persona?.emailPublico ?? null,
    rol: u.rol.nombre,
  };
}

export const authRoutes = new Hono();

authRoutes.post("/register", async (c) => {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    throw AppError.fromZod({ issues: [{ path: [], message: "Body JSON inválido" }] });
  }
  const input = parseBody(registerSchema, json);

  // Login único: mismo tratamiento que email duplicado (409 LOGIN_IN_USE).
  const existing = await prisma.usuario.findUnique({ where: { login: input.login } });
  if (existing) throw new AppError("LOGIN_IN_USE", { login: input.login });

  const rol = await prisma.rol.findUnique({ where: { nombre: "creador" } });
  if (!rol) throw new AppError("INTERNAL_ERROR", undefined, "Falta el rol 'creador' (seed de A1)");

  const passwordHash = await hashPassword(input.password);

  const usuario = await prisma.$transaction(async (tx) => {
    const persona = await tx.persona.create({
      data: { nombre: input.nombre, apellido: input.apellido, emailPublico: input.emailPublico },
    });
    return tx.usuario.create({
      data: {
        login: input.login,
        passwordHash,
        rolId: rol.id,
        personaId: persona.id,
      },
      include: { persona: true, rol: true },
    });
  });

  const tokens = await tokensFor({
    id: usuario.id,
    login: usuario.login,
    rol: usuario.rol.nombre,
  });
  await prisma.refreshToken.create({
    data: {
      usuarioId: usuario.id,
      tokenHash: sha256hex(tokens.refreshToken),
      expiraEn: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
    },
  });

  return c.json(
    // notFound/errores globales ya usan el contrato; aquí solo envolver el éxito.
    // (ok() está en lib/handler.ts pero este router prefiere shape idéntico de C2.)
    { success: true, data: { user: userSummary(usuario), accessToken: tokens.accessToken, refreshToken: tokens.refreshToken }, error: null },
    201,
  );
});

authRoutes.post("/login", loginLimiter.middleware, async (c) => {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    throw AppError.fromZod({ issues: [{ path: [], message: "Body JSON inválido" }] });
  }
  const input = parseBody(loginSchema, json);

  // Credenciales malas → mismo error (401) para no enumerar usuarios.
  const usuario = await prisma.usuario.findUnique({
    where: { login: input.login },
    include: { persona: true, rol: true },
  });
  const hash = usuario?.passwordHash ?? "";
  const ok = usuario !== null && (await verifyPassword(input.password, hash));
  if (!ok) throw new AppError("INVALID_CREDENTIALS");

  const tokens = await tokensFor({ id: usuario.id, login: usuario.login, rol: usuario.rol.nombre });
  const sid = (
    await prisma.refreshToken.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: sha256hex(tokens.refreshToken),
        expiraEn: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
      },
    })
  ).id;

  return c.json({
    success: true,
    data: {
      user: userSummary(usuario),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      refreshTokenId: sid,
    },
    error: null,
  });
});