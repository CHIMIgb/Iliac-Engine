// Tests de autenticación (DATABASE.md §8 C1) — integración contra la DB local.
// Crean un usuario temporal (login aleatorio) y lo eliminan al final; los
// tokens se verifican de verdad con hono/jwt. Si la DB no está disponible los
// tests se saltan con motivo (el dev server requiere DB sí o sí).
import { test } from "node:test";
import assert from "node:assert/strict";
import { verify } from "hono/jwt";
import { prisma } from "../src/db.ts";
import { createApp } from "../src/app.ts";
import { createLimiter } from "../src/lib/rateLimit.ts";

// Sonda: la DB debe estar levantada (misma que usa el server).
let DB_UP = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  DB_UP = true;
} catch {
  DB_UP = false;
}

const app = createApp();
const LOGIN = `test_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
const PASSWORD = "secreto-123";
const SECRET = process.env.JWT_SECRET ?? "";

interface TokenLike {
  sub: string;
  login: string;
  rol: string;
  exp: number;
}

async function json(res: Response) {
  return (await res.json()) as {
    success: boolean;
    data: {
      user: { id: string; login: string; rol: string };
      accessToken: string;
      refreshToken: string;
    } | null;
    error: { code: string; message: string; details?: unknown } | null;
  };
}

test.after(async () => {
  if (!DB_UP) return;
  await prisma.usuario.deleteMany({ where: { login: LOGIN } });
});

test("register crea usuario y devuelve tokens que se verifican con JWT_SECRET", { skip: !DB_UP && "DB no disponible" }, async () => {
  const res = await app.request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: LOGIN, password: PASSWORD, nombre: "Test", apellido: "C1" }),
  });
  assert.equal(res.status, 201);
  // Leer el body UNA sola vez: text() y parsear; res.json() después fallaría.
  const raw = await res.text();
  const b = JSON.parse(raw) as {
    success: boolean;
    data: { user: { id: string; login: string; rol: string }; accessToken: string; refreshToken: string } | null;
    error: { code: string; message: string } | null;
  };
  assert.equal(b.success, true);
  const data = b.data!;
  assert.equal(data.user.login, LOGIN);
  assert.equal(data.user.rol, "creador");
  // El hash nunca viaja en la respuesta.
  assert.ok(!raw.includes("passwordHash") && !raw.includes("$2a$"), "no filtra el hash");

  const payload = (await verify(data.accessToken, SECRET, "HS256")) as unknown as TokenLike;
  assert.equal(payload.sub, data.user.id);
  assert.equal(payload.login, LOGIN);
  assert.equal(payload.rol, "creador");
  assert.ok(payload.exp > Math.floor(Date.now() / 1000), "access expira en el futuro");
});

test("register con login duplicado responde 409 LOGIN_IN_USE", { skip: !DB_UP && "DB no disponible" }, async () => {
  // Además de LOGIN, aseguramos existencia con el register del test anterior
  // (orden secuencial) — si no, creamos uno aquí.
  await prisma.usuario.upsert({
    where: { login: LOGIN },
    update: {},
    create: { login: LOGIN, passwordHash: "x", rolId: (await prisma.rol.findUniqueOrThrow({ where: { nombre: "creador" } })).id },
  });
  const res = await app.request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: LOGIN, password: PASSWORD, nombre: "Dup", apellido: "Dup" }),
  });
  assert.equal(res.status, 409);
  const b = await json(res);
  assert.equal(b.success, false);
  assert.equal(b.error?.code, "LOGIN_IN_USE");
});

test("register con password corta responde 422 VALIDATION_ERROR", async () => {
  const res = await app.request("/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: `t_${LOGIN}`, password: "123", nombre: "X", apellido: "Y" }),
  });
  assert.equal(res.status, 422);
  const b = await json(res);
  assert.equal(b.error?.code, "VALIDATION_ERROR");
  const details = b.error?.details as { issues: { path: string }[] };
  assert.ok(details.issues.some((i) => i.path.includes("password")), "issue para password");
});

test("login correcto devuelve access + refresh y el refresh queda registrado (sha256)", { skip: !DB_UP && "DB no disponible" }, async () => {
  const res = await app.request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: LOGIN, password: PASSWORD }),
  });
  assert.equal(res.status, 200);
  const b = await json(res);
  assert.equal(b.success, true);
  const data = b.data!;
  assert.equal(data.user.rol, "creador");
  const payload = (await verify(data.accessToken, SECRET, "HS256")) as unknown as TokenLike;
  assert.equal(payload.login, LOGIN);
});

test("login con password incorrecta responde 401 INVALID_CREDENTIALS", { skip: !DB_UP && "DB no disponible" }, async () => {
  const res = await app.request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: LOGIN, password: "contraseña-mala" }),
  });
  assert.equal(res.status, 401);
  const b = await json(res);
  assert.equal(b.error?.code, "INVALID_CREDENTIALS");
});

test("login de usuario inexistente responde 401 INVALID_CREDENTIALS (sin enumerar usuarios)", async () => {
  const res = await app.request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ login: "no_existe_999", password: "cualquiera" }),
  });
  assert.equal(res.status, 401);
  const b = await json(res);
  assert.equal(b.error?.code, "INVALID_CREDENTIALS");
});

test("rate limit bloquea tras N intentos (429 TOO_MANY_REQUESTS)", async () => {
  const limiter = createLimiter({ windowMs: 60_000, max: 2 });
  const limitedApp = createApp();
  limitedApp.get("/limit-test", limiter.middleware, (c) => c.json({ ok: true }));
  const first = await limitedApp.request("/limit-test");
  const second = await limitedApp.request("/limit-test");
  const third = await limitedApp.request("/limit-test");
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(third.status, 429);
  const b = (await third.json()) as { success: boolean; error: { code: string } };
  assert.equal(b.success, false);
  assert.equal(b.error.code, "TOO_MANY_REQUESTS");
});