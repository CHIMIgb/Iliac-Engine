/**
 * landscape.test.ts — el mapa por defecto del Studio (100×100 m, celdas 2 m):
 * montaña central alta, río que cruza, terreno irregular alrededor, todo gris
 * por defecto y determinista.
 */
import { describe, it, expect } from 'vitest';
import { sampleProject, buildDefaultDoc, landscapeHeight, MOUNTAIN } from '../src/sample-project';
import { createNoise } from '@engine/core/noise.js';

const world = sampleProject.world as unknown as {
  vertices: { id: string; x: number; y: number }[];
  sectors: { id: string; vertexIds: string[]; floorH: number[]; floorTex: string }[];
  textures: Record<string, string | number>;
};

const heightById = new Map<string, number>();
for (const s of world.sectors) {
  for (let i = 0; i < s.vertexIds.length; i++) heightById.set(s.vertexIds[i]!, s.floorH[i] ?? 0);
}

describe('mapa por defecto 100×100 @ 2 m', () => {
  it('es una grilla completa de 50×50 celdas con 4 alturas por sector', () => {
    expect(world.sectors.length).toBe(50 * 50);
    expect(world.vertices.length).toBe(51 * 51);
    expect(world.sectors.every((s) => Array.isArray(s.floorH) && s.floorH.length === 4)).toBe(true);
  });

  it('tiene una montaña central de ~50 m en (50,50)', () => {
    let maxH = 0;
    let at: { x: number; z: number } | null = null;
    for (const v of world.vertices) {
      const h = heightById.get(v.id) ?? 0;
      if (h > maxH) { maxH = h; at = { x: v.x, z: v.y }; }
    }
    expect(maxH).toBeGreaterThanOrEqual(45);
    // la cima está cerca del centro declarado (tolera el paso de 2 m de la grilla)
    expect(Math.hypot(at!.x - MOUNTAIN.x, at!.z - MOUNTAIN.z)).toBeLessThan(12);
  });

  it('el río cruza el mapa de oeste a este con lecho plano a 0,25 m', () => {
    const pos = new Map<string, { x: number; z: number }>();
    for (const v of world.vertices) pos.set(v.id, { x: v.x, z: v.y });
    let minX = Infinity;
    let maxX = -Infinity;
    let bedCells = 0;
    for (const s of world.sectors) {
      if (Math.max(...s.floorH) >= 0.4) continue;
      bedCells++;
      const cx = s.vertexIds.reduce((a, id) => a + pos.get(id)!.x, 0) / 4;
      minX = Math.min(minX, cx);
      maxX = Math.max(maxX, cx);
    }
    expect(minX).toBeLessThan(15);    // el cauce toca el borde oeste
    expect(maxX).toBeGreaterThan(85);  // y el este
    expect(bedCells).toBeGreaterThan(40); // cauce continuo (~50 filas de agua)
    expect(bedCells).toBeLessThan(world.sectors.length / 4); // no es un mar
  });

  it('el terreno lejos de la montaña es irregular pero bajo (colinas de 0–6 m)', () => {
    const far = world.vertices.filter((v) => Math.hypot(v.x - MOUNTAIN.x, v.y - MOUNTAIN.z) > MOUNTAIN.radius + 6);
    expect(far.length).toBeGreaterThan(300);
    const hs = far.map((v) => heightById.get(v.id) ?? 0);
    expect(Math.max(...hs)).toBeLessThan(8);
    // irregularidad real: alturas variadas, no un plano
    const spread = Math.max(...hs) - Math.min(...hs);
    expect(spread).toBeGreaterThan(2);
  });

  it('por defecto NO declara texturas: el suelo usa el gris del motor', () => {
    expect(Object.keys(world.textures).length).toBe(0);
    expect(world.sectors.every((s) => s.floorTex === 'grass')).toBe(true);
  });

  it('landscapeHeight es determinista para la misma semilla', () => {
    const a = landscapeHeight(63, 85, createNoise(1337), createNoise(1338));
    const b = landscapeHeight(63, 85, createNoise(1337), createNoise(1338));
    expect(a).toBe(b);
    expect(a).toBeGreaterThanOrEqual(0);
  });

  it('buildDefaultDoc produce el mismo paisaje en cada arranque', () => {
    const sum = (doc: ReturnType<typeof buildDefaultDoc>) =>
      doc.world.sectors.reduce((acc, s) => acc + (s.floorH as number[]).reduce((a, h) => a + h, 0), 0);
    expect(Math.round(sum(buildDefaultDoc()))).toBe(Math.round(sum(buildDefaultDoc())));
  }, 15000);
});
