/**
 * spriteTool/gridSlice.ts — corte manual por grilla (F5, modo Manual).
 *
 * Divide la hoja en una grilla uniforme de cols×rows (o tamaño de celda) y
 * devuelve el rect de cada celda. Soporta `spacing` (borde por lado, típico de
 * tilesets con gap de 1 px) y `trailingEmpty` (descarta celdas vacías al final
 * de la hoja, como la opción "last frames empty?" de GDS).
 *
 * Pura y testeable en Node: opera sobre `PixelImage`, sin canvas.
 */

import type { PixelImage, Rect } from './types';
import { isEmptyRegion } from './frames';

export interface GridOptions {
  /** Píxeles de borde a restar por lado de cada celda (default 0). */
  spacing?: number;
  /** Si true, descarta celdas vacías consecutivas al final de la hoja. */
  trailingEmpty?: boolean;
  /** Umbral de alpha para considerar una celda "vacía" (default 8). */
  alphaThreshold?: number;
}

/** Tamaño de celda derivado de la hoja y la grilla (truncado a entero). */
export interface CellSize {
  cellW: number;
  cellH: number;
}

/** Deriva el tamaño de celda de una grilla cols×rows sobre una hoja w×h. */
export function cellSize(sheetW: number, sheetH: number, cols: number, rows: number): CellSize {
  return {
    cellW: cols > 0 ? Math.floor(sheetW / cols) : 0,
    cellH: rows > 0 ? Math.floor(sheetH / rows) : 0,
  };
}

/** Rect de la celda (col, row) aplicando el borde `spacing` por lado. */
export function rectFromCell(col: number, row: number, size: CellSize, spacing = 0): Rect {
  const sp = Math.max(0, spacing);
  return {
    x: col * size.cellW + sp,
    y: row * size.cellH + sp,
    w: Math.max(1, size.cellW - sp * 2),
    h: Math.max(1, size.cellH - sp * 2),
  };
}

/**
 * Genera los rects de la grilla cols×rows sobre la hoja, en orden row-major
 * (fila 0 completa, luego fila 1…). Con `trailingEmpty`, quita las celdas
 * vacías (sin píxeles opacos) del final.
 */
export function gridRects(img: PixelImage, cols: number, rows: number, opts: GridOptions = {}): Rect[] {
  if (cols < 1 || rows < 1) return [];
  const size = cellSize(img.width, img.height, cols, rows);
  if (size.cellW < 1 || size.cellH < 1) return [];

  const spacing = opts.spacing ?? 0;
  const out: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push(rectFromCell(c, r, size, spacing));
    }
  }

  if (opts.trailingEmpty) {
    const threshold = opts.alphaThreshold ?? 8;
    while (out.length > 0 && isEmptyRegion(img, out[out.length - 1]!, threshold)) out.pop();
  }
  return out;
}