/**
 * Dungeons — mazmorras pre-hechas a partir de bloques de 16×16.
 *
 * Inspirado en el sistema de bloques de Daggerfall (UESP:Dungeons): cada
 * mazmorra es una retícula de bloques pre-fabricados que se ensamblan por
 * conectores (pasajes en los lados). El ensamblador fusiona los mundos de los
 * bloques en un world completo y sella el perímetro exterior.
 */

export type ConnectorSide = 'n' | 's' | 'e' | 'w';

export interface DungeonPassage {
  /** Lado nominal (antes de rotar) donde está la boca. */
  side: ConnectorSide;
  /** Boca: ids de vértices locales del bloque que forman el hueco. */
  from: string;
  to: string;
  /** Id local del sector del bloque al que pertenece la boca. */
  sector: string;
}

export interface DungeonBlockWorld {
  vertices: { id: string; x: number; y: number }[];
  sectors: { id: string; vertexIds: string[]; floorH: number; ceilH: number }[];
  walls: { a: string; b: string; sectorFront: string | null; sectorBack: string | null }[];
}

export interface DungeonBlock {
  id: string;
  name: string;
  /** Tamaño de la celda en unidades de mundo (cuadrada). */
  size: number;
  passages: DungeonPassage[];
  world: DungeonBlockWorld;
}

export type Rot = 0 | 90 | 180 | 270;

export interface DungeonTile {
  x: number;
  y: number;
  block: string;
  rot?: Rot;
}

export interface DungeonDef {
  id: string;
  name: string;
  type: string;
  tiles: DungeonTile[];
}

/** Resultado de ensamblar una mazmorra (world completo, listo para exportar). */
export interface AssembledDungeon {
  id: string;
  name: string;
  type: string;
  vertices: { id: string; x: number; y: number }[];
  sectors: { id: string; vertexIds: string[]; floorH: number; ceilH: number }[];
  walls: { id: string; a: string; b: string; sectorFront: string | null; sectorBack: string | null }[];
  /** Pasajes resueltos: `open` = true si conectan con el vecino, false = sellado. */
  passages: { id: string; side: ConnectorSide; tx: number; ty: number; open: boolean }[];
  /** Dimensiones de la mazmorra en unidades de mundo. */
  width: number;
  height: number;
}