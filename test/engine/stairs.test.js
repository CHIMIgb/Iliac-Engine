import { test } from 'node:test';
import assert from 'node:assert/strict';
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
