// app.ts — Instancia de la app Hono (DATABASE.md §8 B1).
// Separada de index.ts para poder testearla con `app.request()` sin levantar
// un servidor real. B2 añadirá el contrato de respuesta {success,data,error}
// y los endpoints de infraestructura /health y /ready.
import { Hono } from "hono";
import { logger } from "hono/logger";

export const app = new Hono();

// Middleware básico: log de requests (B2 lo sustituye por el logger estructurado).
app.use(logger());

// Placeholder mínimo: confirma que la app responde.
app.get("/", (c) => c.text("Iliac Engine API"));
