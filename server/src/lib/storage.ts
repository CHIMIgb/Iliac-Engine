// lib/storage.ts — Blobs de assets en filesystem (DATABASE.md §8 C3).
// Raíz configurable por STORAGE_PATH; por defecto <server>/storage/uploads
// resuelto con import.meta.dirname (no depende del CWD donde se arranca).
// Estructura ordenada por usuario y tipo (ASSET_UPLOAD_PLAN.md §3):
//   uploads/<userId>/<tipo>/<assetId>.<ext> — la ruta única por fila (asset.ruta).
// Cada cuenta tiene su propio árbol; el dedupe por hash es por usuario
// (ver assets.ts), así que dos cuentas que suban el mismo archivo poseen
// blobs independientes aunque el contenido sea idéntico.
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { type TipoAsset } from "../../generated/prisma/client.ts";
import { extensionForMime } from "../schemas/assets.ts";

/** Raíz de blobs: STORAGE_PATH si está configurado, si no <server>/storage/uploads. */
export function storageRoot(): string {
  const configured = process.env.STORAGE_PATH;
  if (configured) return configured;
  // server/src/lib → server/storage/uploads
  return path.resolve(import.meta.dirname, "../../storage/uploads");
}

function blobPath(userId: string, tipo: TipoAsset, assetId: string, mime: string): string {
  return path.join(storageRoot(), userId, tipo, `${assetId}.${extensionForMime(mime)}`);
}

export async function writeBlob(
  userId: string,
  tipo: TipoAsset,
  assetId: string,
  mime: string,
  data: Buffer,
): Promise<string> {
  const target = blobPath(userId, tipo, assetId, mime);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  return target;
}

export async function readBlob(
  userId: string,
  tipo: TipoAsset,
  assetId: string,
  mime: string,
): Promise<Buffer> {
  return readFile(blobPath(userId, tipo, assetId, mime));
}

export async function removeBlob(
  userId: string,
  tipo: TipoAsset,
  assetId: string,
  mime: string,
): Promise<void> {
  await unlink(blobPath(userId, tipo, assetId, mime));
}