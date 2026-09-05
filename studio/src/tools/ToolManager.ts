/**
 * ToolManager — gestiona la herramienta activa y el flujo de edición.
 *
 * Recibe eventos del viewport (pointer down/move/up, wheel, delete) junto con
 * un PickContext (lo que el viewport calcula con la cámara: punto en el suelo
 * del mundo + proyecciones a pantalla) y los despacha a la herramienta vigente,
 * mutando el EditorState a través de tools.ts.
 *
 * Sin Three.js: todo el picking puro vive en picking.ts y la lógica en tools.ts.
 */

import type { EditorState } from '../editor/EditorState';
import {
  pickVertex,
  pickWall,
  pickSprite,
} from './picking';
import type { ScreenVertex, ScreenWall, ScreenSprite } from './picking';
import {
  createVertexAt,
  moveVertexTo,
  tryCreateWall,
  closeSector,
  changeSectorHeight,
  placeEntityAt,
  moveSpriteTo,
  findSectorAt,
} from './tools';
import { ENTITY_CATEGORIES, ENTITIES } from '../entities/entityCatalog';

export type ToolId = 'select' | 'vertex' | 'wall' | 'height' | 'entity';

export type Selection =
  | { kind: 'vertex'; id: string }
  | { kind: 'wall'; id: string }
  | { kind: 'sector'; id: string }
  | { kind: 'sprite'; id: string }
  | null;

/** Información que el viewport calcula por evento (con la cámara del renderer). */
export interface PickContext {
  /** Coordenadas del ratón en el canvas (px). */
  px: number;
  py: number;
  /** Coordenadas del ratón en la ventana (para posicionar el selector). */
  clientX?: number;
  clientY?: number;
  /** Punto en el suelo del mundo bajo el cursor (o null si no se interseca). */
  world: { x: number; z: number } | null;
  /** Proyecciones a pantalla para hit-test. */
  screenVertices: ScreenVertex[];
  screenWalls: ScreenWall[];
  screenSprites: ScreenSprite[];
}

export interface ToolManagerCallbacks {
  onNotice?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
  onSelectionChange?: (sel: Selection) => void;
  onToolChange?: (tool: ToolId) => void;
}

export class ToolManager {
  activeTool: ToolId = 'select';
  selection: Selection = null;
  doc: EditorState;

  /** id del objeto bajo el cursor durante hover (para el overlay). */
  hoverId: { kind: 'vertex' | 'wall' | 'sector' | 'sprite'; id: string } | null = null;

  private cb: ToolManagerCallbacks;
  private wallA: string | null = null; // vértice inicial de la pared en curso
  private polygon: string[] = [];      // vértices acumulados de un sector
  private drag: { kind: 'vertex' | 'sprite'; id: string } | null = null;
  /** Selector HTML de entidades abierto (herramienta Entidades). */
  private entityPicker: HTMLSelectElement | null = null;

  constructor(doc: EditorState, cb: ToolManagerCallbacks = {}) {
    this.doc = doc;
    this.cb = cb;
  }

  // ── API pública para el viewport ──────────────────────────────

  setTool(tool: ToolId): void {
    this.activeTool = tool;
    this.cancelGesture();
    this.hoverId = null;
    this.cb.onToolChange?.(tool);
  }

  select(sel: Selection): void {
    this.selection = sel;
    this.cb.onSelectionChange?.(sel);
  }

  /**
   * Procesa un clic del botón izquierdo.
   * @returns `true` si la herramienta consumió el clic (agarre, creación o
   * selección); `false` si cayó en vacío y el viewport puede orbitar la cámara.
   */
  onPointerDown(ctx: PickContext): boolean {
    switch (this.activeTool) {
      case 'vertex':    return this.toolVertexDown(ctx);
      case 'wall':      return this.toolWallDown(ctx);
      case 'height':    return this.toolHeightDown(ctx);
      case 'entity':    return this.toolEntityDown(ctx);
      default:          return this.toolSelectDown(ctx);
    }
  }

  onPointerMove(ctx: PickContext): void {
    this.hoverId = this._computeHover(ctx);
    // Arrastre en curso: mover el objeto agarrado
    if (this.drag && ctx.world) {
      if (this.drag.kind === 'vertex') {
        moveVertexTo(this.doc, this.drag.id, ctx.world.x, ctx.world.z);
      } else {
        moveSpriteTo(this.doc, this.drag.id, ctx.world.x, ctx.world.z);
      }
    }
  }

  onPointerUp(): void {
    this.drag = null;
  }

  /**
   * Devuelve true si consumió la rueda (hubo cambio de altura).
   * Herramienta H + sector seleccionado → piso/techo.
   * Sprite seleccionado (cualquier herramienta) → altura Y del sprite.
   * Rueda abajo baja, rueda arriba sube (signo ajustado al deltaY del entorno).
   */
  onWheel(deltaY: number, shiftKey: boolean): boolean {
    if (this.activeTool === 'height' && this.selection?.kind === 'sector') {
      const step = deltaY > 0 ? 0.25 : -0.25;
      // Sin Shift → techo (la altura opuesta del eje Y); con Shift → piso.
      const isCeil = !shiftKey;
      changeSectorHeight(this.doc, this.selection.id, step, isCeil);
      return true;
    }
    if (this.selection?.kind === 'sprite') {
      const sel = this.selection;
      const sp = this.doc.world.sprites.find((s) => s.id === sel.id);
      if (sp) {
        const step = deltaY > 0 ? 0.25 : -0.25;
        this.doc.moveSprite(sp.id, sp.pos.x, sp.pos.y, Math.max(0, sp.pos.z + step));
        return true;
      }
    }
    return false;
  }

  /** Elimina el objeto seleccionado. Devuelve true si eliminó algo. */
  onDelete(): boolean {
    if (!this.selection) return false;
    const { kind, id } = this.selection;
    const ok =
      kind === 'vertex' ? this.doc.removeVertex(id) :
      kind === 'wall' ? this.doc.removeWall(id) :
      kind === 'sector' ? this.doc.removeSector(id) :
      this.doc.removeSprite(id);
    if (ok) this.select(null);
    return ok;
  }

  /** Información para el overlay (hover + selección). */
  getHover(): { kind: 'vertex' | 'wall' | 'sector' | 'sprite'; id: string } | null {
    return this.hoverId;
  }

  /** Vértices del polígono en construcción (para el overlay). */
  get polyline(): string[] {
    return [...this.polygon];
  }

  // ── Gestos por herramienta ────────────────────────────────────

  private toolSelectDown(ctx: PickContext): boolean {
    const vid = pickVertex(ctx.px, ctx.py, ctx.screenVertices);
    if (vid) {
      this.select({ kind: 'vertex', id: vid });
      this.drag = { kind: 'vertex', id: vid };
      return true;
    }
    const wid = pickWall(ctx.px, ctx.py, ctx.screenWalls);
    if (wid) {
      this.select({ kind: 'wall', id: wid });
      return true;
    }
    const sid = pickSprite(ctx.px, ctx.py, ctx.screenSprites);
    if (sid) {
      this.select({ kind: 'sprite', id: sid });
      this.drag = { kind: 'sprite', id: sid };
      return true;
    }
    // Clic en un sector (por el punto del suelo)
    if (ctx.world) {
      const sector = findSectorAt(this.doc, ctx.world.x, ctx.world.z);
      if (sector) {
        this.select({ kind: 'sector', id: sector });
        return true;
      }
    }
    this.select(null);
    return false; // vacío → el viewport orbita
  }

  /**
   * Herramienta vértices = "dibujar sala": cada clic izquierdo coloca un punto
   * (creando un vértice o reutilizando uno existente). Al pulsar de nuevo el
   * PRIMER punto (con ≥3) se cierra el polígono y se crea el sector 3D con
   * sus paredes de borde.
   *
   * Para mover vértices existentes se usa la herramienta Seleccionar (1).
   */
  private toolVertexDown(ctx: PickContext): boolean {
    if (!ctx.world) return false;
    const vid = pickVertex(ctx.px, ctx.py, ctx.screenVertices);

    // Cerrar: clic sobre el primer vértice con ≥3 puntos → crea el sector 3D
    if (vid && this.polygon.length >= 3 && this.polygon[0] === vid) {
      const r = closeSector(this.doc, this.polygon);
      if (r.ok) {
        this.select({ kind: 'sector', id: r.sectorId! });
        this.cb.onNotice?.('Habitación creada', 'success');
      } else {
        this.cb.onNotice?.(r.message ?? 'No se pudo crear el sector', 'warning');
      }
      this.polygon = [];
      return true;
    }

    // Clic sobre un vértice existente → añadirlo al esqueleto del polígono
    if (vid) {
      if (!this.polygon.includes(vid)) this.polygon.push(vid);
      this.select({ kind: 'vertex', id: vid });
      return true;
    }

    // Clic en el suelo → crear vértice nuevo y añadirlo al polígono
    const id = createVertexAt(this.doc, ctx.world.x, ctx.world.z);
    this.select({ kind: 'vertex', id });
    if (!this.polygon.includes(id)) this.polygon.push(id);
    return true;
  }

  private toolWallDown(ctx: PickContext): boolean {
    const vid = pickVertex(ctx.px, ctx.py, ctx.screenVertices);
    if (!vid) return false;
    if (this.wallA === null) {
      // Primer extremo
      this.wallA = vid;
      this.cb.onNotice?.('Clic en el segundo vértice para crear la pared', 'info');
      return true;
    }
    // Segundo extremo: crear la pared con el punto del suelo como referencia
    const click = ctx.world ?? { x: 0, z: 0 };
    const r = tryCreateWall(this.doc, this.wallA, vid, click.x, click.z);
    if (r.ok) {
      const wall = this.doc.world.walls.find((w) => w.id === r.wallId);
      const portal = wall?.portal ? ' (portal)' : '';
      this.cb.onNotice?.(`Pared creada${portal}`, 'success');
      this.select({ kind: 'wall', id: r.wallId! });
    } else {
      this.cb.onNotice?.(r.message ?? 'No se pudo crear la pared', 'warning');
    }
    this.wallA = null;
    return true;
  }

  private toolHeightDown(ctx: PickContext): boolean {
    if (!ctx.world) return false;
    const sector = findSectorAt(this.doc, ctx.world.x, ctx.world.z);
    if (sector) {
      this.select({ kind: 'sector', id: sector });
      return true;
    }
    return false;
  }

  private toolEntityDown(ctx: PickContext): boolean {
    if (!ctx.world) return false;
    const sid = pickSprite(ctx.px, ctx.py, ctx.screenSprites);
    if (sid) {
      // Agarrar sprite/entidad existente para moverlo
      this.select({ kind: 'sprite', id: sid });
      this.drag = { kind: 'sprite', id: sid };
      this._closeEntityPicker();
      return true;
    }
    // Clic en el suelo → abrir el selector de tipos de entidad
    this._openEntityPicker(ctx.world.x, ctx.world.z, ctx.clientX, ctx.clientY);
    return true;
  }

  // ── Selector de entidades (dropdown categorizado) ─────────────

  /**
   * Abre un `<select>` flotante junto al cursor con las entidades del
   * catálogo agrupadas por categoría (NPC / Enemigo-Humano / Enemigo-Animal).
   * Al elegir una opción se coloca la entidad en el punto del clic.
   */
  private _openEntityPicker(x: number, z: number, clientX?: number, clientY?: number): void {
    this._closeEntityPicker();
    // Sin DOM (tests/SSR) no hay selector; el clic ya se consume igualmente.
    if (typeof document === 'undefined') return;
    const select = document.createElement('select');
    select.className = 'entity-picker';
    select.title = 'Elige el tipo de entidad a colocar';

    for (const cat of ENTITY_CATEGORIES) {
      const items = ENTITIES.filter((e) => e.category === cat.id);
      if (items.length === 0) continue;
      const group = document.createElement('optgroup');
      group.label = cat.label;
      for (const def of items) {
        const opt = document.createElement('option');
        opt.value = def.id;
        opt.textContent = def.name;
        group.appendChild(opt);
      }
      select.appendChild(group);
    }

    // Posicionar junto al cursor (con margen) o centrado si no hay coords.
    select.style.position = 'fixed';
    if (clientX !== undefined && clientY !== undefined) {
      select.style.left = `${Math.min(clientX + 4, window.innerWidth - 220)}px`;
      select.style.top = `${Math.min(clientY + 4, window.innerHeight - 40)}px`;
    } else {
      select.style.left = '50%';
      select.style.top = '50%';
      select.style.transform = 'translate(-50%, -50%)';
    }

    select.addEventListener('change', () => {
      const def = ENTITIES.find((e) => e.id === select.value);
      if (def) {
        const id = placeEntityAt(this.doc, x, z, def);
        this.select({ kind: 'sprite', id });
        this.drag = { kind: 'sprite', id };
        this.cb.onNotice?.(`${def.name} colocada`, 'success');
      }
      this._closeEntityPicker();
    });
    // Cerrar al perder el foco o con Escape; el clic en el suelo ya lo cierra.
    select.addEventListener('blur', () => this._closeEntityPicker());
    select.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._closeEntityPicker();
    });

    document.body.appendChild(select);
    this.entityPicker = select;
    this.cb.onNotice?.('Elige el tipo de entidad a colocar', 'info');
    select.focus();
  }

  private _closeEntityPicker(): void {
    if (this.entityPicker) {
      this.entityPicker.remove();
      this.entityPicker = null;
    }
  }

  // ── Internos ──────────────────────────────────────────────────

  private _computeHover(ctx: PickContext): { kind: 'vertex' | 'wall' | 'sector' | 'sprite'; id: string } | null {
    const vid = pickVertex(ctx.px, ctx.py, ctx.screenVertices);
    if (vid) return { kind: 'vertex', id: vid };
    const wid = pickWall(ctx.px, ctx.py, ctx.screenWalls);
    if (wid) return { kind: 'wall', id: wid };
    const sid = pickSprite(ctx.px, ctx.py, ctx.screenSprites);
    if (sid) return { kind: 'sprite', id: sid };
    if (ctx.world) {
      const sector = findSectorAt(this.doc, ctx.world.x, ctx.world.z);
      if (sector) return { kind: 'sector', id: sector };
    }
    return null;
  }

  private cancelGesture(): void {
    this.wallA = null;
    this.polygon = [];
    this.drag = null;
    this._closeEntityPicker();
  }
}