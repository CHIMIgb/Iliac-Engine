/**
 * studio/tests/spriteTool/gridSlice.test.ts — corte manual por grilla (F5).
 */
import { describe, expect, it } from 'vitest';
import { cellSize, gridRects, rectFromCell } from '../../src/spriteTool/gridSlice';
import { makeImg, opaqueRect } from './helpers';

describe('gridSlice', () => {
  it('reparte una hoja 128×64 en 4 cols × 2 rows = 8 frames de 32×32', () => {
    const img = makeImg(128, 64);
    const rects = gridRects(img, 4, 2);
    expect(rects).toHaveLength(8);
    expect(rects[0]).toEqual({ x: 0, y: 0, w: 32, h: 32 });
    expect(rects[1]).toEqual({ x: 32, y: 0, w: 32, h: 32 });
    expect(rects[3]).toEqual({ x: 96, y: 0, w: 32, h: 32 }); // último de fila 0
    expect(rects[4]).toEqual({ x: 0, y: 32, w: 32, h: 32 }); // primer de fila 1
    expect(rects[7]).toEqual({ x: 96, y: 32, w: 32, h: 32 });
  });

  it('cols/rows inválidos → []', () => {
    const img = makeImg(64, 32);
    expect(gridRects(img, 0, 2)).toEqual([]);
    expect(gridRects(img, 4, 0)).toEqual([]);
  });

  it('spacing resta el borde por lado', () => {
    const img = makeImg(128, 64);
    const rects = gridRects(img, 4, 2, { spacing: 1 });
    expect(rects[0]).toEqual({ x: 1, y: 1, w: 30, h: 30 });
    expect(rects[1]).toEqual({ x: 33, y: 1, w: 30, h: 30 });
  });

  it('trailingEmpty descarta celdas vacías al final', () => {
    // Hoja 64×32 = 4×2 celdas de 16×16; opacos solo en las 6 primeras.
    const img = makeImg(
      64,
      32,
      [
        ...opaqueRect(1, 1, 8, 8), // celda 0
        ...opaqueRect(17, 1, 8, 8), // celda 1
        ...opaqueRect(33, 1, 8, 8), // celda 2
        ...opaqueRect(49, 1, 8, 8), // celda 3
        ...opaqueRect(1, 17, 8, 8), // celda 4
        ...opaqueRect(17, 17, 8, 8), // celda 5
        // celdas 6 y 7 vacías
      ],
    );
    const rects = gridRects(img, 4, 2, { trailingEmpty: true });
    expect(rects).toHaveLength(6);
    expect(rects[5]).toEqual({ x: 16, y: 16, w: 16, h: 16 });
  });

  it('cellSize y rectFromCell calculan tamaños exactos', () => {
    const size = cellSize(128, 64, 4, 2);
    expect(size).toEqual({ cellW: 32, cellH: 32 });
    expect(rectFromCell(2, 1, size)).toEqual({ x: 64, y: 32, w: 32, h: 32 });
    expect(rectFromCell(2, 1, size, 2)).toEqual({ x: 66, y: 34, w: 28, h: 28 });
  });
});