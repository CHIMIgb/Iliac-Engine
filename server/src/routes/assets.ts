// routes/assets.ts — Subida/lectura/borrado de assets (DATABASE.md §8 C3).
// El MIME se detecta por magic bytes (file-type), no por la extensión ni el
// header del navegador; el `tipo` declarado debe coincidir con lo detectado.
// El blob vive en storage/uploads/<userId>/<tipo>/<assetId>.<ext> (ruta única
// por fila; ASSET_UPLOAD_PLAN.md §3).
// Dedupe por hash POR USUARIO: re-subir el mismo archivo reutiliza la fila
// existente (200) sin escribir bytes duplicados; dos cuentas que suban el
// mismo contenido reciben filas y blobs independientes (aislamiento).
// C5c: `GET /:id/file` es PÚBLICO (D1) y hay `GET /` (list, D6); el resto sigue
// exigiendo JWT y propiedad.
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { Hono } from "hono";
import { fileTypeFromBuffer } from "file-type";
import { type TipoAsset } from "../../generated/prisma/client.ts";
import { prisma } from "../db.ts";
import { AppError } from "../lib/AppError.ts";
import { requireAuth, type AuthEnv } from "../lib/auth.ts";
import { ok } from "../lib/handler.ts";
import { assertUuid } from "../lib/ids.ts";
import { readBlob, removeBlob, writeBlob } from "../lib/storage.ts";
import {
  extensionForMime,
  parseAssetUpload,
  tipoAssetSchema,
  TIPO_MIME,
} from "../schemas/assets.ts";

export const assetsRoutes = new Hono<AuthEnv>();

/** Asume propiedad (ya verificada por el caller); mapea la fila a la respuesta. */
function assetPayload(a: {
  id: string;
  nombre: string;
  tipo: TipoAsset;
  mime: string;
  tamanoBytes: number;
  hash: string | null;
  createdAt: Date;
}) {
  return {
    id: a.id,
    nombre: a.nombre,
    tipo: a.tipo,
    mime: a.mime,
    tamanoBytes: a.tamanoBytes,
    hash: a.hash,
    createdAt: a.createdAt,
  };
}

/**
 * Sirve el blob SIN JWT (D1, C5c): el motor lo carga con `TextureLoader`/
 * `fetch` y no conoce sesiones, y la galería (F8) servirá assets a anónimos.
 * Solo la metadata (GET /:id) y el borrado exigen token y propiedad.
 *
 * Va declarada ANTES del `use("*", requireAuth)` a propósito: Hono resuelve
 * los handlers en orden de registro, así que esta ruta responde sin pasar por
 * el middleware de auth.
 */
assetsRoutes.get("/:id/file", async (c) => {
  const id = c.req.param("id");
  assertUuid(id, "ASSET_NOT_FOUND");
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset) throw new AppError("ASSET_NOT_FOUND", { id });
  try {
    const bytes = await readBlob(asset.propietarioId, asset.tipo, asset.id, asset.mime);
    const inline = asset.mime.startsWith("image/");
    return c.body(new Uint8Array(bytes), 200, {
      "Content-Type": asset.mime,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asset.nombre}"`,
    });
  } catch {
    // La fila existe pero el archivo no: blob huérfano.
    throw new AppError("ASSET_NOT_FOUND", { id: asset.id });
  }
});

// ── A partir de aquí, todo exige JWT ─────────────────────────────
assetsRoutes.use("*", requireAuth);

/** Busca un asset verificando propiedad; ajeno → 404 (sin enumerar). */
async function ownedAsset(id: string, userId: string) {
  assertUuid(id, "ASSET_NOT_FOUND");
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset || asset.propietarioId !== userId) {
    throw new AppError("ASSET_NOT_FOUND", { id });
  }
  return asset;
}

/**
 * Lista los assets de la cuenta (D6, C5c), opcionalmente por tipo
 * (`?tipo=audio`) — lo usa el popover de Audio del Studio para ofrecer sus
 * audios ya subidos. Sin paginación: una cuenta tiene pocos assets y el payload
 * es solo metadata.
 */
assetsRoutes.get("/", async (c) => {
  const userId = c.get("userId");
  const tipo = c.req.query("tipo");
  if (tipo !== undefined) {
    const parsed = tipoAssetSchema.safeParse(tipo);
    if (!parsed.success) {
      throw AppError.fromZod({
        issues: [{ path: ["tipo"], message: `'tipo' debe ser: ${tipoAssetSchema.options.join("|")}` }],
      });
    }
  }
  const assets = await prisma.asset.findMany({
    where: { propietarioId: userId, ...(tipo ? { tipo: tipo as TipoAsset } : {}) },
    orderBy: { createdAt: "desc" },
  });
  return ok(c, { assets: assets.map(assetPayload) });
});

assetsRoutes.post("/", async (c) => {
  const userId = c.get("userId");
  const upload = parseAssetUpload(await c.req.formData());

  // El proyecto referenciado (opcional) debe ser del mismo usuario.
  if (upload.proyectoId) {
    const proyecto = await prisma.proyecto.findFirst({
      where: { id: upload.proyectoId, propietarioId: userId },
      select: { id: true },
    });
    if (!proyecto) {
      throw AppError.fromZod({
        issues: [{ path: ["proyectoId"], message: "El proyecto no existe o no es tuyo" }],
      });
    }
  }

  const buffer = Buffer.from(await upload.file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buffer);
  const mime = detected?.mime ?? "application/octet-stream";

  // 'tipo' declarado debe encajar con el MIME real del contenido.
  const allowed = TIPO_MIME[upload.tipo] ?? [];
  if (!allowed.includes(mime)) {
    throw AppError.fromZod({
      issues: [
        {
          path: ["file"],
          message: `El contenido es ${mime}; para tipo '${upload.tipo}' se espera ${allowed.join(" o ")}`,
        },
      ],
    });
  }

  const hash = createHash("sha256").update(buffer).digest("hex");

  // Dedupe por hash POR USUARIO: el mismo usuario re-subiendo su archivo
  // reutiliza la fila existente (bytes y fila). Otro usuario con el mismo
  // contenido crea su propio asset (aislamiento multi-cuenta).
  const existing = await prisma.asset.findFirst({ where: { hash, propietarioId: userId } });
  if (existing) {
    return ok(c, { asset: assetPayload(existing), reused: true });
  }

  // No existe: persistir fila (con id propio para nombrar el blob) y luego el archivo.
  const id = randomUUID();
  const ext = extensionForMime(mime);
  const asset = await prisma.asset.create({
    data: {
      id,
      propietarioId: userId,
      proyectoId: upload.proyectoId ?? null,
      nombre: upload.file.name || `asset-${upload.tipo}`,
      tipo: upload.tipo as TipoAsset,
      mime,
      tamanoBytes: buffer.byteLength,
      ruta: `uploads/${id}.${ext}`,
      hash,
    },
  });

  await writeBlob(userId, upload.tipo as TipoAsset, id, mime, buffer);

  return ok(c, { asset: assetPayload(asset), reused: false }, 201);
});

assetsRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const asset = await ownedAsset(c.req.param("id"), userId);
  return ok(c, { asset: assetPayload(asset) });
});

assetsRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const asset = await ownedAsset(c.req.param("id"), userId);
  const { count } = await prisma.asset.deleteMany({
    where: { id: asset.id, propietarioId: userId },
  });
  if (count === 0) throw new AppError("ASSET_NOT_FOUND", { id: asset.id });
  try {
    await removeBlob(asset.propietarioId, asset.tipo, asset.id, asset.mime);
  } catch {
    // Archivo ya ausente: el borrado lógico (fila) es lo importante.
  }
  return ok(c, { deleted: true });
});