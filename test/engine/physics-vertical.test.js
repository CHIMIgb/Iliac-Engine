import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../../engine/core/player.js';
import { updateVerticalSector } from '../../engine/core/physics.js';
import { buildSectorIndex } from '../../engine/core/sector.js';

function flatWorld(ramps = []) {
  return {
    vertices: [
      { id: 'v0', x: 0, y: 0 },
      { id: 'v1', x: 10, y: 0 },
      { id: 'v2', x: 10, y: 10 },
      { id: 'v3', x: 0, y: 10 },
    ],
    sectors: [
      { id: 's0', vertexIds: ['v0', 'v1', 'v2', 'v3'], floorH: 0, ceilH: 3 },
    ],
    walls: [
      { id: 'w0', a: 'v0', b: 'v1', sectorFront: 's0', sectorBack: null },
      { id: 'w1', a: 'v1', b: 'v2', sectorFront: 's0', sectorBack: null },
      { id: 'w2', a: 'v2', b: 'v3', sectorFront: 's0', sectorBack: null },
      { id: 'w3', a: 'v3', b: 'v0', sectorFront: 's0', sectorBack: null },
    ],
    ramps,
  };
}

test('updateVerticalSector mantiene al jugador sobre el suelo', () => {
  const world = flatWorld();
  const index = buildSectorIndex(world);
  const p = new Player(5, 5, 0.5, 0, 0);
  updateVerticalSector(p, world, 0.016, index);
  assert.ok(Math.abs(p.posZ - 0.5) < 1e-9);
});

test('updateVerticalSector aplica gravedad', () => {
  const world = flatWorld();
  const index = buildSectorIndex(world);
  const p = new Player(5, 5, 2.0, 0, 0);
  updateVerticalSector(p, world, 1.0, index);
  assert.ok(Math.abs(p.posZ - 0.5) < 1e-9, 'cae hasta la altura de ojos');
});

test('updateVerticalSector sube desniveles <= stepHeight', () => {
  const world = flatWorld();
  const index = buildSectorIndex(world);
  const p = new Player(5, 5, 0.2, 0, 0);
  updateVerticalSector(p, world, 1.0, index);
  assert.ok(Math.abs(p.posZ - 0.5) < 1e-9, 'sube al suelo');
});

test('updateVerticalSector no sube desniveles > stepHeight', () => {
  const world = flatWorld();
  const index = buildSectorIndex(world);
  const p = new Player(5, 5, -1.0, 0, 0);
  updateVerticalSector(p, world, 1.0, index);
  assert.ok(Math.abs(p.posZ + 1.0) < 1e-9, 'no sube un acantilado');
});

test('updateVerticalSector respeta colisión con techo', () => {
  const world = flatWorld();
  const index = buildSectorIndex(world);
  const p = new Player(5, 5, 1.9, 0, 0);
  // Altura de cabeza = height - eyeHeight = 1.3; techo a 3 => maxZ = 1.7.
  // dt pequeño para que la gravedad no lo baje por debajo del techo antes del clamp.
  updateVerticalSector(p, world, 0.001, index);
  assert.ok(Math.abs(p.posZ - 1.7) < 1e-6, 'la cabeza no atraviesa el techo');
});

test('updateVerticalSector ajusta altura en escaleras', () => {
  const world = flatWorld([
    {
      id: 'r0',
      type: 'stairs',
      pos: { x: 1, y: 0 },
      direction: { x: 1, y: 0 },
      width: 2,
      rise: 2,
      run: 2,
      steps: 4,
    },
  ]);
  const index = buildSectorIndex(world);
  const p = new Player(1.5, 0.5, 0.5, 0, 0);
  updateVerticalSector(p, world, 1.0, index);
  // En x=1.5 la altura de peldaño es 0.5; targetZ = 0.5 + eyeHeight = 1.0
  assert.ok(Math.abs(p.posZ - 1.0) < 1e-9, 'sube al peldaño');
});

test('updateVerticalSector sigue la pendiente del suelo', () => {
  const world = {
    vertices: [
      { id: 'v0', x: 0, y: 0 },
      { id: 'v1', x: 10, y: 0 },
      { id: 'v2', x: 10, y: 10 },
      { id: 'v3', x: 0, y: 10 },
    ],
    sectors: [
      {
        id: 's0',
        vertexIds: ['v0', 'v1', 'v2', 'v3'],
        floorH: 0,
        ceilH: 10,
        floorSlope: { axis: 'x', angle: 30 },
      },
    ],
    walls: [
      { id: 'w0', a: 'v0', b: 'v1', sectorFront: 's0', sectorBack: null },
      { id: 'w1', a: 'v1', b: 'v2', sectorFront: 's0', sectorBack: null },
      { id: 'w2', a: 'v2', b: 'v3', sectorFront: 's0', sectorBack: null },
      { id: 'w3', a: 'v3', b: 'v0', sectorFront: 's0', sectorBack: null },
    ],
  };
  const index = buildSectorIndex(world);
  const p = new Player(1, 5, 2.0, 0, 0);
  updateVerticalSector(p, world, 1.0, index);
  // floorH en x=1 con slope 30: tan(30)*1 ≈ 0.577; targetZ ≈ 1.077
  const expected = Math.tan(Math.PI / 6) + 0.5;
  assert.ok(Math.abs(p.posZ - expected) < 1e-9, 'ajusta a la pendiente');
});

test('updateVerticalSector no falla fuera de los sectores', () => {
  const world = flatWorld();
  const index = buildSectorIndex(world);
  const p = new Player(100, 100, 5.0, 0, 0);
  assert.doesNotThrow(() => updateVerticalSector(p, world, 1.0, index));
  assert.ok(Number.isFinite(p.posZ), 'posZ sigue siendo finita');
});

test('updateVerticalSector gravedad acelerada: velocityZ crece entre frames', () => {
  // Techo alto para caída libre sin clavarse en el clamp de techo.
  const world = flatWorld();
  world.sectors[0].ceilH = 50;
  const index = buildSectorIndex(world);
  const p = new Player(5, 5, 40.0, 0, 0);
  updateVerticalSector(p, world, 0.1, index);
  const v1 = p.velocityZ;
  updateVerticalSector(p, world, 0.1, index);
  const v2 = p.velocityZ;
  assert.ok(v1 > 0, 'empieza a caer con velocidad positiva');
  assert.ok(v2 > v1, 'la velocidad aumenta con la gravedad');
  assert.ok(Math.abs((v2 - v1) - 0.9) < 1e-9, 'incremento = gravity * dt');
});

test('updateVerticalSector resetea velocityZ al apoyarse', () => {
  const world = flatWorld();
  const index = buildSectorIndex(world);
  const p = new Player(5, 5, 3.0, 0, 0);
  // Cae y se apoya en el suelo del todo (aterriza a altura de ojos).
  updateVerticalSector(p, world, 2.0, index);
  assert.equal(p.velocityZ, 0, 'al aterrizar la velocidad vertical se anula');
});
