/**
 * tools.ts — lógica de las herramientas de edición.
 *
 * Funciones puras que mutan el EditorState (el único modo permitido de tocar
 * los datos). Cada herramienta del viewport delega aquí su comportamiento.
 * Sin Three.js: toda la geometría procede de picking.ts.
 *
 * Nota de ejes: un vértice del mundo es { x, y } con y = profundidad (el
 * motor lo mapea a Three.js XZ). Al hablar de "z" aquí nos referimos a la
 * profundidad del mundo (la y del EditorState).
 */

import type { EditorState } from '../editor/EditorState';
import { clampFloorCeil, pointInPolygon, snap } from './picking';
import type { PolygonPoint } from './picking';

// ── Helpers de acceso ───────────────────────────────────────────

/** Polígono (en plano suelo) de un sector, resolviendo sus ids de vértice. */
export function sectorPolygon(state: EditorState, sectorId: string): PolygonPoint[] {
  const sector = state.getSector(sectorId);
  if (!sector) return [];
  const pts: PolygonPoint[] = [];
  for (const vid of sector.vertexIds) {
    const v = state.getVertex(vid);
    if (v) pts.push({ x: v.x, y: v.y });
  }
  return pts;
}

/** Devuelve el id del sector que contiene el punto (x, z), o null. */
export function findSectorAt(state: EditorState, x: number, z: number): string | null {
  for (const s of state.world.sectors) {
    if (pointInPolygon(x, z, sectorPolygon(state, s.id))) return s.id;
  }
  return null;
}

/** Sectores que comparten la arista entre dos vértices. */
export function sectorsSharingEdge(state: EditorState, aId: string, bId: string): string[] {
  return state.world.sectors
    .filter((s) => s.vertexIds.includes(aId) && s.vertexIds.includes(bId))
    .map((s) => s.id);
}

/** Pared existente entre dos vértices (en cualquier sentido). */
export function findWall(state: EditorState, aId: string, bId: string) {
  return state.world.walls.find(
    (w) => (w.a === aId && w.b === bId) || (w.a === bId && w.b === aId),
  );
}

/** Textura de sprite por defecto para la herramienta Entidades. */
export function defaultSpriteTex(state: EditorState): string {
  const tex = Object.keys(state.world.textures).find((k) => k.startsWith('sprite'));
  return tex ?? 'sprite_blue';
}

// ── Acciones por herramienta ────────────────────────────────────

/** Herramienta V — crea un vértice en (x, z) con snap a grid. */
export function createVertexAt(state: EditorState, x: number, z: number): string {
  return state.addVertex(snap(x), snap(z)).id;
}

/** Herramienta Q/V/arrastre — mueve un vértice con snap. */
export function moveVertexTo(state: EditorState, id: string, x: number, z: number): boolean {
  return state.moveVertex(id, snap(x), snap(z));
}

/** Herramienta W — crea una pared entre a y b, asignando portales solos. */
export function tryCreateWall(
  state: EditorState,
  aId: string,
  bId: string,
  clickX: number,
  clickZ: number,
): { ok: boolean; message?: string; wallId?: string } {
  if (aId === bId) return { ok: false, message: 'Los dos extremos son el mismo vértice' };
  if (findWall(state, aId, bId)) return { ok: false, message: 'Ya existe una pared entre esos vértices' };

  const front = findSectorAt(state, clickX, clickZ);
  if (!front) return { ok: false, message: 'La pared debe apoyarse en un sector' };

  // Portal: si otro sector comparte la arista, es el sector trasero.
  const back = sectorsSharingEdge(state, aId, bId).find((id) => id !== front) ?? null;

  return { ok: true, wallId: state.addWall(aId, bId, front, back).id };
}

/**
 * Herramienta S — cierra un sector con los vértices dados (en cualquier
 * orden): ordena el polígono por ángulo alrededor del centroide y crea sus
 * paredes de borde (con portales automáticos a sectores vecinos).
 */
export function closeSector(
  state: EditorState,
  vertexIds: string[],
): { ok: boolean; message?: string; sectorId?: string } {
  const unique = [...new Set(vertexIds)].filter((id) => state.getVertex(id));
  if (unique.length < 3) {
    return { ok: false, message: 'Un sector necesita al menos 3 vértices' };
  }

  // Respetar el orden en el que el usuario dibujó los vértices
  // (es vital para polígonos cóncavos, el ordenamiento por centroide los rompe)
  const ordered = unique;

  // Rechazar un sector que ya existe (mismo conjunto de vértices)
  const keyOf = (ids: string[]) => [...ids].sort().join('|');
  const newKey = keyOf(ordered);
  if (state.world.sectors.some((s) => keyOf(s.vertexIds) === newKey)) {
    return { ok: false, message: 'Esa habitación ya existe' };
  }

  const sector = state.addSector(ordered);
  const sectorId = sector.id;

  // Paredes de borde: el front siempre es el nuevo sector; el back es el
  // sector vecino que comparte la arista (si lo hay → portal).
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i]!;
    const b = ordered[(i + 1) % ordered.length]!;
    if (findWall(state, a, b)) continue;
    const back = sectorsSharingEdge(state, a, b).find((id) => id !== sectorId) ?? null;
    state.addWall(a, b, sectorId, back);
  }

  return { ok: true, sectorId };
}

/**
 * Herramienta H — cambia la altura de piso (isCeil=false) o techo (isCeil=true)
 * de un sector. delta en unidades (positivo sube, negativo baja).
 */
export function changeSectorHeight(state: EditorState, sectorId: string, delta: number, isCeil: boolean): boolean {
  const s = state.getSector(sectorId);
  if (!s) return false;
  const floor = typeof s.floorH === 'number' ? s.floorH : 0;
  const ceil = typeof s.ceilH === 'number' ? s.ceilH : 3;
  const { floor: nf, ceil: nc } = clampFloorCeil(
    isCeil ? floor : floor + delta,
    isCeil ? ceil + delta : ceil,
    isCeil ? 'ceil' : 'floor',
  );
  state.setFloorHeight(sectorId, nf);
  state.setCeilHeight(sectorId, nc);
  return true;
}

/** Herramienta E — coloca un sprite en (x, z) con snap. */
export function placeSpriteAt(state: EditorState, x: number, z: number, tex?: string): string {
  return state.addSprite(tex ?? defaultSpriteTex(state), snap(x), snap(z), 0).id;
}

/** Herramienta Q/E — mueve un sprite con snap (mantiene su altura actual). */
export function moveSpriteTo(state: EditorState, id: string, x: number, z: number): boolean {
  const sp = state.world.sprites.find((s) => s.id === id);
  if (!sp) return false;
  return state.moveSprite(id, snap(x), snap(z), sp.pos.z);
}