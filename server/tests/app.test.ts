// Tests del contrato de respuesta y salud del servidor (DATABASE.md §8 B2).
// Usa app.request() de Hono: no levanta servidor. El readiness (GET /ready) se
// prueba con una sonda inyectada, sin tocar la base de datos real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { AppError } from "../src/lib/AppError.ts";
import { createApp } from "../src/app.ts";
import { codes } from "../src/lib/codes.ts";

const app = createApp();

interface ContractError {
  code: string;
  message: string;
  details?: unknown;
}

interface ContractBody {
  success: boolean;
  data: unknown;
  error: ContractError | null;
}

/** `res.json()` de Hono devuelve unknown; este helper fija la forma del contrato. */
async function body(res: Response): Promise<ContractBody> {
  return (await res.json()) as ContractBody;
}

test("GET / responde 200 con el contrato y el nombre de la API", async () => {
  const res = await app.request("/");
  assert.equal(res.status, 200);
  assert.deepEqual(await body(res), {
    success: true,
    data: { message: "Iliac Engine API" },
    error: null,
  });
});

test("GET /health responde ok con el contrato", async () => {
  const res = await app.request("/health");
  assert.equal(res.status, 200);
  assert.deepEqual(await body(res), {
    success: true,
    data: { status: "ok" },
    error: null,
  });
});

test("GET /ready responde ok cuando la DB está conectada", async () => {
  const withDb = createApp({ probeDb: async () => undefined });
  const res = await withDb.request("/ready");
  assert.equal(res.status, 200);
  assert.deepEqual(await body(res), {
    success: true,
    data: { status: "ok", db: "up" },
    error: null,
  });
});

test("GET /ready responde 503 con contrato cuando la DB falla", async () => {
  const withoutDb = createApp({
    probeDb: async () => {
      throw new Error("sin conexión");
    },
  });
  const res = await withoutDb.request("/ready");
  assert.equal(res.status, 503);
  const b = await body(res);
  assert.equal(b.success, false);
  assert.equal(b.data, null);
  const err = b.error;
  assert.ok(err);
  assert.equal(err.code, "DB_UNAVAILABLE");
  assert.equal(err.message, codes.DB_UNAVAILABLE.message);
});

test("una ruta inexistente responde 404 con el contrato (no HTML plano)", async () => {
  const res = await app.request("/no-existe");
  assert.equal(res.status, 404);
  // Estándar pinnado: error.details SIEMPRE presente (null sin detalle).
  assert.deepEqual(await body(res), {
    success: false,
    data: null,
    error: { code: "NOT_FOUND", message: codes.NOT_FOUND.message, details: null },
  });
});

test("app.onError transforma AppError al contrato (403 FORBIDDEN)", async () => {
  const appThrowing = createApp();
  appThrowing.get("/boom", () => {
    throw new AppError("FORBIDDEN", { por: "test" });
  });
  const res = await appThrowing.request("/boom");
  assert.equal(res.status, 403);
  const b = await body(res);
  assert.equal(b.success, false);
  const err = b.error;
  assert.ok(err);
  assert.equal(err.code, "FORBIDDEN");
  assert.deepEqual(err.details, { por: "test" });
});

test("contrato pinnado: error SIN detalles → error.details es null (no se omite)", async () => {
  const appThrowing = createApp();
  appThrowing.get("/boom2", () => {
    throw new AppError("NOT_FOUND");
  });
  const res = await appThrowing.request("/boom2");
  const b = await body(res);
  assert.equal(b.success, false);
  assert.equal(b.data, null);
  assert.ok(b.error);
  assert.equal(b.error.code, "NOT_FOUND");
  // El estándar fija details SIEMPRE presente: accesible sin undefined-checks.
  assert.equal(b.error.details, null);
  assert.ok("details" in b.error, "la clave details existe");
});

test("AppError.fromZod genera VALIDATION_ERROR 422 con issues aplanados", () => {
  const zodLike = {
    issues: [
      { path: ["world", "sectors", 0, "vertexIds"], message: "Requiere ≥3 vértices" },
      { path: ["meta", "name"], message: "Obligatorio" },
    ],
  };
  const err = AppError.fromZod(zodLike);
  assert.equal(err.code, "VALIDATION_ERROR");
  assert.equal(err.status, 422);
  assert.deepEqual(err.details, {
    issues: [
      { path: "world.sectors.0.vertexIds", message: "Requiere ≥3 vértices" },
      { path: "meta.name", message: "Obligatorio" },
    ],
  });
});

test("AppError con mensaje propio no cambia el código ni el status", () => {
  const err = new AppError("SLUG_TAKEN", { slug: "demo" }, "El slug 'demo' ya existe");
  assert.equal(err.code, "SLUG_TAKEN");
  assert.equal(err.status, 409);
  assert.equal(err.message, "El slug 'demo' ya existe");
});