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
import { createNoise, fbm2 } from '@engine/core/noise.js';

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
  // Terreno: capturar cualquier pieza de una colocación (vértice o celda)
  // traslada TODOS sus vértices — el terreno se mueve completo como una pieza
  // aunque sea una grilla de celdas con vértices compartidos.
  const placements = new Set<string>();
  for (const o of objects) {
    const m = /^(terr_.+?)_[vs]\d+_\d+$/.exec(o.id);
    if (m) placements.add(`${m[1]}_`);
  }
  if (placements.size > 0) {
    for (const v of state.world.vertices) {
      for (const p of placements) if (v.id.startsWith(p)) vertexIds.add(v.id);
    }
  }
  return { vertexIds: [...vertexIds], spriteIds: [...spriteIds] };
}

// ── Terreno (herramienta Terreno) ──────────────────────────────

/** Tamaño de celda del terreno en metros (0,5 m: doble densidad = curva casi continua).
 * ponytail: 32 m → 4096 celdas; si el pincel va a tirones, batching de notify
 * (un rebuild por frame) antes de bajar de 0,5 m otra vez. */
export const TERRAIN_CELL = 0.5;
/** Radio del pincel de esculpido (m). */
export const TERRAIN_BRUSH_RADIUS = 3;

/**
 * Vértices INTERIORES de la grilla de terreno (todos menos las 4 esquinas de
 * cada colocación). El editor los oculta en dibujo y picking para que la
 * grilla se vea limpia; siguen existiendo en los datos para el pincel.
 */
export function hiddenTerrainVertices(state: EditorState): Set<string> {
  // Una sola pasada con regex: se guardan las coordenadas de grilla (c, r)
  // junto al id para no recompilar patrones por vértice (esto corre por
  // frame en el overlay y el picking).
  const placements = new Map<string, { verts: { id: string; c: number; r: number }[]; maxC: number; maxR: number }>();
  for (const v of state.world.vertices) {
    const m = /^(terr_.+?)_v(\d+)_(\d+)$/.exec(v.id);
    if (!m) continue;
    const pfx = m[1]!;
    const c = Number(m[2]);
    const r = Number(m[3]);
    let e = placements.get(pfx);
    if (!e) { e = { verts: [], maxC: 0, maxR: 0 }; placements.set(pfx, e); }
    e.verts.push({ id: v.id, c, r });
    if (c > e.maxC) e.maxC = c;
    if (r > e.maxR) e.maxR = r;
  }
  const hidden = new Set<string>();
  for (const e of placements.values()) {
    for (const { id, c, r } of e.verts) {
      const corner = (c === 0 || c === e.maxC) && (r === 0 || r === e.maxR);
      if (!corner) hidden.add(id);
    }
  }
  return hidden;
}

/** Altura de piso de un sector (número o array por vértice) en el índice dado. */
function floorAt(s: { floorH: number | number[] }, i: number): number {
  if (Array.isArray(s.floorH)) return s.floorH[i] ?? 0;
  return typeof s.floorH === 'number' ? s.floorH : 0;
}

/**
 * Herramienta Terreno (7) — coloca un suelo plano de size×size metros como
 * GRILLA de celdas de TERRAIN_CELL m que comparten vértices (el mismo formato
 * que engine/core/terrain.js, con floorH por vértice), alineada a la
 * cuadrícula y elevada a la base del sector bajo el clic. Sin relieves
 * iniciales, sin paredes y con techo alto (50 m).
 *
 * La grilla es lo que permite el pincel de esculpido (sculptTerrainAt): sin
 * vértices intermedios no se puede elevar una zona local. La herramienta
 * Mover compensa moviendo la colocación completa como una pieza (ver
 * collectTranslateTargets).
 *
 * Ids con namespace por colocación: vértices `terr_<gen>_v{c}_{r}`, celdas
 * `terr_<gen>_s{c}_{r}`.
 *
 * @returns Conteo de celdas (sectores) y base de elevación.
 */
export function placeTerrainAt(
  state: EditorState,
  x: number,
  z: number,
  size: number,
  floorTex = 'grass',
  cell = TERRAIN_CELL,
): { sectorCount: number; base: number } {
  // Celda limitada a 0,5–2 m: por debajo, el coste O(celdas²) se descontrola.
  const cs = Math.min(Math.max(cell, 0.5), 2);
  const offX = Math.round(x); // alinear a las celdas de 1 m del grid
  const offZ = Math.round(z);

  // Piso del sector bajo el clic → base de elevación del suelo plano.
  let base = 0;
  const under = findSectorAt(state, offX, offZ);
  if (under) {
    const fh = state.getSector(under)?.floorH;
    base = typeof fh === 'number' ? fh : (Array.isArray(fh) ? fh[0] : 0) ?? 0;
  }

  const cells = Math.max(1, Math.round(size / cs));
  const step = size / cells;

  // El id del primer vértice generado da un namespace único por colocación.
  const v00 = state.addVertex(offX, offZ);
  const pfx = `terr_${v00.id}`;
  v00.id = `${pfx}_v0_0`;

  // Grilla de vértices compartidos: (cells+1)×(cells+1)
  const grid: string[][] = [];
  for (let r = 0; r <= cells; r++) {
    const row: string[] = [];
    for (let c = 0; c <= cells; c++) {
      if (r === 0 && c === 0) { row[c] = v00.id; continue; }
      const v = state.addVertex(offX + c * step, offZ + r * step);
      v.id = `${pfx}_v${c}_${r}`;
      row[c] = v.id;
    }
    grid.push(row);
  }

  // Una celda = un sector, mismo orden de vértices que el motor (SW,SE,NE,NW)
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      state.addSector(
        [grid[r]![c]!, grid[r]![c + 1]!, grid[r + 1]![c + 1]!, grid[r + 1]![c]!],
        [base, base, base, base],
        50,
        `${pfx}_s${c}_${r}`,
        { floorTex },
      );
    }
  }

  return { sectorCount: cells * cells, base };
}

/** Rectángulo (en coordenadas de mundo XZ) ocupado por cada colocación de terreno. */
export interface TerrainFootprint {
  prefix: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Huellas rectangulares de todos los terrenos colocados (una por `terr_<gen>`). */
export function terrainFootprints(state: EditorState): TerrainFootprint[] {
  const map = new Map<string, TerrainFootprint>();
  for (const v of state.world.vertices) {
    const m = /^(terr_.+?)_v\d+_\d+$/.exec(v.id);
    if (!m) continue;
    const pfx = m[1]!;
    const fp = map.get(pfx);
    if (!fp) {
      map.set(pfx, { prefix: pfx, minX: v.x, minY: v.y, maxX: v.x, maxY: v.y });
    } else {
      fp.minX = Math.min(fp.minX, v.x);
      fp.minY = Math.min(fp.minY, v.y);
      fp.maxX = Math.max(fp.maxX, v.x);
      fp.maxY = Math.max(fp.maxY, v.y);
    }
  }
  return [...map.values()];
}

function rectsOverlap(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY;
}

/**
 * Idea 4: un terreno NUNCA se solapa con otro. Si el rectángulo propuesto
 * intersecta una huella existente, se desliza al borde más cercano hasta
 * quedar ADYACENTE (pegado, compartiendo borde, sin solapar). Devuelve la
 * posición resuelta o null si tras `maxTries` desplazamientos no hay lado
 * libre (zona saturada de terrenos).
 */
export function resolveTerrainPlacement(
  state: EditorState,
  x: number,
  z: number,
  size: number,
  maxTries = 8,
): { x: number; z: number; adjacent: boolean } | null {
  const fps = terrainFootprints(state);
  let offX = Math.round(x);
  let offZ = Math.round(z);
  let adjacent = false;
  for (let i = 0; i < maxTries; i++) {
    const rect = { minX: offX, minY: offZ, maxX: offX + size, maxY: offZ + size };
    const hit = fps.find((f) => rectsOverlap(rect, f));
    if (!hit) return { x: offX, z: offZ, adjacent };
    // Deslizar por el borde más corto hacia el exterior de la huella ocupada.
    const dl = offX - (hit.minX - size); // hacia la izquierda
    const dr = hit.maxX - offX;          // hacia la derecha
    const db = offZ - (hit.minY - size); // hacia abajo
    const dt = hit.maxY - offZ;          // hacia arriba
    const best = Math.min(dl, dr, db, dt);
    if (best === dr) offX = hit.maxX;
    else if (best === dl) offX = hit.minX - size;
    else if (best === dt) offZ = hit.maxY;
    else offZ = hit.minY - size;
    adjacent = true;
  }
  return null;
}

/**
 * Pincel de esculpido del terreno (herramienta Terreno, modo moldear):
 * eleva (delta > 0) o hunde (delta < 0) SOLO los vértices de terreno a
 * `radius` metros del punto (x, z), con decaimiento cosenoidal suave (1 en
 * el centro del pincel → 0 en el borde). Cada vértice compartido se escribe
 * con la misma altura en TODAS las celdas que lo referencian, manteniendo la
 * malla estanca (sin grietas entre celdas).
 *
 * @returns Número de celdas modificadas (0 si el pincel no tocó terreno).
 */
export function sculptTerrainAt(
  state: EditorState,
  x: number,
  z: number,
  delta: number,
  radius = TERRAIN_BRUSH_RADIUS,
): number {
  const cells = state.world.sectors.filter((s) => s.id.startsWith('terr_'));
  if (cells.length === 0) return 0;

  // Nueva altura por vértice (se lee de su primera celda: están coherentes).
  const next = new Map<string, number>();
  for (const s of cells) {
    s.vertexIds.forEach((vid, i) => {
      if (next.has(vid)) return;
      const v = state.getVertex(vid);
      if (!v) return;
      const cur = floorAt(s, i);
      const d = Math.hypot(v.x - x, v.y - z);
      if (d >= radius) { next.set(vid, cur); return; } // fuera del pincel: intacto
      const fall = 0.5 + 0.5 * Math.cos((Math.PI * d) / radius);
      const ceil = typeof s.ceilH === 'number' ? s.ceilH : 50;
      next.set(vid, clampFloorCeil(cur + delta * fall, ceil, 'floor').floor);
    });
  }

  let touched = 0;
  for (const s of cells) {
    const cur = s.vertexIds.map((_, i) => floorAt(s, i));
    const arr = s.vertexIds.map((vid) => next.get(vid) ?? 0);
    // ponytail: un notify por celda tocada (~9/frame); batching si el viewport va lento.
    if (arr.some((h, i) => h !== cur[i])) { state.setFloorHeight(s.id, arr); touched++; }
  }
  return touched;
}

/**
 * Relieve "realista" determinista sobre un terreno ya colocado: elevaciones
 * y hundimientos con el mismo ruido FBM del motor (engine/core/noise.js).
 * La altura se calcula POR VÉRTICE y se escribe en todas sus celdas → malla
 * estanca. Semilla fija ⇒ mismo paisaje en cada arranque.
 */
export function applyTerrainRelief(
  state: EditorState,
  opts: { seed?: number; scale?: number; amplitude?: number } = {},
): number {
  const { seed = 1337, scale = 0.045, amplitude = 7 } = opts;
  const noise = createNoise(seed);
  const cells = state.world.sectors.filter((s) => s.id.startsWith('terr_'));
  if (cells.length === 0) return 0;
  const h = new Map<string, number>();
  for (const s of cells) {
    for (const vid of s.vertexIds) {
      if (h.has(vid)) continue;
      const v = state.getVertex(vid);
      if (!v) continue;
      const n = fbm2(noise, v.x * scale, v.y * scale, { octaves: 4, lacunarity: 2, gain: 0.5 });
      const cur = floorAt(s, s.vertexIds.indexOf(vid));
      h.set(vid, Math.round((cur + n * amplitude) * 100) / 100);
    }
  }
  for (const s of cells) {
    const arr = s.vertexIds.map((vid) => h.get(vid) ?? 0);
    if (arr.some((v, i) => v !== floorAt(s, i))) state.setFloorHeight(s.id, arr);
  }
  return h.size;
}