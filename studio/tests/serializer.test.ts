import { describe, it, expect } from 'vitest';
import { EditorState } from '../src/editor/EditorState';
import { toProjectJson, fromProjectJson, validateProjectJson } from '../src/io/Serializer';
import { sampleProject } from '../src/sample-project';

describe('EditorState', () => {
  it('inicia vacío por defecto', () => {
    const s = new EditorState();
    expect(s.world.vertices).toEqual([]);
    expect(s.world.sectors).toEqual([]);
  });

  it('notifica cambios al mutar', () => {
    const s = new EditorState();
    let calls = 0;
    s.onChange(() => calls++);
    s.addVertex(0, 0);
    s.addVertex(8, 0);
    s.addVertex(8, 8);
    s.addVertex(0, 8);
    s.addSector(['id1', 'id2', 'id3', 'id4'] as any);
    expect(calls).toBeGreaterThanOrEqual(5);
  });

  it('addVertex genera ids únicos', () => {
    const s = new EditorState();
    const a = s.addVertex(0, 0);
    const b = s.addVertex(1, 1);
    expect(a.id).not.toBe(b.id);
  });

  it('removeVertex también elimina paredes que lo usaban', () => {
    const s = new EditorState();
    const v1 = s.addVertex(0, 0);
    const v2 = s.addVertex(8, 0);
    const sct = s.addSector([v1.id, v2.id, 'x', 'y']);
    s.addWall(v1.id, v2.id, sct.id, null);
    expect(s.world.walls.length).toBe(1);
    s.removeVertex(v1.id);
    expect(s.world.walls.length).toBe(0);
  });

  it('setFloorHeight y setCeilHeight actualizan', () => {
    const s = new EditorState();
    const v = [0, 1, 2, 3].map(() => 'v' + Math.random());
    const sct = s.addSector(v);
    s.setFloorHeight(sct.id, 2.5);
    s.setCeilHeight(sct.id, 6);
    expect(s.getSector(sct.id)?.floorH).toBe(2.5);
    expect(s.getSector(sct.id)?.ceilH).toBe(6);
  });

  it('snapshot produce una copia independiente', () => {
    const s = new EditorState();
    s.addVertex(0, 0);
    const snap = s.snapshot();
    s.addVertex(9, 9);
    expect(snap.world.vertices.length).toBe(1);
    expect(s.world.vertices.length).toBe(2);
  });
});

describe('Serializer', () => {
  it('round-trip de EditorState → project.json → EditorState conserva datos', () => {
    const s = new EditorState();
    const v1 = s.addVertex(0, 0);
    const v2 = s.addVertex(8, 0);
    const v3 = s.addVertex(8, 8);
    const v4 = s.addVertex(0, 8);
    const sct = s.addSector([v1.id, v2.id, v3.id, v4.id], 0, 3);
    s.addWall(v1.id, v2.id, sct.id, null);
    s.addSprite('sprite_blue', 4, 4, 0.8);

    const json = toProjectJson(s);
    const errors = validateProjectJson(json);
    expect(errors).toEqual([]);

    const restored = fromProjectJson(json);
    expect(restored.world.vertices.length).toBe(4);
    expect(restored.world.sectors.length).toBe(1);
    expect(restored.world.walls.length).toBe(1);
    expect(restored.world.sprites.length).toBe(1);
    expect(restored.getSector(sct.id)?.floorH).toBe(0);
  });

  it('genera un project.json válido para el motor (sampleProject)', () => {
    const errors = validateProjectJson(sampleProject as unknown as Record<string, unknown>);
    expect(errors).toEqual([]);
  });

  it('serializa los ids de paredes/vertices/sectores correctamente', () => {
    const s = new EditorState();
    const v1 = s.addVertex(0, 0, 'V1');
    const v2 = s.addVertex(8, 0, 'V2');
    const v3 = s.addVertex(8, 8, 'V3');
    const v4 = s.addVertex(0, 8, 'V4');
    const sct = s.addSector([v1.id, v2.id, v3.id, v4.id], 0, 3, 'SCT');
    const w = s.addWall(v1.id, v2.id, sct.id, null, 'W1');

    const json = toProjectJson(s);
    expect(json.world.vertices).toContainEqual(expect.objectContaining({ id: 'V1' }));
    expect(json.world.sectors).toContainEqual(expect.objectContaining({ id: 'SCT' }));
    expect(json.world.walls).toContainEqual(expect.objectContaining({ id: 'W1', a: 'V1', b: 'V2' }));
  });

  it('fromProjectJson ignora campos desconocidos', () => {
    const s = fromProjectJson({
      meta: { name: 'x', schemaVersion: 3 },
      world: { vertices: [], sectors: [], unknown: 123 },
    } as unknown as Record<string, unknown>);
    expect(s.world.vertices).toEqual([]);
    expect((s.world as any).unknown).toBeUndefined();
  });
});
