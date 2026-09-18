/**
 * io/assetApi.ts — Assets del juego en la API (C5c).
 *
 * Con sesión, los assets (frames de sprite, audio) se suben a `POST /api/assets`
 * (multipart, `file-type` decide el MIME por contenido) y el documento guarda su
 * URL servida: `/api/assets/<id>/file` — pública (D1), porque el motor la carga
 * con `TextureLoader`/`fetch` y no conoce sesiones. El server deduplica por hash:
 * re-subir el mismo archivo devuelve la misma fila (`reused: true`).
 *
 * Sin sesión NO hay guardado de assets (decisión C5c): quien llama comprueba la
 * sesión antes (main.ts lee `requireSession`, ToolManager preguntar por su
 * puente) y aquí no hay ningún camino local alternativo.
 */
import { apiDeleteAsset, apiListAssets, apiUploadAsset } from './api';
import type { AssetMeta } from './api';

export interface UploadedAsset {
  /** Clave del frame (sprites) o nombre del archivo (audio). */
  key: string;
  /** URL servida por la API (pública) o null si falló. */
  url: string | null;
  /** true si el server ya tenía ese contenido (dedupe por hash). */
  reused: boolean;
  /** Mensaje de error legible si falló; null si fue bien. */
  error: string | null;
}

/** URL pública del blob de un asset (la que se guarda en el documento). */
export function assetUrl(id: string): string {
  return `/api/assets/${id}/file`;
}

/** dataURL ('data:image/png;base64,...') → Blob. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const mime = /^data:([^;,]+)/.exec(dataUrl)?.[1] ?? 'application/octet-stream';
  const bin = atob(comma === -1 ? dataUrl : dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** Sube los frames del Sprite Tool (key → dataURL) y devuelve key → URL de la API. */
export async function uploadSpriteFrames(
  frames: Record<string, string>,
  proyectoId?: string | null,
): Promise<Record<string, UploadedAsset>> {
  const out: Record<string, UploadedAsset> = {};
  for (const [key, dataUrl] of Object.entries(frames)) {
    try {
      const { asset, reused } = await apiUploadAsset({
        file: dataUrlToBlob(dataUrl),
        nombre: `${key}.png`,
        tipo: 'sprite',
        proyectoId,
      });
      out[key] = { key, url: assetUrl(asset.id), reused, error: null };
    } catch (e) {
      out[key] = { key, url: null, reused: false, error: e instanceof Error ? e.message : 'Error' };
    }
  }
  return out;
}

/** Sube audios (File del explorador) y devuelve por archivo su URL o su error. */
export async function uploadAudioFiles(
  files: File[],
  proyectoId?: string | null,
): Promise<UploadedAsset[]> {
  const out: UploadedAsset[] = [];
  for (const file of files) {
    try {
      const { asset, reused } = await apiUploadAsset({
        file,
        nombre: file.name,
        tipo: 'audio',
        proyectoId,
      });
      out.push({ key: file.name, url: assetUrl(asset.id), reused, error: null });
    } catch (e) {
      out.push({
        key: file.name,
        url: null,
        reused: false,
        error: e instanceof Error ? e.message : 'Error',
      });
    }
  }
  return out;
}

/** URLs de los audios de la cuenta (para detectar srcs que ya no existen). */
export async function listAudioUrls(): Promise<string[]> {
  const { assets } = await apiListAssets('audio');
  return assets.map((a) => assetUrl(a.id));
}

/** Sprites físicos subidos a la cuenta (GET /api/assets?tipo=sprite) — los
 *  PNG individuales que el usuario importó; se listan organizados en la tab
 *  «Mis Sprites» del Sprite Tool. */
export async function listSpriteAssets(): Promise<AssetMeta[]> {
  const { assets } = await apiListAssets('sprite');
  return assets;
}

/** Elimina un sprite de la cuenta (DELETE /api/assets/:id). */
export async function deleteSpriteAsset(id: string): Promise<void> {
  await apiDeleteAsset(id);
}
