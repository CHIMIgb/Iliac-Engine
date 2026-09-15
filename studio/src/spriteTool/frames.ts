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

/** Sanea un nombre de archivo a un asset id usable (minusculas, sin extension). */
export function assetIdFromFileName(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? '';
  const withoutExt = base.replace(/\.[^.]+$/, '');
  const clean = withoutExt.replace(/[^A-Za-z0-9._-]/g, '_');
  return clean.toLowerCase();
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