// routes/gallery.ts — Galería pública (DATABASE.md §8 C4).
// Sin autenticación: cualquier visitante lista juegos publicados y obtiene el
// `data` completo de uno para que el motor pueda cargarlo en el navegador.
import { Hono } from "hono";
import { prisma } from "../db.ts";
import { AppError } from "../lib/AppError.ts";
import { ok } from "../lib/handler.ts";

export const galleryRoutes = new Hono();

// GET /api/gallery — lista pública de juegos publicados (sin data: solo meta).
galleryRoutes.get("/", async (c) => {
  const rows = await prisma.galeria.findMany({
    orderBy: { publishedAt: "desc" },
    include: {
      proyecto: {
        select: {
          propietario: {
            select: { login: true, persona: { select: { nombre: true } } },
          },
        },
      },
    },
  });

  return ok(c, {
    games: rows.map((g) => ({
      slug: g.slug,
      titulo: g.titulo,
      descripcion: g.descripcion,
      visitas: g.visitas,
      publicadoEn: g.publishedAt,
      autor: g.proyecto.propietario.persona?.nombre ?? g.proyecto.propietario.login,
    })),
    total: rows.length,
  });
});

// GET /api/gallery/:slug — juego publicado completo (para cargar en el motor)
// + contador de visitas (se incrementa aquí, la "visita" es abrir el juego).
galleryRoutes.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const galeria = await prisma.galeria.findUnique({
    where: { slug },
    include: { proyecto: true },
  });
  if (!galeria) throw new AppError("NOT_FOUND", { slug });

  const visitas = galeria.visitas + 1;
  await prisma.galeria.update({
    where: { id: galeria.id },
    data: { visitas: { increment: 1 } },
  });

  const p = galeria.proyecto;
  return ok(c, {
    juego: {
      slug: galeria.slug,
      titulo: galeria.titulo,
      descripcion: galeria.descripcion,
      visitas,
      publicadoEn: galeria.publishedAt,
      renderMode: p.renderMode,
      schemaVersion: p.schemaVersion,
      nombre: p.nombre,
      data: p.data,
    },
  });
});