/**
 * studio/tests/spriteTool/helpers.ts — imágenes RGBA sintéticas para tests.
 */

import type { PixelImage } from '../../src/spriteTool/types';

/** Rellena un rectángulo de píxeles opacos (255,255,255,255). */
function blobOpaque(out: Array<[number, number]>, x: number, y: number, w: number, h: number): void {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) out.push([x + dx, y + dy]);
  }
}

/**
 * Crea una imagen w×h con píxeles opacos en las coordenadas dadas.
 * Se puede pasar `setAlpha` para valores de alpha distintos de 255 (p.ej.
 * píxeles semitransparentes bajo el umbral de detección).
 */
export function makeImg(w: number, h: number, opaque: Array<[number, number]> = [], alpha = 255): PixelImage {
  const data = new Uint8ClampedArray(w * h * 4);
  for (const [x, y] of opaque) {
    if (x < 0 || x >= w || y < 0 || y >= h) continue;
    const p = (y * w + x) * 4;
    data[p] = 255;
    data[p + 1] = 255;
    data[p + 2] = 255;
    data[p + 3] = alpha;
  }
  return { width: w, height: h, data };
}

/** Rellena un rect de píxeles opacos y devuelve la lista de coordenadas. */
export function opaqueRect(x: number, y: number, w: number, h: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  blobOpaque(out, x, y, w, h);
  return out;
}