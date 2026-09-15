/**
 * studio/tests/spriteTool/frames.test.ts — naming, trim y orden de frames (F5).
 */
import { describe, expect, it } from 'vitest';
import { frameOrder, isEmptyRegion, textureKeyFor, trimRect, urlFor } from '../../src/spriteTool/frames';
import { makeImg, opaqueRect } from './helpers';

describe('frames', () => {
  it('genera key y URL coherentes por convención', () => {
    expect(textureKeyFor('guard', 0)).toBe('guard_f0');
    expect(textureKeyFor('guard', 12)).toBe('guard_f12');
    expect(urlFor('guard', 2)).toBe('/assets/sprites/guard_f2.png');
  });

  it('trimRect reduce al bounding box de píxeles opacos', () => {
    // Región 8×8 en (2,2) con opacos solo en (5,4)-(6,6).
    const img = makeImg(16, 16, opaqueRect(5, 4, 2, 3));
    const rect = { x: 2, y: 2, w: 8, h: 8 };
    expect(trimRect(img, rect)).toEqual({ x: 5, y: 4, w: 2, h: 3 });
  });

  it('trimRect devuelve null si la región está vacía', () => {
    const img = makeImg(16, 16);
    expect(trimRect(img, { x: 2, y: 2, w: 8, h: 8 })).toBeNull();
  });

  it('isEmptyRegion distingue regiones vacías de ocupadas', () => {
    const img = makeImg(16, 16, opaqueRect(4, 4, 2, 2));
    expect(isEmptyRegion(img, { x: 0, y: 0, w: 3, h: 3 })).toBe(true);
    expect(isEmptyRegion(img, { x: 0, y: 0, w: 8, h: 8 })).toBe(false);
  });

  it('frameOrder ordene row-major (filas por Y, luego X)', () => {
    const rects = [
      { x: 30, y: 30, w: 4, h: 4 }, // fila 1
      { x: 10, y: 2, w: 4, h: 4 }, // fila 0, col 2
      { x: 2, y: 2, w: 4, h: 4 }, // fila 0, col 1
      { x: 2, y: 32, w: 4, h: 4 }, // fila 1, col 1
    ];
    const ordered = frameOrder(rects);
    expect(ordered.map((r) => r.x)).toEqual([2, 10, 2, 30]);
    expect(ordered.map((r) => r.y)).toEqual([2, 2, 32, 30]);
  });
});