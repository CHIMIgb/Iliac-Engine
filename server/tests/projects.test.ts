// Tests del CRUD de proyectos (DATABASE.md §8 C2) — integración contra la DB
// local, mismo patrón que auth.test.ts: usuarios temporales (login aleatorio),
// cleanup al final y skip con motivo si Postgres no está disponible.
import { test } from "node:test";
import assert from "node:assert/strict";
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
const OWNER = `c2_own_${Date.now()}`;
const OTHER = `c2_oth_${Date.now()}`;
const PASSWORD = "secreto-123";

// Mundo mínimo VÁLIDO según validateProject: triángulo con sus 3 paredes.
const VALID_DATA = {
  meta: { name: "Test" },
  world: {
    vertices: [
      { id: "v1", x: 0, y: 0 },
      { id: "v2", x: 4, y: 0 },
      { id: "v3", x: 4, y: 4 },
    ],
    sectors: [{ id: "s1", vertexIds: ["v1", "v2", "v3"], floorH: 0, ceilH: 4 }],
    walls: [
      { id: "w1", a: "v1", b: "v2", sectorFront: "s1" },
      { id: "w2", a: "v2", b: "v3", sectorFront: "s1" },
      { id: "w3", a: "v3", b: "v1", sectorFront: "s1" },
    ],
  },
};

// Sector con 3 vértices que referencia uno inexistente → error del validador.
const INVALID_DATA = {
  world: { vertices: [], sectors: [{ id: "s1", vertexIds: ["v1", "v2", "vX"] }], walls: [] },
};

interface ApiBody {
  success: boolean;
  data: { project?: Record<string, unknown>; projects?: Record<string, unknown>[]; deleted?: boolean } | null;
  error: { code: string; message: string; details?: { issues?: unknown[] } } | null;
}

async function api(route: string, opts: { method?: string; token?: string; body?: unknown } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  const res = await app.request(route, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as ApiBody };
}

async function registerAndToken(login: string) {
  await api("/auth/register", { method: "POST", body: { login, password: PASSWORD, nombre: "C2", apellido: "Test" } });
  const { body } = await api("/auth/login", { method: "POST", body: { login, password: PASSWORD } });
  return body.data as unknown as { accessToken: string; refreshToken: string; user: { id: string } };
}

let ownerToken = "";
let otherToken = "";
let createdId = "";

test.before(async () => {
  if (!DB_UP) return;
  const o = await registerAndToken(OWNER);
  ownerToken = o.accessToken;
  const ot = await registerAndToken(OTHER);
  otherToken = ot.accessToken;
});

test.after(async () => {
  if (!DB_UP) return;
  await prisma.usuario.deleteMany({ where: { login: { in: [OWNER, OTHER] } } });
});

test("sin token → 401 UNAUTHORIZED", async () => {
  const { status, body } = await api("/api/projects");
  assert.equal(status, 401);
  assert.equal(body.success, false);
  assert.equal(body.error?.code, "UNAUTHORIZED");
});

test("token inválido → 401 UNAUTHORIZED", async () => {
  const { status, body } = await api("/api/projects", { token: "token-falso" });
  assert.equal(status, 401);
  assert.equal(body.error?.code, "UNAUTHORIZED");
});

test("POST crea y GET /:id devuelve el mismo árbol JSONB v3", { skip: !DB_UP && "DB no disponible" }, async () => {
  const created = await api("/api/projects", {
    method: "POST",
    token: ownerToken,
    body: { nombre: "Mi juego", data: VALID_DATA },
  });
  assert.equal(created.status, 201);
  const project = created.body.data?.project as Record<string, unknown> & { id: string };
  assert.equal(project.nombre, "Mi juego");
  assert.equal(project.renderMode, "retro");
  assert.equal(project.schemaVersion, 3);
  createdId = project.id;

  const fetched = await api(`/api/projects/${createdId}`, { token: ownerToken });
  assert.equal(fetched.status, 200);
  assert.deepEqual(fetched.body.data?.project?.data, VALID_DATA);
});

test("POST sin data usa el esqueleto v3 mínimo", { skip: !DB_UP && "DB no disponible" }, async () => {
  const created = await api("/api/projects", { method: "POST", token: ownerToken, body: { nombre: "Sin datos" } });
  assert.equal(created.status, 201);
  const data = created.body.data?.project?.data as { world: { vertices: unknown[] } };
  assert.ok(Array.isArray(data.world.vertices), "world presente con arrays vacíos");
});

test("POST con data inválida → 422 VALIDATION_ERROR", { skip: !DB_UP && "DB no disponible" }, async () => {
  const { status, body } = await api("/api/projects", {
    method: "POST",
    token: ownerToken,
    body: { nombre: "Malo", data: INVALID_DATA },
  });
  assert.equal(status, 422);
  assert.equal(body.error?.code, "VALIDATION_ERROR");
  const issues = body.error?.details?.issues as { path: string; message: string }[];
  assert.ok(issues.some((i) => i.message.includes("vértice inexistente")), "detalle del validador del contrato");
});

test("GET / lista solo los proyectos propios (el otro usuario no ve nada)", { skip: !DB_UP && "DB no disponible" }, async () => {
  const mine = await api("/api/projects", { token: ownerToken });
  assert.equal(mine.status, 200);
  assert.ok((mine.body.data?.projects ?? []).length >= 2, "dueño tiene sus proyectos");
  const allMine = (mine.body.data?.projects ?? []).every((p) => p.estado === "EN_DESARROLLO");
  assert.ok(allMine, "respuesta de lista es metadata (sin data)");

  const theirs = await api("/api/projects", { token: otherToken });
  assert.deepEqual(theirs.body.data?.projects ?? [], [], "ajeno no ve proyectos del dueño");
});

test("GET /:id de proyecto ajeno → 404 PROJECT_NOT_FOUND", { skip: !DB_UP && "DB no disponible" }, async () => {
  assert.ok(createdId, "requiere el proyecto creado antes");
  const { status, body } = await api(`/api/projects/${createdId}`, { token: otherToken });
  assert.equal(status, 404);
  assert.equal(body.error?.code, "PROJECT_NOT_FOUND");
});

test("PATCH actualiza nombre y REEMPLAZA data (validado)", { skip: !DB_UP && "DB no disponible" }, async () => {
  assert.ok(createdId);
  const nuevoNombre = { nombre: "Renombrado", data: VALID_DATA };
  const patched = await api(`/api/projects/${createdId}`, { method: "PATCH", token: ownerToken, body: nuevoNombre });
  assert.equal(patched.status, 200);
  assert.equal((patched.body.data?.project as Record<string, unknown>)?.nombre, "Renombrado");

  const bad = await api(`/api/projects/${createdId}`, { method: "PATCH", token: ownerToken, body: { data: INVALID_DATA } });
  assert.equal(bad.status, 422, "data inválida rechazada incluso en PATCH");
});

test("DELETE borra y luego el proyecto ya no existe", { skip: !DB_UP && "DB no disponible" }, async () => {
  assert.ok(createdId);
  const del = await api(`/api/projects/${createdId}`, { method: "DELETE", token: ownerToken });
  assert.equal(del.status, 200);
  assert.equal(del.body.data?.deleted, true);
  const after = await api(`/api/projects/${createdId}`, { token: ownerToken });
  assert.equal(after.status, 404);
});

test("id malformado (no-UUID) → 404 PROJECT_NOT_FOUND, nunca 500", { skip: !DB_UP && "DB no disponible" }, async () => {
  // Hueco detectado en C5b: un :id que no es UUID hacía que Prisma P2023
  // escapara como INTERNAL_ERROR. Ahora se responde igual que un id ajeno.
  for (const method of ["GET", "PATCH", "DELETE"] as const) {
    const res = await api(`/api/projects/v3`, {
      method,
      token: ownerToken,
      ...(method !== "GET" ? { body: { nombre: "x" } } : {}),
    });
    assert.equal(res.status, 404, `${method} con id no-UUID → 404`);
    assert.equal(res.body.error?.code, "PROJECT_NOT_FOUND");
  }
  const pub = await api("/api/projects/v3/publish", { method: "PATCH", token: ownerToken, body: {} });
  assert.equal(pub.status, 404, "publish con id no-UUID → 404");
});