// Tests de assets (DATABASE.md §8 C3) — integración contra DB local + storage
// TEMPORAL (STORAGE_PATH a un mkdtemp): blobs reales que se limpian al final.
// Mismo patrón que auth/projects: usuarios temporales, skip con motivo sin DB.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
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
const OWNER = `c3_own_${Date.now()}`;
const OTHER = `c3_oth_${Date.now()}`;
const PASSWORD = "secreto-123";

// PNG válido real de 1×1 (transparente): file-type lo detecta por magic bytes.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

// MP3 mínimo con frame sync válido (FF FB): file-type lo detecta como
// audio/mpeg por contenido (un `ID3` suelto no basta en file-type v22).
const MP3 = Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(400)]);

let storageTmp = "";

interface ApiBody {
  success: boolean;
  data: {
    asset?: { id: string; nombre: string; tipo: string; mime: string; tamanBytes?: number; hash: string | null };
    assets?: { id: string; tipo: string; mime: string }[];
    reused?: boolean;
    deleted?: boolean;
  } | null;
  error: { code: string; message: string; details?: { issues?: { path: string; message: string }[] } } | null;
}

/** Llama a la app con FormData (multipart). */
async function upload(route: string, opts: { token?: string; form: FormData }) {
  const headers: Record<string, string> = {};
  if (opts.token) headers["authorization"] = `Bearer ${opts.token}`;
  const res = await app.request(route, { method: "POST", headers, body: opts.form });
  return { status: res.status, body: (await res.json()) as ApiBody };
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
  await api("/auth/register", {
    method: "POST",
    body: { login, password: PASSWORD, nombre: "C3", apellido: "Test" },
  });
  const { body } = await api("/auth/login", { method: "POST", body: { login, password: PASSWORD } });
  return body.data as unknown as { accessToken: string };
}

let ownerToken = "";
let otherToken = "";
let assetId = "";

test.before(async () => {
  if (!DB_UP) return;
  storageTmp = await mkdtemp(path.join(tmpdir(), "iliac-assets-"));
  process.env.STORAGE_PATH = storageTmp;
  ownerToken = (await registerAndToken(OWNER)).accessToken;
  otherToken = (await registerAndToken(OTHER)).accessToken;
});

test.after(async () => {
  if (!DB_UP) return;
  await prisma.usuario.deleteMany({ where: { login: { in: [OWNER, OTHER] } } });
  // También los assets de esos usuarios se van por cascade de la DB.
  await rm(storageTmp, { recursive: true, force: true });
});

function pngForm(nombre = "guard_f0.png"): FormData {
  const form = new FormData();
  form.append("file", new File([PNG_1x1], nombre, { type: "image/png" }), nombre);
  form.append("tipo", "sprite");
  return form;
}

test("sin token → 401 UNAUTHORIZED", async () => {
  const { status, body } = await upload("/api/assets", { form: pngForm() });
  assert.equal(status, 401);
  assert.equal(body.error?.code, "UNAUTHORIZED");
});

test("POST sube un PNG real → 201 con fila tipo sprite + MIME por magic bytes", { skip: !DB_UP && "DB no disponible" }, async () => {
  const { status, body } = await upload("/api/assets", { token: ownerToken, form: pngForm() });
  assert.equal(status, 201);
  const asset = body.data?.asset;
  assert.ok(asset?.id, "id generado");
  assert.equal(asset.nombre, "guard_f0.png");
  assert.equal(asset.tipo, "sprite");
  assert.equal(asset.mime, "image/png", "MIME detectado del contenido, no del header");
  assert.match(asset.hash ?? "", /^[0-9a-f]{64}$/, "hash sha256 presente");
  assetId = asset.id;
});

test("GET /:id devuelve la metadata", { skip: !DB_UP && "DB no disponible" }, async () => {
  assert.ok(assetId);
  const { status, body } = await api(`/api/assets/${assetId}`, { token: ownerToken });
  assert.equal(status, 200);
  assert.equal(body.data?.asset?.id, assetId);
  assert.equal(body.data?.asset?.mime, "image/png");
});

test("GET /:id/file sirve los MISMOS bytes con Content-Type correcto", { skip: !DB_UP && "DB no disponible" }, async () => {
  assert.ok(assetId);
  const res = await app.request(`/api/assets/${assetId}/file`, {
    headers: { authorization: `Bearer ${ownerToken}` },
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/png");
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.deepEqual(bytes, PNG_1x1, "bytes idénticos al subido (round-trip)");
});

test("POST con contenido falso (extensión .png pero no es PNG) → 422", { skip: !DB_UP && "DB no disponible" }, async () => {
  const form = new FormData();
  form.append("file", new File([Buffer.from("Esto no es un PNG real")], "falso.png", { type: "image/png" }), "falso.png");
  form.append("tipo", "sprite");
  const { status, body } = await upload("/api/assets", { token: ownerToken, form });
  assert.equal(status, 422);
  assert.equal(body.error?.code, "VALIDATION_ERROR");
  const issues = body.error?.details?.issues ?? [];
  assert.ok(issues.some((i) => i.message.includes("application/octet-stream")), "indica el MIME real detectado");
});

test("POST tipo no coincide con el contenido → 422", { skip: !DB_UP && "DB no disponible" }, async () => {
  const form = new FormData();
  form.append("file", new File([PNG_1x1], "voz.ogg", { type: "audio/ogg" }), "voz.ogg");
  form.append("tipo", "audio"); // el contenido es PNG, no OGG
  const { status, body } = await upload("/api/assets", { token: ownerToken, form });
  assert.equal(status, 422);
  assert.equal(body.error?.code, "VALIDATION_ERROR");
});

test("re-subir el MISMO archivo reutiliza el asset (dedupe por hash) → 200 mismo id", { skip: !DB_UP && "DB no disponible" }, async () => {
  assert.ok(assetId);
  const { status, body } = await upload("/api/assets", { token: ownerToken, form: pngForm("copia.png") });
  assert.equal(status, 200);
  assert.equal(body.data?.reused, true);
  assert.equal(body.data?.asset?.id, assetId, "mismo asset, sin duplicar fila ni bytes");
});

// ── C5c ────────────────────────────────────────────────────────

test("GET /:id/file sirve el blob SIN token (D1: el motor no tiene sesión)", { skip: !DB_UP && "DB no disponible" }, async () => {
  assert.ok(assetId);
  const res = await app.request(`/api/assets/${assetId}/file`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "image/png");
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.deepEqual(bytes, PNG_1x1, "bytes idénticos al subido (round-trip sin auth)");
});

test("la metadata y el borrado SÍ exigen token → 401", { skip: !DB_UP && "DB no disponible" }, async () => {
  assert.ok(assetId);
  assert.equal((await api(`/api/assets/${assetId}`)).status, 401);
  assert.equal((await api(`/api/assets/${assetId}`, { method: "DELETE" })).status, 401);
});

test("id no-UUID → 404 ASSET_NOT_FOUND (nunca 500), público o privado", { skip: !DB_UP && "DB no disponible" }, async () => {
  const pub = await api("/api/assets/v3/file");
  assert.equal(pub.status, 404);
  assert.equal(pub.body.error?.code, "ASSET_NOT_FOUND");
  const priv = await api("/api/assets/v3", { token: ownerToken });
  assert.equal(priv.status, 404);
  assert.equal(priv.body.error?.code, "ASSET_NOT_FOUND");
});

test("POST de un MP3 real → 201 tipo audio (D5: audio/mpeg por frame sync)", { skip: !DB_UP && "DB no disponible" }, async () => {
  const form = new FormData();
  form.append("file", new File([MP3], "viento.mp3", { type: "audio/mpeg" }), "viento.mp3");
  form.append("tipo", "audio");
  const { status, body } = await upload("/api/assets", { token: ownerToken, form });
  assert.equal(status, 201);
  assert.equal(body.data?.asset?.mime, "audio/mpeg", "el MIME sale del contenido, no de la extensión");
  assert.equal(body.data?.asset?.tipo, "audio");
});

test("GET /api/assets lista solo los del usuario y ?tipo filtra (D6)", { skip: !DB_UP && "DB no disponible" }, async () => {
  const mine = await api("/api/assets", { token: ownerToken });
  assert.equal(mine.status, 200);
  assert.ok((mine.body.data?.assets?.length ?? 0) >= 2, "PNG + MP3 del owner");

  const audio = await api("/api/assets?tipo=audio", { token: ownerToken });
  assert.deepEqual(audio.body.data?.assets?.map((a) => a.tipo), ["audio"], "solo el MP3");

  const theirs = await api("/api/assets", { token: otherToken });
  assert.deepEqual(theirs.body.data?.assets, [], "nunca assets ajenos");
});

test("GET /api/assets?tipo inválido → 422", { skip: !DB_UP && "DB no disponible" }, async () => {
  const { status, body } = await api("/api/assets?tipo=nope", { token: ownerToken });
  assert.equal(status, 422);
  assert.equal(body.error?.code, "VALIDATION_ERROR");
});

test("asset de otro usuario → 404 ASSET_NOT_FOUND", { skip: !DB_UP && "DB no disponible" }, async () => {
  assert.ok(assetId);
  const { status, body } = await api(`/api/assets/${assetId}`, { token: otherToken });
  assert.equal(status, 404);
  assert.equal(body.error?.code, "ASSET_NOT_FOUND");
});

test("DELETE borra fila + archivo y luego GET → 404", { skip: !DB_UP && "DB no disponible" }, async () => {
  assert.ok(assetId);
  const del = await api(`/api/assets/${assetId}`, { method: "DELETE", token: ownerToken });
  assert.equal(del.status, 200);
  assert.equal(del.body.data?.deleted, true);

  const after = await api(`/api/assets/${assetId}`, { token: ownerToken });
  assert.equal(after.status, 404);

  // El blob ya no existe en el storage temporal: estructura <userId>/<tipo>/...
  const owner = await prisma.usuario.findUnique({ where: { login: OWNER }, select: { id: true } });
  assert.ok(owner, "owner existe");
  const blob = path.join(storageTmp, owner!.id, "sprite", `${assetId}.png`);
  assert.equal(await readFile(blob).catch(() => null), null, "archivo del blob eliminado del filesystem");
  await access(blob).then(
    () => assert.fail("no debería existir"),
    () => undefined,
  );
});

// ── ASSET_UPLOAD_PLAN.md paso 5: aislamiento multi-usuario ─────
// El dedupe por hash ahora es POR USUARIO: el mismo contenido subido por dos
// cuentas crea filas y blobs independientes; borrar el de uno no rompe el
// otro (la URL pública del asset del otro sigue sirviéndose).
test("aislamiento: el mismo archivo en 2 cuentas → assets independientes y borrado aislado", { skip: !DB_UP && "DB no disponible" }, async () => {
  // OWNER sube el PNG → fila propia.
  const a = await upload("/api/assets", { token: ownerToken, form: pngForm("compartido.png") });
  assert.equal(a.status, 201);
  assert.equal(a.body.data?.reused, false);
  const idA = a.body.data?.asset?.id;
  assert.ok(idA, "owner recibe su asset");

  // OTHER sube el MISMO contenido → NO reutiliza el de owner (aislamiento).
  const b = await upload("/api/assets", { token: otherToken, form: pngForm("compartido.png") });
  assert.equal(b.status, 201);
  assert.equal(b.body.data?.reused, false, "no reutiliza asset ajeno");
  const idB = b.body.data?.asset?.id;
  assert.ok(idB, "other recibe el suyo");
  assert.notEqual(idB, idA, "ids distintos: cada cuenta tiene su fila");

  // Para OTHER, el asset de OWNER sigue siendo ajeno → 404.
  const theirs = await api(`/api/assets/${idA}`, { token: otherToken });
  assert.equal(theirs.status, 404);

  // OTHER borra el suyo.
  const del = await api(`/api/assets/${idB}`, { method: "DELETE", token: otherToken });
  assert.equal(del.status, 200);
  assert.equal(del.body.data?.deleted, true);

  // El asset de OWNER sigue sirviéndose (el borrado ajeno no lo rompe).
  const pub = await app.request(`/api/assets/${idA}/file`);
  assert.equal(pub.status, 200);
  const bytes = Buffer.from(await pub.arrayBuffer());
  assert.deepEqual(bytes, PNG_1x1, "los bytes del otro usuario sobreviven");
});