// routes/templates.ts — Plantillas públicas (DATABASE.md §8 C4).
// Sin autenticación: la lista no expone `data` (puede pesar y solo hace falta
// al crear un proyecto desde la plantilla).
import { Hono } from "hono";
import { prisma } from "../db.ts";
import { AppError } from "../lib/AppError.ts";
import { ok } from "../lib/handler.ts";

export const templatesRoutes = new Hono();

// GET /api/templates — lista sin data.
templatesRoutes.get("/", async (c) => {
  const templates = await prisma.plantilla.findMany({
    orderBy: { id: "asc" },
    select: { id: true, nombre: true, descripcion: true },
  });
  return ok(c, { templates });
});

// GET /api/templates/:id — plantilla completa (con data para crear proyectos).
templatesRoutes.get("/:id", async (c) => {
  const id = c.req.param("id");
  const plantilla = await prisma.plantilla.findUnique({ where: { id } });
  if (!plantilla) throw new AppError("TEMPLATE_NOT_FOUND", { id });
  return ok(c, { template: plantilla });
});