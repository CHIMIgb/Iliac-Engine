// schemas/assets.ts — Validación de subidas de assets (DATABASE.md §8 C3).
// Se valida el multipart (formData), no un body JSON: 'file' (el binario),
// 'tipo' (enum TipoAsset) y 'proyectoId' opcional. El MIME real se decide por
// magic bytes en el router (file-type); aquí solo la correspondencia tipo↔mime.
import { z } from "zod";
import { AppError } from "../lib/AppError.ts";

export const MAX_ASSET_BYTES = 20 * 1024 * 1024; // 20 MB de tope (audio/música de sobra)

export const tipoAssetSchema = z.enum(["texture", "sprite", "audio", "font", "modelo"]);

/** Mimetypes aceptados por cada tipo de asset (detección por magic bytes). */
export const TIPO_MIME: Record<string, string[]> = {
  texture: ["image/png", "image/webp"],
  sprite: ["image/png"],
  audio: ["audio/ogg", "audio/wav"],
  font: ["font/ttf"],
  modelo: ["model/gltf-binary"],
};

/** Extensión de archivo para el blob según el MIME detectado. */
export function extensionForMime(mime: string): string {
  const map: Record<string, string> = {
    "image/png": "png",
    "image/webp": "webp",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "font/ttf": "ttf",
    "model/gltf-binary": "glb",
  };
  return map[mime] ?? "bin";
}

export interface AssetUpload {
  file: File;
  tipo: string;
  proyectoId?: string;
}

/** Extrae y valida los campos del formData del POST /api/assets. */
export function parseAssetUpload(formData: FormData): AssetUpload {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw AppError.fromZod({ issues: [{ path: ["file"], message: "Campo 'file' requerido (multipart)" }] });
  }
  if (file.size === 0) {
    throw AppError.fromZod({ issues: [{ path: ["file"], message: "El archivo está vacío" }] });
  }
  if (file.size > MAX_ASSET_BYTES) {
    throw new AppError("ASSET_TOO_LARGE");
  }

  const tipoRaw = formData.get("tipo");
  const parsed = tipoAssetSchema.safeParse(tipoRaw);
  if (!parsed.success) {
    throw AppError.fromZod({
      issues: [{ path: ["tipo"], message: `'tipo' debe ser: ${tipoAssetSchema.options.join("|")}` }],
    });
  }

  const proyectoId = formData.get("proyectoId");
  if (proyectoId != null && typeof proyectoId !== "string") {
    throw AppError.fromZod({ issues: [{ path: ["proyectoId"], message: "Debe ser texto (uuid)" }] });
  }

  return { file, tipo: parsed.data, proyectoId: typeof proyectoId === "string" ? proyectoId : undefined };
}