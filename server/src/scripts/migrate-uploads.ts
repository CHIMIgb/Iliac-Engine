/**
 * migrate-uploads.ts — Migración one-shot de blobs (ASSET_UPLOAD_PLAN.md paso 3).
 *
 *   npm run migrate:uploads
 *
 * Mueve los blobs de la estructura plana anterior
 *   uploads/<assetId>.<ext>
 * a la estructura ordenada por usuario y tipo
 *   uploads/<userId>/<tipo>/<assetId>.<ext>
 * y actualiza la columna `asset.ruta` para que refleje la nueva ubicación
 * (relativa a STORAGE_PATH). Usa fs.rename (mismo filesystem → no copia bytes).
 *
 * Idempotente: si el destino ya existe, no duplica ni peta; solo repara `ruta`.
 * Blobs huérfanos (fila sin archivo) se saltan con warning.
 */
import { access, mkdir, rename } from "node:fs/promises";
import { resolve } from "node:path";
import { prisma } from "../db.ts";
import { storageRoot } from "../lib/storage.ts";
import { extensionForMime } from "../schemas/assets.ts";

const root = storageRoot();

async function exists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

const assets = await prisma.asset.findMany();
let movidos = 0;
let reparados = 0;
let huerfanos = 0;

for (const asset of assets) {
  const ext = extensionForMime(asset.mime);
  // `ruta` guardada en BD va relativa a server/ y conserva el prefijo "uploads/"
  // (igual que antes: uploads/<id>.<ext>); la ruta absoluta se construye sobre
  // storageRoot() que YA es .../server/storage/uploads → sin repetir "uploads/".
  const nuevoRel = `uploads/${asset.propietarioId}/${asset.tipo}/${asset.id}.${ext}`;
  const nuevoAbs = resolve(root, asset.propietarioId, asset.tipo, `${asset.id}.${ext}`);
  const viejoAbs = resolve(root, `${asset.id}.${ext}`);

  // Destino ya en su sitio: solo garantizar que `ruta` esté al día.
  if (await exists(nuevoAbs)) {
    if (asset.ruta !== nuevoRel) {
      await prisma.asset.update({ where: { id: asset.id }, data: { ruta: nuevoRel } });
      reparados++;
    }
    continue;
  }

  // Origen plano existente → mover.
  if (await exists(viejoAbs)) {
    await mkdir(resolve(root, asset.propietarioId, asset.tipo), { recursive: true });
    await rename(viejoAbs, nuevoAbs);
    await prisma.asset.update({ where: { id: asset.id }, data: { ruta: nuevoRel } });
    movidos++;
    console.log(`✔ ${asset.id} → ${nuevoRel}`);
    continue;
  }

  // Ni destino ni origen: fila sin blob.
  huerfanos++;
  console.warn(`⚠ ${asset.id} (${asset.nombre}): sin blob en origen ni destino, se salta`);
}

console.log(`Migración lista: ${movidos} movido(s), ${reparados} ruta(s) reparada(s), ${huerfanos} huérfano(s).`);
await prisma.$disconnect();