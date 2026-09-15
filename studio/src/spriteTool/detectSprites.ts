/**
 * spriteTool/detectSprites.ts — detección automática de sprites (F5, modo Auto).
 *
 * Recorre la hoja buscando "islas" de píxeles con alpha (componentes conexas
 * por 4-vecindad) y devuelve el bounding box de cada una. Sirve para hojas
 * irregulares o empaquetadas donde no hay grilla uniforme; necesita
 * transparencia real entre sprites (un tileset sin alpha es un solo bloque —
 * la UI lo detecta y sugiere el modo manual).
 *
 * Pura y testeable en Node: opera sobre `PixelImage` (RGBA plano), sin canvas.
 */

import type { PixelImage, Rect } from './types';
import { frameOrder } from './frames';

export interface DetectOptions {
  /** Umbral de alpha (0-255) para considerar un píxel "activo". */
  alphaThreshold?: number;
  /** Componentes con menos píxeles que esto se descartan (ruido). */
  minPixels?: number;
  /** Fusiona cajas separadas por esta distancia (px) o menos. */
  gapTolerance?: number;
  /** Tope de sprites devueltos (salvaguarda de rendimiento). */
  maxSprites?: number;
}

/** True si dos cajas expandidas `gap` px a cada lado se tocan/solapan. */
function touchesExpanded(a: Rect, b: Rect, gap: number): boolean {
  return (
    a.x - gap <= b.x + b.w - 1 + gap &&
    a.x + a.w - 1 + gap >= b.x - gap &&
    a.y - gap <= b.y + b.h - 1 + gap &&
    a.y + a.h - 1 + gap >= b.y - gap
  );
}

/** Caja unión de dos rects. */
function union(a: Rect, b: Rect): Rect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    w: Math.max(a.x + a.w, b.x + b.w) - x,
    h: Math.max(a.y + a.h, b.y + b.h) - y,
  };
}

/**
 * Fusiona cajas que quedan a menos de `gapTolerance` px entre sí (sprites con
 * huecos internos o piezas separadas por 1 px de anti-aliasing).
 * ponytail: peor caso O(n³) con muchas fusiones (n limitado por maxSprites);
 * otra opción es un sweep por ejes si un día hay hojas con cientos de piezas
 * por fusionar.
 */
function mergeCloseRects(rects: Rect[], gapTolerance: number): Rect[] {
  if (gapTolerance <= 0 || rects.length < 2) return rects;
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        if (touchesExpanded(rects[i]!, rects[j]!, gapTolerance)) {
          rects[i] = union(rects[i]!, rects[j]!);
          rects.splice(j, 1);
          changed = true;
          break outer;
        }
      }
    }
  }
  return rects;
}

/**
 * Detecta los sprites de una hoja transparente. Devuelve el bounding box de
 * cada componente conexo de píxeles opacos, en orden row-major (filas de
 * arriba a abajo, y dentro de cada fila de izquierda a derecha).
 */
export function detectSprites(img: PixelImage, opts: DetectOptions = {}): Rect[] {
  const alphaThreshold = opts.alphaThreshold ?? 8;
  const minPixels = opts.minPixels ?? 4;
  const gapTolerance = opts.gapTolerance ?? 2;
  const maxSprites = opts.maxSprites ?? 512;

  const w = img.width;
  const h = img.height;
  if (w <= 0 || h <= 0) return [];

  const visited = new Uint8Array(w * h); // 1 = ya explorado
  const stack: number[] = []; // índices de píxel pendientes del BFS
  const rects: Rect[] = [];

  for (let sy = 0; sy < h; sy++) {
    for (let sx = 0; sx < w; sx++) {
      const p = sy * w + sx;
      if (visited[p] !== 0 || img.data[p * 4 + 3]! < alphaThreshold) continue;

      // BFS del componente: arranca en (sx, sy) y crece por 4-vecindad.
      let minX = sx;
      let maxX = sx;
      let minY = sy;
      let maxY = sy;
      let count = 0;
      visited[p] = 1;
      stack.length = 0;
      stack.push(p);
      while (stack.length > 0) {
        const q = stack.pop()!;
        count++;
        const x = q % w;
        const y = (q / w) | 0;
        if (x < minX) minX = x;
        else if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        else if (y > maxY) maxY = y;
        const neighbors: Array<[number, number]> = [
          [x - 1, y],
          [x + 1, y],
          [x, y - 1],
          [x, y + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
          const np = ny * w + nx;
          if (visited[np] !== 0) continue;
          if (img.data[np * 4 + 3]! < alphaThreshold) continue;
          visited[np] = 1;
          stack.push(np);
        }
      }

      if (count >= minPixels) {
        rects.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
      }
    }
  }

  const merged = gapTolerance > 0 ? mergeCloseRects(rects, gapTolerance) : rects;
  const capped = merged.length > maxSprites ? merged.slice(0, maxSprites) : merged;
  return frameOrder(capped);
}