import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../../engine/core/player.js';
import { moveWithSectorCollision } from '../../engine/core/physics.js';
import { getStairHeightAt, getStairSegments } from '../../engine/core/stairs.js';

const world = {
  ramps: [
    {
      id: 'r0',
      type: 'stairs',
      pos: { x: 0, y: 0 },
      direction: { x: 1, y: 0 },
      width: 1,
      rise: 1,
      run: 2,
      steps: 4,
    },
  ],
};

test('getStairHeightAt devuelve altura correcta por peldaño', () => {
  assert.equal(getStairHeightAt(world, 0.1, 0.5), 0.0);
  assert.equal(getStairHeightAt(world, 0.6, 0.5), 0.25);
  assert.equal(getStairHeightAt(world, 1.1, 0.5), 0.5);
  assert.equal(getStairHeightAt(world, 1.6, 0.5), 0.75);
});

test('getStairHeightAt devuelve null fuera de la escalera', () => {
  assert.equal(getStairHeightAt(world, -0.1, 0.5), null);
  assert.equal(getStairHeightAt(world, 2.1, 0.5), null);
  assert.equal(getStairHeightAt(world, 0.5, 1.1), null);
});

test('getStairSegments genera una cara frontal por peldaño', () => {
  const segs = getStairSegments(world.ramps[0]);
  assert.equal(segs.length, 4);
});

test('moveWithSectorCollision no atraviesa escalera demasiado alta', () => {
  const stairWorld = {
    vertices: [
      { id: 'v0', x: 0, y: 0 },
      { id: 'v1', x: 4, y: 0 },
      { id: 'v2', x: 4, y: 4 },
      { id: 'v3', x: 0, y: 4 },
    ],
    sectors: [
      { id: 's0', vertexIds: ['v0', 'v1', 'v2', 'v3'], floorH: 0, ceilH: 10, floorTex: '', ceilTex: '', wallTex: '' },
    ],
    walls: [
      { id: 'w0', a: 'v0', b: 'v1', sectorFront: 's0', sectorBack: null },
      { id: 'w1', a: 'v1', b: 'v2', sectorFront: 's0', sectorBack: null },
      { id: 'w2', a: 'v2', b: 'v3', sectorFront: 's0', sectorBack: null },
      { id: 'w3', a: 'v3', b: 'v0', sectorFront: 's0', sectorBack: null },
    ],
    ramps: [
      {
        id: 'r0',
        type: 'stairs',
        pos: { x: 1, y: 0 },
        direction: { x: 1, y: 0 },
        width: 2,
        rise: 2,   // 4 peldaños de 0.5m cada uno
        run: 2,
        steps: 4,
      },
    ],
  };
  const p = new Player(0.5, 1, 0.5, 0, 0);
  // Mover hacia +x contra la escalera; stepHeight=0.6, stepRise=0.5 < 0.6 → no bloquea.
  moveWithSectorCollision(p, stairWorld, 1, 0, 2.0, 1.0, 0.2);
  assert.ok(p.posX > 0.5, 'puede avanzar hacia escalera escalable');

  // Ahora una escalera demasiado alta: stepRise = 2 > stepHeight=0.6 → bloquea.
  const steepWorld = JSON.parse(JSON.stringify(stairWorld));
  steepWorld.ramps[0].rise = 8; // 4 peldaños de 2m
  const p2 = new Player(0.5, 1, 0.5, 0, 0);
  moveWithSectorCollision(p2, steepWorld, 1, 0, 5.0, 1.0, 0.2);
  assert.ok(p2.posX < 2, 'no atraviesa escalera demasiado empinada');
});
