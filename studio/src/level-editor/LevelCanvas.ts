/**
 * LevelCanvas.ts — Vista 2D top-down del Level Editor
 *
 * Dibuja sobre un <canvas> 2D el mundo de sectores del documento, con cámara
 * (pan/zoom), picking (selección de vértice/sector/pared/sprite) y edición por
 * arrastre de vértices. NO usa Three.js ni WebGL: es canvas 2D puro, apto para
 * el editor sin necesidad de WebGL.
 *
 * Reutiliza la geometría del motor (engine/core/sector.js): closestPointOnSegment
 * y getSectorAt para picking.
 */

import { closestPointOnSegment, getSectorAt } from '../../../engine/core/sector.js';
import type { LevelDocument, Vertex } from './LevelDocument.js';

export type SelectableKind = 'vertex' | 'sector' | 'wall' | 'sprite';

export interface PickedObject {
  kind: SelectableKind;
  id: string;
}

export interface LevelCanvasOptions {
  snap?: number; // snapping de rejilla en unidades de mundo
  onSelect?: (picked: PickedObject | null) => void;
  onCursorWorld?: (x: number, y: number, sectorId: string | null) => void;
}

/** Transformación mundo <-> pantalla (cámara 2D: offset + escala). */
export interface Camera2D {
  offsetX: number;
  offsetY: number;
  scale: number; // píxeles por unidad de mundo
}

export const SNAP_SEARCH = 12; // píxeles máximos para seleccionar un vértice
export const WALL_SEARCH = 8; // píxeles máximos para seleccionar una pared

export class LevelCanvas {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private doc: LevelDocument;
  private opts: LevelCanvasOptions;
  private camera: Camera2D = { offsetX: 40, offsetY: 40, scale: 60 };
  private selectedId: string | null = null;
  private selectedKind: SelectableKind | null = null;
  // Estado de arrastre
  private draggingVert: string | null = null;
  private panning = false;
  private lastPointer = { x: 0, y: 0 };
  private resizeObserver: ResizeObserver | null = null;

  constructor(container: HTMLElement, doc: LevelDocument, opts: LevelCanvasOptions = {}) {
    this.opts = opts;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'level-canvas';
    container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    this.doc = doc;
    this.bindEvents();
    this.resize();
    // Reajustar el canvas cuando el contenedor del viewport cambie de tamaño
    // (SplitView redimensionable). El observer se desconecta en dispose().
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(container);
    }
  }

  setDocument(doc: LevelDocument) {
    this.doc = doc;
    this.clearSelection();
    this.redraw();
  }

  getDocument(): LevelDocument {
    return this.doc;
  }

  /** Optimiza: redibuja desde el documento. */
  redraw() {
    const { ctx, canvas } = this;
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Fondo del encuadre
    ctx.fillStyle = '#11111b';
    ctx.fillRect(0, 0, w, h);

    this.drawGrid();
    this.drawSprites();
    this.drawSectors();
    this.drawWalls();
    this.drawVertices();
  }

  resize() {
    const rect = this.canvas.parentElement!.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width));
    this.canvas.height = Math.max(1, Math.floor(rect.height));
    this.redraw();
  }

  private clearSelection() {
    this.selectedId = null;
    this.selectedKind = null;
  }

  // --- Transformaciones ---
  private worldToScreen(x: number, y: number): { x: number; y: number } {
    return {
      x: this.camera.offsetX + x * this.camera.scale,
      y: this.camera.offsetY + y * this.camera.scale,
    };
  }

  private screenToWorld(px: number, py: number): { x: number; y: number } {
    return {
      x: (px - this.camera.offsetX) / this.camera.scale,
      y: (py - this.camera.offsetY) / this.camera.scale,
    };
  }

  // --- Dibujo ---
  private drawGrid() {
    const { ctx, camera } = this;
    ctx.strokeStyle = '#1e1e2e';
    ctx.lineWidth = 1;
    // Paso de rejilla: el más fino de 1, 2, 5, 10… que quepa en pantalla
    const step = this.snapStep();
    const { offsetX, offsetY, scale } = camera;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const minX = -offsetX / scale;
    const maxX = (w - offsetX) / scale;
    const minY = -offsetY / scale;
    const maxY = (h - offsetY) / scale;

    for (let x = Math.floor(minX / step) * step; x <= maxX; x += step) {
      const sx = offsetX + x * scale;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();
    }
    for (let y = Math.floor(minY / step) * step; y <= maxY; y += step) {
      const sy = offsetY + y * scale;
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
    }
  }

  /** Paso de rejilla adaptativo (unidades de mundo) según el zoom. */
  private snapStep(): number {
    // Queremos que el paso ocupe entre 30 y 120 px en pantalla.
    const target = 60;
    const raw = target / this.camera.scale;
    // Redondear al 1/2/5/10 más cercano
    const pow = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / pow;
    const unit = m >= 5 ? 5 : m >= 2 ? 2 : m >= 1 ? 1 : 0.5;
    return unit * pow;
  }

  private drawSectors() {
    const { ctx, doc } = this;
    const map = new Map(doc.world.vertices.map((v) => [v.id, v]));
    for (const sector of doc.world.sectors) {
      const pts = sector.vertexIds.map((id) => map.get(id)).filter(Boolean);
      if (pts.length < 2) continue;
      const screen = pts.map((v) => this.worldToScreen(v!.x, v!.y));
      const isSelected = this.selectedKind === 'sector' && this.selectedId === sector.id;

      ctx.beginPath();
      ctx.moveTo(screen[0]!.x, screen[0]!.y);
      for (let i = 1; i < screen.length; i++) {
        ctx.lineTo(screen[i]!.x, screen[i]!.y);
      }
      ctx.closePath();
      ctx.fillStyle = isSelected ? 'rgba(137,180,250,0.25)' : 'rgba(49,50,68,0.5)';
      ctx.fill();

      // Etiqueta de id del sector en su centroide
      const cx = pts.reduce((a, v) => a + v!.x, 0) / pts.length;
      const cy = pts.reduce((a, v) => a + v!.y, 0) / pts.length;
      const c = this.worldToScreen(cx, cy);
      ctx.fillStyle = '#6c7086';
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(sector.id, c.x, c.y);
    }
  }

  private drawWalls() {
    const { ctx, doc } = this;
    const map = new Map(doc.world.vertices.map((v) => [v.id, v]));
    for (const wall of doc.world.walls) {
      const a = map.get(wall.a);
      const b = map.get(wall.b);
      if (!a || !b) continue;
      const p1 = this.worldToScreen(a.x, a.y);
      const p2 = this.worldToScreen(b.x, b.y);
      const isPortal = !!wall.portal;
      const isSelected = this.selectedKind === 'wall' && this.selectedId === wall.id;

      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = isSelected ? '#f9e2af' : isPortal ? '#94e2d5' : '#cdd6f4';
      ctx.lineWidth = isPortal ? 2 : 3;
      if (isPortal) ctx.setLineDash([6, 4]);
      else ctx.setLineDash([]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  private drawVertices() {
    const { ctx, doc } = this;
    for (const v of doc.world.vertices) {
      const p = this.worldToScreen(v.x, v.y);
      const isSelected = this.selectedKind === 'vertex' && this.selectedId === v.id;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isSelected ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#f38ba8' : '#89b4fa';
      ctx.fill();
    }
  }

  private drawSprites() {
    const { ctx, doc } = this;
    for (const sp of doc.world.sprites) {
      const p = this.worldToScreen(sp.pos.x, sp.pos.y);
      const isSelected = this.selectedKind === 'sprite' && this.selectedId === sp.id;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 8);
      ctx.lineTo(p.x + 7, p.y);
      ctx.lineTo(p.x, p.y + 8);
      ctx.lineTo(p.x - 7, p.y);
      ctx.closePath();
      ctx.fillStyle = isSelected ? '#a6e3a1' : '#a6adc8';
      ctx.fill();
    }
  }

  // --- Picking (coordenadas de pantalla) ---
  pick(px: number, py: number): PickedObject | null {
    const { doc } = this;
    const wpt = this.screenToWorld(px, py);
    const map = new Map(doc.world.vertices.map((v) => [v.id, v]));

    // 1. Vértice más cercano dentro del radio de selección
    let bestVertex: Vertex | null = null;
    let bestDist = Infinity;
    for (const v of doc.world.vertices) {
      const p = this.worldToScreen(v.x, v.y);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bestDist) {
        bestDist = d;
        bestVertex = v;
      }
    }
    if (bestVertex && bestDist <= SNAP_SEARCH) {
      return { kind: 'vertex', id: bestVertex.id };
    }

    // 2. Pared más cercana dentro del radio
    let bestWall: { id: string; d: number } | null = null;
    for (const wall of doc.world.walls) {
      const a = map.get(wall.a);
      const b = map.get(wall.b);
      if (!a || !b) continue;
      const d = this.distToSegmentScreen(px, py, a, b, map);
      if (bestWall === null || d < bestWall.d) bestWall = { id: wall.id, d };
    }
    if (bestWall && bestWall.d <= WALL_SEARCH) {
      return { kind: 'wall', id: bestWall.id };
    }

    // 3. Sprite bajo el puntero
    for (const sp of doc.world.sprites) {
      const p = this.worldToScreen(sp.pos.x, sp.pos.y);
      if (Math.hypot(p.x - px, p.y - py) <= 10) {
        return { kind: 'sprite', id: sp.id };
      }
    }

    // 4. Sector que contiene el punto
    const sector = getSectorAt(doc.world as any, wpt.x, wpt.y);
    if (sector) return { kind: 'sector', id: sector.id };

    return null;
  }

  private distToSegmentScreen(px: number, py: number, a: Vertex, b: Vertex, map: Map<string, Vertex>): number {
    const p1 = this.worldToScreen(a.x, a.y);
    const p2 = this.worldToScreen(b.x, b.y);
    const closest = closestPointOnSegment(px, py, p1, p2);
    return Math.hypot(px - closest.x, py - closest.y);
  }

  /** Aplica snapping a la rejilla (en unidades de mundo) si está configurado. */
  private snap(x: number, y: number): { x: number; y: number } {
    const s = this.opts.snap;
    if (!s) return { x, y };
    return { x: Math.round(x / s) * s, y: Math.round(y / s) * s };
  }

  // --- Interacción ---
  private bindEvents() {
    const c = this.canvas;

    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const prev = this.camera.scale;
      this.camera.scale = Math.min(400, Math.max(5, prev * factor));
      // Zoom centrado en el cursor
      const wpt = this.screenToWorld(e.offsetX, e.offsetY);
      this.camera.offsetX = e.offsetX - wpt.x * this.camera.scale;
      this.camera.offsetY = e.offsetY - wpt.y * this.camera.scale;
      this.redraw();
    });

    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.lastPointer = { x: e.offsetX, y: e.offsetY };
      const picked = this.pick(e.offsetX, e.offsetY);

      if (e.button === 1 || e.button === 2) {
        // Botón central/derecho: pan
        this.panning = true;
        return;
      }

      if (picked && picked.kind === 'vertex') {
        // Empezar a arrastrar vértice
        this.draggingVert = picked.id;
        this.setSelection(picked);
      } else {
        this.setSelection(picked ?? null);
        // Si no hay nada seleccionado con clic izquierdo, preparar pan igualmente
        this.panning = true;
      }
    });

    c.addEventListener('pointermove', (e) => {
      const dx = e.offsetX - this.lastPointer.x;
      const dy = e.offsetY - this.lastPointer.y;

      if (this.draggingVert) {
        const wpt = this.screenToWorld(e.offsetX, e.offsetY);
        const snapped = this.snap(wpt.x, wpt.y);
        this.doc.moveVertex(this.draggingVert, snapped.x, snapped.y);
        this.redraw();
      } else if (this.panning) {
        this.camera.offsetX += dx;
        this.camera.offsetY += dy;
        this.redraw();
      }

      this.lastPointer = { x: e.offsetX, y: e.offsetY };
      this.opts.onCursorWorld?.(...this.cursorWorld(e));
    });

    c.addEventListener('pointerup', (e) => {
      this.draggingVert = null;
      this.panning = false;
      c.releasePointerCapture(e.pointerId);
    });

    c.addEventListener('pointerleave', () => {
      this.draggingVert = null;
      this.panning = false;
    });
  }

  private cursorWorld(e: MouseEvent): [number, number, string | null] {
    const wpt = this.screenToWorld(e.offsetX, e.offsetY);
    const sector = getSectorAt(this.doc.world as any, wpt.x, wpt.y);
    return [wpt.x, wpt.y, sector ? sector.id : null];
  }

  private setSelection(picked: PickedObject | null) {
    if (picked) {
      this.selectedId = picked.id;
      this.selectedKind = picked.kind;
    } else {
      this.clearSelection();
    }
    this.redraw();
    this.opts.onSelect?.(picked);
  }

  /** Fuerza una selección desde el exterior (usado por el orquestador). */
  forceSelection(picked: PickedObject) {
    this.selectedId = picked.id;
    this.selectedKind = picked.kind;
    this.redraw();
    this.opts.onSelect?.(picked);
  }

  // --- Temas de colores por altura (placeholder; el editor real usa texturas) ---
  get selected(): PickedObject | null {
    return this.selectedKind && this.selectedId ? { kind: this.selectedKind, id: this.selectedId } : null;
  }

  dispose() {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
  }
}
