/**
 * DungeonBrowser — modal que lista las mazmorras pre-hechas curadas y muestra
 * su planta 2D (estilo automap de Daggerfall). "Añadir al proyecto" devuelve
 * la definición elegida al callback; main.ts la ensambla y la fusiona.
 */

import { assemble } from '../dungeons/assemble';
import { BLOCKS } from '../dungeons/blocks';
import type { ConnectorSide, DungeonDef } from '../dungeons/types';

const CELL = 16; // tamaño de celda de los bloques (coincide con beats defs)

export class DungeonBrowser {
  private overlay: HTMLDivElement;
  private list: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private addBtn: HTMLButtonElement;
  private current: DungeonDef | null = null;
  private onAdd: ((def: DungeonDef) => void) | null = null;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay dungeon-browser';

    const modal = document.createElement('div');
    modal.className = 'modal dungeon-browser__modal';

    // Cabecera
    const header = document.createElement('div');
    header.className = 'modal__header';
    const title = document.createElement('h2');
    title.className = 'modal__title';
    title.textContent = 'Mazmorras pre-hechas';
    const closeX = document.createElement('button');
    closeX.className = 'btn btn--icon';
    closeX.title = 'Cerrar (Esc)';
    closeX.textContent = '×';
    closeX.addEventListener('click', () => this.close());
    header.append(title, closeX);
    modal.appendChild(header);

    // Cuerpo: lista + previsualización 2D
    const body = document.createElement('div');
    body.className = 'dungeon-browser__body';
    this.list = document.createElement('div');
    this.list.className = 'dungeon-list';
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'dungeon-preview';
    body.append(this.list, this.canvas);
    modal.appendChild(body);

    // Pie
    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    this.addBtn = document.createElement('button');
    this.addBtn.className = 'btn btn--primary';
    this.addBtn.textContent = 'Añadir al proyecto';
    this.addBtn.disabled = true;
    this.addBtn.addEventListener('click', () => {
      if (this.current && this.onAdd) {
        this.onAdd(this.current);
        this.close();
      }
    });
    const cancel = document.createElement('button');
    cancel.className = 'btn btn--secondary';
    cancel.textContent = 'Cerrar';
    cancel.addEventListener('click', () => this.close());
    footer.append(this.addBtn, cancel);
    modal.appendChild(footer);

    this.overlay.appendChild(modal);
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close();
  };

  open(defs: DungeonDef[], onAdd: (def: DungeonDef) => void): void {
    this.onAdd = onAdd;
    this.current = null;
    this.addBtn.disabled = true;
    this.list.textContent = '';

    for (const def of defs) {
      const item = document.createElement('button');
      item.className = 'dungeon-item';
      const name = document.createElement('span');
      name.className = 'dungeon-item__name';
      name.textContent = def.name;
      const meta = document.createElement('span');
      meta.className = 'dungeon-item__meta';
      meta.textContent = `${def.type} · ${def.tiles.length} bloques`;
      item.append(name, meta);
      item.addEventListener('click', () => this.select(def, item));
      this.list.appendChild(item);
    }

    document.body.appendChild(this.overlay);
    document.addEventListener('keydown', this.onKey);
    const first = defs[0];
    if (first) this.select(first, this.list.firstElementChild as HTMLButtonElement);
  }

  close(): void {
    this.overlay.remove();
    document.removeEventListener('keydown', this.onKey);
  }

  private select(def: DungeonDef, btn: HTMLButtonElement): void {
    this.current = def;
    for (const el of this.list.children) el.classList.toggle('active', el === btn);
    this.addBtn.disabled = false;
    this.renderPreview(def);
  }

  /** Dibuja la planta 2D de la mazmorra (sectores, paredes y puertas). */
  private renderPreview(def: DungeonDef): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const dun = assemble(def, BLOCKS);
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.canvas.width = w;
    this.canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#11111b';
    ctx.fillRect(0, 0, w, h);

    const pad = 40;
    const scale = Math.min((w - pad * 2) / dun.width, (h - pad * 2) / dun.height);
    const X = (x: number): number => pad + x * scale;
    const Y = (y: number): number => pad + (dun.height - y) * scale;

    // Suelos (sectores)
    for (const s of dun.sectors) {
      const pts = s.vertexIds.map((id) => dun.vertices.find((v) => v.id === id));
      if (!pts[0]) continue;
      ctx.beginPath();
      ctx.moveTo(X(pts[0]!.x), Y(pts[0]!.y));
      for (let i = 1; i < pts.length; i++) ctx.lineTo(X(pts[i]!.x), Y(pts[i]!.y));
      ctx.closePath();
      ctx.fillStyle = 'rgba(137,180,250,0.14)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(137,180,250,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Paredes
    ctx.strokeStyle = '#cdd6f4';
    ctx.lineWidth = 1.5;
    for (const wl of dun.walls) {
      const a = dun.vertices.find((v) => v.id === wl.a);
      const b = dun.vertices.find((v) => v.id === wl.b);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(X(a.x), Y(a.y));
      ctx.lineTo(X(b.x), Y(b.y));
      ctx.stroke();
    }

    // Puertas abiertas: marca verde en el centro de la boca
    ctx.strokeStyle = '#a6e3a1';
    ctx.lineWidth = 2;
    for (const p of dun.passages) {
      if (!p.open) continue;
      const [cx, cy] = gateCenter(p.side, p.tx, p.ty);
      const horizontal = p.side === 'n' || p.side === 's';
      ctx.beginPath();
      if (horizontal) {
        ctx.moveTo(X(cx - 2), Y(cy));
        ctx.lineTo(X(cx + 2), Y(cy));
      } else {
        ctx.moveTo(X(cx), Y(cy - 2));
        ctx.lineTo(X(cx), Y(cy + 2));
      }
      ctx.stroke();
    }
  }
}

/** Centro de la boca de un pasaje (tile en retícula + lado). */
function gateCenter(side: ConnectorSide, tx: number, ty: number): [number, number] {
  const cx = tx * CELL + CELL / 2;
  const cy = ty * CELL + CELL / 2;
  switch (side) {
    case 'n': return [cx, cy + CELL / 2];
    case 's': return [cx, cy - CELL / 2];
    case 'e': return [cx + CELL / 2, cy];
    case 'w': return [cx - CELL / 2, cy];
  }
}