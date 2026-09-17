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
import { requireAuth, type AuthEnv } from "../lib/auth.ts";
import { ok } from "../lib/handler.ts";
import { sha256hex, signToken, verifyToken, type TokenPayload } from "../lib/jwt.ts";
import { hashPassword, verifyPassword } from "../lib/password.ts";
import { loginLimiter, refreshLimiter } from "../lib/rateLimit.ts";
import { loginSchema, logoutSchema, refreshSchema, registerSchema } from "../schemas/auth.ts";

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

export const authRoutes = new Hono<AuthEnv>();

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

// C5f — renovación de sesión con ROTACIÓN del refresh token (DATABASE.md §3.8):
// al refrescar se revoca el refresh viejo y se firma uno nuevo; reusar un token
// ya rotado indica posible robo → se revocan TODAS las sesiones del usuario.
// El access vuelve a durar 15 min; el front re-guarda la sesión y reintenta.
authRoutes.post("/refresh", refreshLimiter.middleware, async (c) => {
  let json: unknown;
  try {
    json = await c.req.json();
  } catch {
    throw AppError.fromZod({ issues: [{ path: [], message: "Body JSON inválido" }] });
  }
  const { refreshToken } = parseBody(refreshSchema, json);

  // 1. Firma + expiración del JWT refresh (7 días). La sesión se identifica por
  //    tokenHash (unique) — el payload no necesita `sid`: jwt.ts anunciaba el
  //    sid para rotación futura pero tokensFor() nunca lo firmó (el id de la
  //    fila se crea después); buscar por hash es suficiente y más simple.
  let payload: TokenPayload;
  try {
    payload = await verifyToken<TokenPayload>(refreshToken);
  } catch {
    throw new AppError("UNAUTHORIZED", undefined, "Refresh token inválido o expirado");
  }
  if (!payload.sub) {
    throw new AppError("UNAUTHORIZED", undefined, "Refresh token inválido");
  }

  // 2. La fila respalda al token (mismo 401 genérico para no enumerar sesiones).
  const row = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256hex(refreshToken) },
  });
  if (!row || row.expiraEn <= new Date()) {
    throw new AppError("UNAUTHORIZED", undefined, "Refresh token inválido o expirado");
  }
  if (row.revocadoEn !== null) {
    // Token viejo reusado tras rotar → posible robo: revocar todas las sesiones.
    await prisma.refreshToken.updateMany({
      where: { usuarioId: row.usuarioId, revocadoEn: null },
      data: { revocadoEn: new Date() },
    });
    throw new AppError("UNAUTHORIZED", undefined, "Sesión revocada");
  }

  const usuario = await prisma.usuario.findUnique({
    where: { id: row.usuarioId },
    include: { persona: true, rol: true },
  });
  if (!usuario) throw new AppError("UNAUTHORIZED", undefined, "Sesión inválida");

  // 3. Rotación atómica: revocar el viejo + crear el nuevo (mismo usuario).
  const tokens = await tokensFor({ id: usuario.id, login: usuario.login, rol: usuario.rol.nombre });
  const sid = await prisma.$transaction(async (tx) => {
    await tx.refreshToken.update({
      where: { id: row.id },
      data: { revocadoEn: new Date() },
    });
    const nuevo = await tx.refreshToken.create({
      data: {
        usuarioId: usuario.id,
        tokenHash: sha256hex(tokens.refreshToken),
        expiraEn: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
      },
    });
    return nuevo.id;
  });

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

// C5g — Logout: cierra SOLO esta sesión (DATABASE.md §3.8).
//  1. Revoca la fila de refresh de ESTA sesión (por hash + dueño): las demás
//     sesiones del mismo usuario siguen vivas. Idempotente y sin filtrar si el
//     token es ajeno/inexistente (mismo 200: cerrar sesión nunca falla).
//  2. Mete el `jti` del access en `token_invalido` con su expiración real: sin
//     esto el access seguiría sirviendo hasta 15 min tras cerrar sesión.
//     Purga perezosa de las filas vencidas en la misma transacción.
// (La revocación GLOBAL solo ocurre al detectar reuso de un refresh rotado en
// /auth/refresh: eso es robo de token, no un logout.)
authRoutes.post("/logout", requireAuth, async (c) => {
  const userId = c.get("userId");
  const jti = c.get("accessJti");
  const exp = c.get("accessExp");

  // El body es opcional: sin refresh solo se denylista el access.
  let json: unknown = {};
  try {
    json = await c.req.json();
  } catch {
    // Sin body → se trata como {} (logout del access a secas).
  }
  const { refreshToken } = parseBody(logoutSchema, json ?? {});

  const ahora = new Date();
  if (refreshToken) {
    // Se BORRA la fila (no se marca `revocadoEn`): una fila revocada que alguien
    // venga a usar es la señal de ROBO que revoca todas las sesiones en
    // /auth/refresh — y el refresh de una sesión ya cerrada lo puede reintentar
    // un cliente legítimo (pestaña abierta, petición en vuelo) sin que haya
    // robo alguno. Sin fila, ese token es simplemente inválido (401) y las
    // demás sesiones siguen intactas.
    await prisma.refreshToken.deleteMany({
      where: { tokenHash: sha256hex(refreshToken), usuarioId: userId },
    });
  }

  if (jti) {
    const expiraEn = exp ? new Date(exp * 1000) : new Date(Date.now() + ACCESS_TTL_SEC * 1000);
    await prisma.$transaction([
      prisma.tokenInvalido.deleteMany({ where: { expiraEn: { lt: ahora } } }),
      prisma.tokenInvalido.upsert({
        where: { jti },
        create: { jti, usuarioId: userId, expiraEn },
        update: {}, // ya denylistado: no-op (logout repetido)
      }),
    ]);
  }

  return ok(c, { loggedOut: true });
});