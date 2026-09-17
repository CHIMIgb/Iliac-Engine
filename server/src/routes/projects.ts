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
import { assertUuid } from "../lib/ids.ts";
import { parseBody } from "../lib/parseBody.ts";
import {
  createProjectSchema,
  updateProjectSchema,
  publishSchema,
  validateProjectData,
  DEFAULT_PROJECT_DATA,
} from "../schemas/project.ts";

/** Slug legible desde un nombre (C4): minúsculas, sin acentos, guiones. */
function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** Slug libre en galería; si el base está tomado añade -2, -3... */
async function freeSlug(base: string): Promise<string> {
  const fallback = base || "proyecto";
  let slug = fallback;
  let n = 2;
  while (await prisma.galeria.findUnique({ where: { slug } })) {
    slug = `${fallback}-${n}`;
    n += 1;
  }
  return slug;
}

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
  assertProjectId(id);
  const proyecto = await prisma.proyecto.findUnique({ where: { id } });
  if (!proyecto || proyecto.propietarioId !== userId) {
    throw new AppError("PROJECT_NOT_FOUND", { id });
  }
  return proyecto;
}

/**
 * Un id que no es UUID no puede existir: se responde 404 PROJECT_NOT_FOUND
 * (mismo criterio que un id ajeno) ANTES de tocar Prisma — un id malformado
 * hacía que P2023 escapara como INTERNAL_ERROR 500 (hueco detectado en C5b).
 */
function assertProjectId(id: string): void {
  assertUuid(id, "PROJECT_NOT_FOUND");
}

projectsRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const input = await parseBody(c, createProjectSchema);

  // Crear desde plantilla (C4): data = plantilla.data; nombre default = plantilla.nombre.
  if (input.plantillaId) {
    const plantilla = await prisma.plantilla.findUnique({
      where: { id: input.plantillaId },
    });
    if (!plantilla) {
      throw new AppError("TEMPLATE_NOT_FOUND", { plantillaId: input.plantillaId });
    }
    const nombre = input.nombre ?? plantilla.nombre;
    const proyecto = await prisma.proyecto.create({
      data: {
        propietarioId: userId,
        nombre,
        data: plantilla.data as Prisma.InputJsonValue,
      },
    });
    return ok(c, { project: fullProject(proyecto) }, 201);
  }

  if (input.nombre === undefined) {
    throw new AppError("VALIDATION_ERROR", { issues: [{ path: "nombre", message: "nombre requerido (o usa plantillaId)" }] });
  }
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
  assertProjectId(id);
  // deleteMany acepta filtro no único y evita la doble consulta de propiedad.
  const { count } = await prisma.proyecto.deleteMany({
    where: { id, propietarioId: userId },
  });
  if (count === 0) throw new AppError("PROJECT_NOT_FOUND", { id });
  return ok(c, { deleted: true });
});

// C4 — Publicar: transacción (estado PUBLICADO + fila en galería). La galería
// solo debe contener juegos VÁLIDOS; se revalida `data` contra el contrato
// (aunque toda escritura ya lo valida, protege inserciones fuera de la API).
projectsRoutes.patch("/:id/publish", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const input = await parseBody(c, publishSchema);
  const proyecto = await ownedProject(id, userId);
  validateProjectData(proyecto.data);

  // Slug explícito en conflicto → 409; autogenerado → sufijo -2, -3...
  let slug = input.slug;
  if (slug) {
    const exist = await prisma.galeria.findUnique({ where: { slug } });
    if (exist && exist.proyectoId !== proyecto.id) {
      throw new AppError("SLUG_TAKEN", { slug });
    }
  } else {
    slug = await freeSlug(slugify(proyecto.nombre));
  }

  const titulo = input.titulo ?? proyecto.nombre;
  const descripcion = input.descripcion ?? "";
  const [galeria] = await prisma.$transaction([
    prisma.galeria.upsert({
      where: { proyectoId: proyecto.id },
      create: { proyectoId: proyecto.id, slug, titulo, descripcion },
      update: { slug, titulo, descripcion },
    }),
    prisma.proyecto.update({
      where: { id: proyecto.id },
      data: {
        estado: "PUBLICADO",
        publishedAt: new Date(),
        ...(input.thumbnailPath !== undefined ? { thumbnailPath: input.thumbnailPath } : {}),
        updatedAt: new Date(),
      },
    }),
  ]);

  return ok(c, {
    published: {
      proyectoId: proyecto.id,
      slug: galeria.slug,
      titulo: galeria.titulo,
      visitas: galeria.visitas,
    },
  });
});

// C4 — Despublicar: revierte el estado y borra la entrada de galería.
// Idempotente: si no estaba publicada termina en el mismo estado final.
projectsRoutes.patch("/:id/unpublish", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  await ownedProject(id, userId);

  await prisma.$transaction([
    prisma.galeria.deleteMany({ where: { proyectoId: id } }),
    prisma.proyecto.update({
      where: { id },
      data: { estado: "EN_DESARROLLO", publishedAt: null, updatedAt: new Date() },
    }),
  ]);

  return ok(c, { unpublished: true });
});