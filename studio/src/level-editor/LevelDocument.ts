/**
 * LevelDocument.ts — Modelo de documento del Level Editor
 *
 * Mantiene el mundo (world: vertices, sectors, walls, ramps, sprites, textures)
 * en memoria como datos puros, y ofrece operaciones de edición (crear/borrar
 * sectores, mover vértices, elevar piso/techo, añadir paredes portal, colocar
 * sprites). NO toca DOM ni Three.js: es lógica pura, testeable de forma aislada.
 *
 * Reutiliza la geometría del motor (engine/core/sector.js) en lugar de
 * duplicarla: el Studio es un consumidor del motor (regla de cero duplicación).
 */

import { getSectorAt } from '../../../engine/core/sector.js';

/** Textura del mundo (id -> ruta de imagen). */
export type TextureMap = Record<string, string>;

export interface Vertex {
  id: string;
  x: number;
  y: number;
}

export interface Slope {
  axis: 'x' | 'y';
  angle: number;
}

export interface Sector {
  id: string;
  vertexIds: string[];
  floorH: number;
  ceilH: number;
  floorTex?: string;
  ceilTex?: string;
  wallTex?: string;
  floorSlope?: Slope;
  ceilSlope?: Slope;
}

export interface Wall {
  id: string;
  a: string;
  b: string;
  sectorFront: string;
  sectorBack?: string | null;
  portal?: boolean;
  tex?: string;
}

export interface Ramp {
  id: string;
  type: 'stairs' | 'slope';
  pos: { x: number; y: number };
  direction: { x: number; y: number };
  rise: number;
  run: number;
  width?: number;
}

export interface Sprite {
  id: string;
  tex: string;
  pos: { x: number; y: number; z: number };
  scale: number;
  billboard?: boolean;
}

export interface WorldData {
  vertices: Vertex[];
  sectors: Sector[];
  walls: Wall[];
  ramps: Ramp[];
  sprites: Sprite[];
  textures: TextureMap;
}

export interface RenderSettings {
  fov: number;
  near: number;
  far: number;
  backgroundColor: number;
  ambientLight: { color: number; intensity: number };
  directionalLight: { color: number; intensity: number; position: [number, number, number] };
}

export interface CameraData {
  posX: number;
  posY: number;
  posZ: number;
  yaw: number;
  pitch: number;
}

export interface MetaData {
  name: string;
  schemaVersion: number;
  renderMode: '3d';
}

/** Proyección del proyecto (schema v3) tal como la consume el motor. */
export interface LevelProject {
  meta: MetaData;
  render: RenderSettings;
  camera: CameraData;
  world: WorldData;
}

export interface LevelDocumentOptions {
  meta?: Partial<MetaData>;
  render?: Partial<RenderSettings>;
  camera?: Partial<CameraData>;
  world?: Partial<WorldData>;
}

export interface LevelDocument {
  meta: MetaData;
  render: RenderSettings;
  camera: CameraData;
  world: WorldData;
  /** Contador interno para autogenerar ids únicos (prefijo + n). */
  _seq: number;

  // --- Vértices ---
  addVertex(x: number, y: number): string;
  moveVertex(id: string, x: number, y: number): void;
  removeVertex(id: string): void;

  // --- Sectores ---
  addSector(vertexIds: string[], options?: Partial<Omit<Sector, 'id' | 'vertexIds'>>): string;
  removeSector(id: string): void;
  setFloorHeight(id: string, h: number): void;
  setCeilHeight(id: string, h: number): void;

  // --- Paredes ---
  addWall(a: string, b: string, sectorFront: string, sectorBack?: string | null, portal?: boolean): string;
  removeWall(id: string): void;

  // --- Sprites ---
  addSprite(tex: string, x: number, y: number, z: number, scale?: number): string;
  removeSprite(id: string): void;

  // --- Utilidades de consulta ---
  sectorAt(x: number, y: number): Sector | null;
}

const DEFAULTS: LevelDocumentOptions = {
  meta: { name: 'Sin título', schemaVersion: 3, renderMode: '3d' },
  render: {
    fov: 80,
    near: 0.1,
    far: 500,
    backgroundColor: 0x000000,
    ambientLight: { color: 0xffffff, intensity: 0.4 },
    directionalLight: { color: 0xffaa88, intensity: 0.6, position: [12, 10, 12] },
  },
  camera: { posX: 5, posY: 5, posZ: 0.6, yaw: 0.78, pitch: 0 },
  world: { vertices: [], sectors: [], walls: [], ramps: [], sprites: [], textures: {} },
};

/** Genera un id único con el prefijo dado y el contador del documento. */
function nextId(doc: LevelDocument, prefix: string): string {
  return `${prefix}_${++doc._seq}`;
}

export function createLevelDocument(options: LevelDocumentOptions = {}): LevelDocument {
  const meta: MetaData = {
    name: options.meta?.name ?? DEFAULTS.meta!.name!,
    schemaVersion: options.meta?.schemaVersion ?? DEFAULTS.meta!.schemaVersion!,
    renderMode: '3d',
  };
  const render: RenderSettings = {
    fov: options.render?.fov ?? DEFAULTS.render!.fov!,
    near: options.render?.near ?? DEFAULTS.render!.near!,
    far: options.render?.far ?? DEFAULTS.render!.far!,
    backgroundColor: options.render?.backgroundColor ?? DEFAULTS.render!.backgroundColor!,
    ambientLight: options.render?.ambientLight ?? DEFAULTS.render!.ambientLight!,
    directionalLight: options.render?.directionalLight ?? DEFAULTS.render!.directionalLight!,
  };
  const camera: CameraData = {
    posX: options.camera?.posX ?? DEFAULTS.camera!.posX!,
    posY: options.camera?.posY ?? DEFAULTS.camera!.posY!,
    posZ: options.camera?.posZ ?? DEFAULTS.camera!.posZ!,
    yaw: options.camera?.yaw ?? DEFAULTS.camera!.yaw!,
    pitch: options.camera?.pitch ?? DEFAULTS.camera!.pitch!,
  };
  const world: WorldData = {
    vertices: options.world?.vertices ? options.world.vertices.map((v) => ({ ...v })) : [],
    sectors: options.world?.sectors ? options.world.sectors.map((s) => ({ ...s, vertexIds: [...s.vertexIds] })) : [],
    walls: options.world?.walls ? options.world.walls.map((w) => ({ ...w })) : [],
    ramps: options.world?.ramps ? options.world.ramps.map((r) => ({ ...r, pos: { ...r.pos }, direction: { ...r.direction } })) : [],
    sprites: options.world?.sprites ? options.world.sprites.map((sp) => ({ ...sp, pos: { ...sp.pos } })) : [],
    textures: options.world?.textures ? { ...options.world.textures } : {},
  };

  const doc: LevelDocument = {
    meta,
    render,
    camera,
    world,
    _seq: 0,

    addVertex(x: number, y: number): string {
      const id = nextId(doc, 'v');
      doc.world.vertices.push({ id, x, y });
      return id;
    },

    moveVertex(id: string, x: number, y: number): void {
      const v = doc.world.vertices.find((v) => v.id === id);
      if (v) {
        v.x = x;
        v.y = y;
      }
    },

    removeVertex(id: string): void {
      // Un vértice en uso por un sector o pared no debería borrarse a la ligera;
      // se expone la operación y el editor valida antes de usarla.
      doc.world.vertices = doc.world.vertices.filter((v) => v.id !== id);
    },

    addSector(vertexIds: string[], options: Partial<Omit<Sector, 'id' | 'vertexIds'>> = {}): string {
      const id = nextId(doc, 'sector');
      doc.world.sectors.push({
        id,
        vertexIds: [...vertexIds],
        floorH: options.floorH ?? 0,
        ceilH: options.ceilH ?? 3,
        floorTex: options.floorTex,
        ceilTex: options.ceilTex,
        wallTex: options.wallTex,
        floorSlope: options.floorSlope,
        ceilSlope: options.ceilSlope,
      });
      return id;
    },

    removeSector(id: string): void {
      doc.world.sectors = doc.world.sectors.filter((s) => s.id !== id);
      // Al borrar un sector se borran sus paredes para no dejar referencias huérfanas.
      doc.world.walls = doc.world.walls.filter((w) => w.sectorFront !== id && w.sectorBack !== id);
    },

    setFloorHeight(id: string, h: number): void {
      const s = doc.world.sectors.find((s) => s.id === id);
      if (s) s.floorH = h;
    },

    setCeilHeight(id: string, h: number): void {
      const s = doc.world.sectors.find((s) => s.id === id);
      if (s) s.ceilH = h;
    },

    addWall(a: string, b: string, sectorFront: string, sectorBack: string | null = null, portal = false): string {
      const id = nextId(doc, 'wall');
      doc.world.walls.push({
        id,
        a,
        b,
        sectorFront,
        sectorBack,
        portal: portal || sectorBack != null,
      });
      return id;
    },

    removeWall(id: string): void {
      doc.world.walls = doc.world.walls.filter((w) => w.id !== id);
    },

    addSprite(tex: string, x: number, y: number, z: number, scale = 1): string {
      const id = nextId(doc, 'sprite');
      doc.world.sprites.push({ id, tex, pos: { x, y, z }, scale, billboard: true });
      return id;
    },

    removeSprite(id: string): void {
      doc.world.sprites = doc.world.sprites.filter((sp) => sp.id !== id);
    },

    sectorAt(x: number, y: number): Sector | null {
      return getSectorAt(doc.world as any, x, y);
    },
  };

  return doc;
}

/** Copia profunda de un documento (útil para undo/redo futuro y para evitar mutar la fuente). */
export function cloneDocument(doc: LevelDocument): LevelDocument {
  return createLevelDocument({
    meta: { ...doc.meta },
    render: {
      ...doc.render,
      ambientLight: { ...doc.render.ambientLight },
      directionalLight: { ...doc.render.directionalLight, position: [...doc.render.directionalLight.position] },
    },
    camera: { ...doc.camera },
    world: {
      vertices: doc.world.vertices.map((v) => ({ ...v })),
      sectors: doc.world.sectors.map((s) => ({ ...s, vertexIds: [...s.vertexIds], floorSlope: s.floorSlope ? { ...s.floorSlope } : undefined, ceilSlope: s.ceilSlope ? { ...s.ceilSlope } : undefined })),
      walls: doc.world.walls.map((w) => ({ ...w })),
      ramps: doc.world.ramps.map((r) => ({ ...r, pos: { ...r.pos }, direction: { ...r.direction } })),
      sprites: doc.world.sprites.map((sp) => ({ ...sp, pos: { ...sp.pos } })),
      textures: { ...doc.world.textures },
    },
  });
}
