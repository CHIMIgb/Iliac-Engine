/**
 * picking.ts — hit-test puro de las herramientas de edición.
 *
 * NO importa Three.js: recibe estructuras de datos simples (puntos en pantalla,
 * puntos del mundo, polígonos) y devuelve qué objeto está bajo el cursor o
 * coordenadas ajustadas al grid. Testeable aislado.
 *
 * Nota de ejes: en el mundo del Studio un vértice es { x, y } donde y es
 * profundidad. En Three.js el plano del suelo es XZ, así que al proyectar a
 * pantalla se usa (v.x, altura, v.y). Aquí trabajamos con el plano XY del
 * mundo (suelo) y con puntos de pantalla 2D ya proyectados por el viewport.
 */

export interface ScreenPoint { x: number; y: number; }
export interface ScreenVertex extends ScreenPoint { id: string; }
/** Pared proyectada a pantalla (segmento entre sus dos vértices). */
export interface ScreenWall {
  id: string;
  x1: number; y1: number;
  x2: number; y2: number;
}
/** Sprite proyectado a pantalla como punto (ancla). */
export interface ScreenSprite extends ScreenPoint { id: string; }
/** Polygono en coordenadas de mundo (plano suelo). */
export interface PolygonPoint { x: number; y: number; }

export const PICK_VERTEX_TOL = 10; // px
export const PICK_WALL_TOL = 8;    // px
export const PICK_SPRITE_TOL = 12; // px
export const GRID = 0.5;           // unidades del snap por defecto
export const MIN_ROOM_HEIGHT = 2;   // altura mínima entre piso y techo (metros)
export const MAX_ROOM_HEIGHT = 60;  // límite superior del techo (metros)

// ── Geometría básica ─────────────────────────────────────────────

/** Distancia euclidiana entre dos puntos. */
export function dist2D(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Distancia de un punto a un segmento (px,py → (x1,y1)-(x2,y2)). */
export function pointToSegmentDist(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return dist2D(px, py, x1, y1);
  // t = proyección del punto sobre el segmento, clamp a [0,1]
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  return dist2D(px, py, x1 + t * dx, y1 + t * dy);
}

/** Lado del punto respecto al segmento dirigido (signo del cross product). */
export function sideOfSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  return (bx - ax) * (py - ay) - (by - ay) * (px - ax);
}

// ── Hit-test ────────────────────────────────────────────────────

/** Devuelve el id del vértice proyectado más cercano dentro de la tolerancia (o null). */
export function pickVertex(px: number, py: number, verts: ScreenVertex[], tol = PICK_VERTEX_TOL): string | null {
  let best: string | null = null;
  let bestD = tol;
  for (const v of verts) {
    const d = dist2D(px, py, v.x, v.y);
    if (d <= bestD) { best = v.id; bestD = d; }
  }
  return best;
}

/** Devuelve el id de la pared proyectada más cercana dentro de la tolerancia (o null). */
export function pickWall(px: number, py: number, walls: ScreenWall[], tol = PICK_WALL_TOL): string | null {
  let best: string | null = null;
  let bestD = tol;
  for (const w of walls) {
    const d = pointToSegmentDist(px, py, w.x1, w.y1, w.x2, w.y2);
    if (d <= bestD) { best = w.id; bestD = d; }
  }
  return best;
}

/** Devuelve el id del sprite proyectado más cercano dentro de la tolerancia (o null). */
export function pickSprite(px: number, py: number, sprites: ScreenSprite[], tol = PICK_SPRITE_TOL): string | null {
  let best: string | null = null;
  let bestD = tol;
  for (const s of sprites) {
    const d = dist2D(px, py, s.x, s.y);
    if (d <= bestD) { best = s.id; bestD = d; }
  }
  return best;
}

/** Point-in-polygon (ray casting) en el plano XY. */
export function pointInPolygon(x: number, y: number, poly: PolygonPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i]?.x ?? 0;
    const yi = poly[i]?.y ?? 0;
    const xj = poly[j]?.x ?? 0;
    const yj = poly[j]?.y ?? 0;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ── Snap y alturas ──────────────────────────────────────────────

/** Redondea un valor al grid. */
export function snap(v: number, grid = GRID): number {
  return Math.round(v / grid) * grid;
}

/**
 * Ajusta floor/ceil para que el piso nunca pase del techo, manteniendo un
 * mínimo de altura (2 m) y un límite máximo del techo (60 m).
 * `which` indica qué lado se está editando (el otro queda fijo):
 * 'floor' baja el piso si es necesario; 'ceil' sube el techo.
 */
export function clampFloorCeil(
  floor: number,
  ceil: number,
  which: 'floor' | 'ceil' = 'floor',
): { floor: number; ceil: number } {
  // Límite superior del techo
  if (ceil > MAX_ROOM_HEIGHT) ceil = MAX_ROOM_HEIGHT;
  if (which === 'ceil') {
    if (ceil < floor + MIN_ROOM_HEIGHT) ceil = Math.min(MAX_ROOM_HEIGHT, floor + MIN_ROOM_HEIGHT);
  } else {
    if (floor > ceil - MIN_ROOM_HEIGHT) floor = ceil - MIN_ROOM_HEIGHT;
  }
  // El piso nunca puede superar (MAX - MIN) para que siempre quepa el mínimo
  if (floor > MAX_ROOM_HEIGHT - MIN_ROOM_HEIGHT) floor = MAX_ROOM_HEIGHT - MIN_ROOM_HEIGHT;
  return { floor, ceil };
}