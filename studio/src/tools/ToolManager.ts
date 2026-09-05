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
  tryCreateWall,
  closeSector,
  changeSectorHeight,
  placeEntityAt,
  findSectorAt,
  collectTranslateTargets,
  placeTerrainAt,
} from './tools';
import { ENTITY_CATEGORIES, ENTITIES } from '../entities/entityCatalog';
import type { EntityDef } from '../entities/entityCatalog';
import { snap } from './picking';

export type ToolId = 'select' | 'move' | 'vertex' | 'wall' | 'height' | 'entity' | 'terrain';

/** Tamaños de terreno disponibles (metros cuadrados, celda = 1 m). */
export const TERRAIN_SIZES = [8, 16, 24, 32] as const;

export type Selection =
  | { kind: 'vertex'; id: string }
  | { kind: 'wall'; id: string }
  | { kind: 'sector'; id: string }
  | { kind: 'sprite'; id: string };

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
  /** Shift pulsado (selección múltiple / toggle). */
  shiftKey?: boolean;
}

export interface ToolManagerCallbacks {
  onNotice?: (message: string, type?: 'info' | 'warning' | 'error' | 'success') => void;
  onSelectionChange?: (sel: Selection[]) => void;
  onToolChange?: (tool: ToolId) => void;
}

/** Objeto agarrado durante un arrastre (posiciones originales para traslación rígida). */
interface GrabTarget {
  kind: 'vertex' | 'sprite';
  id: string;
  x: number;
  z: number;
  h: number;
}

export class ToolManager {
  activeTool: ToolId = 'select';
  selection: Selection[] = [];
  doc: EditorState;

  /** id del objeto bajo el cursor durante hover (para el overlay). */
  hoverId: { kind: 'vertex' | 'wall' | 'sector' | 'sprite'; id: string } | null = null;

  private cb: ToolManagerCallbacks;
  private wallA: string | null = null; // vértice inicial de la pared en curso
  private polygon: string[] = [];      // vértices acumulados de un sector
  /**
   * Arrastre en curso: punto inicial del cursor + posiciones originales de
   * los targets (grupo si hay selección múltiple). El delta aplicado sobre
   * las originales produce traslación rígida sin deformación ni error acumulado.
   */
  private grab: {
    cursorStartX: number;
    cursorStartZ: number;
    originals: GrabTarget[];
  } | null = null;
  /** Selector HTML de entidades abierto (herramienta Entidades). */
  private entityPicker: HTMLSelectElement | null = null;
  /** Momento (performance.now) en que se abrió el selector. */
  private pickerOpenedAt = 0;
  /** Tipo de entidad activo: el clic en la cuadrícula coloca este tipo. */
  activeEntity: EntityDef | null = null;
  /** Tamaño activo del terreno (m): null hasta elegirlo en el icono Terreno. */
  activeTerrainSize: number | null = null;
  /**
   * Modo de la herramienta Terreno: 'place' coloca un suelo plano nuevo;
   * 'raise'/'lower' moldean (elevan/hunden) un terreno YA colocado.
   */
  terrainMode: 'place' | 'raise' | 'lower' = 'place';
  /** Selector HTML de tamaños abierto (herramienta Terreno). */
  private terrainPicker: HTMLSelectElement | null = null;
  private terrainPickerOpenedAt = 0;

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

  /** Selecciona un objeto, un conjunto, o vacío (null) — normaliza a array. */
  select(sel: Selection | Selection[] | null): void {
    this.selection = sel ? (Array.isArray(sel) ? sel : [sel]) : [];
    this.cb.onSelectionChange?.(this.selection);
  }

  /**
   * Procesa un clic del botón izquierdo.
   * @returns `true` si la herramienta consumió el clic (agarre, creación o
   * selección); `false` si cayó en vacío y el viewport puede orbitar la cámara.
   */
  onPointerDown(ctx: PickContext): boolean {
    switch (this.activeTool) {
      case 'move':     return this.toolMoveDown(ctx);
      case 'vertex':   return this.toolVertexDown(ctx);
      case 'wall':     return this.toolWallDown(ctx);
      case 'height':   return this.toolHeightDown(ctx);
      case 'entity':   return this.toolEntityDown(ctx);
      case 'terrain':  return this.toolTerrainDown(ctx);
      default:         return this.toolSelectDown(ctx);
    }
  }

  onPointerMove(ctx: PickContext): void {
    this.hoverId = this._computeHover(ctx);
    // Arrastre en curso: aplicar el delta (snap al grid) a las originales.
    if (this.grab && ctx.world) {
      const dx = snap(ctx.world.x - this.grab.cursorStartX);
      const dz = snap(ctx.world.z - this.grab.cursorStartZ);
      for (const o of this.grab.originals) {
        if (o.kind === 'vertex') this.doc.moveVertex(o.id, o.x + dx, o.z + dz);
        else this.doc.moveSprite(o.id, o.x + dx, o.z + dz, o.h);
      }
    }
  }

  onPointerUp(): void {
    this.grab = null;
  }

  /**
   * Devuelve true si consumió la rueda (hubo cambio de altura).
   * Herramienta H + sector seleccionado → piso/techo.
   * Rueda abajo baja, rueda arriba sube (signo ajustado al deltaY del entorno).
   * Cualquier otro caso (incluido sprite seleccionado) devuelve false →
   * el viewport hace zoom con la rueda.
   */
  onWheel(deltaY: number, shiftKey: boolean): boolean {
    if (this.activeTool === 'height') {
      // La rueda afecta al primer sector de la selección (la multi-selección
      // de alturas no forma parte de esta feature).
      const sectorSel = this.selection.find((s) => s.kind === 'sector');
      if (sectorSel) {
        const step = deltaY > 0 ? 0.25 : -0.25;
        // Sin Shift → techo (la altura opuesta del eje Y); con Shift → piso.
        const isCeil = !shiftKey;
        changeSectorHeight(this.doc, sectorSel.id, step, isCeil);
        return true;
      }
    }
    return false;
  }

  /** Elimina todos los objetos seleccionados. Devuelve true si eliminó algo. */
  onDelete(): boolean {
    if (this.selection.length === 0) return false;
    let anyOk = false;
    // Orden: sprites → paredes → sectores → vértices (evita huérfanos).
    for (const kind of ['sprite', 'wall', 'sector', 'vertex'] as const) {
      for (const s of this.selection) {
        if (s.kind !== kind) continue;
        const ok =
          kind === 'vertex' ? this.doc.removeVertex(s.id) :
          kind === 'wall' ? this.doc.removeWall(s.id) :
          kind === 'sector' ? this.doc.removeSector(s.id) :
          this.doc.removeSprite(s.id);
        anyOk = anyOk || ok;
      }
    }
    if (anyOk) this.select(null);
    return anyOk;
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
    const clicked = this._pickAny(ctx);
    if (clicked) {
      this._selectWithShift(clicked, ctx.shiftKey ?? false);
      // Arrastre: solo vértices y sprites (como antes); con multi, mueve el grupo.
      if (clicked.kind === 'vertex' || clicked.kind === 'sprite') {
        this._beginGrab(this.selection, ctx);
      }
      return true;
    }
    // Clic en un sector (por el punto del suelo)
    if (ctx.world) {
      const sector = findSectorAt(this.doc, ctx.world.x, ctx.world.z);
      if (sector) {
        this._selectWithShift({ kind: 'sector', id: sector }, ctx.shiftKey ?? false);
        return true;
      }
    }
    // Vacío: sin Shift se limpia la selección; con Shift se conserva (multi).
    if (!(ctx.shiftKey ?? false)) this.select(null);
    return false; // vacío → el viewport orbita/pan
  }

  /**
   * Herramienta Mover (3) — traslada CUALQUIER cosa de forma rígida:
   * vértice, pared (sus 2 extremos), sector (todo el polígono) o sprite.
   * Con Shift la selección es múltiple y el arrastre mueve todo el grupo.
   */
  private toolMoveDown(ctx: PickContext): boolean {
    const clicked = this._pickAny(ctx);
    if (clicked) {
      this._selectWithShift(clicked, ctx.shiftKey ?? false);
      this._beginGrab(this.selection, ctx);
      return true;
    }
    if (ctx.world) {
      const sector = findSectorAt(this.doc, ctx.world.x, ctx.world.z);
      if (sector) {
        this._selectWithShift({ kind: 'sector', id: sector }, ctx.shiftKey ?? false);
        this._beginGrab(this.selection, ctx);
        return true;
      }
    }
    if (!(ctx.shiftKey ?? false)) this.select(null);
    return false; // vacío → el viewport orbita/pan
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
      this._beginGrab([{ kind: 'sprite', id: sid }], ctx);
      this._closeEntityPicker();
      return true;
    }
    // Sin tipo activo: recordar que hay que elegirlo en el icono Entidades.
    if (!this.activeEntity) {
      this.cb.onNotice?.('Elige el tipo de entidad en el icono Entidades', 'info');
      return true;
    }
    // Colocar la entidad del tipo activo en el punto de la cuadrícula.
    const id = placeEntityAt(this.doc, ctx.world.x, ctx.world.z, this.activeEntity);
    this.select({ kind: 'sprite', id });
    this._beginGrab([{ kind: 'sprite', id }], ctx);
    return true;
  }

  /**
   * Herramienta Terreno (7):
   * - Modo colocar: cada clic en la cuadrícula coloca un suelo plano del
   *   tamaño activo (activeTerrainSize), elevado al piso del sector bajo el clic.
   * - Modo moldear ('raise'/'lower'): cada clic sobre un terreno YA colocado
   *   (sector con id `terr_...`) lo eleva o hunde +0,5 m. Solo moldea terrenos:
   *   si el clic cae en otra cosa, no consume y el viewport puede orbitar.
   */
  private toolTerrainDown(ctx: PickContext): boolean {
    if (!ctx.world) return false;

    if (this.terrainMode !== 'place') {
      const sector = findSectorAt(this.doc, ctx.world.x, ctx.world.z);
      if (sector && sector.startsWith('terr_')) {
        const raising = this.terrainMode === 'raise';
        const ok = changeSectorHeight(this.doc, sector, raising ? 0.5 : -0.5, false);
        if (ok) {
          const s = this.doc.getSector(sector);
          const h = s && typeof s.floorH === 'number' ? s.floorH : 0;
          this.cb.onNotice?.(`Terreno ${raising ? 'elevado' : 'hundido'} a ${h} m`, 'success');
        }
        return ok;
      }
      // No es un terreno: dejar orbitar/desmarcar sin castigar.
      return false;
    }

    if (this.activeTerrainSize === null) {
      this.cb.onNotice?.('Elige el tamaño del terreno en el icono Terreno', 'info');
      return true;
    }
    const r = placeTerrainAt(this.doc, ctx.world.x, ctx.world.z, this.activeTerrainSize);
    this.cb.onNotice?.(
      `Suelo plano de ${r.sectorCount} celdas colocado (base ${r.base} m)`,
      'success',
    );
    return true;
  }

  /**
   * Abre el `<select>` de tamaños de terreno bajo el icono Terreno.
   * Al elegir se fija `activeTerrainSize`; cada clic en la cuadrícula coloca
   * un terreno de ese tamaño.
   */
  openTerrainSizePicker(clientX?: number, clientY?: number): void {
    this._closeTerrainPicker();
    // Sin DOM (tests/SSR) no hay selector; el primer clic avisa igualmente.
    if (typeof document === 'undefined') return;
    const select = document.createElement('select');
    select.className = 'entity-picker'; // mismo estilo que el selector de entidades
    select.title = 'Tamaño del terreno a colocar';

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Selecciona acción —';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    // Sub-sección Colocar: tamaños del suelo plano nuevo.
    const placeGroup = document.createElement('optgroup');
    placeGroup.label = 'Colocar suelo plano';
    for (const size of TERRAIN_SIZES) {
      const opt = document.createElement('option');
      opt.value = String(size);
      opt.textContent = `${size} × ${size} m`;
      placeGroup.appendChild(opt);
    }
    select.appendChild(placeGroup);

    // Sub-sección Moldear: elevar/hundir un terreno ya colocado.
    const moldGroup = document.createElement('optgroup');
    moldGroup.label = 'Moldear terreno colocado';
    const moldOptions: { value: string; text: string }[] = [
      { value: 'raise', text: '⬆ Elevar (+0,5 m por clic)' },
      { value: 'lower', text: '⬇ Hundir (−0,5 m por clic)' },
    ];
    for (const m of moldOptions) {
      const opt = document.createElement('option');
      opt.value = m.value;
      opt.textContent = m.text;
      moldGroup.appendChild(opt);
    }
    select.appendChild(moldGroup);
    select.size = 1 + TERRAIN_SIZES.length + moldOptions.length;

    select.style.position = 'fixed';
    if (clientX !== undefined && clientY !== undefined) {
      select.style.left = `${Math.min(clientX, window.innerWidth - 240)}px`;
      select.style.top = `${Math.min(clientY + 4, window.innerHeight - 200)}px`;
    } else {
      select.style.left = '50%';
      select.style.top = '50%';
      select.style.transform = 'translate(-50%, -50%)';
    }

    select.addEventListener('change', () => {
      const v = select.value;
      if (v === 'raise' || v === 'lower') {
        this.terrainMode = v;
        this.activeTerrainSize = null; // no colocar por accidente
        this.cb.onNotice?.(
          v === 'raise'
            ? 'Modo moldear: eleva un terreno colocado con cada clic (+0,5 m)'
            : 'Modo moldear: hunde un terreno colocado con cada clic (−0,5 m)',
          'success',
        );
      } else if (Number.isInteger(Number(v))) {
        this.activeTerrainSize = Number(v);
        this.terrainMode = 'place';
        this.cb.onNotice?.(`Terreno de ${v}×${v} m — clic en la cuadrícula para colocar`, 'success');
      }
      this._closeTerrainPicker();
    });
    select.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._closeTerrainPicker();
    });

    document.body.appendChild(select);
    this.terrainPicker = select;
    this.terrainPickerOpenedAt = performance.now();
    document.addEventListener('click', this._onTerrainDocClick);
    this.cb.onNotice?.('Elige el tamaño del terreno a colocar', 'info');
    requestAnimationFrame(() => select.focus());
  }

  private _closeTerrainPicker(): void {
    if (this.terrainPicker) {
      this.terrainPicker.remove();
      this.terrainPicker = null;
      document.removeEventListener('click', this._onTerrainDocClick);
    }
  }

  /** Cierra el selector de tamaños al hacer clic fuera (mismo patrón entidades). */
  private _onTerrainDocClick = (e: MouseEvent): void => {
    const picker = this.terrainPicker;
    if (!picker) return;
    if (performance.now() - this.terrainPickerOpenedAt < 300) return;
    if (!picker.contains(e.target as Node)) this._closeTerrainPicker();
  };

  // ── Selector de entidades (dropdown desde el icono Entidades) ──

  /**
   * Abre el `<select>` de entidades bajo el icono Entidades de la toolbar.
   * Al elegir se fija `activeEntity`; después cada clic en la cuadrícula
   * coloca una entidad de ese tipo.
   */
  openEntityPicker(clientX?: number, clientY?: number): void {
    this._openEntityPicker(clientX, clientY);
  }

  private _openEntityPicker(clientX?: number, clientY?: number): void {
    this._closeEntityPicker();
    // Sin DOM (tests/SSR) no hay selector; el clic ya se consume igualmente.
    if (typeof document === 'undefined') return;
    const select = document.createElement('select');
    select.className = 'entity-picker';
    select.title = 'Elige el tipo de entidad a colocar';

    // Placeholder vacío como primera opción (obliga a elegir un tipo).
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '— Selecciona entidad —';
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);

    let totalOptions = 0;
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
        totalOptions++;
      }
      select.appendChild(group);
    }

    // Lista expandida (no dropdown nativo) para evitar problemas de foco.
    select.size = Math.min(totalOptions + 1, 12);

    // Posicionar bajo el punto indicado (botón de la toolbar) o centrado.
    select.style.position = 'fixed';
    if (clientX !== undefined && clientY !== undefined) {
      select.style.left = `${Math.min(clientX, window.innerWidth - 240)}px`;
      select.style.top = `${Math.min(clientY + 4, window.innerHeight - 200)}px`;
    } else {
      select.style.left = '50%';
      select.style.top = '50%';
      select.style.transform = 'translate(-50%, -50%)';
    }

    select.addEventListener('change', () => {
      const def = ENTITIES.find((e) => e.id === select.value);
      if (def) {
        this.activeEntity = def;
        this.cb.onNotice?.(`${def.name} activa — clic en la cuadrícula para colocar`, 'success');
      }
      this._closeEntityPicker();
    });
    select.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this._closeEntityPicker();
    });

    document.body.appendChild(select);
    this.entityPicker = select;
    this.pickerOpenedAt = performance.now();
    document.addEventListener('click', this._onDocClick);
    this.cb.onNotice?.('Elige el tipo de entidad a colocar', 'info');
    // Dar foco en el siguiente frame para que el mouseup del canvas no lo robe
    requestAnimationFrame(() => select.focus());
  }

  private _closeEntityPicker(): void {
    if (this.entityPicker) {
      this.entityPicker.remove();
      this.entityPicker = null;
      document.removeEventListener('click', this._onDocClick);
    }
  }

  /**
   * Cierra el selector cuando se hace clic fuera de él. Ignora el clic que
   * acaba de abrirlo (mismo gesto, < 300 ms) para no cerrarlo en el acto.
   */
  private _onDocClick = (e: MouseEvent): void => {
    const picker = this.entityPicker;
    if (!picker) return;
    if (performance.now() - this.pickerOpenedAt < 300) return;
    if (!picker.contains(e.target as Node)) this._closeEntityPicker();
  };

  // ── Internos ──────────────────────────────────────────────────

  /** Picking de objetos con prioridad: vértice → pared → sprite. */
  private _pickAny(ctx: PickContext): Selection | null {
    const vid = pickVertex(ctx.px, ctx.py, ctx.screenVertices);
    if (vid) return { kind: 'vertex', id: vid };
    const wid = pickWall(ctx.px, ctx.py, ctx.screenWalls);
    if (wid) return { kind: 'wall', id: wid };
    const sid = pickSprite(ctx.px, ctx.py, ctx.screenSprites);
    if (sid) return { kind: 'sprite', id: sid };
    return null;
  }

  /**
   * Selección con semántica de editores: sin Shift reemplaza con el objeto;
   * con Shift lo AÑADE al conjunto (si ya está, no lo duplica). Para quitar
   * objetos se hace clic en vacío sin Shift (limpia todo) o se deselecciona
   * con Ctrl/Shit+clic en blanco. Este comportamiento permite arrastrar un
   * miembro del grupo sin perder el resto.
   */
  private _selectWithShift(obj: Selection, shift: boolean): void {
    if (shift) {
      if (!this.selection.some((s) => s.kind === obj.kind && s.id === obj.id)) {
        this.selection = [...this.selection, obj];
      }
    } else {
      this.selection = [obj];
    }
    this.cb.onSelectionChange?.(this.selection);
  }

  /**
   * Inicia un arrastre de traslación rígida para el conjunto dado: guarda el
   * punto inicial del cursor y las posiciones originales de todos los targets
   * (vértice→él, pared→sus 2 extremos, sector→sus vértices, sprite→su
   * posición). El delta se aplica sobre las originales → sin deformación.
   */
  private _beginGrab(objects: Selection[], ctx: PickContext): void {
    if (!ctx.world) return;
    const { vertexIds, spriteIds } = collectTranslateTargets(this.doc, objects);
    const originals: GrabTarget[] = [];
    for (const id of vertexIds) {
      const v = this.doc.getVertex(id);
      if (v) originals.push({ kind: 'vertex', id, x: v.x, z: v.y, h: 0 });
    }
    for (const id of spriteIds) {
      const sp = this.doc.world.sprites.find((s) => s.id === id);
      if (sp) originals.push({ kind: 'sprite', id, x: sp.pos.x, z: sp.pos.y, h: sp.pos.z });
    }
    this.grab = { cursorStartX: ctx.world.x, cursorStartZ: ctx.world.z, originals };
  }

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
    this.grab = null;
    this._closeEntityPicker();
    this._closeTerrainPicker();
  }
}