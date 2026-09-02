import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine3D } from '../../engine/Engine3D.js';

// Proyecto mínimo schema v3 (sectores poligonales) para testear Engine3D.update().
const projectV3 = {
  meta: { name: 'Test Sectors', schemaVersion: 3, renderMode: '3d' },
  camera: { posX: 2, posY: 2, posZ: 0.5, yaw: 0, pitch: 0 },
  world: {
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
        ceilH: 3,
        floorTex: '',
        ceilTex: '',
        wallTex: '',
      },
    ],
    walls: [
      { id: 'w0', a: 'v0', b: 'v1', sectorFront: 's0', sectorBack: null, tex: '' },
      { id: 'w1', a: 'v1', b: 'v2', sectorFront: 's0', sectorBack: null, tex: '' },
      { id: 'w2', a: 'v2', b: 'v3', sectorFront: 's0', sectorBack: null, tex: '' },
      { id: 'w3', a: 'v3', b: 'v0', sectorFront: 's0', sectorBack: null, tex: '' },
    ],
    textures: {},
  },
};

test('Engine3D.update mueve al jugador en schema v3', () => {
  const engine = new Engine3D(projectV3);
  const startX = engine.player.posX;
  engine.update({ dirX: 1, dirY: 0, speed: 2.0 }, 0.5);
  assert.ok(engine.player.posX > startX, 'el jugador avanza en +X');
});

test('Engine3D.update no atraviesa paredes en schema v3', () => {
  const engine = new Engine3D(projectV3);
  // Colocar al jugador cerca del borde derecho y empujar hacia la pared en x=10.
  engine.player.posX = 9.8;
  engine.player.posY = 2;
  engine.update({ dirX: 1, dirY: 0, speed: 10.0 }, 1.0);
  assert.ok(engine.player.posX <= 10, 'no atraviesa la pared derecha');
});

test('Engine3D.update aplica gravedad en schema v3', () => {
  const engine = new Engine3D(projectV3);
  engine.player.posZ = 2.0;
  engine.update({ dirX: 0, dirY: 0, speed: 0 }, 1.0);
  assert.ok(engine.player.posZ < 2.0, 'el jugador cae hacia el suelo');
});

test('Engine3D.update no falla sin input en schema v3', () => {
  const engine = new Engine3D(projectV3);
  assert.doesNotThrow(() => {
    engine.update(undefined, 0.016);
  });
});
