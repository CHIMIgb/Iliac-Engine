import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skyFrameIndex, skyFrameUrl, skySignature } from '../../engine/three/SkySystem.js';
import { validateProject } from '../../engine/core/validate.js';

test('skyFrameIndex cubre la vuelta completa en 32 fotogramas', () => {
  assert.equal(skyFrameIndex(0), 0);
  assert.equal(skyFrameIndex(Math.PI), 16);
  assert.equal(skyFrameIndex(Math.PI * 2), 0); // envolvente: un giro entero = frame 0
  assert.equal(skyFrameIndex(-Math.PI / 2), 24); // y negativos también
  assert.equal(skyFrameIndex(Math.PI, 16), 8); // stride 2 → 16 frames, media vuelta = frame 8
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
  assert.ok(validateProject({ ...base, world: { ...base.world, sky: { set: 2, stride: 3 } } }).errors.length > 0);
});

test('skySignature distingue ausente/cero y set cambiar', () => {
  assert.equal(skySignature(undefined), skySignature(null));
  assert.notEqual(skySignature(null), skySignature({ set: 0 }));
  assert.equal(skySignature({ set: 15 }), skySignature({ set: 15 }));
  assert.notEqual(skySignature({ set: 15 }), skySignature({ set: 16 }));
});
