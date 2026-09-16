// Test de paridad del esquema Prisma (Fase A3, DATABASE.md §8).
// Verifica que server/prisma/schema.prisma es el espejo del SQL ya aplicado:
//   - declara los 9 modelos y los 2 enums
//   - cada modelo mapea (@@map) a una tabla real de server/db/schema.sql
// Sin frameworks: node:test + node:assert. Ejecutar: npm test (en server/).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(__dirname, "../prisma/schema.prisma"), "utf8");
const sql = readFileSync(join(__dirname, "../db/schema.sql"), "utf8");

const MODELOS = [
  "Rol", "Persona", "Usuario", "Proyecto", "Asset",
  "Galeria", "Plantilla", "RefreshToken", "TokenInvalido",
];
const ENUMS = ["EstadoProyecto", "TipoAsset"];

test("schema.prisma declara los 9 modelos", () => {
  for (const modelo of MODELOS) {
    assert.match(schema, new RegExp(`^model ${modelo} \\{`, "m"), `falta el modelo ${modelo}`);
  }
});

test("schema.prisma declara los 2 enums", () => {
  for (const enumNombre of ENUMS) {
    assert.match(schema, new RegExp(`^enum ${enumNombre} \\{`, "m"), `falta el enum ${enumNombre}`);
  }
});

test("paridad: cada tabla de schema.sql esta mapeada en schema.prisma", () => {
  // Tablas creadas en el SQL de A1 (nombre real en Postgres).
  const tablasSql = [...sql.matchAll(/CREATE TABLE (\w+)/g)].map((m) => m[1]).sort();
  // Nombres reales a los que mapea cada modelo/enum de Prisma (@@map).
  const mapeados = new Set([...schema.matchAll(/@@map\("([^"]+)"\)/g)].map((m) => m[1]));

  assert.ok(tablasSql.length >= 9, `schema.sql debe declarar >=9 tablas (hay ${tablasSql.length})`);
  for (const tabla of tablasSql) {
    assert.ok(mapeados.has(tabla), `falta @@map("${tabla}") en schema.prisma`);
  }
});
