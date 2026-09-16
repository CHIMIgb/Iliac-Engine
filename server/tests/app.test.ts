// Test de humo del esqueleto del servidor (DATABASE.md §8 B1).
// Usa app.request() de Hono: no levanta servidor ni toca la base de datos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { app } from "../src/app.ts";

test("GET / responde 200 con el texto de la API", async () => {
  const res = await app.request("/");
  assert.equal(res.status, 200);
  assert.equal(await res.text(), "Iliac Engine API");
});

test("una ruta inexistente responde 404", async () => {
  const res = await app.request("/no-existe");
  assert.equal(res.status, 404);
});
