import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  pointInPolygon,
  pointInSector,
  getSectorAt,
  getFloorHeightAt,
  getCeilHeightAt,
  getSolidWalls,
  distancePointToSegment,
  buildSectorIndex,
} from '../../engine/core/sector.js';
import { project } from '../../demo/project-sector.js';

test('pointInPolygon detecta interior de cuadrado', () => {
  const poly = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
  ];
  assert.ok(pointInPolygon(poly, 2, 2), 'centro dentro');
  assert.ok(!pointInPolygon(poly, 5, 2), 'fuera a la derecha');
  assert.ok(!pointInPolygon(poly, -1, 2), 'fuera a la izquierda');
});

test('pointInSector localiza punto dentro de sector s0', () => {
  const s0 = project.world.sectors[0];
  assert.ok(pointInSector(project.world, s0, 1, 1), 'dentro de s0');
  assert.ok(!pointInSector(project.world, s0, 5, 1), 'fuera de s0 (en s1)');
});

test('getSectorAt encuentra el sector correcto', () => {
  assert.equal(getSectorAt(project.world, 1, 1)?.id, 's0');
  assert.equal(getSectorAt(project.world, 5, 1)?.id, 's1');
  assert.equal(getSectorAt(project.world, 9, 1)?.id, 's2');
  assert.equal(getSectorAt(project.world, -1, -1), null);
});

test('getFloorHeightAt respeta slope de sector s1', () => {
  const s1 = project.world.sectors[1];
  const h0 = getFloorHeightAt(project.world, s1, 4, 2);
  const h1 = getFloorHeightAt(project.world, s1, 8, 2);
  assert.ok(h1 > h0, 'la rampa sube hacia +x');
  assert.ok(Math.abs(h1 - h0 - 1.0) < 0.01, 'subida total ~1.0');
});

test('getFloorHeightAt devuelve floorH plano sin slope', () => {
  const s0 = project.world.sectors[0];
  assert.equal(getFloorHeightAt(project.world, s0, 2, 2), 0.0);
});

test('getCeilHeightAt devuelve altura de techo', () => {
  const s0 = project.world.sectors[0];
  assert.equal(getCeilHeightAt(project.world, s0, 2, 2), 3.0);
});

test('getSolidWalls omite portales', () => {
  const solids = getSolidWalls(project.world, 's0');
  assert.equal(solids.length, 3, 's0 tiene 3 paredes sólidas (1 es portal)');
});

test('buildSectorIndex crea mapa de vértices y paredes por sector', () => {
  const { vertexMap, wallsBySector } = buildSectorIndex(project.world);
  assert.ok(vertexMap.has('v0'));
  assert.equal(wallsBySector.get('s0').length, 4);
});

test('distancePointToSegment calcula distancia mínima', () => {
  const a = { x: 0, y: 0 };
  const b = { x: 4, y: 0 };
  assert.equal(distancePointToSegment(2, 3, a, b), 3);
  assert.equal(distancePointToSegment(-1, 0, a, b), 1);
  assert.equal(distancePointToSegment(5, 0, a, b), 1);
});
