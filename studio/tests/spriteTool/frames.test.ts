/**
 * studio/tests/spriteTool/frames.test.ts — naming, trim y orden de frames (F5).
 */
import { describe, expect, it } from 'vitest';
import { assetIdFromFileName, cropRegion, frameKeyFromFile, frameOrder, isEmptyRegion, mirrorPixelImage, spritePath, textureKeyFor, trimRect, urlFor } from '../../src/spriteTool/frames';
import { makeImg, opaqueRect } from './helpers';

describe('frames', () => {
  it('genera key y URL coherentes por convención', () => {
    expect(textureKeyFor('guard', 0)).toBe('guard_f0');
    expect(textureKeyFor('guard', 12)).toBe('guard_f12');
    expect(urlFor('guard', 2)).toBe('/assets/sprites/guard_f2.png');
  });

  it('assetIdFromFileName sanea el nombre a minusculas y sin extension', () => {
    expect(assetIdFromFileName('Guard.PNG')).toBe('guard');
    expect(assetIdFromFileName('mi hoja 2.png')).toBe('mi_hoja_2');
    expect(assetIdFromFileName('a/b/goblin walk.webp')).toBe('goblin_walk');
    expect(assetIdFromFileName('a\\b\\Goblin.Walk.webp')).toBe('goblin.walk');
  });

  it('frameKeyFromFile combina assetId con el nombre sano del archivo (C1)', () => {
    expect(frameKeyFromFile('guard', 'Sword.png')).toBe('guard_sword');
    expect(frameKeyFromFile('guard', 'mi poción.png')).toBe('guard_mi_poci_n');
    expect(frameKeyFromFile('guard', 'a/b/Arrow.WebP')).toBe('guard_arrow');
  });

  it('spritePath genera la URL del middleware para cualquier key (C1)', () => {
    expect(spritePath('guard_f0')).toBe('/assets/sprites/guard_f0.png');
    expect(spritePath('guard_sword')).toBe('/assets/sprites/guard_sword.png');
    expect(spritePath('guard_f0_mirror')).toBe('/assets/sprites/guard_f0_mirror.png');
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

describe('cropRegion', () => {
  it('recorta un rect sin escalado (dimensiones y píxeles exactos)', () => {
    const img = makeImg(8, 8, opaqueRect(0, 0, 8, 8));
    const out = cropRegion(img, { x: 2, y: 1, w: 3, h: 2 });
    expect(out).not.toBeNull();
    expect(out!.width).toBe(3);
    expect(out!.height).toBe(2);
    expect(out!.data[7]).toBe(255); // primer píxel de la fila 2 (opaco)
    expect(out!.data[10]).toBe(255); // primer píxel de la fila 3
  });

  it('copia exactamente los píxeles de la región (incluye alpha)', () => {
    const img = makeImg(4, 4);
    img.data[(1 * 4 + 2) * 4 + 3] = 120;
    img.data[(1 * 4 + 2) * 4] = 10;
    const out = cropRegion(img, { x: 2, y: 1, w: 1, h: 1 })!;
    expect(out.data[3]).toBe(120);
    expect(out.data[0]).toBe(10);
  });

  it('trim recorta al bounding box de píxeles opacos', () => {
    const img = makeImg(8, 8, opaqueRect(5, 4, 2, 3));
    const out = cropRegion(img, { x: 2, y: 2, w: 8, h: 8 }, { trim: true })!;
    expect(out.width).toBe(2);
    expect(out.height).toBe(3);
  });

  it('sin trim respeta la celda completa aunque tenga bordes transparentes', () => {
    const img = makeImg(8, 8, opaqueRect(5, 4, 2, 3));
    const out = cropRegion(img, { x: 2, y: 2, w: 8, h: 8 })!;
    expect(out.width).toBe(8);
    expect(out.height).toBe(8);
  });

  it('con trim y región vacía devuelve null', () => {
    const img = makeImg(8, 8);
    expect(cropRegion(img, { x: 0, y: 0, w: 4, h: 4 }, { trim: true })).toBeNull();
  });
});

describe('mirrorPixelImage (7f)', () => {
  it('voltea horizontalmente los píxeles (2×1: [R,G] → [G,R])', () => {
    const img = { width: 2, height: 1, data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]) };
    const out = mirrorPixelImage(img);
    expect(out.width).toBe(2);
    expect(out.height).toBe(1);
    expect([...out.data]).toEqual([0, 255, 0, 255, 255, 0, 0, 255]);
  });

  it('preserva alpha y no muta la original', () => {
    const img = {
      width: 3,
      height: 1,
      data: new Uint8ClampedArray([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]),
    };
    const out = mirrorPixelImage(img);
    expect([...out.data]).toEqual([90, 100, 110, 120, 50, 60, 70, 80, 10, 20, 30, 40]);
    expect([...img.data]).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
  });

  it('imagen 1×1 queda igual', () => {
    const img = { width: 1, height: 1, data: new Uint8ClampedArray([7, 8, 9, 255]) };
    const out = mirrorPixelImage(img);
    expect([...out.data]).toEqual([7, 8, 9, 255]);
  });
});