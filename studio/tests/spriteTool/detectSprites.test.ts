/**
 * studio/tests/spriteTool/detectSprites.test.ts — detección automática (F5).
 */
import { describe, expect, it } from 'vitest';
import { detectSprites } from '../../src/spriteTool/detectSprites';
import { makeImg, opaqueRect } from './helpers';

describe('detectSprites', () => {
  it('detecta 3 sprites separados y los ordena row-major', () => {
    // Fila 0: A en (2,2) 4×4 y B en (20,2) 4×4 · Fila 1: C en (2,18) 4×4.
    const img = makeImg(
      32,
      24,
      [...opaqueRect(2, 2, 4, 4), ...opaqueRect(20, 2, 4, 4), ...opaqueRect(2, 18, 4, 4)],
    );
    const rects = detectSprites(img);
    expect(rects).toHaveLength(3);
    expect(rects[0]).toEqual({ x: 2, y: 2, w: 4, h: 4 }); // fila 0, col 0
    expect(rects[1]).toEqual({ x: 20, y: 2, w: 4, h: 4 }); // fila 0, col 1
    expect(rects[2]).toEqual({ x: 2, y: 18, w: 4, h: 4 }); // fila 1
  });

  it('descarta el ruido de píxeles sueltos (minPixels)', () => {
    const img = makeImg(16, 16, [...opaqueRect(1, 1, 3, 3), [5, 5]]);
    const rects = detectSprites(img, { gapTolerance: 0 });
    expect(rects).toHaveLength(1); // el blob 3×3 (9 px) sí, el solitario no
    expect(rects[0]).toEqual({ x: 1, y: 1, w: 3, h: 3 });
  });

  it('fusiona piezas cercanas con gapTolerance (sprite partido)', () => {
    // Dos blobs 2×2 separados por 1 px de transparencia en X.
    const img = makeImg(16, 16, [...opaqueRect(2, 2, 2, 2), ...opaqueRect(5, 2, 2, 2)]);
    const rects = detectSprites(img, { gapTolerance: 2 });
    expect(rects).toHaveLength(1);
    expect(rects[0]).toEqual({ x: 2, y: 2, w: 5, h: 2 });
  });

  it('no fusiona si gapTolerance es 0', () => {
    const img = makeImg(16, 16, [...opaqueRect(2, 2, 2, 2), ...opaqueRect(5, 2, 2, 2)]);
    const rects = detectSprites(img, { gapTolerance: 0 });
    expect(rects).toHaveLength(2);
  });

  it('hoja sin transparencia = un solo rect (caso tileset)', () => {
    // Toda la hoja opaca: no hay separación, se detecta como un bloque.
    const img = makeImg(8, 8, opaqueRect(0, 0, 8, 8));
    const rects = detectSprites(img);
    expect(rects).toHaveLength(1);
    expect(rects[0]).toEqual({ x: 0, y: 0, w: 8, h: 8 });
  });

  it('hoja vacía → []', () => {
    const img = makeImg(8, 8);
    expect(detectSprites(img)).toEqual([]);
  });

  it('píxeles semitransparentes bajo el umbral se ignoran', () => {
    const img = makeImg(8, 8);
    img.data[(3 * 8 + 3) * 4 + 3] = 5; // alpha 5 < umbral 8
    img.data[(5 * 8 + 5) * 4 + 3] = 200; // alpha 200 ≥ umbral
    // minPixels 1 para que un solo píxel cuente como sprite.
    const rects = detectSprites(img, { minPixels: 1 });
    expect(rects).toHaveLength(1);
    expect(rects[0]).toEqual({ x: 5, y: 5, w: 1, h: 1 });
  });

  it('respeta maxSprites (salvaguarda)', () => {
    const img = makeImg(64, 8, [
      ...opaqueRect(1, 1, 2, 2),
      ...opaqueRect(9, 1, 2, 2),
      ...opaqueRect(17, 1, 2, 2),
      ...opaqueRect(25, 1, 2, 2),
    ]);
    const rects = detectSprites(img, { gapTolerance: 0, maxSprites: 2 });
    expect(rects).toHaveLength(2);
  });
});