/**
 * entityCatalog.ts — Catálogo de entidades del Studio.
 *
 * Define los tipos de entidad que la herramienta Entidades (tecla 6) puede
 * colocar, agrupados por categoría. Además de los tipos genéricos (NPC,
 * humano hostil, animal), incluye el bestiario de The Elder Scrolls II:
 * Daggerfall (fuente: elderscrolls.fandom.com/wiki/Enemies_(Daggerfall)).
 *
 * Cada entidad declara su caja de colisión (en metros), que difiere entre
 * humanos (verticales, ~1.8 m) y animales (bajos y largos).
 *
 * Es dato de editor: el motor solo recibe `entityType`, `collisionType` y
 * `collisionBox` dentro de cada sprite del project.json.
 */

import type { EditableCollisionBox, EditableCollisionType } from '../editor/types';

export type EntityCategory =
  | 'npc'
  | 'enemy-human'
  | 'enemy-animal'
  | 'enemy-undead'
  | 'enemy-daedra'
  | 'enemy-monster';

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
  { id: 'enemy-undead', label: 'Enemigos — No Muertos' },
  { id: 'enemy-daedra', label: 'Enemigos — Daedra' },
  { id: 'enemy-monster', label: 'Enemigos — Criaturas' },
];

// Colores por categoría (Catppuccin Mocha + tonos del bestiario).
const C_NPC = 0x89b4fa; // azul
const C_HUMAN = 0xf38ba8; // rojo
const C_ANIMAL = 0xa6e3a1; // verde
const C_UNDEAD = 0x9399b2; // lavanda (hueso)
const C_DAEDRA = 0xfab387; // melocotón (fuego de Oblivion)
const C_MONSTER = 0x94e2d5; // teal

// Caja humanoide estándar (1.8 m de alto).
const BOX_HUMAN: EditableCollisionBox = { w: 0.5, d: 0.5, h: 1.8 };
// Caja humanoide grande (orcos, liches, vampiros ancianos).
const BOX_HUMAN_BIG: EditableCollisionBox = { w: 0.6, d: 0.6, h: 2.0 };

export const ENTITIES: EntityDef[] = [
  // ── NPCs ──────────────────────────────────────────────────────
  {
    id: 'npc_villager', name: 'Aldeano', category: 'npc',
    tex: 'sprite_npc_villager', collisionType: 'npc',
    collisionBox: { w: 0.5, d: 0.5, h: 1.8 }, color: C_NPC,
    description: 'Habitante del pueblo; puede tener diálogo o comercio.',
  },
  {
    id: 'npc_merchant', name: 'Comerciante', category: 'npc',
    tex: 'sprite_npc_merchant', collisionType: 'npc',
    collisionBox: { w: 0.5, d: 0.5, h: 1.8 }, color: C_NPC,
    description: 'Vende objetos al jugador.',
  },
  {
    id: 'npc_guard', name: 'Guardia', category: 'npc',
    tex: 'sprite_npc_guard', collisionType: 'npc',
    collisionBox: { w: 0.5, d: 0.5, h: 1.8 }, color: C_NPC,
    description: 'Defiende la zona; patrulla si se le asigna un blueprint.',
  },

  // ── Enemigos — Humanos (colisión humana, ~1.8 m de alto) ─────
  {
    id: 'enemy_bandit', name: 'Bandido', category: 'enemy-human',
    tex: 'sprite_enemy_bandit', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Atacante cuerpo a cuerpo.',
  },
  {
    id: 'enemy_soldier', name: 'Soldado', category: 'enemy-human',
    tex: 'sprite_enemy_soldier', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Atacante con armadura; más resistencia.',
  },

  // Daggerfall — pícaros y mercenarios
  {
    id: 'df_acrobat', name: 'Acróbata', category: 'enemy-human',
    tex: 'sprite_enemy_acrobat', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Ágil, esquiva y ataca por sorpresa.',
  },
  {
    id: 'df_archer', name: 'Arquero', category: 'enemy-human',
    tex: 'sprite_enemy_archer', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Ataca a distancia con arco.',
  },
  {
    id: 'df_assassin', name: 'Asesino', category: 'enemy-human',
    tex: 'sprite_enemy_assassin', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Golpea en silencio y desde las sombras.',
  },
  {
    id: 'df_barbarian', name: 'Bárbaro', category: 'enemy-human',
    tex: 'sprite_enemy_barbarian', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Fuerte, ataca cuerpo a cuerpo sin armadura.',
  },
  {
    id: 'df_bard', name: 'Bardo', category: 'enemy-human',
    tex: 'sprite_enemy_bard', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Usa magia de ilusión y encantamiento.',
  },
  {
    id: 'df_battlemage', name: 'Magibrujo', category: 'enemy-human',
    tex: 'sprite_enemy_battlemage', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Combina armas y destrucción mágica.',
  },
  {
    id: 'df_burglar', name: 'Ladrón', category: 'enemy-human',
    tex: 'sprite_enemy_burglar', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Rápido, ataca por la espalda.',
  },
  {
    id: 'df_healer', name: 'Clérigo', category: 'enemy-human',
    tex: 'sprite_enemy_healer', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Cura a sus aliados durante el combate.',
  },
  {
    id: 'df_knight', name: 'Caballero', category: 'enemy-human',
    tex: 'sprite_enemy_knight', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Guerrero con armadura completa.',
  },
  {
    id: 'df_mage', name: 'Mago', category: 'enemy-human',
    tex: 'sprite_enemy_mage', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Ataca con hechizos a distancia.',
  },
  {
    id: 'df_monk', name: 'Monje', category: 'enemy-human',
    tex: 'sprite_enemy_monk', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Pelea con las manos desnudas.',
  },
  {
    id: 'df_nightblade', name: 'Hoja Nocturna', category: 'enemy-human',
    tex: 'sprite_enemy_nightblade', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Espadachín que mezcla ilusión y sigilo.',
  },
  {
    id: 'df_orc', name: 'Orco', category: 'enemy-human',
    tex: 'sprite_enemy_orc', collisionType: 'human',
    collisionBox: BOX_HUMAN_BIG, color: C_HUMAN,
    description: 'Guerrero orco, fuerte y agresivo.',
  },
  {
    id: 'df_orc_sergeant', name: 'Sargento Orco', category: 'enemy-human',
    tex: 'sprite_enemy_orc_sergeant', collisionType: 'human',
    collisionBox: BOX_HUMAN_BIG, color: C_HUMAN,
    description: 'Líder de tropa orca.',
  },
  {
    id: 'df_orc_shaman', name: 'Chamán Orco', category: 'enemy-human',
    tex: 'sprite_enemy_orc_shaman', collisionType: 'human',
    collisionBox: BOX_HUMAN_BIG, color: C_HUMAN,
    description: 'Orco que usa magia de daño y curación.',
  },
  {
    id: 'df_orc_warlord', name: 'Señor de la Guerra Orco', category: 'enemy-human',
    tex: 'sprite_enemy_orc_warlord', collisionType: 'human',
    collisionBox: BOX_HUMAN_BIG, color: C_HUMAN,
    description: 'Jefe orco; el enemigo humano más temible.',
  },
  {
    id: 'df_ranger', name: 'Explorador', category: 'enemy-human',
    tex: 'sprite_enemy_ranger', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Combina arco y espada, gran precisión.',
  },
  {
    id: 'df_rogue', name: 'Pícaro', category: 'enemy-human',
    tex: 'sprite_enemy_rogue', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Sigiloso, ataca con daga.',
  },
  {
    id: 'df_sorcerer', name: 'Hechicero', category: 'enemy-human',
    tex: 'sprite_enemy_sorcerer', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Mago de alto poder destructivo.',
  },
  {
    id: 'df_spellsword', name: 'Espadachín Arcano', category: 'enemy-human',
    tex: 'sprite_enemy_spellsword', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Encanta su espada con hechizos.',
  },
  {
    id: 'df_thief', name: 'Ladronzuelo', category: 'enemy-human',
    tex: 'sprite_enemy_thief', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Roba y golpea rápido.',
  },
  {
    id: 'df_warrior', name: 'Guerrero', category: 'enemy-human',
    tex: 'sprite_enemy_warrior', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_HUMAN,
    description: 'Soldado genérico con espada.',
  },

  // ── Enemigos — Animales (colisión baja y alargada) ───────────
  {
    id: 'enemy_wolf', name: 'Lobo', category: 'enemy-animal',
    tex: 'sprite_enemy_wolf', collisionType: 'animal',
    collisionBox: { w: 0.6, d: 1.1, h: 0.9 }, color: C_ANIMAL,
    description: 'Rápido, ataca en manada.',
  },
  {
    id: 'enemy_rat', name: 'Rata', category: 'enemy-animal',
    tex: 'sprite_enemy_rat', collisionType: 'animal',
    collisionBox: { w: 0.3, d: 0.6, h: 0.35 }, color: C_ANIMAL,
    description: 'Débil y pequeña; cae con un golpe.',
  },
  {
    id: 'enemy_bear', name: 'Oso', category: 'enemy-animal',
    tex: 'sprite_enemy_bear', collisionType: 'animal',
    collisionBox: { w: 0.9, d: 1.6, h: 1.4 }, color: C_ANIMAL,
    description: 'Lento pero muy dañino.',
  },

  // Daggerfall — bestias mundanas
  {
    id: 'df_giant_bat', name: 'Murciélago Gigante', category: 'enemy-animal',
    tex: 'sprite_enemy_giant_bat', collisionType: 'animal',
    collisionBox: { w: 0.6, d: 0.9, h: 0.5 }, color: C_ANIMAL,
    description: 'Vuela y muerde; aparece en cuevas.',
  },
  {
    id: 'df_giant_scorpion', name: 'Escorpión Gigante', category: 'enemy-animal',
    tex: 'sprite_enemy_giant_scorpion', collisionType: 'animal',
    collisionBox: { w: 0.6, d: 1.2, h: 0.6 }, color: C_ANIMAL,
    description: 'Veneno en el aguijón.',
  },
  {
    id: 'df_grizzlybear', name: 'Oso Pardo', category: 'enemy-animal',
    tex: 'sprite_enemy_grizzlybear', collisionType: 'animal',
    collisionBox: { w: 0.9, d: 1.6, h: 1.4 }, color: C_ANIMAL,
    description: 'Bestia enorme de los bosques.',
  },
  {
    id: 'df_sabertooth', name: 'Tigre Dientes de Sable', category: 'enemy-animal',
    tex: 'sprite_enemy_sabertooth', collisionType: 'animal',
    collisionBox: { w: 0.7, d: 1.2, h: 1.0 }, color: C_ANIMAL,
    description: 'Felino prehistórico, muy veloz.',
  },
  {
    id: 'df_slaughterfish', name: 'Pez Carnicero', category: 'enemy-animal',
    tex: 'sprite_enemy_slaughterfish', collisionType: 'animal',
    collisionBox: { w: 0.4, d: 0.5, h: 0.4 }, color: C_ANIMAL,
    description: 'Muerde en ríos y lagos.',
  },
  {
    id: 'df_spider', name: 'Araña', category: 'enemy-animal',
    tex: 'sprite_enemy_spider', collisionType: 'animal',
    collisionBox: { w: 0.5, d: 0.7, h: 0.5 }, color: C_ANIMAL,
    description: 'Trepadora, puede tener veneno.',
  },

  // ── Enemigos — No Muertos (lavanda hueso) ────────────────────
  {
    id: 'df_ghost', name: 'Fantasma', category: 'enemy-undead',
    tex: 'sprite_enemy_ghost', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_UNDEAD,
    description: 'Etéreo, atraviesa el dolor.',
  },
  {
    id: 'df_lich', name: 'Lich', category: 'enemy-undead',
    tex: 'sprite_enemy_lich', collisionType: 'human',
    collisionBox: BOX_HUMAN_BIG, color: C_UNDEAD,
    description: 'Nigromante no muerto de alto poder.',
  },
  {
    id: 'df_ancient_lich', name: 'Lich Ancestral', category: 'enemy-undead',
    tex: 'sprite_enemy_ancient_lich', collisionType: 'human',
    collisionBox: BOX_HUMAN_BIG, color: C_UNDEAD,
    description: 'Lich de eras olvidadas, temible.',
  },
  {
    id: 'df_mummy', name: 'Momia', category: 'enemy-undead',
    tex: 'sprite_enemy_mummy', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_UNDEAD,
    description: 'Lenta pero resistente a flechas.',
  },
  {
    id: 'df_skeleton', name: 'Esqueleto Guerrero', category: 'enemy-undead',
    tex: 'sprite_enemy_skeleton', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_UNDEAD,
    description: 'Restos animados con espada.',
  },
  {
    id: 'df_vampire', name: 'Vampiro', category: 'enemy-undead',
    tex: 'sprite_enemy_vampire', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_UNDEAD,
    description: 'Chupa vida; rehúye la luz.',
  },
  {
    id: 'df_vampire_ancient', name: 'Vampiro Ancestral', category: 'enemy-undead',
    tex: 'sprite_enemy_vampire_ancient', collisionType: 'human',
    collisionBox: BOX_HUMAN_BIG, color: C_UNDEAD,
    description: 'El no muerto más peligroso.',
  },
  {
    id: 'df_wraith', name: 'Espectro', category: 'enemy-undead',
    tex: 'sprite_enemy_wraith', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_UNDEAD,
    description: 'Drena energía, difícil de golpear.',
  },
  {
    id: 'df_zombie', name: 'Zombi', category: 'enemy-undead',
    tex: 'sprite_enemy_zombie', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_UNDEAD,
    description: 'Cuerpo reanimado, lento y tosco.',
  },

  // ── Enemigos — Daedra (melocotón, fuego de Oblivion) ─────────
  {
    id: 'df_daedra_lord', name: 'Señor Daedra', category: 'enemy-daedra',
    tex: 'sprite_enemy_daedra_lord', collisionType: 'human',
    collisionBox: { w: 0.7, d: 0.7, h: 2.0 }, color: C_DAEDRA,
    description: 'Daedra noble de gran poder.',
  },
  {
    id: 'df_daedra_seducer', name: 'Daedra Seductor', category: 'enemy-daedra',
    tex: 'sprite_enemy_daedra_seducer', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_DAEDRA,
    description: 'Atractiva y letal, usa magia.',
  },
  {
    id: 'df_daedroth', name: 'Daedroth', category: 'enemy-daedra',
    tex: 'sprite_enemy_daedroth', collisionType: 'animal',
    collisionBox: { w: 0.8, d: 1.2, h: 1.6 }, color: C_DAEDRA,
    description: 'Reptil de Oblivion, mordida poderosa.',
  },
  {
    id: 'df_atronach_fire', name: 'Atronach de Fuego', category: 'enemy-daedra',
    tex: 'sprite_enemy_atronach_fire', collisionType: 'human',
    collisionBox: BOX_HUMAN_BIG, color: C_DAEDRA,
    description: 'Cuerpo de llama viva.',
  },
  {
    id: 'df_atronach_ice', name: 'Atronach de Hielo', category: 'enemy-daedra',
    tex: 'sprite_enemy_atronach_ice', collisionType: 'human',
    collisionBox: BOX_HUMAN_BIG, color: C_DAEDRA,
    description: 'Escarcha animada que congela.',
  },
  {
    id: 'df_atronach_iron', name: 'Atronach de Hierro', category: 'enemy-daedra',
    tex: 'sprite_enemy_atronach_iron', collisionType: 'human',
    collisionBox: BOX_HUMAN_BIG, color: C_DAEDRA,
    description: 'Gólem de hierro, casi invulnerable.',
  },
  {
    id: 'df_atronach_flesh', name: 'Atronach de Carne', category: 'enemy-daedra',
    tex: 'sprite_enemy_atronach_flesh', collisionType: 'human',
    collisionBox: BOX_HUMAN_BIG, color: C_DAEDRA,
    description: 'Frankenstein de Oblivion.',
  },
  {
    id: 'df_fire_daedra', name: 'Daedra de Fuego', category: 'enemy-daedra',
    tex: 'sprite_enemy_fire_daedra', collisionType: 'human',
    collisionBox: BOX_HUMAN_BIG, color: C_DAEDRA,
    description: 'Golpea con llamas.',
  },
  {
    id: 'df_frost_daedra', name: 'Daedra de Escarcha', category: 'enemy-daedra',
    tex: 'sprite_enemy_frost_daedra', collisionType: 'human',
    collisionBox: BOX_HUMAN_BIG, color: C_DAEDRA,
    description: 'Vive en el frío, golpes helados.',
  },
  {
    id: 'df_imp', name: 'Imp', category: 'enemy-daedra',
    tex: 'sprite_enemy_imp', collisionType: 'animal',
    collisionBox: { w: 0.4, d: 0.4, h: 1.0 }, color: C_DAEDRA,
    description: 'Daedra menor que lanza bolas de fuego.',
  },

  // ── Enemigos — Criaturas (teal) ──────────────────────────────
  {
    id: 'df_centaur', name: 'Centauro', category: 'enemy-monster',
    tex: 'sprite_enemy_centaur', collisionType: 'animal',
    collisionBox: { w: 0.7, d: 1.3, h: 1.7 }, color: C_MONSTER,
    description: 'Mitad hombre, mitad caballo; dispara flechas.',
  },
  {
    id: 'df_dragon', name: 'Dragón', category: 'enemy-monster',
    tex: 'sprite_enemy_dragon', collisionType: 'animal',
    collisionBox: { w: 2.4, d: 3.2, h: 1.8 }, color: C_MONSTER,
    description: 'Aliento de fuego; el mayor de los enemigos.',
  },
  {
    id: 'df_dreugh', name: 'Dreugh', category: 'enemy-monster',
    tex: 'sprite_enemy_dreugh', collisionType: 'animal',
    collisionBox: { w: 0.8, d: 1.2, h: 1.4 }, color: C_MONSTER,
    description: 'Crustáceo marino de pinzas afiladas.',
  },
  {
    id: 'df_gargoyle', name: 'Gárgola', category: 'enemy-monster',
    tex: 'sprite_enemy_gargoyle', collisionType: 'human',
    collisionBox: { w: 0.7, d: 0.7, h: 1.8 }, color: C_MONSTER,
    description: 'Piedra animada que ataca en picada.',
  },
  {
    id: 'df_giant', name: 'Gigante', category: 'enemy-monster',
    tex: 'sprite_enemy_giant', collisionType: 'human',
    collisionBox: { w: 1.2, d: 1.2, h: 2.5 }, color: C_MONSTER,
    description: 'Coloso lento con maza enorme.',
  },
  {
    id: 'df_harpy', name: 'Arpía', category: 'enemy-monster',
    tex: 'sprite_enemy_harpy', collisionType: 'animal',
    collisionBox: { w: 0.6, d: 0.6, h: 1.7 }, color: C_MONSTER,
    description: 'Mujer-pájaro que ataca desde el aire.',
  },
  {
    id: 'df_lamia', name: 'Lamia', category: 'enemy-monster',
    tex: 'sprite_enemy_lamia', collisionType: 'animal',
    collisionBox: { w: 0.6, d: 0.9, h: 1.5 }, color: C_MONSTER,
    description: 'Sirena serpiente de los pantanos.',
  },
  {
    id: 'df_nymph', name: 'Ninfa', category: 'enemy-monster',
    tex: 'sprite_enemy_nymph', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_MONSTER,
    description: 'Encanta y ataca con magia.',
  },
  {
    id: 'df_spriggan', name: 'Spriggan', category: 'enemy-monster',
    tex: 'sprite_enemy_spriggan', collisionType: 'human',
    collisionBox: BOX_HUMAN, color: C_MONSTER,
    description: 'Espíritu del bosque, piel de corteza.',
  },
  {
    id: 'df_wereboar', name: 'Hombre Jabalí', category: 'enemy-monster',
    tex: 'sprite_enemy_wereboar', collisionType: 'animal',
    collisionBox: { w: 0.7, d: 1.2, h: 1.4 }, color: C_MONSTER,
    description: 'Licántropo porcino, carga directa.',
  },
  {
    id: 'df_werewolf', name: 'Hombre Lobo', category: 'enemy-monster',
    tex: 'sprite_enemy_werewolf', collisionType: 'animal',
    collisionBox: { w: 0.6, d: 1.1, h: 1.5 }, color: C_MONSTER,
    description: 'Maldito lunar, garras y velocidad.',
  },
];

const byId = new Map(ENTITIES.map((e) => [e.id, e]));

export function getEntityDef(id: string | undefined): EntityDef | null {
  return id ? byId.get(id) ?? null : null;
}

export function entitiesByCategory(category: EntityCategory): EntityDef[] {
  return ENTITIES.filter((e) => e.category === category);
}