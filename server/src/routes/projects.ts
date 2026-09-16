// routes/projects.ts — CRUD de proyectos (DATABASE.md §8 C2).
// Todas las rutas exigen token JWT (requireAuth) y solo el propietario accede
// a su proyecto: id ajeno → PROJECT_NOT_FOUND (404), nunca 403 ni detalles,
// para no enumerar recursos que existen.
// El `data` JSONB v3 se valida con validateProject del contrato; PATCH
// REEMPLAZA el árbol completo si viene `data` (decisión: sin merge profundo de
// JSONB — el Studio guarda el documento entero; ver plan C2).
import { Hono } from "hono";
import { Prisma, type Proyecto } from "../../generated/prisma/client.ts";
import { prisma } from "../db.ts";
import { AppError } from "../lib/AppError.ts";
import { requireAuth, type AuthEnv } from "../lib/auth.ts";
import { ok } from "../lib/handler.ts";
import { parseBody } from "../lib/parseBody.ts";
import {
  createProjectSchema,
  updateProjectSchema,
  validateProjectData,
  DEFAULT_PROJECT_DATA,
} from "../schemas/project.ts";

export const projectsRoutes = new Hono<AuthEnv>();
projectsRoutes.use("*", requireAuth);

/** Resumen sin `data`: para la LISTA (evita transferir JSONB grandes). */
function metaProject(p: Pick<Proyecto, "id" | "nombre" | "estado" | "schemaVersion" | "renderMode" | "createdAt" | "updatedAt">) {
  return {
    id: p.id,
    nombre: p.nombre,
    estado: p.estado,
    schemaVersion: p.schemaVersion,
    renderMode: p.renderMode,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** Proyecto COMPLETO: para GET /:id (el editor necesita el árbol entero). */
function fullProject(p: Proyecto) {
  return { ...metaProject(p), data: p.data };
}

/** Busca un proyecto verificando propiedad; ajeno → 404 (sin enumerar). */
async function ownedProject(id: string, userId: string) {
  const proyecto = await prisma.proyecto.findUnique({ where: { id } });
  if (!proyecto || proyecto.propietarioId !== userId) {
    throw new AppError("PROJECT_NOT_FOUND", { id });
  }
  return proyecto;
}

projectsRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const input = await parseBody(c, createProjectSchema);
  const data =
    input.data !== undefined ? validateProjectData(input.data) : DEFAULT_PROJECT_DATA;

  const proyecto = await prisma.proyecto.create({
    data: {
      propietarioId: userId,
      nombre: input.nombre,
      data: data as Prisma.InputJsonValue,
    },
  });

  return ok(c, { project: fullProject(proyecto) }, 201);
});

projectsRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const proyectos = await prisma.proyecto.findMany({
    where: { propietarioId: userId },
    orderBy: { updatedAt: "desc" },
  });
  return ok(c, { projects: proyectos.map(metaProject) });
});

projectsRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const proyecto = await ownedProject(c.req.param("id"), userId);
  return ok(c, { project: fullProject(proyecto) });
});

projectsRoutes.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const input = await parseBody(c, updateProjectSchema);
  const data = input.data !== undefined ? validateProjectData(input.data) : undefined;

  await ownedProject(c.req.param("id"), userId); // 404 si ajeno/inexistente
  const proyecto = await prisma.proyecto.update({
    where: { id: c.req.param("id") },
    data: {
      ...(input.nombre !== undefined ? { nombre: input.nombre } : {}),
      ...(data !== undefined ? { data: data as Prisma.InputJsonValue } : {}),
      // updatedAt NO es @updatedAt en el esquema: se actualiza manualmente.
      updatedAt: new Date(),
    },
  });

  return ok(c, { project: fullProject(proyecto) });
});

projectsRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  // deleteMany acepta filtro no único y evita la doble consulta de propiedad.
  const { count } = await prisma.proyecto.deleteMany({
    where: { id, propietarioId: userId },
  });
  if (count === 0) throw new AppError("PROJECT_NOT_FOUND", { id });
  return ok(c, { deleted: true });
});