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

  // Regresión 2026-09-17: cargar un documento con `Object.assign` pisaba
  // `handlers` (propiedad de instancia) y el editor se quedaba sordo: ni flag
  // de cambios sin guardar ni reload en vivo del viewport.
  it('applyFrom vuelca los datos y CONSERVA los suscriptores', () => {
    const doc = new EditorState();
    let calls = 0;
    doc.onChange(() => calls++);

    const cargado = fromProjectJson({
      meta: { name: 'Torre del Alba', schemaVersion: 3 },
      world: { vertices: [], sectors: [{ id: 's1', vertexIds: [] }], walls: [] },
    } as unknown as Record<string, unknown>);

    doc.applyFrom(cargado);

    expect(doc.meta.name).toBe('Torre del Alba');
    expect(doc.world.sectors.map((s) => s.id)).toEqual(['s1']);
    doc.addVertex(1, 2); // mutación posterior: el handler del doc sigue vivo
    expect(calls).toBe(1);
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

  // Regresión 2026-09-17: sin `render` en el JSON, `fromProjectJson` metía un
  // `{}` que pisaba el default del constructor y el motor arrancaba con los
  // defaults del Renderer3D (fov 75 / far 200) mientras el editor creía tener
  // el render por defecto. Al iniciar sesión eso forzaba el reload caro.
  it('fromProjectJson sin render conserva el default del EditorState', () => {
    const s = fromProjectJson({
      world: { vertices: [], sectors: [], walls: [] },
    } as unknown as Record<string, unknown>);
    expect(s.render).toEqual(new EditorState().render);
    expect(s.render.fov).toBe(80);
    expect(s.render.far).toBe(500);
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

  it('assignSpriteAnim exige la anim guardada y escribe sprite.anim (puente F5→6.4)', () => {
    const s = new EditorState();
    const sp = s.addSprite('sprite', 1, 1, 0, 'sp_guard');
    expect(s.assignSpriteAnim('sp_guard', 'idle')).toBe(false); // 'idle' no está guardada
    const sp2 = s.addSprite('sprite', 2, 2, 0, 'sp_guard2');
    s.setSpriteAnims({ idle: { frames: ['sp_guard'], fps: 4, loop: true } });
    expect(s.assignSpriteAnim('sp_guard2', 'idle')).toBe(true);
    expect(s.world.sprites.find((x) => x.id === 'sp_guard2')?.anim).toBe('idle');
    expect(s.assignSpriteAnim('no-existe', 'idle')).toBe(false);
    // null limpia la animación
    expect(s.assignSpriteAnim('sp_guard2', null)).toBe(true);
    expect(s.world.sprites.find((x) => x.id === 'sp_guard2')?.anim).toBeUndefined();
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

  it('getSpriteLibrarySnapshot (Fase D1) expone texturas + anims guardadas', () => {
    const s = new EditorState();
    // Sin nada guardado: snapshot vacío, no null.
    expect(s.getSpriteLibrarySnapshot()).toEqual({ textures: {}, spriteAnims: {} });
    s.setWorldTextures({ guard_f0: '/assets/sprites/guard_f0.png' });
    s.setSpriteAnims({ idle: { frames: ['guard_f0', 'guard_f0'], fps: 4, loop: true } });
    const snap = s.getSpriteLibrarySnapshot();
    expect(snap.textures['guard_f0']).toBe('/assets/sprites/guard_f0.png');
    expect(snap.spriteAnims['idle']).toEqual({ frames: ['guard_f0', 'guard_f0'], fps: 4, loop: true });
    // El snapshot es una foto: mutar el mundo después no altera el objeto devuelto.
    snap.spriteAnims['idle']!.frames.push('x');
    expect(s.world.spriteAnims?.['idle']?.frames).toEqual(['guard_f0', 'guard_f0']);
  });
});
