// routes/templates.ts — Plantillas de proyectos (DATABASE.md §8 C4 + C5d).
// Visibilidad: sin sesión solo las del sistema (propietario_id NULL); con
// sesión, las del sistema + las propias. La lista no expone `data` (puede
// pesar y solo hace falta al crear un proyecto desde la plantilla).
import { Hono } from "hono";
import { prisma } from "../db.ts";
import { AppError } from "../lib/AppError.ts";
import { ok } from "../lib/handler.ts";
import { optionalAuth, type OptionalAuthEnv } from "../lib/auth.ts";

export const templatesRoutes = new Hono<OptionalAuthEnv>();

// GET /api/templates — lista sin data.
templatesRoutes.get("/", optionalAuth, async (c) => {
  const userId = c.get("userId");
  const templates = await prisma.plantilla.findMany({
    where: userId
      ? { OR: [{ propietarioId: null }, { propietarioId: userId }] }
      : { propietarioId: null },
    orderBy: { id: "asc" },
    select: { id: true, nombre: true, descripcion: true },
  });
  return ok(c, { templates });
});

// GET /api/templates/:id — plantilla completa (con data para crear proyectos).
templatesRoutes.get("/:id", optionalAuth, async (c) => {
  const id = c.req.param("id");
  const plantilla = await prisma.plantilla.findUnique({ where: { id } });
  // Personal ajena → mismo 404 que inexistente (no filtra su existencia).
  if (!plantilla || (plantilla.propietarioId && plantilla.propietarioId !== c.get("userId"))) {
    throw new AppError("TEMPLATE_NOT_FOUND", { id });
  }
  return ok(c, { template: plantilla });
});
