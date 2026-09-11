import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SkySystem, skyFrameUrl, skySignature, SKY_FRAMES } from '../../engine/three/SkySystem.js';
import { validateProject } from '../../engine/core/validate.js';

test('un solo telón: addTo añade exactamente 1 billboard y setFrame cambia la franja', () => {
  const sky = new SkySystem({ set: 15, frame: 0 });
  sky.loaded = true;
  // Stub de las 32 texturas (sin red): el mesh las referencia por índice.
  sky.textures = Object.fromEntries(Array.from({ length: SKY_FRAMES }, (_, i) => [String(i), null]));
  const scene = new THREE.Scene();
  sky.addTo(scene);
  assert.equal(scene.children.length, 1);
  assert.ok(scene.children[0].userData.isSky);

  sky.setFrame(5);
  assert.equal(sky.frame, 5);

  sky.dispose();
  assert.equal(scene.children.length, 0);
});

test('update(): mirando al cenit el quad cubre la camara y el cielo llena la pantalla (sin caja de fondo)', () => {
  const sky = new SkySystem({ set: 15, frame: 0 });
  sky.loaded = true;
  sky.textures = Object.fromEntries(
    Array.from({ length: SKY_FRAMES }, (_, i) => [String(i), new THREE.Texture()]),
  );
  const scene = new THREE.Scene();
  sky.addTo(scene);
  const mesh = scene.children[0];

  const cam = new THREE.PerspectiveCamera(80, 16 / 9, 0.1, 500);
  cam.position.set(32, 0.4, 32);
  cam.lookAt(32, 100, 32); // mirar al cenit: antes el telon vertical se recortaba/veia su borde
  sky.update(cam);

  // Quad anclado a la camara: perpendicular a la vista, delante, misma orientacion.
  const fwd = new THREE.Vector3();
  cam.getWorldDirection(fwd);
  const offset = mesh.position.clone().sub(cam.position);
  assert.ok(Math.abs(offset.angleTo(fwd)) < 1e-6, 'el quad esta al frente de la camara');
  assert.ok(Math.abs(cam.quaternion.angleTo(mesh.quaternion)) < 1e-6, 'sin alabeo');

  // Horizonte (v=0) acotado en o bajo el borde inferior: v en el borde de pantalla <= 0.
  const tex = sky.textures['0'];
  assert.ok(Number.isFinite(tex.offset.y) && Number.isFinite(tex.repeat.y), 'UVs sin NaN');
  assert.ok(tex.offset.y <= 1e-6, 'mirando al cenit el horizonte queda clavado en el borde inferior');
  assert.ok(tex.repeat.y > 0 && tex.repeat.x > 0, 'la franja conserva escala');
  sky.dispose();
});

test('skyFrameUrl construye rutas limpias SKYnn/capa-frame.PNG', () => {
  assert.equal(skyFrameUrl('/sky/', 15, 1, 3), '/sky/SKY15/1-3.PNG');
  assert.equal(skyFrameUrl('./sky/', 0, 0, 30), './sky/SKY00/0-30.PNG');
});

test('validateProject acepta sky opcional y rechaza valores fuera de rango', () => {
  const base = {
    meta: { name: 't', schemaVersion: 3 },
    camera: { posX: 0, posY: 0, posZ: 0.5, yaw: 0, pitch: 0 },
    world: { vertices: [], sectors: [], walls: [], textures: {} },
  };
  assert.equal(validateProject(base).errors.length, 0, 'sin sky: válido');
  assert.equal(validateProject({ ...base, world: { ...base.world, sky: { set: 15 } } }).errors.length, 0);
  assert.ok(validateProject({ ...base, world: { ...base.world, sky: { set: 31 } } }).errors.length > 0);
  assert.ok(validateProject({ ...base, world: { ...base.world, sky: { set: 1.5 } } }).errors.length > 0);
});

test('skySignature distingue set/base, no el frame (el frame se sincroniza aparte)', () => {
  assert.equal(skySignature(undefined), skySignature(null));
  assert.notEqual(skySignature(null), skySignature({ set: 0 }));
  assert.equal(skySignature({ set: 15 }), skySignature({ set: 15, frame: 5 }));
  assert.notEqual(skySignature({ set: 15 }), skySignature({ set: 16 }));
  assert.notEqual(skySignature({ set: 15 }), skySignature({ set: 15, base: '/otro/' }));
});
