import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSectorFloorGeometry,
  createSectorCeilingGeometry,
  createWallGeometry,
} from '../../engine/three/SectorGeometry.js';
import { project } from '../../demo/project.js';

test('createSectorFloorGeometry genera geometría con vértices correctos', () => {
  const s0 = project.world.sectors[0];
  const geo = createSectorFloorGeometry(project.world, s0);
  assert.ok(geo.attributes.position, 'tiene posiciones');
  assert.equal(geo.attributes.position.count, 4, '4 vértices para cuadrado');
  assert.equal(geo.index.count, 6, '2 triángulos = 6 índices');
});

test('createSectorFloorGeometry aplica alturas por vértice', () => {
  const s1 = project.world.sectors[1];
  const geo = createSectorFloorGeometry(project.world, s1);
  const pos = geo.attributes.position.array;
  // vértice 0 en x=6 (altura 0.0), vértice 1 en x=7 (altura 0.4)
  const yAt6 = pos[0 * 3 + 1];
  const yAt7 = pos[1 * 3 + 1];
  assert.ok(Math.abs(yAt6 - 0.0) < 0.01, 'altura v1 = 0.0');
  assert.ok(Math.abs(yAt7 - 0.4) < 0.01, 'altura v2 = 0.4');
});

test('createSectorCeilingGeometry invierte índices para normal hacia abajo', () => {
  const s0 = project.world.sectors[0];
  const geo = createSectorCeilingGeometry(project.world, s0);
  assert.equal(geo.attributes.position.count, 4);
  assert.equal(geo.index.count, 6);
  // Verificar que los índices no son idénticos al floor (están invertidos)
  const floorGeo = createSectorFloorGeometry(project.world, s0);
  const ceilIdx = Array.from(geo.index.array);
  const floorIdx = Array.from(floorGeo.index.array);
  assert.notDeepEqual(ceilIdx, floorIdx, 'índices de techo invertidos');
});

test('createWallGeometry genera quad vertical con 4 vértices', () => {
  const wall = project.world.walls[0];
  const s0 = project.world.sectors[0];
  const geo = createWallGeometry(wall, project.world, s0);
  assert.ok(geo);
  assert.equal(geo.attributes.position.count, 4);
  assert.equal(geo.index.count, 6);
});

test('createWallGeometry devuelve null si falta un vértice', () => {
  const badWall = { a: 'no-existe', b: 'v1', sectorFront: 's0' };
  const s0 = project.world.sectors[0];
  assert.equal(createWallGeometry(badWall, project.world, s0), null);
});
