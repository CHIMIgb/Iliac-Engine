import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Player, checkCollision } from '../../engine/core/player.js';
import { Engine3D } from '../../engine/Engine3D.js';
import { project } from '../../demo/project.js';

const map = project.world.map;

test('Engine3D se instancia con el proyecto', () => {
  const engine = new Engine3D(project);
  assert.ok(engine instanceof Engine3D);
  assert.equal(engine.player.posX, project.camera.posX);
});

test('Player rota yaw y conserva forward perpendicular al right', () => {
  const p = new Player(0, 0, 0.5, 0, 0);
  p.rotateYaw(Math.PI / 2);
  assert.ok(Math.abs(p.forwardX - 0) < 1e-9 && Math.abs(p.forwardY - 1) < 1e-9, 'forward rotado 90° apunta a (0,1)');
  assert.ok(Math.abs(p.forwardX * p.rightX + p.forwardY * p.rightY) < 1e-9, 'forward y right son perpendiculares');
});

test('checkCollision detecta muros', () => {
  assert.ok(checkCollision(map, 0.5, 0.5), 'tile (0,0) es muro');
  assert.ok(checkCollision(map, 0.5, 7.5), 'tile (0,7) es muro');
  assert.ok(checkCollision(map, 7.5, 0.5), 'tile (7,0) es muro');
  assert.ok(!checkCollision(map, 1.5, 1.5), 'tile (1,1) es suelo');
  assert.ok(checkCollision(map, -1, 1.5), 'fuera del mapa colisiona');
  assert.ok(checkCollision(map, 8, 1.5), 'fuera del mapa colisiona');
});

test('Player.move avanza y retrocede con colisión', () => {
  const p = new Player(3.5, 3.5, 0.5, 0, 0);
  p.move(map, 1, 0, 3.0, 1.0);
  assert.ok(p.posX > 3.5, 'avanza en dirección X positivo');

  p.move(map, -1, 0, 3.0, 1.0);
  assert.ok(Math.abs(p.posX - 3.5) < 0.1, 'retrocede a posición original');
});

test('Player.move no atraviesa muro', () => {
  const p = new Player(3.5, 3.5, 0.5, 0, 0);
  p.move(map, 1, 0, 10.0, 1.0);
  assert.ok(p.posX < 7, 'no atraviesa muro en x=7');
});

test('Player.updateZ sube a plataforma si el desnivel es <= stepHeight', () => {
  const sectorMap = [[0, 1]];
  const sectors = [
    { floorH: 0.0, ceilH: 1.0 },
    { floorH: 0.4, ceilH: 1.4 },
  ];
  const p = new Player(0.5, 0.5, 0.5, 0, 0);
  p.updateZ(sectorMap, sectors);
  assert.ok(Math.abs(p.posZ - 0.5) < 0.01, 'sigue en suelo bajo');

  p.posX = 1.5;
  p.updateZ(sectorMap, sectors);
  assert.ok(Math.abs(p.posZ - 0.9) < 0.01, 'sube a plataforma de floorH=0.4 + eye=0.5');
});

test('Player.updateZ cae por gravedad a sector más bajo', () => {
  const sectorMap = [[0, 1]];
  const sectors = [
    { floorH: 0.0, ceilH: 1.0 },
    { floorH: -0.5, ceilH: 0.5 },
  ];
  const p = new Player(1.5, 0.5, 0.5, 0, 0);
  p.updateZ(sectorMap, sectors);
  assert.ok(p.posZ < 0.5, 'cae hacia sector más bajo');
});
