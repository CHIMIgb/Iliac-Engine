import { test } from 'node:test';
import assert from 'node:assert/strict';
import { castRay, checkCollision } from '../../engine/core/dda.js';
import { wallProjection } from '../../engine/core/projection.js';
import { Camera } from '../../engine/core/camera.js';
import { makeTexture } from '../../engine/core/textures.js';
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

test('la rotación de cámara gira dir y plane y conserva el FOV', () => {
  const c = new Camera(0, 0, 1, 0, 0, 0.66);
  c.rotate(Math.PI / 2);
  assert.ok(Math.abs(c.dirX - 0) < 1e-9 && Math.abs(c.dirY - 1) < 1e-9, 'dir(1,0) rotado 90° debe ser aprox (0,1)');
  assert.equal(c.dirX * c.planeX + c.dirY * c.planeY, 0, 'dir y plane siguen perpendiculares (FOV constante)');
});

test('checkCollision detecta muros', () => {
  assert.ok(checkCollision(map, 0.5, 0.5), 'tile (0,0) es muro');
  assert.ok(checkCollision(map, 0.5, 7.5), 'tile (0,7) es muro');
  assert.ok(checkCollision(map, 7.5, 0.5), 'tile (7,0) es muro');
  assert.ok(!checkCollision(map, 1.5, 1.5), 'tile (1,1) es suelo');
  assert.ok(checkCollision(map, -1, 1.5), 'fuera del mapa colisiona');
  assert.ok(checkCollision(map, 8, 1.5), 'fuera del mapa colisiona');
});

test('Camera.move avanza y retrocede con colisión', () => {
  const c = new Camera(3.5, 3.5, 1, 0, 0, 0.66);
  c.move(map, true, 3.0, 1.0);
  assert.ok(c.posX > 3.5, 'avanza en dirección dirX positivo');
  
  c.move(map, false, 3.0, 1.0);
  assert.ok(Math.abs(c.posX - 3.5) < 0.1, 'retrocede a posición original');
});

test('Camera.move no atraviesa muro', () => {
  const c = new Camera(3.5, 3.5, 1, 0, 0, 0.66);
  // muro en x=7, distancia ~3.5
  c.move(map, true, 10.0, 1.0);
  assert.ok(c.posX < 7, 'no atraviesa muro en x=7');
});

test('makeTexture genera una textura 64x64 del color base', () => {
  const tex = makeTexture(0xcc0000, 64, 64);
  assert.equal(tex.length, 64 * 64);
  const r = (tex[0] >> 16) & 255;
  assert.ok(r > 100 && r <= 0xcc, 'el canal rojo dominante del color base');
});

test('Raycaster instanciado sin cargar texturas', () => {
  const engine = new Raycaster(project);
  assert.ok(engine instanceof Raycaster);
});