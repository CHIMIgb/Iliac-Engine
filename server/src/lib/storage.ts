// lib/storage.ts — Blobs de assets en filesystem (DATABASE.md §8 C3).
// Raíz configurable por STORAGE_PATH; por defecto <server>/storage/uploads
// resuelto con import.meta.dirname (no depende del CWD donde se arranca).
// Nombre de archivo = <assetId>.<ext> — la ruta única por fila (asset.ruta).
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { extensionForMime } from "../schemas/assets.ts";

function storageRoot(): string {
  const configured = process.env.STORAGE_PATH;
  if (configured) return configured;
  // server/src/lib → server/storage/uploads
  return path.resolve(import.meta.dirname, "../../storage/uploads");
}

function blobPath(assetId: string, mime: string): string {
  return path.join(storageRoot(), `${assetId}.${extensionForMime(mime)}`);
}

export async function writeBlob(assetId: string, mime: string, data: Buffer): Promise<string> {
  const target = blobPath(assetId, mime);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  return target;
}

export async function readBlob(assetId: string, mime: string): Promise<Buffer> {
  return readFile(blobPath(assetId, mime));
}

export async function removeBlob(assetId: string, mime: string): Promise<void> {
  await unlink(blobPath(assetId, mime));
}