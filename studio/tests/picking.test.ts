import { describe, it, expect } from 'vitest';
import {
  dist2D,
  pointToSegmentDist,
  sideOfSegment,
  pickVertex,
  pickWall,
  pickSprite,
  pointInPolygon,
  snap,
  clampFloorCeil,
  GRID,
} from '../src/tools/picking';
import type { ScreenVertex, ScreenWall, ScreenSprite } from '../src/tools/picking';

describe('picking · geometría', () => {
  it('dist2D calcula la distancia euclidiana', () => {
    expect(dist2D(0, 0, 3, 4)).toBeCloseTo(5);
  });

  it('pointToSegmentDist: punto sobre el segmento da 0', () => {
    expect(pointToSegmentDist(5, 5, 0, 0, 10, 0)).toBeCloseTo(5); // perpendicula al punto medio
    expect(pointToSegmentDist(5, 0, 0, 0, 10, 0)).toBeCloseTo(0); // sobre el segmento
  });

  it('pointToSegmentDist: el extremo más cercano fuera del segmento', () => {
    expect(pointToSegmentDist(-5, 0, 0, 0, 10, 0)).toBeCloseTo(5);
    expect(pointToSegmentDist(15, 0, 0, 0, 10, 0)).toBeCloseTo(5);
  });

  it('sideOfSegment distingue lado izquierdo/derecho', () => {
    // Segmento de (0,0) a (10,0): positivo = por encima (y>0)
    expect(sideOfSegment(5, 1, 0, 0, 10, 0)).toBeGreaterThan(0);
    expect(sideOfSegment(5, -1, 0, 0, 10, 0)).toBeLessThan(0);
    expect(sideOfSegment(5, 0, 0, 0, 10, 0)).toBe(0);
  });
});

describe('picking · hit-test', () => {
  const verts: ScreenVertex[] = [
    { id: 'a', x: 10, y: 10 },
    { id: 'b', x: 50, y: 50 },
  ];
  const walls: ScreenWall[] = [
    { id: 'w', x1: 0, y1: 0, x2: 100, y2: 0 },
  ];
  const sprites: ScreenSprite[] = [
    { id: 'sp', x: 30, y: 30 },
  ];

  it('pickVertex encuentra el vértice más cercano dentro de la tolerancia', () => {
    expect(pickVertex(12, 10, verts, 10)).toBe('a');
    expect(pickVertex(45, 45, verts, 10)).toBe('b');
  });

  it('pickVertex devuelve null fuera de la tolerancia', () => {
    expect(pickVertex(40, 10, verts, 10)).toBeNull();
  });

  it('pickWall encuentra la pared por distancia punto-segmento', () => {
    expect(pickWall(50, 3, walls, 8)).toBe('w');
    expect(pickWall(50, 20, walls, 8)).toBeNull();
  });

  it('pickSprite encuentra el sprite más cercano', () => {
    expect(pickSprite(34, 28, sprites, 12)).toBe('sp');
    expect(pickSprite(60, 60, sprites, 12)).toBeNull();
  });

  it('pointInPolygon detecta dentro/fuera en un rectángulo', () => {
    const rect = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(pointInPolygon(5, 5, rect)).toBe(true);
    expect(pointInPolygon(-1, 5, rect)).toBe(false);
    expect(pointInPolygon(5, 11, rect)).toBe(false);
  });

  it('pointInPolygon en polígono cóncavo', () => {
    const L = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 4 },
      { x: 4, y: 4 },
      { x: 4, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(pointInPolygon(2, 2, L)).toBe(true);
    expect(pointInPolygon(7, 7, L)).toBe(false); // hueco de la L
  });
});

describe('picking · snap y alturas', () => {
  it('snap redondea al grid por defecto (0.5)', () => {
    expect(snap(1.23)).toBe(1);
    expect(snap(1.26)).toBe(1.5);
    expect(snap(-1.3)).toBe(-1.5);
    expect(snap(2.0)).toBe(GRID * 4);
  });

  it('clampFloorCeil baja el piso cuando sube demasiado (which=floor)', () => {
    const r = clampFloorCeil(2.95, 3, 'floor'); // piso casi al techo
    expect(r.floor).toBeCloseTo(2.6, 5);
    expect(r.ceil).toBe(3);
    expect(r.ceil - r.floor).toBeCloseTo(0.4, 5);
  });

  it('clampFloorCeil sube el techo cuando baja demasiado (which=ceil)', () => {
    const r = clampFloorCeil(0, 0.2, 'ceil'); // techo casi al piso
    expect(r.floor).toBe(0);
    expect(r.ceil).toBeCloseTo(0.4, 5);
    expect(r.ceil - r.floor).toBeCloseTo(0.4, 5);
  });

  it('clampFloorCeil deja intactas alturas válidas', () => {
    const r = clampFloorCeil(0, 3);
    expect(r).toEqual({ floor: 0, ceil: 3 });
  });
});