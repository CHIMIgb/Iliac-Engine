/**
 * EditorState — documento del mundo en memoria.
 *
 * Contiene los datos editables (vértices, sectores, paredes, rampas, sprites,
 * texturas, cámara, meta, render) y los métodos para mutarlos.
 *
 * Cada mutación dispara `onChange` (para que el viewport se reconstruya y el
 * stack de undo pueda hacer snapshot). Los métodos son la única vía de
 * modificación: ninguna herramienta toca los arrays directamente.
 */

import type {
  EditableWorld,
  EditableVertex,
  EditableSector,
  EditableWall,
  EditableRamp,
  EditableSprite,
  EditableCamera,
  EditableRender,
  EditableMeta,
} from './types';

export type EditorChangeHandler = () => void;

let seq = 0;
function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${(seq++).toString(36)}`;
}

export class EditorState {
  meta: EditableMeta;
  camera: EditableCamera;
  render: EditableRender;
  world: EditableWorld;

  private handlers: EditorChangeHandler[] = [];

  constructor(initial?: Partial<EditorState>) {
    this.meta = initial?.meta ?? { name: 'Proyecto nuevo', schemaVersion: 3, renderMode: '3d' };
    this.camera = initial?.camera ?? { posX: 4, posY: 4, posZ: 0.6, yaw: Math.PI / 2, pitch: 0 };
    this.render = initial?.render ?? {
      fov: 80, near: 0.1, far: 500, backgroundColor: 0x1a1a2e,
      ambientLight: { color: 0xffffff, intensity: 0.5 },
      directionalLight: { color: 0xffffee, intensity: 0.8, position: [20, 30, 20] },
    };
    this.world = initial?.world ?? { vertices: [], sectors: [], walls: [], ramps: [], sprites: [], textures: {} };
  }

  /** Suscribe un handler de cambios. */
  onChange(handler: EditorChangeHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  /** Devuelve un snapshot profundo del estado (copy-on-write para undo). */
  snapshot(): EditorState {
    return new EditorState(JSON.parse(JSON.stringify(this)));
  }

  private notify(): void {
    for (const h of this.handlers) h();
  }

  // ─────────────────────────────────────────────────
  // Vértices
  // ─────────────────────────────────────────────────
  addVertex(x: number, y: number, id?: string): EditableVertex {
    const vertex: EditableVertex = { id: id ?? genId("v"), x, y };
    this.world.vertices.push(vertex);
    this.notify();
    return vertex;
  }

  /** Mueve un vértice. Devuelve false si no existe. */
  moveVertex(id: string, x: number, y: number): boolean {
    const v = this.world.vertices.find((v) => v.id === id);
    if (!v) return false;
    v.x = x;
    v.y = y;
    this.notify();
    return true;
  }

  /** Elimina un vértice (y las paredes que lo usaban). */
  removeVertex(id: string): boolean {
    const idx = this.world.vertices.findIndex((v) => v.id === id);
    if (idx < 0) return false;
    this.world.vertices.splice(idx, 1);
    // Quitar paredes que lo usan
    this.world.walls = this.world.walls.filter((w) => w.a !== id && w.b !== id);
    // Quitar id de sectores
    for (const s of this.world.sectors) {
      s.vertexIds = s.vertexIds.filter((v) => v !== id);
    }
    this.notify();
    return true;
  }

  // ─────────────────────────────────────────────────
  // Sectores
  // ─────────────────────────────────────────────────
  addSector(vertexIds: string[], floorH = 0, ceilH = 3, id?: string): EditableSector {
    const sector: EditableSector = {
      id: id ?? genId("s"),
      vertexIds,
      floorH,
      ceilH,
      floorTex: 'wood',
      ceilTex: 'ceil',
      wallTex: 'wall',
    };
    this.world.sectors.push(sector);
    this.notify();
    return sector;
  }

  removeSector(id: string): boolean {
    const idx = this.world.sectors.findIndex((s) => s.id === id);
    if (idx < 0) return false;
    this.world.sectors.splice(idx, 1);
    // Quitar paredes que referenciaban a este sector
    this.world.walls = this.world.walls.filter((w) => w.sectorFront !== id && w.sectorBack !== id);
    this.notify();
    return true;
  }

  setFloorHeight(id: string, floorH: number | number[]): boolean {
    const s = this.world.sectors.find((s) => s.id === id);
    if (!s) return false;
    s.floorH = floorH;
    this.notify();
    return true;
  }

  setCeilHeight(id: string, ceilH: number | number[]): boolean {
    const s = this.world.sectors.find((s) => s.id === id);
    if (!s) return false;
    s.ceilH = ceilH;
    this.notify();
    return true;
  }

  setSectorTex(id: string, part: 'floor' | 'ceil' | 'wall', tex: string): boolean {
    const s = this.world.sectors.find((s) => s.id === id);
    if (!s) return false;
    if (part === 'floor') s.floorTex = tex;
    else if (part === 'ceil') s.ceilTex = tex;
    else s.wallTex = tex;
    this.notify();
    return true;
  }

  // ─────────────────────────────────────────────────
  // Paredes
  // ─────────────────────────────────────────────────
  addWall(a: string, b: string, sectorFront: string | null, sectorBack: string | null, id?: string): EditableWall {
    const wall: EditableWall = {
      id: id ?? genId("w"),
      a,
      b,
      sectorFront,
      sectorBack,
      tex: 'wall',
      portal: sectorBack != null,
    };
    this.world.walls.push(wall);
    this.notify();
    return wall;
  }

  removeWall(id: string): boolean {
    const idx = this.world.walls.findIndex((w) => w.id === id);
    if (idx < 0) return false;
    this.world.walls.splice(idx, 1);
    this.notify();
    return true;
  }

  // ─────────────────────────────────────────────────
  // Sprites
  // ─────────────────────────────────────────────────
  addSprite(
    tex: string,
    x: number,
    y: number,
    z = 0,
    id?: string,
    entity?: {
      entityType?: string;
      entityName?: string;
      collisionType?: EditableSprite['collisionType'];
      collisionBox?: EditableSprite['collisionBox'];
    },
  ): EditableSprite {
    const sprite: EditableSprite = {
      id: id ?? genId("sp"),
      tex,
      pos: { x, y, z },
      scale: 1,
      billboard: true,
      ...(entity?.entityType ? { entityType: entity.entityType } : {}),
      ...(entity?.entityName ? { entityName: entity.entityName } : {}),
      ...(entity?.collisionType ? { collisionType: entity.collisionType } : {}),
      ...(entity?.collisionBox ? { collisionBox: entity.collisionBox } : {}),
    };
    this.world.sprites.push(sprite);
    this.notify();
    return sprite;
  }

  moveSprite(id: string, x: number, y: number, z: number): boolean {
    const sp = this.world.sprites.find((s) => s.id === id);
    if (!sp) return false;
    sp.pos = { x, y, z };
    this.notify();
    return true;
  }

  removeSprite(id: string): boolean {
    const idx = this.world.sprites.findIndex((s) => s.id === id);
    if (idx < 0) return false;
    this.world.sprites.splice(idx, 1);
    this.notify();
    return true;
  }

  // ─────────────────────────────────────────────────
  // Accesores
  // ─────────────────────────────────────────────────
  getVertex(id: string): EditableVertex | undefined {
    return this.world.vertices.find((v) => v.id === id);
  }

  getSector(id: string): EditableSector | undefined {
    return this.world.sectors.find((s) => s.id === id);
  }
}
