import { test } from 'node:test';
import assert from 'node:assert/strict';
import { castRay } from '../../engine/core/dda.js';
import { wallProjection } from '../../engine/core/projection.js';
import { Raycaster } from '../../engine/Raycaster.js';
import { project } from '../../demo/project.js';

const map = project.world.map;
const cam = project.camera;

test('el rayo frontal impacta en un muro', () => {
  const hit = castRay(map, cam.posX, cam.posY, cam.dirX, cam.dirY);
  assert.ok(hit.tile > 0, 'debe impactar un tile de muro');
});

test('perpWallDist es positiva y la pared cabe en pantalla', () => {
  const hit = castRay(map, cam.posX, cam.posY, cam.dirX, cam.dirY);
  assert.ok(hit.perpWallDist > 0);
  const proj = wallProjection(hit.perpWallDist, 480);
  assert.ok(proj.drawEnd - proj.drawStart > 50, 'la pared ocupa más de 50px');
  assert.ok(proj.drawStart >= 0 && proj.drawEnd < 480, 'la pared cabe en pantalla');
});

test('el desglose de color respeta 0xRRGGBB', () => {
  const color = 0xcc0000;
  assert.equal((color >> 16) & 255, 0xcc);
  assert.equal((color >> 8) & 255, 0x00);
  assert.equal(color & 255, 0x00);
});

test('el motor se instancia con el proyecto', () => {
  assert.ok(new Raycaster(project) instanceof Raycaster);
});
