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
  fog?: { color?: number; density?: number };
}

/** Meta del proyecto. */
export interface EditableMeta {
  name: string;
  schemaVersion: number;
  renderMode?: string;
}

/** Cielo lejano (horizonte Daggerfall o cielo realista F4.7). Sin sky = fondo de color actual. */
export interface EditableSky {
  /** Estilo del cielo: 'classic' (telón 2D Daggerfall) o 'realista' (3D día/noche). */
  style?: 'classic' | 'realista';
  /** Carpeta SKY00–SKY30 (el horizonte/escenario). Solo classic. */
  set?: number;
  /** Franja del día 0–31 dentro del set (iluminación/hora del día). Solo classic. */
  frame?: number;
  base?: string;
  /** Hora 0–24 (float) para el cielo realista. */
  hour?: number;
  /** Segundos por día solar: >0 = el tiempo avanza solo (autoplay). 0/faltante = fijo. */
  dayLengthSec?: number;
  /** True = el sol proyecta sombras (PCF 2048). Solo realista. */
  shadows?: boolean;
  /** Inclinación del eje de rotación solar en grados (23.5 por defecto). */
  sunTilt?: number;
  /** Multiplicador de la intensidad del sol (0.1–3, 1 = curva base). */
  sunIntensity?: number;
  /** Luz lunar nocturna 0–1 (la luna ilumina de noche). */
  moonIntensity?: number;
  /** True = estrellas visibles de noche. */
  stars?: boolean;
  /** True = aurora boreal en el polo norte (F4.7). */
  aurora?: boolean;
  /** Multiplicador de la intensidad de la aurora (0.1–3, 1 = base). */
  auroraIntensity?: number;
}

/** Definición de audio (project.audio, F4.5): una voz = una entrada. */
export interface EditableAudioDef {
  id: string;
  src: string;
  bus?: 'music' | 'sfx' | 'ambience' | 'voice';
  loop?: boolean;
  volume?: number;
  /** Espacial 3D: posición fija o siguiendo a un sprite (`follow`). */
  spatial?: { x?: number; y?: number; z?: number; follow?: string; refDistance?: number; maxDistance?: number; rolloff?: number };
  /** Pools de variantes para SFX (anti-machine-gun). */
  variations?: string[];
  /** Stems sincronizados (solo bus 'music'): intensidad sube capas. */
  layers?: string[];
}

/** Pista musical activa + intensidad inicial (project.music). */
export interface EditableMusicRef {
  id: string;
  intensity?: 0 | 1 | 2;
  bpm?: number;
}

/** Estado editable completo del mundo (lo que edita el Studio). */
export interface EditableWorld {
  vertices: EditableVertex[];
  sectors: EditableSector[];
  walls: EditableWall[];
  ramps: EditableRamp[];
  sprites: EditableSprite[];
  textures: EditableTextures;
  sky?: EditableSky | null;
}
