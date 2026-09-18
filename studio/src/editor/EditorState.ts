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
  EditableSky,
  EditableAudioDef,
  EditableMusicRef,
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
  /** Definiciones de audio (project.audio): vacías = sin audio (comportamiento histórico). */
  audio: EditableAudioDef[];
  /** Pista musical activa (project.music) o null. */
  music: EditableMusicRef | null;

  private handlers: EditorChangeHandler[] = [];

  constructor(initial?: Partial<EditorState>) {
    this.meta = initial?.meta ?? { name: 'Proyecto nuevo', schemaVersion: 3, renderMode: '3d' };
    this.camera = initial?.camera ?? { posX: 4, posY: 4, posZ: 0.6, yaw: Math.PI / 2, pitch: 0 };
    this.render = initial?.render ?? {
      fov: 80, near: 0.1, far: 500, backgroundColor: 0x1a1a2e,
      ambientLight: { color: 0xffffff, intensity: 0.5 },
      directionalLight: { color: 0xffffee, intensity: 0.8, position: [20, 30, 20] },
      fog: { color: 0x1a1a2e, density: 0.005 },
    };
    this.world = initial?.world ?? { vertices: [], sectors: [], walls: [], ramps: [], sprites: [], textures: {} };
    this.audio = initial?.audio ?? [];
    this.music = initial?.music ?? null;
  }

  /**
   * Vuelca los campos de DATOS de otro estado (cargar/crear un documento).
   *
   * No vale `Object.assign(this, other)`: copiaría también `handlers`
   * (propiedad de instancia) y el documento perdería sus suscriptores —
   * el flag de cambios sin guardar y el reload en vivo del viewport.
   */
  applyFrom(other: EditorState): void {
    this.meta = other.meta;
    this.camera = other.camera;
    this.render = other.render;
    this.world = other.world;
    this.audio = other.audio;
    this.music = other.music;
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
  addSector(
    vertexIds: string[],
    floorH: number | number[] = 0,
    ceilH: number | number[] = 3,
    id?: string,
    tex?: { floorTex?: string; ceilTex?: string; wallTex?: string },
  ): EditableSector {
    const sector: EditableSector = {
      id: id ?? genId("s"),
      vertexIds,
      floorH,
      ceilH,
      floorTex: tex?.floorTex ?? 'wood',
      ceilTex: tex?.ceilTex ?? 'ceil',
      wallTex: tex?.wallTex ?? 'wall',
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

  /** Cielo lejano del mundo (horizonte Daggerfall, tecla 8). null = sin cielo. */
  setSky(cfg: EditableSky | null): void {
    this.world.sky = cfg;
    this.notify();
  }

  // ─────────────────────────────────────────────────
  // Audio (project.audio / project.music) — herramienta 9
  // ─────────────────────────────────────────────────

  /** Añade una definición de audio con id único (`audio_<n>`) y avisa. */
  addAudioDef(def: Omit<EditableAudioDef, 'id'> & { id?: string }): EditableAudioDef {
    let n = this.audio.length + 1;
    while (this.audio.some((a) => a.id === `audio_${n}`)) n++;
    const entry: EditableAudioDef = { ...def, id: def.id ?? `audio_${n}` };
    this.audio.push(entry);
    this.notify();
    return entry;
  }

  /** Fusiona cambios sobre un def existente. false si no existe. */
  updateAudioDef(id: string, patch: Partial<Omit<EditableAudioDef, 'id'>>): boolean {
    const a = this.audio.find((x) => x.id === id);
    if (!a) return false;
    Object.assign(a, patch);
    this.notify();
    return true;
  }

  /**
   * Elimina un def. Si la pista musical activa (`doc.music`) era ella,
   * `doc.music` se retira también (invariante: music.id debe existir en audio[]).
   */
  removeAudioDef(id: string): boolean {
    const idx = this.audio.findIndex((x) => x.id === id);
    if (idx < 0) return false;
    this.audio.splice(idx, 1);
    if (this.music?.id === id) this.music = null;
    this.notify();
    return true;
  }

  /** Pista musical activa (null = sin música). */
  setMusic(cfg: EditableMusicRef | null): void {
    this.music = cfg;
    this.notify();
  }

  /** Fusiona opciones de render (fov, fondo, niebla…) y avisa. */
  setRender(patch: Partial<EditableRender>): void {
    this.render = { ...this.render, ...patch };
    this.notify();
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
  // Texturas / Sprite Anims (F5, Fase B — Sprite Tool)
  // ─────────────────────────────────────────────────

  /** Fusiona texturas nuevas en `world.textures` (p. ej. frames recortados). */
  setWorldTextures(patch: Record<string, string | number>): void {
    this.world.textures = { ...this.world.textures, ...patch };
    this.notify();
  }

  /** Fusiona animaciones de sprites en `world.spriteAnims`. */
  setSpriteAnims(anims: Record<string, { frames: string[]; fps?: number; loop?: boolean }>): void {
    this.world.spriteAnims = { ...(this.world.spriteAnims ?? {}), ...anims };
    this.notify();
  }

  /**
   * Asigna la animación `anim` a un sprite del mundo (puente F5→6.4: aún no hay
   * Entity Builder, así que el usuario elige un sprite existente). false si el
   * sprite no existe; `anim` null limpia la animación.
   */
  assignSpriteAnim(spriteId: string, anim: string | null): boolean {
    const sp = this.world.sprites.find((s) => s.id === spriteId);
    if (!sp) return false;
    if (anim === null) delete sp.anim;
    else sp.anim = anim;
    this.notify();
    return true;
  }

  /**
   * Elimina una animación guardada de `world.spriteAnims` y su rastro en el
   * mundo (botón Eliminar de la Biblioteca, Fase G): borra la anim, los
   * sprites del mundo que la usaban (decisión del usuario 2026-09-18: los
   * mocks antiguos deben salir también del viewport) y las texturas de sus
   * frames que queden huérfanas (ni otra anim ni otro sprite las usan).
   * Devuelve un resumen de lo borrado; `ok:false` si la anim no existe.
   */
  removeSpriteAnim(name: string):
    | { ok: false }
    | { ok: true; removedSprites: number; removedTextures: number } {
    const anims = this.world.spriteAnims;
    const anim = anims?.[name];
    if (!anim) return { ok: false };
    const frameKeys = anim.frames;
    delete anims[name];

    const removedSprites = this.world.sprites.filter((sp) => sp.anim === name).length;
    if (removedSprites > 0) {
      this.world.sprites = this.world.sprites.filter((sp) => sp.anim !== name);
    }

    // Frames huérfanos: texturas ya no referenciadas ni por las anims
    // restantes ni por los sprites restantes (`sp.tex`).
    const used = new Set<string>();
    for (const a of Object.values(anims)) for (const k of a.frames) used.add(k);
    for (const sp of this.world.sprites) if (sp.tex) used.add(sp.tex);
    let removedTextures = 0;
    for (const k of frameKeys) {
      if (!used.has(k) && Object.prototype.hasOwnProperty.call(this.world.textures, k)) {
        delete this.world.textures[k];
        removedTextures++;
      }
    }

    this.notify();
    return { ok: true, removedSprites, removedTextures };
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

  /**
   * Snapshot del proyecto para la Biblioteca del Sprite Tool (Fase D): las
   * texturas y animaciones de sprites ya guardadas. Devuelve una copia ligera
   * (foto del estado actual) para que el Sprite Tool lo lea en modo lectura
   * sin riesgo de mutar el mundo.
   */
  getSpriteLibrarySnapshot(): { textures: Record<string, string | number>; spriteAnims: Record<string, { frames: string[]; fps?: number; loop?: boolean }> } {
    return {
      textures: { ...this.world.textures },
      spriteAnims: Object.fromEntries(
        Object.entries(this.world.spriteAnims ?? {}).map(([name, anim]) => [
          name,
          { ...anim, frames: [...anim.frames] },
        ]),
      ),
    };
  }
}
