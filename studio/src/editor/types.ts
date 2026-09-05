/**
 * Editable types — modelo de datos del mundo editable en el Studio.
 *
 * Refleja el schema v3 de project.json pero organizado para edición:
 *  - id: enlaces entre vértices/sectores/paredes.
 *  - Alturas: numero o array por vértice.
 */

/** Un vértice en el plano XZ (el motor usa Y como profundidad). */
export interface EditableVertex {
  id: string;
  x: number;
  y: number;
}

/** Sector: región poligonal con alturas de piso/techo. */
export interface EditableSector {
  id: string;
  vertexIds: string[]; // en orden de polígono (sentido horario)
  floorH: number | number[];
  ceilH: number | number[];
  floorTex?: string;
  ceilTex?: string;
  wallTex?: string;
}

/** Pared: segmento entre dos vértices, con sector frontal/trasero. */
export interface EditableWall {
  id: string;
  a: string; // id vértice
  b: string; // id vértice
  sectorFront: string | null;
  sectorBack: string | null;
  tex?: string;
  portal?: boolean;
}

/** Escalera/rampa. */
export interface EditableRamp {
  id: string;
  type: 'stairs';
  pos: { x: number; y: number };
  direction: { x: number; y: number };
  width: number;
  rise: number;
  run: number;
  steps: number;
  tex?: string;
}

/** Tamaño de la caja de colisión de una entidad (metros: ancho, fondo, alto). */
export interface EditableCollisionBox {
  w: number;
  d: number;
  h: number;
}

/** Tipo de colisión de una entidad (humano vs animal → distinta geometría). */
export type EditableCollisionType = 'npc' | 'human' | 'animal';

/** Sprite billboard. Las entidades son sprites con datos de colisión extra. */
export interface EditableSprite {
  id: string;
  tex: string;
  pos: { x: number; y: number; z: number };
  scale?: number;
  billboard?: boolean;
  /** Id del tipo de entidad en el catálogo (si es una entidad colocada). */
  entityType?: string;
  /** Nombre legible del tipo de entidad (del catálogo). */
  entityName?: string;
  /** Colisión de la entidad: humano vs animal vs npc. */
  collisionType?: EditableCollisionType;
  /** Caja de colisión en metros (w × d × h). */
  collisionBox?: EditableCollisionBox;
}

/** Texturas disponibles (svg o color hex). */
export interface EditableTextures {
  [key: string]: string | number;
}

/** Config de cámara inicial. */
export interface EditableCamera {
  posX: number;
  posY: number;
  posZ: number;
  yaw?: number;
  pitch?: number;
}

/** Render settings. */
export interface EditableRender {
  fov?: number;
  near?: number;
  far?: number;
  backgroundColor?: number;
  ambientLight?: { color?: number; intensity?: number };
  directionalLight?: { color?: number; intensity?: number; position?: number[] };
}

/** Meta del proyecto. */
export interface EditableMeta {
  name: string;
  schemaVersion: number;
  renderMode?: string;
}

/** Estado editable completo del mundo (lo que edita el Studio). */
export interface EditableWorld {
  vertices: EditableVertex[];
  sectors: EditableSector[];
  walls: EditableWall[];
  ramps: EditableRamp[];
  sprites: EditableSprite[];
  textures: EditableTextures;
}
