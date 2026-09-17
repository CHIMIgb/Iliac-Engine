// routes/assets.ts — Subida/lectura/borrado de assets (DATABASE.md §8 C3).
// El MIME se detecta por magic bytes (file-type), no por la extensión ni el
// header del navegador; el `tipo` declarado debe coincidir con lo detectado.
// El blob vive en storage/uploads/<assetId>.<ext> (ruta única por fila).
// Dedupe por hash: re-subir el mismo archivo devuelve el asset existente (200)
// sin escribir bytes duplicados (ruta es @unique en el esquema; dos filas no
// pueden compartir archivo — ver nota ponytail en el plan C3).
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { Hono } from "hono";
import { fileTypeFromBuffer } from "file-type";
import { type TipoAsset } from "../../generated/prisma/client.ts";
import { prisma } from "../db.ts";
import { AppError } from "../lib/AppError.ts";
import { requireAuth, type AuthEnv } from "../lib/auth.ts";
import { ok } from "../lib/handler.ts";
import { readBlob, removeBlob, writeBlob } from "../lib/storage.ts";
import { extensionForMime, parseAssetUpload, TIPO_MIME } from "../schemas/assets.ts";

export const assetsRoutes = new Hono<AuthEnv>();
assetsRoutes.use("*", requireAuth);

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

/** Busca un asset verificando propiedad; ajeno → 404 (sin enumerar). */
async function ownedAsset(id: string, userId: string) {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset || asset.propietarioId !== userId) {
    throw new AppError("ASSET_NOT_FOUND", { id });
  }
  return asset;
}

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

  // Dedupe por hash: el mismo archivo ya existe → reutilizar (bytes y fila).
  const existing = await prisma.asset.findFirst({ where: { hash } });
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

  await writeBlob(id, mime, buffer);

  return ok(c, { asset: assetPayload(asset), reused: false }, 201);
});

assetsRoutes.get("/:id", async (c) => {
  const userId = c.get("userId");
  const asset = await ownedAsset(c.req.param("id"), userId);
  return ok(c, { asset: assetPayload(asset) });
});

assetsRoutes.get("/:id/file", async (c) => {
  const userId = c.get("userId");
  const asset = await ownedAsset(c.req.param("id"), userId);
  try {
    const bytes = await readBlob(asset.id, asset.mime);
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

assetsRoutes.delete("/:id", async (c) => {
  const userId = c.get("userId");
  const asset = await ownedAsset(c.req.param("id"), userId);
  const { count } = await prisma.asset.deleteMany({
    where: { id: asset.id, propietarioId: userId },
  });
  if (count === 0) throw new AppError("ASSET_NOT_FOUND", { id: asset.id });
  try {
    await removeBlob(asset.id, asset.mime);
  } catch {
    // Archivo ya ausente: el borrado lógico (fila) es lo importante.
  }
  return ok(c, { deleted: true });
});