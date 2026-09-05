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

describe('entityCatalog', () => {
  it('tiene las tres categorías ordenadas (NPC, humano, animal)', () => {
    expect(ENTITY_CATEGORIES.map((c) => c.id)).toEqual([
      'npc',
      'enemy-human',
      'enemy-animal',
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

  it('humanos y NPCs son altos (~1.8 m); animales bajos (< 1.5 m)', () => {
    const humans = ENTITIES.filter((e) => e.collisionType === 'human' || e.collisionType === 'npc');
    const animals = ENTITIES.filter((e) => e.collisionType === 'animal');
    for (const e of humans) expect(e.collisionBox.h).toBeGreaterThanOrEqual(1.6);
    for (const e of animals) expect(e.collisionBox.h).toBeLessThan(1.5);
    expect(animals.length).toBeGreaterThan(0);
  });

  it('getEntityDef devuelve null para ids desconocidos', () => {
    expect(getEntityDef('nope')).toBeNull();
    expect(getEntityDef(undefined)).toBeNull();
    expect(getEntityDef('enemy_wolf')?.name).toBe('Lobo');
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