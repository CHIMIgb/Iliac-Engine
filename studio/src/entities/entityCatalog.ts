/**
 * entityCatalog.ts — Catálogo de entidades del Studio.
 *
 * Define los tipos de entidad que la herramienta Entidades (tecla 6) puede
 * colocar, agrupados por categoría (NPC / Enemigo-Humano / Enemigo-Animal).
 * Cada entidad declara su caja de colisión (en metros), que difiere entre
 * humanos (verticales, ~1.8 m) y animales (bajos y largos).
 *
 * Es dato de editor: el motor solo recibe `entityType`, `collisionType` y
 * `collisionBox` dentro de cada sprite del project.json.
 */

import type { EditableCollisionBox, EditableCollisionType } from '../editor/types';

export type EntityCategory = 'npc' | 'enemy-human' | 'enemy-animal';

export interface EntityDef {
  /** Id único del tipo (se guarda como entityType en el sprite). */
  id: string;
  /** Nombre legible para el selector y el editor. */
  name: string;
  category: EntityCategory;
  /** Textura del billboard en el juego. El editor usa fallback si no existe. */
  tex: string;
  /** Tipo de colisión: humano (alto y estrecho) vs animal (bajo y largo). */
  collisionType: EditableCollisionType;
  /** Caja de colisión en metros (w × d × h), centrada en el suelo. */
  collisionBox: EditableCollisionBox;
  /** Color del cubo de preview en el editor (por categoría). */
  color: number;
  description: string;
}

/** Categorías ordenadas tal como aparecen en el selector. */
export const ENTITY_CATEGORIES: { id: EntityCategory; label: string }[] = [
  { id: 'npc', label: 'NPCs' },
  { id: 'enemy-human', label: 'Enemigos — Humanos' },
  { id: 'enemy-animal', label: 'Enemigos — Animales' },
];

export const ENTITIES: EntityDef[] = [
  // ── NPCs ──────────────────────────────────────────────────────
  {
    id: 'npc_villager', name: 'Aldeano', category: 'npc',
    tex: 'sprite_npc_villager', collisionType: 'npc',
    collisionBox: { w: 0.5, d: 0.5, h: 1.8 }, color: 0x89b4fa,
    description: 'Habitante del pueblo; puede tener diálogo o comercio.',
  },
  {
    id: 'npc_merchant', name: 'Comerciante', category: 'npc',
    tex: 'sprite_npc_merchant', collisionType: 'npc',
    collisionBox: { w: 0.5, d: 0.5, h: 1.8 }, color: 0x89b4fa,
    description: 'Vende objetos al jugador.',
  },
  {
    id: 'npc_guard', name: 'Guardia', category: 'npc',
    tex: 'sprite_npc_guard', collisionType: 'npc',
    collisionBox: { w: 0.5, d: 0.5, h: 1.8 }, color: 0x89b4fa,
    description: 'Defiende la zona; patrulla si se le asigna un blueprint.',
  },

  // ── Enemigos — Humanos (colisión humana, ~1.8 m de alto) ─────
  {
    id: 'enemy_bandit', name: 'Bandido', category: 'enemy-human',
    tex: 'sprite_enemy_bandit', collisionType: 'human',
    collisionBox: { w: 0.5, d: 0.5, h: 1.8 }, color: 0xf38ba8,
    description: 'Atacante cuerpo a cuerpo.',
  },
  {
    id: 'enemy_soldier', name: 'Soldado', category: 'enemy-human',
    tex: 'sprite_enemy_soldier', collisionType: 'human',
    collisionBox: { w: 0.5, d: 0.5, h: 1.8 }, color: 0xf38ba8,
    description: 'Atacante con armadura; más resistencia.',
  },

  // ── Enemigos — Animales (colisión baja y alargada) ───────────
  {
    id: 'enemy_wolf', name: 'Lobo', category: 'enemy-animal',
    tex: 'sprite_enemy_wolf', collisionType: 'animal',
    collisionBox: { w: 0.6, d: 1.1, h: 0.9 }, color: 0xa6e3a1,
    description: 'Rápido, ataca en manada.',
  },
  {
    id: 'enemy_rat', name: 'Rata', category: 'enemy-animal',
    tex: 'sprite_enemy_rat', collisionType: 'animal',
    collisionBox: { w: 0.3, d: 0.6, h: 0.35 }, color: 0xa6e3a1,
    description: 'Débil y pequeña; cae con un golpe.',
  },
  {
    id: 'enemy_bear', name: 'Oso', category: 'enemy-animal',
    tex: 'sprite_enemy_bear', collisionType: 'animal',
    collisionBox: { w: 0.9, d: 1.6, h: 1.4 }, color: 0xa6e3a1,
    description: 'Lento pero muy dañino.',
  },
];

const byId = new Map(ENTITIES.map((e) => [e.id, e]));

export function getEntityDef(id: string | undefined): EntityDef | null {
  return id ? byId.get(id) ?? null : null;
}

export function entitiesByCategory(category: EntityCategory): EntityDef[] {
  return ENTITIES.filter((e) => e.category === category);
}