// Tests de galería + plantillas (DATABASE.md §8 C4) — integración contra la DB
// local, mismo patrón que projects.test.ts: usuarios temporales, cleanup al
// final y skip con motivo si Postgres no está disponible. `tpl-demo` ya existe
// (seed de schema.sql desde A1; su `data` es una sala v3 jugable).
import { test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "../src/db.ts";
import { createApp } from "../src/app.ts";
import { validateProject } from "../../contract/project-schema.js";

let DB_UP = false;
try {
  await prisma.$queryRaw`SELECT 1`;
  DB_UP = true;
} catch {
  DB_UP = false;
}

const app = createApp();
const OWNER = `c4_own_${Date.now()}`;
const OTHER = `c4_oth_${Date.now()}`;
const PASSWORD = "secreto-123";

// Mundo mínimo VÁLIDO según validateProject (triángulo con sus 3 paredes).
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

interface ApiBody {
  success: boolean;
  data: Record<string, unknown> | null;
  error: { code: string; message: string } | null;
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
  await api("/auth/register", { method: "POST", body: { login, password: PASSWORD, nombre: "C4", apellido: "Test" } });
  const { body } = await api("/auth/login", { method: "POST", body: { login, password: PASSWORD } });
  return body.data as unknown as { accessToken: string };
}

let ownerToken = "";
let otherToken = "";
let projectId = "";
let publishedSlug = "";
const PRIVATE_TPL = `tpl_c5d_${Date.now()}`; // plantilla personal de OWNER (C5d)

test.before(async () => {
  if (!DB_UP) return;
  ownerToken = (await registerAndToken(OWNER)).accessToken;
  otherToken = (await registerAndToken(OTHER)).accessToken;
  const created = await api("/api/projects", {
    method: "POST",
    token: ownerToken,
    body: { nombre: "Mi Juego", data: VALID_DATA },
  });
  projectId = (created.body.data?.project as { id: string }).id;

  // Plantilla personal de OWNER (C5d): se borra en cascada con el usuario.
  const owner = await prisma.usuario.findUniqueOrThrow({ where: { login: OWNER } });
  await prisma.plantilla.create({
    data: { id: PRIVATE_TPL, propietarioId: owner.id, nombre: "Escenario privado", data: VALID_DATA },
  });
});

test.after(async () => {
  if (!DB_UP) return;
  await prisma.usuario.deleteMany({ where: { login: { in: [OWNER, OTHER] } } });
});

test("GET /api/gallery y /api/templates son públicos (sin token)", { skip: !DB_UP && "DB no disponible" }, async () => {
  const g = await api("/api/gallery");
  assert.equal(g.status, 200);
  const t = await api("/api/templates");
  assert.equal(t.status, 200);
  const templates = t.body.data?.templates as { id: string }[];
  assert.ok(templates.some((x) => x.id === "tpl-demo"), "el seed tpl-demo está listado");
});

test("PATCH publish publica y aparece en la galería (slug autogenerado)", { skip: !DB_UP && "DB no disponible" }, async () => {
  const res = await api(`/api/projects/${projectId}/publish`, {
    method: "PATCH",
    token: ownerToken,
    body: { titulo: "Mi juego publicado" },
  });
  assert.equal(res.status, 200);
  publishedSlug = (res.body.data?.published as { slug: string }).slug;
  assert.equal(publishedSlug, "mi-juego", "slug derivado del nombre");

  const gallery = await api("/api/gallery");
  const games = gallery.body.data?.games as { slug: string; titulo: string }[];
  const mine = games.find((g) => g.slug === publishedSlug);
  assert.ok(mine, "aparece en la galería pública");
  assert.equal(mine.titulo, "Mi juego publicado");
  assert.equal(gallery.body.data?.total, games.length);
});

test("GET /api/gallery/:slug devuelve el data y cuenta visitas", { skip: !DB_UP && "DB no disponible" }, async () => {
  assert.ok(publishedSlug);
  const first = await api(`/api/gallery/${publishedSlug}`);
  assert.equal(first.status, 200);
  const juego = first.body.data?.juego as { data: unknown; visitas: number };
  assert.deepEqual(juego.data, VALID_DATA, "data completo para el motor");
  assert.equal(juego.visitas, 1);

  const second = await api(`/api/gallery/${publishedSlug}`);
  assert.equal((second.body.data?.juego as { visitas: number }).visitas, 2);
});

test("publish con slug explícito repetido → 409 SLUG_TAKEN", { skip: !DB_UP && "DB no disponible" }, async () => {
  assert.ok(publishedSlug);
  // Segundo proyecto (ownerToken ya publicó mi-juego; se publica otra vez sobre
  // el MISMO proyecto → permitido). Para el conflicto usa el proyecto del otro.
  const otro = await api("/api/projects", {
    method: "POST",
    token: otherToken,
    body: { nombre: "Otro", data: VALID_DATA },
  });
  const otroId = (otro.body.data?.project as { id: string }).id;
  const res = await api(`/api/projects/${otroId}/publish`, {
    method: "PATCH",
    token: otherToken,
    body: { slug: publishedSlug },
  });
  assert.equal(res.status, 409);
  assert.equal(res.body.error?.code, "SLUG_TAKEN");
});

test("publish de proyecto ajeno → 404 PROJECT_NOT_FOUND", { skip: !DB_UP && "DB no disponible" }, async () => {
  assert.ok(projectId);
  const { status, body } = await api(`/api/projects/${projectId}/publish`, {
    method: "PATCH",
    token: otherToken,
    body: {},
  });
  assert.equal(status, 404);
  assert.equal(body.error?.code, "PROJECT_NOT_FOUND");
});

test("publish de proyecto con data inválida → 422 VALIDATION_ERROR", { skip: !DB_UP && "DB no disponible" }, async () => {
  const bad = await api("/api/projects", {
    method: "POST",
    token: ownerToken,
    body: { nombre: "Roto", data: { world: { vertices: [] } } },
  });
  assert.equal(bad.status, 422, "crear con data inválida ya es rechazado");
});

test("unpublish lo saca de la galería", { skip: !DB_UP && "DB no disponible" }, async () => {
  assert.ok(publishedSlug);
  const res = await api(`/api/projects/${projectId}/unpublish`, { method: "PATCH", token: ownerToken });
  assert.equal(res.status, 200);
  assert.equal(res.body.data?.unpublished, true);

  const gallery = await api("/api/gallery");
  const games = gallery.body.data?.games as { slug: string }[];
  assert.ok(!games.some((g) => g.slug === publishedSlug), "ya no está en la galería");

  const gone = await api(`/api/gallery/${publishedSlug}`);
  assert.equal(gone.status, 404);

  // Estado del proyecto de vuelta a EN_DESARROLLO.
  const mine = await api(`/api/projects/${projectId}`, { token: ownerToken });
  assert.equal((mine.body.data?.project as { estado: string }).estado, "EN_DESARROLLO");
});

test("unpublish es idempotente (no publicado → éxito igual)", { skip: !DB_UP && "DB no disponible" }, async () => {
  const res = await api(`/api/projects/${projectId}/unpublish`, { method: "PATCH", token: ownerToken });
  assert.equal(res.status, 200);
  assert.equal(res.body.data?.unpublished, true);
});

test("GET /api/templates/:id devuelve plantilla con data válido y jugable", { skip: !DB_UP && "DB no disponible" }, async () => {
  const res = await api("/api/templates/tpl-demo");
  assert.equal(res.status, 200);
  const template = res.body.data?.template as { data: unknown; nombre: string };
  assert.equal(template.nombre, "Demo base");
  const validation = validateProject(template.data);
  assert.equal(validation.valid, true, "el seed pasa el validador del contrato");
  assert.ok(!validation.warnings.some((w) => w.includes("vértice")), "sin warnings graves");
});

test("POST /api/projects con plantillaId carga los datos de la plantilla", { skip: !DB_UP && "DB no disponible" }, async () => {
  const res = await api("/api/projects", {
    method: "POST",
    token: ownerToken,
    body: { plantillaId: "tpl-demo" },
  });
  assert.equal(res.status, 201);
  const project = res.body.data?.project as { nombre: string; data: { meta: { name: string } } };
  assert.equal(project.nombre, "Demo base", "nombre hereda de la plantilla");
  const tpl = (await api("/api/templates/tpl-demo")).body.data?.template as { data: { meta: { name: string } } };
  // Fix 2026-09-17: el clon es idéntico salvo meta.name, que se alinea con el
  // nombre del proyecto (antes nacía con el meta.name de la plantilla).
  assert.deepEqual(
    project.data,
    { ...tpl.data, meta: { ...tpl.data.meta, name: "Demo base" } },
    "clon íntegro salvo meta.name",
  );
});

test("Fix C4: con nombre explícito el clon nace con ese meta.name", { skip: !DB_UP && "DB no disponible" }, async () => {
  const res = await api("/api/projects", {
    method: "POST",
    token: ownerToken,
    body: { plantillaId: "tpl-demo", nombre: "Prueba renombrada" },
  });
  assert.equal(res.status, 201);
  const project = res.body.data?.project as { nombre: string; data: { meta: { name: string }; world?: unknown } };
  assert.equal(project.nombre, "Prueba renombrada");
  assert.equal(project.data.meta.name, "Prueba renombrada", "nombre explícito → meta.name");
  assert.ok(project.data.world !== undefined, "el resto del árbol se clona intacto");
});

test("POST /api/projects con plantillaId inexistente → 404 TEMPLATE_NOT_FOUND", { skip: !DB_UP && "DB no disponible" }, async () => {
  const { status, body } = await api("/api/projects", {
    method: "POST",
    token: ownerToken,
    body: { plantillaId: "no-existe" },
  });
  assert.equal(status, 404);
  assert.equal(body.error?.code, "TEMPLATE_NOT_FOUND");
});

// --- C5d: plantillas con dueño (visibilidad y propiedad) ---

function idsOf(body: ApiBody): string[] {
  return (body.data?.templates as { id: string }[]).map((t) => t.id);
}

test("C5d: sin sesión la lista solo trae las del sistema", { skip: !DB_UP && "DB no disponible" }, async () => {
  const { status, body } = await api("/api/templates");
  assert.equal(status, 200);
  assert.ok(idsOf(body).includes("tpl-demo"), "la del sistema sí");
  assert.ok(!idsOf(body).includes(PRIVATE_TPL), "la personal no se filtra a anónimos");
});

test("C5d: con sesión la lista trae las propias, nunca las ajenas", { skip: !DB_UP && "DB no disponible" }, async () => {
  const mine = idsOf((await api("/api/templates", { token: ownerToken })).body);
  assert.ok(mine.includes("tpl-demo") && mine.includes(PRIVATE_TPL), "dueño ve sistema + propia");
  const ajenas = idsOf((await api("/api/templates", { token: otherToken })).body);
  assert.ok(!ajenas.includes(PRIVATE_TPL), "otra cuenta no ve la personal ajena");
});

test("C5d: plantilla personal → 200 para el dueño; 404 para otros y anónimos", { skip: !DB_UP && "DB no disponible" }, async () => {
  const propia = await api(`/api/templates/${PRIVATE_TPL}`, { token: ownerToken });
  assert.equal(propia.status, 200);
  assert.deepEqual((propia.body.data?.template as { data: unknown }).data, VALID_DATA);

  const anon = await api(`/api/templates/${PRIVATE_TPL}`);
  assert.equal(anon.status, 404);
  assert.equal(anon.body.error?.code, "TEMPLATE_NOT_FOUND");

  const ajena = await api(`/api/templates/${PRIVATE_TPL}`, { token: otherToken });
  assert.equal(ajena.status, 404);
  assert.equal(ajena.body.error?.code, "TEMPLATE_NOT_FOUND", "no filtra que la plantilla exista");
});

test("C5d: crear proyecto desde plantilla personal solo puede el dueño", { skip: !DB_UP && "DB no disponible" }, async () => {
  const propia = await api("/api/projects", {
    method: "POST",
    token: ownerToken,
    body: { plantillaId: PRIVATE_TPL },
  });
  assert.equal(propia.status, 201);
  assert.equal((propia.body.data?.project as { nombre: string }).nombre, "Escenario privado");

  const ajena = await api("/api/projects", {
    method: "POST",
    token: otherToken,
    body: { plantillaId: PRIVATE_TPL },
  });
  assert.equal(ajena.status, 404);
  assert.equal(ajena.body.error?.code, "TEMPLATE_NOT_FOUND");
});