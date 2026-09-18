// Tests de renovación de sesión (DATABASE.md §8 C5f) — integración contra la DB
// local. Crean un usuario temporal y lo eliminan al final; los refresh rotan de
// verdad (revocado_viejo + nuevo). Si la DB no está disponible se saltan.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verify } from "hono/jwt";
import { prisma } from "../src/db.ts";
import { createApp } from "../src/app.ts";
import { signToken } from "../src/lib/jwt.ts";
import { refreshLimiter } from "../src/lib/rateLimit.ts";

let DB_UP = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  DB_UP = true;
} catch {
  DB_UP = false;
}

const app = createApp();
const LOGIN = `refresh_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const PASSWORD = "secreto-123";
const SECRET = process.env.JWT_SECRET ?? "";

/** Login del usuario temporal → sesión completa (tokens + refreshTokenId). */
async function login(): Promise<{
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
}> {
  const res = await app.request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: LOGIN, password: PASSWORD }),
  });
  assert.equal(res.status, 200);
  const b = (await res.json()) as {
    success: boolean;
    data: { accessToken: string; refreshToken: string; refreshTokenId: string };
  };
  return b.data;
}

/** Body tipado del contrato para /auth/refresh. */
async function refreshBody(refreshToken: string) {
  const res = await app.request("/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  const b = (await res.json()) as {
    success: boolean;
    data: { user: { login: string }; accessToken: string; refreshToken: string; refreshTokenId: string } | null;
    error: { code: string; message: string } | null;
  };
  return { res, b };
}

test.after(async () => {
  if (!DB_UP) return;
  await prisma.usuario.deleteMany({ where: { login: LOGIN } });
});

test("login previo: crea el usuario temporal para los tests de refresh", { skip: !DB_UP && "DB no disponible" }, async () => {
  const res = await app.request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: LOGIN, password: PASSWORD, nombre: "Refresh", apellido: "C5f" }),
  });
  assert.equal(res.status, 201);
});

test("refresh válido: devuelve access + refresh nuevos y rotación (el viejo deja de servir)", { skip: !DB_UP && "DB no disponible" }, async () => {
  const sesion = await login();

  const { res, b } = await refreshBody(sesion.refreshToken);
  assert.equal(res.status, 200);
  assert.equal(b.success, true);
  const nuevo = b.data!;
  assert.notEqual(nuevo.refreshToken, sesion.refreshToken, "el refresh rota (token distinto)");
  assert.notEqual(nuevo.refreshTokenId, sesion.refreshTokenId, "el sid rota (fila nueva)");

  // El access nuevo es un JWT válido de la misma cuenta.
  const payload = (await verify(nuevo.accessToken, SECRET, "HS256")) as unknown as { login: string };
  assert.equal(payload.login, LOGIN);

  // El refresh viejo quedó revocado: reusarlo responde 401.
  const reuse = await refreshBody(sesion.refreshToken);
  assert.equal(reuse.res.status, 401);
  assert.equal(reuse.b.error?.code, "UNAUTHORIZED");
});

test("refresh encadenado: el rotado nuevo vuelve a servir (y rota otra vez)", { skip: !DB_UP && "DB no disponible" }, async () => {
  const sesion = await login();
  const primera = await refreshBody(sesion.refreshToken);
  assert.equal(primera.res.status, 200);

  const segunda = await refreshBody(primera.b!.data!.refreshToken);
  assert.equal(segunda.res.status, 200);
  assert.notEqual(segunda.b!.data!.refreshToken, primera.b!.data!.refreshToken);
  assert.equal(segunda.b!.data!.user.login, LOGIN);
});

test("refresh inexistente o malformado responde 401 UNAUTHORIZED", async () => {
  const basura = "no-es-un-jwt";
  const { res, b } = await refreshBody(basura);
  assert.equal(res.status, 401);
  assert.equal(b.error?.code, "UNAUTHORIZED");
});

test("refresh expirado responde 401 UNAUTHORIZED", async () => {
  // Firma un refresh con exp en el pasado: verifyToken lanza antes de tocar DB.
  const expirado = await signToken(
    { sub: "00000000-0000-0000-0000-000000000000", login: LOGIN, rol: "creador", sid: "x" },
    -60,
  );
  const { res, b } = await refreshBody(expirado);
  assert.equal(res.status, 401);
  assert.equal(b.error?.code, "UNAUTHORIZED");
});

test("reuso tras rotación (robo): responde 401 y revoca TODAS las sesiones del usuario", { skip: !DB_UP && "DB no disponible" }, async () => {
  // Dos sesiones activas del mismo usuario.
  const s1 = await login();
  const s2 = await login();

  // Rotar s1 (queda revocada; s2 sigue viva).
  const ok = await refreshBody(s1.refreshToken);
  assert.equal(ok.res.status, 200);

  // Reusar el refresh viejo de s1 → posible robo → revoca s2 también.
  const robo = await refreshBody(s1.refreshToken);
  assert.equal(robo.res.status, 401);

  // s2 ya no sirve (revocada en cascada).
  const s2Ahora = await refreshBody(s2.refreshToken);
  assert.equal(s2Ahora.res.status, 401);
});

test("refresh sin body o sin token responde 422 VALIDATION_ERROR", async () => {
  const sinToken = await app.request("/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(sinToken.status, 422);
  const b = (await sinToken.json()) as { error: { code: string } };
  assert.equal(b.error.code, "VALIDATION_ERROR");
});

test("refresh limite por IP: la 11ª petición en 1 min responde 429", async () => {
  const limitedApp = createApp();
  limitedApp.post("/refresh-limit-test", refreshLimiter.middleware, (c) => c.json({ ok: true }));
  let last = 0;
  for (let i = 0; i < 11; i += 1) {
    // IP única para este test: el limiter es un singleton compartido (Map por IP)
    // y la ventana de "local" ya la han usado los tests anteriores.
    last = (
      await limitedApp.request("/refresh-limit-test", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.77" },
      })
    ).status;
  }
  assert.equal(last, 429);
});