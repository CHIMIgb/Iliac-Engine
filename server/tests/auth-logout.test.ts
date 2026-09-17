// Tests del logout real y la denylist de access tokens (DATABASE.md §8 C5g) —
// integración contra la DB local. Crean dos usuarios temporales, abren varias
// sesiones y comprueban: el logout cierra SOLO esa sesión, el access muere ya
// (token_invalido) y la revocación global solo ocurre al detectar reuso de un
// refresh rotado (/auth/refresh). Si la DB no está disponible se saltan.
import { test } from "node:test";
import assert from "node:assert/strict";
import { verify } from "hono/jwt";
import { prisma } from "../src/db.ts";
import { createApp } from "../src/app.ts";

let DB_UP = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  DB_UP = true;
} catch {
  DB_UP = false;
}

const app = createApp();
const SECRET = process.env.JWT_SECRET ?? "";
const PASSWORD = "secreto-123";
const A = `logout_a_${Date.now()}`;
const B = `logout_b_${Date.now()}`;

interface Sesion {
  accessToken: string;
  refreshToken: string;
  refreshTokenId: string;
}

/** Petición con el contrato ya envuelto (helper local, patrón de auth-refresh).
 *  Cada llamada sale de una IP propia: loginLimiter (5/min) y refreshLimiter
 *  (10/min) son singletons por IP y estos tests encadenan varios logins. */
let ipSeq = 0;
async function api(
  path: string,
  init: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ status: number; body: { success: boolean; data: unknown; error: { code: string } | null } }> {
  const res = await app.request(path, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": `10.9.0.${++ipSeq}`,
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
    },
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  return { status: res.status, body: (await res.json()) as never };
}

async function registrar(login: string): Promise<void> {
  const res = await api("/auth/register", {
    method: "POST",
    body: { login, password: PASSWORD, nombre: "Logout", apellido: "C5g" },
  });
  assert.equal(res.status, 201);
}

async function login(login: string): Promise<Sesion> {
  const res = await api("/auth/login", { method: "POST", body: { login, password: PASSWORD } });
  assert.equal(res.status, 200);
  return res.body.data as Sesion;
}

/** Un access sirve si /api/projects responde 200; cuenta con el token dado. */
async function accessVivo(token: string): Promise<boolean> {
  return (await api("/api/projects", { token })).status === 200;
}

test.before(async () => {
  if (!DB_UP) return;
  await registrar(A);
  await registrar(B);
});

test.after(async () => {
  if (!DB_UP) return;
  await prisma.usuario.deleteMany({ where: { login: { in: [A, B] } } });
});

test("logout: el access muere al instante y queda la fila en token_invalido", { skip: !DB_UP && "DB no disponible" }, async () => {
  const s1 = await login(A);
  assert.equal(await accessVivo(s1.accessToken), true, "antes del logout el access sirve");

  const res = await api("/auth/logout", {
    method: "POST",
    token: s1.accessToken,
    body: { refreshToken: s1.refreshToken },
  });
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.data, { loggedOut: true });

  // El access ya no sirve (antes esperaba hasta 15 min a que expirase).
  assert.equal(await accessVivo(s1.accessToken), false, "tras el logout → 401");

  // El refresh de esa sesión queda revocado: no renueva.
  const refresh = await api("/auth/refresh", { method: "POST", body: { refreshToken: s1.refreshToken } });
  assert.equal(refresh.status, 401);

  // Está en la denylist con su expiración real (futuro).
  const payload = (await verify(s1.accessToken, SECRET, "HS256")) as { jti: string; exp: number };
  const fila = await prisma.tokenInvalido.findUnique({ where: { jti: payload.jti } });
  assert.ok(fila, "el jti del access está en token_invalido");
  assert.equal(fila.expiraEn.getTime(), payload.exp * 1000, "expira_en = exp del token");
  assert.ok(fila.expiraEn > new Date(), "no nace vencida (la purga no se la lleva)");
});

test("logout por sesión: las otras sesiones del MISMO usuario siguen vivas", { skip: !DB_UP && "DB no disponible" }, async () => {
  const s1 = await login(A);
  const s2 = await login(A); // otra sesión (otro "dispositivo")
  const b1 = await login(B);

  await api("/auth/logout", { method: "POST", token: s1.accessToken, body: { refreshToken: s1.refreshToken } });

  assert.equal(await accessVivo(s1.accessToken), false, "la sesión cerrada muere");
  assert.equal(await accessVivo(s2.accessToken), true, "la otra sesión del mismo usuario sigue viva");
  assert.equal(await accessVivo(b1.accessToken), true, "la sesión de otro usuario ni se entera");

  // Y el refresh de la otra sesión sigue renovando (rotación normal).
  const r2 = await api("/auth/refresh", { method: "POST", body: { refreshToken: s2.refreshToken } });
  assert.equal(r2.status, 200, "el refresh de la sesión viva renueva");
  const rB = await api("/auth/refresh", { method: "POST", body: { refreshToken: b1.refreshToken } });
  assert.equal(rB.status, 200, "el refresh de B renueva");
});

test("logout con un refresh ajeno: no revoca la sesión del otro usuario", { skip: !DB_UP && "DB no disponible" }, async () => {
  const sa = await login(A);
  const sb = await login(B);
  await api("/auth/refresh", { method: "POST", body: { refreshToken: sb.refreshToken } }); // rota el de B
  const sb2 = await login(B); // sesión nueva de B con su propio refresh

  // A intenta cerrar la sesión de B pasando SU refresh.
  const res = await api("/auth/logout", { method: "POST", token: sa.accessToken, body: { refreshToken: sb2.refreshToken } });
  assert.equal(res.status, 200, "responde 200 (no se filtra si el token es ajeno)");

  const rb = await api("/auth/refresh", { method: "POST", body: { refreshToken: sb2.refreshToken } });
  assert.equal(rb.status, 200, "el refresh de B sigue vivo: el filtro es por usuarioId");
  assert.equal(await accessVivo(sa.accessToken), false, "el access de A sí murió (era su logout)");
});

test("logout sin body: denylista el access igual", { skip: !DB_UP && "DB no disponible" }, async () => {
  const s = await login(A);
  const res = await api("/auth/logout", { method: "POST", token: s.accessToken });
  assert.equal(res.status, 200);
  assert.equal(await accessVivo(s.accessToken), false);
});

test("logout sin token → 401 (y repetirlo con el access ya denylistado también)", { skip: !DB_UP && "DB no disponible" }, async () => {
  assert.equal((await api("/auth/logout", { method: "POST" })).status, 401);

  const s = await login(A);
  assert.equal((await api("/auth/logout", { method: "POST", token: s.accessToken })).status, 200);
  // El access ya está revocado: el guard lo rechaza (idempotente desde el front,
  // que limpia la cookie igualmente).
  const repetido = await api("/auth/logout", { method: "POST", token: s.accessToken });
  assert.equal(repetido.status, 401);
  assert.equal(repetido.body.error?.code, "UNAUTHORIZED");
});

test("usar el refresh de una sesión ya cerrada NO cierra las demás (sin falso robo)", { skip: !DB_UP && "DB no disponible" }, async () => {
  const s1 = await login(A);
  const s2 = await login(A);

  await api("/auth/logout", { method: "POST", token: s1.accessToken, body: { refreshToken: s1.refreshToken } });

  // Un cliente legítimo (otra pestaña con la misma sesión, una petición en
  // vuelo) reintenta con el refresh ya cerrado: 401 simple, sin alarma.
  const reintento = await api("/auth/refresh", { method: "POST", body: { refreshToken: s1.refreshToken } });
  assert.equal(reintento.status, 401);

  // Lo importante: la OTRA sesión sigue viva (el bug era que esto la mataba).
  assert.equal(await accessVivo(s2.accessToken), true, "s2 sigue viva");
  const r2 = await api("/auth/refresh", { method: "POST", body: { refreshToken: s2.refreshToken } });
  assert.equal(r2.status, 200, "y su refresh renueva");
});

test("reuso de un refresh rotado → revocación GLOBAL (anti-robo, C5f intacto)", { skip: !DB_UP && "DB no disponible" }, async () => {
  const s1 = await login(A);
  const s2 = await login(A);

  // Rotación legítima de s1 → su refresh viejo queda revocado.
  const r = await api("/auth/refresh", { method: "POST", body: { refreshToken: s1.refreshToken } });
  assert.equal(r.status, 200);
  const s1b = r.body.data as Sesion;

  // Alguien reusa el refresh VIEJO → posible robo: se revocan TODAS las sesiones.
  const reuso = await api("/auth/refresh", { method: "POST", body: { refreshToken: s1.refreshToken } });
  assert.equal(reuso.status, 401);

  // Límite conocido del access stateless: no se puede denylistar un access que
  // no hemos visto (no hay jti ↔ sesión), así que el access emitido sobrevive
  // hasta su `exp` (≤15 min). Lo que muere es la CAPACIDAD de renovar.
  assert.equal(await accessVivo(s1b.accessToken), true, "el access vive hasta expirar (≤15 min)");
  assert.equal(await accessVivo(s2.accessToken), true, "ídem la otra sesión");

  const r1 = await api("/auth/refresh", { method: "POST", body: { refreshToken: s1b.refreshToken } });
  assert.equal(r1.status, 401, "el refresh rotado ya no renueva");
  const r2 = await api("/auth/refresh", { method: "POST", body: { refreshToken: s2.refreshToken } });
  assert.equal(r2.status, 401, "y el de la otra sesión quedó revocado (global)");
});

// Regla de AGENTS.md: todo endpoint privado pasa por el guard. Este test la
// vigila: si alguien añade una ruta y se olvida de requireAuth, aquí se ve.
test("cobertura del guard: /api/* sin token → 401 salvo la lista blanca pública", { skip: !DB_UP && "DB no disponible" }, async () => {
  const publicas = (path: string) =>
    path === "/api/gallery" ||
    path.startsWith("/api/gallery/") ||
    path === "/api/templates" ||
    path.startsWith("/api/templates/") ||
    path.endsWith("/file"); // GET /api/assets/:id/file (blob público, D1)

  const rutas = app.routes
    .filter((r) => r.path.startsWith("/api/") && !publicas(r.path))
    // `app.all`/middleware del router no aparecen aquí; las de verdad llevan método.
    .filter((r) => ["GET", "POST", "PATCH", "DELETE", "PUT"].includes(r.method));

  assert.ok(rutas.length >= 5, `hay rutas privadas que revisar (${rutas.length})`);
  for (const ruta of rutas) {
    const path = ruta.path.replace(/:[a-zA-Z]+/g, "00000000-0000-0000-0000-000000000000");
    const res = await app.request(path, { method: ruta.method });
    assert.equal(res.status, 401, `${ruta.method} ${ruta.path} sin token debe ser 401 (¿falta requireAuth?)`);
  }
});
