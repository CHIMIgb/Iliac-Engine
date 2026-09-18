// index.ts — Arranque del servidor (DATABASE.md §8 B1).
// Levanta la app Hono sobre Node con @hono/node-server, escuchando en PORT.
import "dotenv/config";
import { serve } from "@hono/node-server";
import { app } from "./app.ts";

const port = Number(process.env.PORT ?? 3000);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`API de Iliac Engine escuchando en http://localhost:${info.port}`);
});
