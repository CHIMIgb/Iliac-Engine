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

// Fixture inline — mundo de prueba con 5 sectores (réplica del project original)
const world = {
  vertices: [
    { id: 'v0', x: 0, y: 0 },
    { id: 'v1', x: 6, y: 0 },
    { id: 'v2', x: 10, y: 0 },
    { id: 'v3', x: 16, y: 0 },
    { id: 'v4', x: 20, y: 0 },
    { id: 'v5', x: 26, y: 0 },
    { id: 'v6', x: 0, y: 6 },
    { id: 'v7', x: 6, y: 6 },
    { id: 'v8', x: 10, y: 6 },
    { id: 'v9', x: 16, y: 6 },
    { id: 'v10', x: 20, y: 6 },
    { id: 'v11', x: 26, y: 6 },
  ],
  sectors: [
    {
      id: 's0',
      vertexIds: ['v0', 'v1', 'v7', 'v6'],
      floorH: 0.0,
      ceilH: 4.0,
    },
    {
      id: 's1',
      vertexIds: ['v1', 'v2', 'v8', 'v7'],
      floorH: 0.0,
      ceilH: 4.0,
      floorSlope: { axis: 'x', angle: 30 },
    },
    {
      id: 's2',
      vertexIds: ['v2', 'v3', 'v9', 'v8'],
      floorH: 2.31,
      ceilH: 6.0,
    },
    {
      id: 's3',
      vertexIds: ['v3', 'v4', 'v10', 'v9'],
      floorH: 2.31,
      ceilH: 6.0,
      floorSlope: { axis: 'x', angle: -30 },
    },
    {
      id: 's4',
      vertexIds: ['v4', 'v5', 'v11', 'v10'],
      floorH: 0.0,
      ceilH: 4.0,
    },
  ],
  walls: [
    { id: 'w0', a: 'v0', b: 'v1', sectorFront: 's0', sectorBack: null, tex: 'wall' },
    { id: 'w1', a: 'v1', b: 'v7', sectorFront: 's0', sectorBack: 's1', tex: 'wall', portal: true },
    { id: 'w2', a: 'v7', b: 'v6', sectorFront: 's0', sectorBack: null, tex: 'wall' },
    { id: 'w3', a: 'v6', b: 'v0', sectorFront: 's0', sectorBack: null, tex: 'wall' },
    { id: 'w4', a: 'v1', b: 'v2', sectorFront: 's1', sectorBack: null, tex: 'wall' },
    { id: 'w5', a: 'v2', b: 'v8', sectorFront: 's1', sectorBack: 's2', tex: 'wall', portal: true },
    { id: 'w6', a: 'v8', b: 'v7', sectorFront: 's1', sectorBack: null, tex: 'wall' },
    { id: 'w7', a: 'v2', b: 'v3', sectorFront: 's2', sectorBack: null, tex: 'wall' },
    { id: 'w8', a: 'v3', b: 'v9', sectorFront: 's2', sectorBack: 's3', tex: 'wall', portal: true },
    { id: 'w9', a: 'v9', b: 'v8', sectorFront: 's2', sectorBack: null, tex: 'wall' },
    { id: 'w10', a: 'v3', b: 'v4', sectorFront: 's3', sectorBack: null, tex: 'wall' },
    { id: 'w11', a: 'v4', b: 'v10', sectorFront: 's3', sectorBack: 's4', tex: 'wall', portal: true },
    { id: 'w12', a: 'v10', b: 'v9', sectorFront: 's3', sectorBack: null, tex: 'wall' },
    { id: 'w13', a: 'v4', b: 'v5', sectorFront: 's4', sectorBack: null, tex: 'wall' },
    { id: 'w14', a: 'v5', b: 'v11', sectorFront: 's4', sectorBack: null, tex: 'wall' },
    { id: 'w15', a: 'v11', b: 'v10', sectorFront: 's4', sectorBack: null, tex: 'wall' },
  ],
};

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
  const s0 = world.sectors[0];
  assert.ok(pointInSector(world, s0, 1, 1), 'dentro de s0');
  assert.ok(!pointInSector(world, s0, 7, 1), 'fuera de s0 (en s1)');
});

test('getSectorAt encuentra el sector correcto', () => {
  assert.equal(getSectorAt(world, 1, 1)?.id, 's0');
  assert.equal(getSectorAt(world, 7, 1)?.id, 's1');
  assert.equal(getSectorAt(world, 12, 1)?.id, 's2');
  assert.equal(getSectorAt(world, 18, 1)?.id, 's3');
  assert.equal(getSectorAt(world, 22, 1)?.id, 's4');
  assert.equal(getSectorAt(world, -1, -1), null);
});

test('getFloorHeightAt respeta slope de sector s1', () => {
  const s1 = world.sectors[1];
  const h0 = getFloorHeightAt(world, s1, 6, 2);
  const h1 = getFloorHeightAt(world, s1, 10, 2);
  assert.ok(h1 > h0, 'la rampa sube hacia +x');
  assert.ok(Math.abs(h1 - h0 - 2.31) < 0.01, 'subida total ~2.31 (30° sobre 4u)');
});

test('getFloorHeightAt devuelve floorH plano sin slope', () => {
  const s0 = world.sectors[0];
  assert.equal(getFloorHeightAt(world, s0, 2, 2), 0.0);
});

test('getCeilHeightAt devuelve altura de techo', () => {
  const s0 = world.sectors[0];
  assert.equal(getCeilHeightAt(world, s0, 2, 2), 4.0);
});

test('getSolidWalls omite portales', () => {
  const solids = getSolidWalls(world, 's0');
  assert.equal(solids.length, 3, 's0 tiene 3 paredes sólidas (1 es portal)');
});

test('buildSectorIndex crea mapa de vértices y paredes por sector', () => {
  const { vertexMap, wallsBySector } = buildSectorIndex(world);
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
