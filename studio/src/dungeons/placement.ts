/**
 * Colocación de mazmorras: busca el punto de inserción alineado a la
 * cuadrícula del editor (GRID = 0.5), empezando por el centro (0,0) y
 * expandiéndose en espiral cuadrada hasta encontrar un hueco libre.
 *
 * # ponytail: detección de ocupado por AABB de sectores; pasar a
 * punto-en-polígono (picking.ts) si algún día se exige densidad máxima.
 */

import type { EditorState } from '../editor/EditorState';
import type { AssembledDungeon } from './types';

/** Tamaño de celda de los bloques (16) — coincide con blocks.ts y assemble.ts. */
const CELL = 16;

/** Límite de búsqueda: anillos de 16u → radio máximo 640u. */
const MAX_RING = 40;

interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function sectorBounds(
  vertices: readonly { id: string; x: number; y: number }[],
  vertexIds: readonly string[],
): Bounds | null {
  let b: Bounds | null = null;
  for (const id of vertexIds) {
    const v = vertices.find((v) => v.id === id);
    if (!v) continue;
    if (!b) {
      b = { minX: v.x, minY: v.y, maxX: v.x, maxY: v.y };
    } else {
      b.minX = Math.min(b.minX, v.x);
      b.minY = Math.min(b.minY, v.y);
      b.maxX = Math.max(b.maxX, v.x);
      b.maxY = Math.max(b.maxY, v.y);
    }
  }
  return b;
}

function overlaps(a: Bounds, b: Bounds): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

function shifted(b: Bounds, ox: number, oy: number): Bounds {
  return { minX: b.minX + ox, minY: b.minY + oy, maxX: b.maxX + ox, maxY: b.maxY + oy };
}

/** Puntos del perímetro de un anillo cuadrado (paso CELL, alineado a GRID). */
function ringPoints(radius: number): [number, number][] {
  const s = radius * CELL;
  const pts: [number, number][] = [];
  for (let x = -s; x < s; x += CELL) pts.push([x, -s]);       // abajo
  for (let y = -s; y < s; y += CELL) pts.push([s, y]);        // derecha
  for (let x = s; x > -s; x -= CELL) pts.push([x, s]);        // arriba
  for (let y = s; y > -s; y -= CELL) pts.push([-s, y]);       // izquierda
  return pts;
}

/**
 * Devuelve el offset de inserción para una mazmorra: (0,0) si está libre;
 * si no, el primer hueco en espiral donde ningún sector de la mazmorra
 * solape un sector del mundo. `null` si no hay hueco dentro del radio límite.
 */
export function findSpot(
  state: EditorState,
  dun: AssembledDungeon,
): { x: number; y: number } | null {
  const dunBounds = dun.sectors
    .map((s) => sectorBounds(dun.vertices, s.vertexIds))
    .filter((b): b is Bounds => b !== null);
  const worldBounds = state.world.sectors
    .map((s) => sectorBounds(state.world.vertices, s.vertexIds))
    .filter((b): b is Bounds => b !== null);

  const freeAt = (ox: number, oy: number): boolean =>
    !dunBounds.some((db) => worldBounds.some((wb) => overlaps(shifted(db, ox, oy), wb)));

  if (freeAt(0, 0)) return { x: 0, y: 0 };
  for (let ring = 1; ring <= MAX_RING; ring++) {
    for (const [ox, oy] of ringPoints(ring)) {
      if (freeAt(ox, oy)) return { x: ox, y: oy };
    }
  }
  return null;
}