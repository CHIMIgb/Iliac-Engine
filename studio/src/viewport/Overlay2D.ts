/**
 * Overlay2D — canvas 2D transparente sobre el viewport WebGL.
 *
 * Dibuja los gizmos de edición: vértices como puntos, paredes como líneas,
 * polígono del sector seleccionado, sprites como marcadores, y resaltado del
 * hover. Se redibuja en cada frame de modo orbit.
 *
 * Esta capa SÍ toca Three.js (proyecta la cámara del renderer a pantalla);
 * el picking puro sigue viviendo en tools/picking.ts.
 */

import * as THREE from 'three';
import type { EditorState } from '../editor/EditorState';

export class Overlay2D {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private tmp = new THREE.Vector3();

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.cssText =
      'position:absolute;inset:0;pointer-events:none;width:100%;height:100%;';
    this.ctx = this.canvas.getContext('2d')!;
  }

  /** Redimensiona el canvas del overlay al tamaño del viewport. */
  resize(w: number, h: number): void {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  /**
   * Dibuja el estado actual de la edición.
   * @param camera Cámara del renderer (Three.js) para proyectar.
   * @param selection Objeto seleccionado (para resaltar).
   * @param hover Objeto bajo el cursor (para resaltar).
   */
  draw(
    doc: EditorState,
    camera: THREE.PerspectiveCamera | THREE.OrthographicCamera,
    selection: { kind: string; id: string } | null,
    hover: { kind: string; id: string } | null,
  ): void {
    const { ctx } = this;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Proyectar un punto del mundo (y/z del mundo → XZ de Three) a pantalla.
    const project = (x: number, z: number, y = 0): { x: number; y: number; visible: boolean } => {
      this.tmp.set(x, y, z);
      const v = this.tmp.project(camera);
      const visible = v.z >= -1 && v.z <= 1;
      return { x: (v.x + 1) * 0.5 * w, y: (1 - v.y) * 0.5 * h, visible };
    };

    // Paredes
    ctx.strokeStyle = 'rgba(205,214,244,0.35)';
    ctx.lineWidth = 1;
    for (const wall of doc.world.walls) {
      const va = doc.getVertex(wall.a);
      const vb = doc.getVertex(wall.b);
      if (!va || !vb) continue;
      const pa = project(va.x, va.y);
      const pb = project(vb.x, vb.y);
      if (!pa.visible || !pb.visible) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x, pa.y);
      ctx.lineTo(pb.x, pb.y);
      ctx.stroke();
    }

    // Sector seleccionado: relleno translúcido + borde
    if (selection?.kind === 'sector') {
      const sector = doc.getSector(selection.id);
      if (sector) {
        const pts = sector.vertexIds
          .map((vid) => doc.getVertex(vid))
          .filter((v) => v !== undefined)
          .map((v) => project(v!.x, v!.y));
        const allVisible = pts.every((p) => p.visible);
        if (allVisible && pts.length >= 3) {
          ctx.beginPath();
          ctx.moveTo(pts[0]!.x, pts[0]!.y);
          for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y);
          ctx.closePath();
          ctx.fillStyle = 'rgba(137,180,250,0.18)';
          ctx.fill();
          ctx.strokeStyle = '#89b4fa';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    // Pared seleccionada
    if (selection?.kind === 'wall') {
      const wall = doc.world.walls.find((ww) => ww.id === selection.id);
      if (wall) {
        const va = doc.getVertex(wall.a);
        const vb = doc.getVertex(wall.b);
        if (va && vb) {
          const pa = project(va.x, va.y);
          const pb = project(vb.x, vb.y);
          if (pa.visible && pb.visible) {
            ctx.beginPath();
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.strokeStyle = '#f9e2af';
            ctx.lineWidth = 3;
            ctx.stroke();
          }
        }
      }
    }

    // Sprites (marcadores)
    for (const sp of doc.world.sprites) {
      const p = project(sp.pos.x, sp.pos.y, sp.pos.z);
      if (!p.visible) continue;
      const isSel = selection?.kind === 'sprite' && selection.id === sp.id;
      const isHover = hover?.kind === 'sprite' && hover.id === sp.id;
      ctx.fillStyle = isSel || isHover ? '#f38ba8' : 'rgba(205,214,244,0.6)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, isSel || isHover ? 5 : 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vértices (puntos) — después de las paredes para que queden encima
    for (const v of doc.world.vertices) {
      const p = project(v.x, v.y);
      if (!p.visible) continue;
      const isSel = selection?.kind === 'vertex' && selection.id === v.id;
      const isHover = hover?.kind === 'vertex' && hover.id === v.id;
      ctx.fillStyle = isSel ? '#a6e3a1' : isHover ? '#f9e2af' : 'rgba(137,180,250,0.85)';
      const size = isSel || isHover ? 5 : 4;
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
  }
}