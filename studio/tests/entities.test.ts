/**
 * entities.test.ts — catálogo de entidades y colocación con la herramienta.
 */

import { describe, it, expect } from 'vitest';
import { EditorState } from '../src/editor/EditorState';
import { placeEntityAt, placeSpriteAt, defaultSpriteTex } from '../src/tools/tools';
import {
  ENTITIES,
  ENTITY_CATEGORIES,
  getEntityDef,
  entitiesByCategory,
} from '../src/entities/entityCatalog';
import { toProjectJson, fromProjectJson } from '../src/io/Serializer';

function makeRoom(): EditorState {
  const state = new EditorState();
  const a = state.addVertex(0, 0);
  const b = state.addVertex(8, 0);
  const c = state.addVertex(8, 8);
  const d = state.addVertex(0, 8);
  state.addSector([a.id, b.id, c.id, d.id], 0, 3);
  return state;
}

describe('EditorState.removeSpriteAnim (Fase G — Eliminar de la Biblioteca)', () => {
  function makeDoc(): EditorState {
    const state = makeRoom();
    // 3 anims mock + texturas de frames
    state.setWorldTextures({
      wolf_f0: 'data:a/wolf_f0', wolf_f1: 'data:a/wolf_f1',
      guard_f0: 'data:a/guard_f0',
      potion_f0: 'data:a/potion_f0', potion_f1: 'data:a/potion_f1',
      shared_f0: 'data:a/shared_f0',
    });
    state.setSpriteAnims({
      wolf_idle: { frames: ['wolf_f0', 'wolf_f1'], fps: 4, loop: true },
      guard_idle: { frames: ['guard_f0'], fps: 4, loop: true },
      potion_idle: { frames: ['potion_f0', 'potion_f1', 'shared_f0'], fps: 2, loop: false },
    });
    const guard = state.addSprite('guard_f0', 2, 2, 0, 'npc_guardian');
    guard.anim = 'guard_idle';
    const wolf = state.addSprite('wolf_f0', 3, 3, 0, 'npc_lobo');
    wolf.anim = 'wolf_idle';
    const potion = state.addSprite('potion_f0', 4, 4, 0, 'prop_pocion');
    potion.anim = 'potion_idle';
    // Sprite sin anim (debe conservarse) cuya tex no es de ningún frame.
    state.addSprite('z_tex', 5, 5, 0, 'prop_otro');
    return state;
  }

  it('borra la anim, los sprites del mundo que la usaban y sus texturas huérfanas', () => {
    const state = makeDoc();
    const r = state.removeSpriteAnim('wolf_idle');
    expect(r).toEqual({ ok: true, removedSprites: 1, removedTextures: 2 });
    expect(state.world.spriteAnims).not.toHaveProperty('wolf_idle');
    expect(state.world.sprites.map((s) => s.id)).not.toContain('npc_lobo');
    expect(state.world.sprites.map((s) => s.id)).toContain('npc_guardian');
    expect(state.world.sprites.map((s) => s.id)).toContain('prop_pocion');
    expect(state.world.textures).not.toHaveProperty('wolf_f0');
    expect(state.world.textures).not.toHaveProperty('wolf_f1');
  });

  it('conserva las texturas compartidas por otras anims', () => {
    const state = makeDoc();
    state.removeSpriteAnim('potion_idle'); // comparte shared_f0 con nadie más → se borra
    expect(state.world.textures).not.toHaveProperty('potion_f0');
    expect(state.world.textures).not.toHaveProperty('potion_f1');
    // shared_f0 no la usa ya ninguna anim tras el borrado → también se elimina
    expect(state.world.textures).not.toHaveProperty('shared_f0');
    expect(state.world.spriteAnims).not.toHaveProperty('potion_idle');
  });

  it('devuelve ok:false si la anim no existe y no muta nada', () => {
    const state = makeDoc();
    const before = state.snapshot();
    expect(state.removeSpriteAnim('no_existe')).toEqual({ ok: false });
    expect(state.world.sprites).toEqual(before.world.sprites);
    expect(state.world.spriteAnims).toEqual(before.world.spriteAnims);
  });
});

describe('entityCatalog', () => {
  it('tiene las seis categorías ordenadas (NPC, humano, animal, no muertos, daedra, criaturas)', () => {
    expect(ENTITY_CATEGORIES.map((c) => c.id)).toEqual([
      'npc',
      'enemy-human',
      'enemy-animal',
      'enemy-undead',
      'enemy-daedra',
      'enemy-monster',
    ]);
  });

  it('todas las categorías tienen al menos una entidad', () => {
    for (const cat of ENTITY_CATEGORIES) {
      expect(entitiesByCategory(cat.id).length).toBeGreaterThan(0);
    }
  });

  it('ids únicos y caja de colisión válida (w/d/h > 0)', () => {
    const ids = new Set<string>();
    for (const e of ENTITIES) {
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
      expect(e.collisionBox.w).toBeGreaterThan(0);
      expect(e.collisionBox.d).toBeGreaterThan(0);
      expect(e.collisionBox.h).toBeGreaterThan(0);
    }
  });

  it('humanoides (human/npc) son altos (≥ 1.6 m); el bestiario tiene de todo', () => {
    const humans = ENTITIES.filter((e) => e.collisionType === 'human' || e.collisionType === 'npc');
    const animals = ENTITIES.filter((e) => e.collisionType === 'animal');
    for (const e of humans) expect(e.collisionBox.h).toBeGreaterThanOrEqual(1.6);
    expect(animals.length).toBeGreaterThan(0);
  });

  it('getEntityDef devuelve null para ids desconocidos', () => {
    expect(getEntityDef('nope')).toBeNull();
    expect(getEntityDef(undefined)).toBeNull();
    expect(getEntityDef('enemy_wolf')?.name).toBe('Lobo');
  });

  it('bestiario de Daggerfall (df_*) presente en todas las categorías nuevas', () => {
    expect(getEntityDef('df_archer')?.category).toBe('enemy-human');
    expect(getEntityDef('df_giant_bat')?.category).toBe('enemy-animal');
    expect(getEntityDef('df_lich')?.category).toBe('enemy-undead');
    expect(getEntityDef('df_atronach_fire')?.category).toBe('enemy-daedra');
    expect(getEntityDef('df_dragon')?.category).toBe('enemy-monster');
    // Las secuelas de la lista de la wiki (vampiros, dragón, gigante) existen
    const dfCount = ENTITIES.filter((e) => e.id.startsWith('df_')).length;
    expect(dfCount).toBeGreaterThan(50);
  });
});

describe('tools · entidades', () => {
  it('placeEntityAt crea un sprite con los datos del catálogo', () => {
    const state = makeRoom();
    const def = getEntityDef('enemy_wolf')!;
    const id = placeEntityAt(state, 1.26, 3.7, def);
    const sp = state.world.sprites.find((s) => s.id === id)!;
    expect(sp.pos).toEqual({ x: 1.5, y: 3.5, z: 0 });
    expect(sp.entityType).toBe('enemy_wolf');
    expect(sp.entityName).toBe('Lobo');
    expect(sp.collisionType).toBe('animal');
    expect(sp.collisionBox).toEqual({ w: 0.6, d: 1.1, h: 0.9 });
    expect(sp.billboard).toBe(true);
  });

  it('varias entidades del mismo tipo no comparten caja (copia por valor)', () => {
    const state = makeRoom();
    const def = getEntityDef('enemy_bear')!;
    const idA = placeEntityAt(state, 1, 1, def);
    const idB = placeEntityAt(state, 3, 3, def);
    const a = state.world.sprites.find((s) => s.id === idA)!;
    const b = state.world.sprites.find((s) => s.id === idB)!;
    expect(a.collisionBox).not.toBe(b.collisionBox);
    expect(a.collisionBox).toEqual(b.collisionBox);
  });

  it('placeEntityAt con textura ausente cae a la textura por defecto', () => {
    const state = makeRoom();
    const def = getEntityDef('npc_villager')!; // tex 'sprite_npc_villager' no existe
    expect(state.world.textures[def.tex]).toBeUndefined();
    const id = placeEntityAt(state, 0, 0, def);
    const sp = state.world.sprites.find((s) => s.id === id)!;
    expect(sp.tex).toBe(defaultSpriteTex(state));
  });

  it('placeSpriteAt sigue creando sprites simples sin datos de entidad', () => {
    const state = makeRoom();
    const id = placeSpriteAt(state, 5, 5, 'sprite_blue');
    const sp = state.world.sprites.find((s) => s.id === id)!;
    expect(sp.entityType).toBeUndefined();
    expect(sp.collisionBox).toBeUndefined();
  });

  it('addSprite con entity.anim guarda la anim y mantiene billboard (E1, puente de colocación)', () => {
    const state = makeRoom();
    const sp = state.addSprite('guard_f0', 1, 1, 0, undefined, { anim: 'idle' });
    expect(sp.anim).toBe('idle');
    expect(sp.billboard).toBe(true); // requisito E5: todo sprite de entidad es billboard
  });

  it('addSprite sin entity.anim no deja rastro del campo (regresión E1)', () => {
    const state = makeRoom();
    const sp = state.addSprite('sprite_blue', 1, 1, 0);
    expect(sp.anim).toBeUndefined();
  });
});

describe('serializer · entidades', () => {
  it('round-trip conserva entityType, collisionType y collisionBox', () => {
    const state = makeRoom();
    const def = getEntityDef('enemy_rat')!;
    placeEntityAt(state, 2, 2, def);

    const s2 = fromProjectJson(toProjectJson(state) as unknown as Record<string, unknown>);
    expect(s2.world.sprites).toHaveLength(1);
    const sp = s2.world.sprites[0]!;
    expect(sp.entityType).toBe('enemy_rat');
    expect(sp.entityName).toBe('Rata');
    expect(sp.collisionType).toBe('animal');
    expect(sp.collisionBox).toEqual({ w: 0.3, d: 0.6, h: 0.35 });
  });
});