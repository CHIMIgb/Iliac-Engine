import { describe, it, expect } from 'vitest';
import { EditorState } from '../src/editor/EditorState';
import { assemble, mergeDungeon } from '../src/dungeons/assemble';
import { DUNGEONS } from '../src/dungeons/definitions';
import { BLOCKS } from '../src/dungeons/blocks';
import { validateProjectJson } from '../src/io/Serializer';

/** Estado con una habitación simple 8×8 (para probar que el merge no rompe). */
function makeRoom(): EditorState {
  const state = new EditorState();
  const a = state.addVertex(0, 0);
  const b = state.addVertex(8, 0);
  const c = state.addVertex(8, 8);
  const d = state.addVertex(0, 8);
  state.addSector([a.id, b.id, c.id, d.id], 0, 3);
  return state;
}

describe('dungeons · assemble', () => {
  it('todas las definiciones producen ids únicos y un world válido', () => {
    for (const def of DUNGEONS) {
      const dun = assemble(def);
      const unique = <T>(arr: T[]): boolean => new Set(arr).size === arr.length;
      expect(unique(dun.vertices.map((v) => v.id)), `vértices de ${def.id}`).toBe(true);
      expect(unique(dun.sectors.map((s) => s.id)), `sectores de ${def.id}`).toBe(true);
      expect(unique(dun.walls.map((w) => w.id)), `paredes de ${def.id}`).toBe(true);
      // Las referencias a/b de cada pared existen
      for (const w of dun.walls) {
        expect(dun.vertices.some((v) => v.id === w.a), `a de ${w.id}`).toBe(true);
        expect(dun.vertices.some((v) => v.id === w.b), `b de ${w.id}`).toBe(true);
      }
      // El mundo ensamblado → EditorState → project.json válido end-to-end
      const state = new EditorState();
      mergeDungeon(state, dun, 0, 0);
      const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
      expect(validateProjectJson(raw), `schema de ${def.id}`).toEqual([]);
    }
  });

  it('los pasajes interiores quedan abiertos y los del exterior sellados', () => {
    const dun = assemble(DUNGEONS[0]!); // cripta 3×2
    const byKey = new Map(dun.passages.map((p) => [`${p.tx},${p.ty},${p.side}`, p]));
    // (1,0) es el pasaje horizontal: sus bocas e/w tienen vecino → abiertas
    expect(byKey.get('1,0,e')?.open).toBe(true);
    expect(byKey.get('1,0,w')?.open).toBe(true);
    // Bordes exteriores: (0,0) w no tiene vecino → sellado
    expect(byKey.get('0,0,w')?.open).toBe(false);
    expect(byKey.get('0,0,s')?.open).toBe(false);
    // Cada pasaje sellado produce exactamente una pared `seal_`
    const seals = dun.walls.filter((w) => w.id.startsWith('seal_'));
    const closed = dun.passages.filter((p) => !p.open);
    expect(seals).toHaveLength(closed.length);
  });

  it('rotar un pasaje 90° convierte n/s en e/w sobre la geometría', () => {
    const dun = assemble({
      id: 't',
      name: 't',
      type: 't',
      tiles: [{ x: 0, y: 0, block: 'blk-passage', rot: 90 }],
    });
    // El pasillo (6,0)-(10,0)-(10,16)-(6,16) rotado 90° queda horizontal
    // (y≈6..10) con sus bocas abiertas en x=0 y x=16.
    const xs = dun.vertices.map((v) => v.x).sort((a, b) => a - b);
    const ys = dun.vertices.map((v) => v.y).sort((a, b) => a - b);
    expect(xs[0]).toBe(0);
    expect(xs[3]).toBe(16);
    expect(ys[0]).toBe(6);
    expect(ys[3]).toBe(10);
    const sides = dun.passages.map((p) => p.side).sort();
    expect(sides).toEqual(['e', 'w']);
  });
});

describe('dungeons · merge', () => {
  it('añade la mazmorra sin romper el mundo existente', () => {
    const state = makeRoom();
    const beforeVertices = state.world.vertices.length;
    const beforeSectors = state.world.sectors.length;
    const beforeWalls = state.world.walls.length;

    mergeDungeon(state, assemble(DUNGEONS[1]!), 100, 100); // mina 2×2 lejos

    expect(state.world.vertices.length).toBeGreaterThan(beforeVertices);
    expect(state.world.sectors.length).toBe(beforeSectors + 4); // 4 bloques
    expect(state.world.walls.length).toBeGreaterThan(beforeWalls);
    // La habitación original sigue intacta
    expect(state.world.sectors[0]!.vertexIds).toHaveLength(4);
    const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    expect(validateProjectJson(raw)).toEqual([]);
  });

  it('la cripta exporta el número exacto de sectores (1 por bloque)', () => {
    const dun = assemble(DUNGEONS[0]!);
    expect(dun.sectors).toHaveLength(DUNGEONS[0]!.tiles.length);
    // Cada sector tiene 4 vértices (las esquinas del bloque)
    for (const s of dun.sectors) expect(s.vertexIds).toHaveLength(4);
  });

  it('todos los bloques del catálogo son válidos', () => {
    for (const b of BLOCKS) {
      const dun = assemble({ id: b.id, name: b.name, type: 'bloque', tiles: [{ x: 0, y: 0, block: b.id }] });
      const state = new EditorState();
      mergeDungeon(state, dun, 0, 0);
      const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
      expect(validateProjectJson(raw), `bloque ${b.id}`).toEqual([]);
    }
  });
});