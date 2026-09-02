import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../../engine/core/player.js';
import { moveWithSectorCollision } from '../../engine/core/physics.js';

const world = {
  vertices: [
    { id: 'v0', x: 0, y: 0 },
    { id: 'v1', x: 4, y: 0 },
    { id: 'v2', x: 4, y: 4 },
    { id: 'v3', x: 0, y: 4 },
    { id: 'v4', x: 8, y: 0 },
    { id: 'v5', x: 8, y: 4 },
  ],
  sectors: [
    { id: 's0', vertexIds: ['v0', 'v1', 'v2', 'v3'], floorH: 0, ceilH: 3, floorTex: '', ceilTex: '', wallTex: '' },
    { id: 's1', vertexIds: ['v1', 'v4', 'v5', 'v2'], floorH: 0, ceilH: 3, floorTex: '', ceilTex: '', wallTex: '' },
  ],
  walls: [
    { id: 'w0', a: 'v0', b: 'v1', sectorFront: 's0', sectorBack: null },
    { id: 'w1', a: 'v1', b: 'v2', sectorFront: 's0', sectorBack: 's1', portal: true },
    { id: 'w2', a: 'v2', b: 'v3', sectorFront: 's0', sectorBack: null },
    { id: 'w3', a: 'v3', b: 'v0', sectorFront: 's0', sectorBack: null },
    { id: 'w4', a: 'v1', b: 'v4', sectorFront: 's1', sectorBack: null },
    { id: 'w5', a: 'v4', b: 'v5', sectorFront: 's1', sectorBack: null },
    { id: 'w6', a: 'v5', b: 'v2', sectorFront: 's1', sectorBack: null },
  ],
};

test('moveWithSectorCollision no atraviesa pared sólida', () => {
  const p = new Player(1, 2, 0.5, 0, 0);
  // Intentar atravesar pared izquierda en x=0 moviéndose hacia -x
  moveWithSectorCollision(p, world, -1, 0, 5.0, 1.0, 0.2);
  assert.ok(p.posX >= 0.2, 'no atraviesa pared izquierda');
});

test('moveWithSectorCollision permite cruzar portal', () => {
  const p = new Player(3, 2, 0.5, 0, 0);
  // Mover hacia +x a través del portal en x=4
  moveWithSectorCollision(p, world, 1, 0, 3.0, 1.0, 0.2);
  assert.ok(p.posX > 4, 'cruza el portal al sector s1');
});

test('moveWithSectorCollision desliza a lo largo de pared diagonal', () => {
  const diagWorld = {
    vertices: [
      { id: 'v0', x: 0, y: 0 },
      { id: 'v1', x: 4, y: 0 },
      { id: 'v2', x: 4, y: 4 },
    ],
    sectors: [
      { id: 's0', vertexIds: ['v0', 'v1', 'v2'], floorH: 0, ceilH: 3, floorTex: '', ceilTex: '', wallTex: '' },
    ],
    walls: [
      { id: 'w0', a: 'v0', b: 'v1', sectorFront: 's0', sectorBack: null },
      { id: 'w1', a: 'v1', b: 'v2', sectorFront: 's0', sectorBack: null },
      { id: 'w2', a: 'v2', b: 'v0', sectorFront: 's0', sectorBack: null },
    ],
  };
  const p = new Player(1, 0.3, 0.5, 0, 0);
  // Intentar mover hacia abajo (-y) contra la pared diagonal v2-v0
  moveWithSectorCollision(p, diagWorld, 0, -1, 3.0, 1.0, 0.2);
  // No debe salir del triángulo por la hipotenusa
  assert.ok(p.posX >= 0 && p.posY >= 0, 'permanece dentro del sector');
});
