import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSectorFloorGeometry,
  createSectorCeilingGeometry,
  createWallGeometry,
} from '../../engine/three/SectorGeometry.js';

function getNormal(geo, i) {
  const n = geo.attributes.normal.array;
  return [n[i * 3], n[i * 3 + 1], n[i * 3 + 2]];
}

// Fixture inline — mundo de prueba con sectores de geometría conocida
const world = {
  vertices: [
    { id: 'v0', x: 0, y: 0 },
    { id: 'v1', x: 6, y: 0 },
    { id: 'v2', x: 10, y: 0 },
    { id: 'v3', x: 16, y: 0 },
    { id: 'v6', x: 0, y: 6 },
    { id: 'v7', x: 6, y: 6 },
    { id: 'v8', x: 10, y: 6 },
    { id: 'v9', x: 16, y: 6 },
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
  ],
  walls: [
    { id: 'w0', a: 'v0', b: 'v1', sectorFront: 's0', sectorBack: null, tex: 'wall' },
    { id: 'w1', a: 'v1', b: 'v7', sectorFront: 's0', sectorBack: 's1', tex: 'wall', portal: true },
    { id: 'w2', a: 'v7', b: 'v6', sectorFront: 's0', sectorBack: null, tex: 'wall' },
    { id: 'w3', a: 'v6', b: 'v0', sectorFront: 's0', sectorBack: null, tex: 'wall' },
  ],
};

test('createSectorFloorGeometry genera geometría con vértices correctos', () => {
  const s0 = world.sectors[0];
  const geo = createSectorFloorGeometry(world, s0);
  assert.ok(geo.attributes.position, 'tiene posiciones');
  assert.equal(geo.attributes.position.count, 4, '4 vértices para cuadrado');
  assert.equal(geo.index.count, 6, '2 triángulos = 6 índices');
});

test('createSectorFloorGeometry aplica slope al piso', () => {
  const s1 = world.sectors[1];
  const geo = createSectorFloorGeometry(world, s1);
  const pos = geo.attributes.position.array;
  // vértice 0 en x=6, vértice 1 en x=10
  const yAt6 = pos[0 * 3 + 1];
  const yAt10 = pos[1 * 3 + 1];
  assert.ok(yAt10 > yAt6, 'la altura aumenta hacia +x');
  assert.ok(Math.abs(yAt10 - yAt6 - 2.31) < 0.01, 'subida ~2.31');
});

test('createSectorCeilingGeometry invierte índices para normal hacia abajo', () => {
  const s0 = world.sectors[0];
  const geo = createSectorCeilingGeometry(world, s0);
  assert.equal(geo.attributes.position.count, 4);
  assert.equal(geo.index.count, 6);
  // Verificar que los índices no son idénticos al floor (están invertidos)
  const floorGeo = createSectorFloorGeometry(world, s0);
  const ceilIdx = Array.from(geo.index.array);
  const floorIdx = Array.from(floorGeo.index.array);
  assert.notDeepEqual(ceilIdx, floorIdx, 'índices de techo invertidos');
});

test('createWallGeometry genera quad vertical con 4 vértices', () => {
  const wall = world.walls[0];
  const s0 = world.sectors[0];
  const geo = createWallGeometry(wall, world, s0);
  assert.ok(geo);
  assert.equal(geo.attributes.position.count, 4);
  assert.equal(geo.index.count, 6);
});

test('createWallGeometry devuelve null si falta un vértice', () => {
  const badWall = { a: 'no-existe', b: 'v1', sectorFront: 's0' };
  const s0 = world.sectors[0];
  assert.equal(createWallGeometry(badWall, world, s0), null);
});

test('createSectorFloorGeometry usa normal analítica (0,1,0) para piso plano', () => {
  const geo = createSectorFloorGeometry(world, world.sectors[0]);
  for (let i = 0; i < geo.attributes.position.count; i++) {
    const n = getNormal(geo, i);
    assert.ok(
      Math.abs(n[0]) < 1e-6 && Math.abs(n[1] - 1) < 1e-6 && Math.abs(n[2]) < 1e-6,
      `vértice ${i} tiene normal (0,1,0)`
    );
  }
});

test('createSectorCeilingGeometry usa normal analítica (0,-1,0) para techo plano', () => {
  const geo = createSectorCeilingGeometry(world, world.sectors[0]);
  for (let i = 0; i < geo.attributes.position.count; i++) {
    const n = getNormal(geo, i);
    assert.ok(
      Math.abs(n[0]) < 1e-6 && Math.abs(n[1] + 1) < 1e-6 && Math.abs(n[2]) < 1e-6,
      `vértice ${i} tiene normal (0,-1,0)`
    );
  }
});

test('createSectorFloorGeometry usa normal analítica en piso inclinado', () => {
  const geo = createSectorFloorGeometry(world, world.sectors[1]);
  const n = getNormal(geo, 0);
  const len = Math.hypot(...n);
  assert.ok(Math.abs(len - 1) < 1e-6, 'normal es unitaria');
  assert.ok(n[1] > 0, 'componente Y positivo (hacia arriba)');
  assert.ok(n[0] < 0, 'componente X negativo por la pendiente hacia +x');
});

test('createWallGeometry usa normal analítica horizontal perpendicular al muro', () => {
  const wall = world.walls[0]; // v0(0,0) -> v1(6,0), dirección +x
  const geo = createWallGeometry(wall, world, world.sectors[0]);
  assert.equal(geo.attributes.position.count, 4);
  for (let i = 0; i < 4; i++) {
    const n = getNormal(geo, i);
    assert.ok(Math.abs(n[1]) < 1e-6, `vértice ${i} sin componente Y`);
    assert.ok(Math.abs(n[0]) < 1e-6, `vértice ${i} sin componente X`);
    assert.ok(Math.abs(n[2] - 1) < 1e-6, `vértice ${i} apunta en +z`);
  }
});

test('createSectorFloorGeometry conserva computeVertexNormals para terreno no plano', () => {
  const terrainSector = {
    id: 'st',
    vertexIds: ['v0', 'v1', 'v7', 'v6'],
    floorH: [0, 1, 2, 0.5],
    ceilH: 4.0,
  };
  const geo = createSectorFloorGeometry(world, terrainSector);
  assert.ok(geo.attributes.normal, 'tiene atributo normal');
  const n = getNormal(geo, 0);
  const len = Math.hypot(...n);
  assert.ok(Math.abs(len - 1) < 1e-6, 'normal normalizada');
});

function getUV(geo, i) {
  const uv = geo.attributes.uv.array;
  return [uv[i * 2], uv[i * 2 + 1]];
}

test('createSectorFloorGeometry aplica repeat en UVs', () => {
  const geo = createSectorFloorGeometry(world, world.sectors[0], undefined, { x: 2, y: 3 });
  const uvs = geo.attributes.uv.array;
  assert.deepStrictEqual(getUV(geo, 0), [0, 0]);
  assert.deepStrictEqual(getUV(geo, 1), [12, 0]);
  assert.deepStrictEqual(getUV(geo, 2), [12, 18]);
  assert.deepStrictEqual(getUV(geo, 3), [0, 18]);
});

test('createSectorCeilingGeometry aplica repeat en UVs', () => {
  const geo = createSectorCeilingGeometry(world, world.sectors[0], undefined, { x: 0.5, y: 2 });
  assert.deepStrictEqual(getUV(geo, 0), [0, 0]);
  assert.deepStrictEqual(getUV(geo, 1), [3, 0]);
});

test('createWallGeometry aplica repeat en UVs', () => {
  const wall = world.walls[0];
  const geo = createWallGeometry(wall, world, world.sectors[0], undefined, undefined, { x: 3, y: 2 });
  assert.deepStrictEqual(getUV(geo, 0), [0, 0]);
  assert.deepStrictEqual(getUV(geo, 1), [3, 0]);
  assert.deepStrictEqual(getUV(geo, 2), [3, 2]);
  assert.deepStrictEqual(getUV(geo, 3), [0, 2]);
});

test('createWallGeometry usa repeat uniforme (número)', () => {
  const wall = world.walls[0];
  const geo = createWallGeometry(wall, world, world.sectors[0], undefined, undefined, 2);
  assert.deepStrictEqual(getUV(geo, 1), [2, 0]);
  assert.deepStrictEqual(getUV(geo, 2), [2, 2]);
});
