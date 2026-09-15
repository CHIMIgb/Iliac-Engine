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

  it('genera un project.json válido para el motor (sampleProject con terreno 100 m y sin cielo)', () => {
    const errors = validateProjectJson(sampleProject as unknown as Record<string, unknown>);
    expect(errors).toEqual([]);
    // El proyecto inicial: terreno 100 m (celda 2) = 50×50 sectores con
    // paisaje (praderas/montañas/río/lago), sin cielo por defecto, y sobrevive
    // al round-trip.
    const w = (sampleProject as unknown as { world: { sectors: unknown[]; sky: { set: number } | null } }).world;
    expect(w.sectors.length).toBe(2500);
    expect(w.sky).toBeUndefined();
    const restored = fromProjectJson(sampleProject as unknown as Record<string, unknown>);
    expect(restored.world.sectors.length).toBe(2500);
    expect(restored.world.sky).toBeNull();
  }, 15000);

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

describe('Sprite Tool · guardado (F5 Fase B)', () => {
  it('setWorldTextures y setSpriteAnims fusionan y notifican', () => {
    const s = new EditorState();
    let calls = 0;
    s.onChange(() => calls++);
    s.setWorldTextures({ guard_f0: '/assets/sprites/guard_f0.png' });
    s.setSpriteAnims({ idle: { frames: ['guard_f0', 'guard_f0'], fps: 4, loop: true } });
    expect(s.world.textures['guard_f0']).toBe('/assets/sprites/guard_f0.png');
    expect(s.world.spriteAnims?.['idle']?.frames).toEqual(['guard_f0', 'guard_f0']);
    expect(calls).toBe(2);
  });

  it('assignSpriteAnim escribe sprite.anim (puente F5→6.4)', () => {
    const s = new EditorState();
    const sp = s.addSprite('sprite', 1, 1, 0, 'sp_guard');
    expect(s.assignSpriteAnim('sp_guard', 'idle')).toBe(true);
    expect(s.world.sprites.find((x) => x.id === 'sp_guard')?.anim).toBe('idle');
    expect(s.assignSpriteAnim('no-existe', 'idle')).toBe(false);
    // null limpia la animación
    expect(s.assignSpriteAnim('sp_guard', null)).toBe(true);
    expect(s.world.sprites.find((x) => x.id === 'sp_guard')?.anim).toBeUndefined();
  });

  it('round-trip conserva spriteAnims y sprite.anim, y pasa validateProject', () => {
    const s = new EditorState();
    s.setWorldTextures({
      guard_f0: '/assets/sprites/guard_f0.png',
      guard_f1: '/assets/sprites/guard_f1.png',
    });
    s.setSpriteAnims({ idle: { frames: ['guard_f0', 'guard_f1'], fps: 4 } });
    const sp = s.addSprite('guard_f0', 2, 2, 0.5, 'sp_guard');
    s.assignSpriteAnim(sp.id, 'idle');

    const json = toProjectJson(s);
    expect(validateProjectJson(json)).toEqual([]);
    expect(json.world.spriteAnims?.['idle']).toEqual({ frames: ['guard_f0', 'guard_f1'], fps: 4 });
    expect(json.world.sprites.find((x: { id: string }) => x.id === 'sp_guard')?.anim).toBe('idle');

    const restored = fromProjectJson(json);
    expect(restored.world.spriteAnims?.['idle']?.frames).toEqual(['guard_f0', 'guard_f1']);
    expect(restored.world.sprites.find((x) => x.id === 'sp_guard')?.anim).toBe('idle');
  });
});
