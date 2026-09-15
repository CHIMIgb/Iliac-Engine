/**
 * spriteTool/frames.ts — utilidades de frames del Sprite Tool (F5).
 *
 * Nombre y URL por convención del Studio (`guard_f2` →
 * `/assets/sprites/guard_f2.png`), inspección de regiones (vacías/trim) y
 * orden row-major de una lista de rects. Todo puro (sin canvas): el dibujado
 * real a `<canvas>` ocurre en la UI (spriteToolUI.ts).
 */

import type { PixelImage, Rect } from './types';

/** Key de textura por convención: `{assetId}_f{index}`. */
export function textureKeyFor(assetId: string, index: number): string {
  return `${assetId}_f${index}`;
}

/** URL servida por el middleware del Studio para el frame. */
export function urlFor(assetId: string, index: number): string {
  return `/assets/sprites/${textureKeyFor(assetId, index)}.png`;
}

/** Key de un PNG suelto (Fase C): `{assetId}_{nombre_sanitizado_sin_ext}`. */
export function frameKeyFromFile(assetId: string, fileName: string): string {
  return `${assetId}_${assetIdFromFileName(fileName)}`;
}

/** URL servida por el middleware para una key arbitraria (hoja, espejo o suelta). */
export function spritePath(key: string): string {
  return `/assets/sprites/${key}.png`;
}

/** Sanea un nombre de archivo a un asset id usable (minusculas, sin extension). */
export function assetIdFromFileName(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? '';
  const withoutExt = base.replace(/\.[^.]+$/, '');
  const clean = withoutExt.replace(/[^A-Za-z0-9._-]/g, '_');
  return clean.toLowerCase();
}

/**
 * Recorta una región de la hoja a un `PixelImage` nuevo (sin canvas → testeable
 * en Node). Con `trim` recorta además al bounding box de píxeles opacos; si la
 * región queda vacía devuelve null. Sin escalado: nunca pierde calidad.
 */
export function cropRegion(img: PixelImage, rect: Rect, opts: { trim?: boolean; alphaThreshold?: number } = {}): PixelImage | null {
  const trim = opts.trim ?? false;
  const alphaThreshold = opts.alphaThreshold ?? 8;
  let r = rect;

  if (trim) {
    const t = trimRect(img, r, alphaThreshold);
    if (t === null) return null;
    r = t;
  }

  const out = new Uint8ClampedArray(r.w * r.h * 4);
  for (let dy = 0; dy < r.h; dy++) {
    const sy = r.y + dy;
    if (sy < 0 || sy >= img.height) continue;
    const src = (sy * img.width + r.x) * 4;
    const dst = dy * r.w * 4;
    for (let dx = 0; dx < r.w; dx++) {
      const sx = r.x + dx;
      if (sx < 0 || sx >= img.width) continue;
      out[dst + dx * 4] = img.data[src + dx * 4]!;
      out[dst + dx * 4 + 1] = img.data[src + dx * 4 + 1]!;
      out[dst + dx * 4 + 2] = img.data[src + dx * 4 + 2]!;
      out[dst + dx * 4 + 3] = img.data[src + dx * 4 + 3]!;
    }
  }
  return { width: r.w, height: r.h, data: out };
}

/** True si la región no contiene ningún píxel con alpha ≥ umbral. */
export function isEmptyRegion(img: PixelImage, rect: Rect, alphaThreshold = 8): boolean {
  for (let dy = 0; dy < rect.h; dy++) {
    const y = rect.y + dy;
    if (y < 0 || y >= img.height) continue;
    const row = (y * img.width + rect.x) * 4;
    for (let dx = 0; dx < rect.w; dx++) {
      const x = rect.x + dx;
      if (x < 0 || x >= img.width) continue;
      if (img.data[row + dx * 4 + 3]! >= alphaThreshold) return false;
    }
  }
  return true;
}

/**
 * Reduce un rect al bounding box de sus píxeles opacos (trim). Devuelve null
 * si la región está vacía. Útil para recortar el sobrante transparente de cada
 * frame; ojo: activar el trim cambia el registro (pivot) entre frames y puede
 * hacer "tambalear" la animación — la UI lo advierte.
 */
export function trimRect(img: PixelImage, rect: Rect, alphaThreshold = 8): Rect | null {
  let minX = rect.w;
  let minY = rect.h;
  let maxX = -1;
  let maxY = -1;
  for (let dy = 0; dy < rect.h; dy++) {
    const y = rect.y + dy;
    if (y < 0 || y >= img.height) continue;
    const row = (y * img.width + rect.x) * 4;
    for (let dx = 0; dx < rect.w; dx++) {
      const x = rect.x + dx;
      if (x < 0 || x >= img.width) continue;
      if (img.data[row + dx * 4 + 3]! >= alphaThreshold) {
        if (dx < minX) minX = dx;
        if (dx > maxX) maxX = dx;
        if (dy < minY) minY = dy;
        if (dy > maxY) maxY = dy;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: rect.x + minX, y: rect.y + minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Voltea horizontalmente una imagen (espejo), 7f. Puro (sin canvas): invierte
 * el orden de columnas RGBA y devuelve una copia nueva sin tocar la original.
 */
export function mirrorPixelImage(img: PixelImage): PixelImage {
  const out = new Uint8ClampedArray(img.width * img.height * 4);
  for (let y = 0; y < img.height; y++) {
    const row = y * img.width;
    for (let x = 0; x < img.width; x++) {
      const src = (row + x) * 4;
      const dst = (row + (img.width - 1 - x)) * 4;
      out[dst] = img.data[src]!;
      out[dst + 1] = img.data[src + 1]!;
      out[dst + 2] = img.data[src + 2]!;
      out[dst + 3] = img.data[src + 3]!;
    }
  }
  return { width: img.width, height: img.height, data: out };
}

/**
 * Ordena los rects en filas: agrupa por centro Y (con tolerancia = mitad de la
 * altura media, para hojas con pequeñas inclinaciones) y dentro de cada fila
 * ordena por X. Cada rect devuelto es el mismo objeto (no se copia).
 */
export function frameOrder(rects: Rect[]): Rect[] {
  if (rects.length < 2) return rects.slice();
  const cy = rects.map((r) => r.y + r.h / 2);
  const avgH = rects.reduce((s, r) => s + r.h, 0) / rects.length;
  const slop = Math.max(avgH / 2, 1);

  // Índices ordenados por centro Y (para formar filas sin pre-ordenar X).
  const byY = rects.map((_, i) => i).sort((a, b) => cy[a]! - cy[b]!);

  const rows: number[][] = [];
  for (const i of byY) {
    const last = rows[rows.length - 1];
    if (last !== undefined && cy[last[0]!]! + slop >= cy[i]!) last.push(i);
    else rows.push([i]);
  }

  const out: Rect[] = [];
  for (const row of rows) {
    const sorted = row.slice().sort((a, b) => rects[a]!.x - rects[b]!.x);
    for (const i of sorted) out.push(rects[i]!);
  }
  return out;
}