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
import type { EntityDef } from '../entities/entityCatalog';

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

/**
 * Herramienta E (Entidades) — coloca una entidad del catálogo en (x, z).
 * Usa la textura del catálogo si existe en el proyecto; si no, cae a la
 * textura de sprite por defecto (el cubo de preview del editor es lo que
 * representa la entidad hasta que se importe su sprite).
 */
export function placeEntityAt(
  state: EditorState,
  x: number,
  z: number,
  def: EntityDef,
): string {
  const tex = state.world.textures[def.tex] ? def.tex : defaultSpriteTex(state);
  return state.addSprite(tex, snap(x), snap(z), 0, undefined, {
    entityType: def.id,
    entityName: def.name,
    collisionType: def.collisionType,
    collisionBox: { ...def.collisionBox },
  }).id;
}

/** Herramienta Q/E — mueve un sprite con snap (mantiene su altura actual). */
export function moveSpriteTo(state: EditorState, id: string, x: number, z: number): boolean {
  const sp = state.world.sprites.find((s) => s.id === id);
  if (!sp) return false;
  return state.moveSprite(id, snap(x), snap(z), sp.pos.z);
}

// ── Traslación (herramienta Mover) ─────────────────────────────

/** Objeto seleccionable para la herramienta Mover. */
export interface TranslateTarget {
  kind: 'vertex' | 'wall' | 'sector' | 'sprite';
  id: string;
}

/**
 * Mover — traduce el conjunto de objetos a los vértices/sprites que hay que
 * trasladar para desplazarlos rígidamente: vértice→él mismo, pared→sus 2
 * extremos, sector→todos sus vértices; el sprite se traslada por su propia
 * posición en el plano.
 */
export function collectTranslateTargets(
  state: EditorState,
  objects: readonly TranslateTarget[],
): { vertexIds: string[]; spriteIds: string[] } {
  const vertexIds = new Set<string>();
  const spriteIds = new Set<string>();
  for (const o of objects) {
    if (o.kind === 'vertex') vertexIds.add(o.id);
    if (o.kind === 'wall') {
      const w = state.world.walls.find((ww) => ww.id === o.id);
      if (w) {
        vertexIds.add(w.a);
        vertexIds.add(w.b);
      }
    }
    if (o.kind === 'sector') {
      const s = state.getSector(o.id);
      if (s) for (const vid of s.vertexIds) vertexIds.add(vid);
    }
    if (o.kind === 'sprite') spriteIds.add(o.id);
  }
  return { vertexIds: [...vertexIds], spriteIds: [...spriteIds] };
}

// ── Terreno (herramienta Terreno) ──────────────────────────────

/**
 * Herramienta Terreno (7) — coloca un suelo plano de size×size metros
 * (celda = 1 m, alineado a la cuadrícula del editor) con la esquina inferior-
 * izquierda en (x, z). Sin relieves, sin paredes y con techo alto (50 m, luz
 * de cielo): solo el piso, elevado al piso del sector bajo el clic.
 * Todo el terreno es UN ÚNICO sector cuadrado de 4 vértices: así la
 * herramienta Mover lo traslada completo como una pieza.
 *
 * @returns Conteo de sectores y base de elevación.
 */
export function placeTerrainAt(
  state: EditorState,
  x: number,
  z: number,
  size: number,
  floorTex = 'grass',
): { sectorCount: number; base: number } {
  const offX = Math.round(x); // alinear a las celdas de 1 m del grid
  const offZ = Math.round(z);

  // Piso del sector bajo el clic → base de elevación del suelo plano.
  let base = 0;
  const under = findSectorAt(state, offX, offZ);
  if (under) {
    const fh = state.getSector(under)?.floorH;
    base = typeof fh === 'number' ? fh : (Array.isArray(fh) ? fh[0] : 0) ?? 0;
  }

  // Un único sector cuadrado con sus 4 esquinas, de size×size metros.
  const a = state.addVertex(offX, offZ);
  const b = state.addVertex(offX + size, offZ);
  const c = state.addVertex(offX + size, offZ + size);
  const d = state.addVertex(offX, offZ + size);
  const sector = state.addSector(
    [a.id, b.id, c.id, d.id],
    base, // piso plano
    50,   // techo alto: no estorba (el motor exige ceilH; 50 m = cielo)
    undefined,
    { floorTex },
  );
  // Marcar el sector como terreno: el modo "moldear" de la herramienta solo
  // actúa sobre ids con prefijo `terr_` (no sobre salas/mazmorras).
  sector.id = `terr_${sector.id}`;

  return { sectorCount: 1, base };
}