/**
 * sky-core.test.js — lógica pura del cielo (engine/core/sky.js).
 *
 * - 31 sets SKY00–SKY30 (horizontes distintos).
 * - 32 franjas del día por set (fotogramas 0–31 de la capa 0).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SKY_SETS, SKY_FRAMES, skyFrameLabel, skySetForHour, skyHourForSet } from '../../engine/core/sky.js';
import { validateProject } from '../../engine/core/validate.js';

test('skyFrameLabel cubre 32 franjas en 24 h', () => {
  assert.equal(skyFrameLabel(0), '00:00');
  assert.equal(skyFrameLabel(SKY_FRAMES / 2), '12:00');
  assert.equal(skyFrameLabel(SKY_FRAMES - 1), '23:15');
  const labels = new Set(Array.from({ length: SKY_FRAMES }, (_, i) => skyFrameLabel(i)));
  assert.equal(labels.size, SKY_FRAMES);
});

test('skySetForHour y skyHourForSet: etiquetas de hora 0–23', () => {
  assert.equal(skySetForHour(0), 0);
  assert.equal(skySetForHour(23), SKY_SETS - 1);
  assert.ok(skyHourForSet(0) >= 0 && skyHourForSet(0) <= 23);
  assert.ok(skyHourForSet(SKY_SETS - 1) >= 0 && skyHourForSet(SKY_SETS - 1) <= 23);
});

test('validateProject acepta frame opcional 0–31 y rechaza valores fuera de rango', () => {
  const base = {
    meta: { name: 't', schemaVersion: 3 },
    camera: { posX: 0, posY: 0, posZ: 0.5, yaw: 0, pitch: 0 },
    world: { vertices: [], sectors: [], walls: [], textures: {} },
  };
  const sky = (s) => validateProject({ ...base, world: { ...base.world, sky: s } }).errors;
  assert.equal(sky({ set: 15 }).length, 0, 'sin frame: válido');
  assert.equal(sky({ set: 15, frame: 0 }).length, 0, 'frame 0: válido');
  assert.equal(sky({ set: 15, frame: 31 }).length, 0, 'frame 31: válido');
  assert.ok(sky({ set: 15, frame: 32 }).length > 0, '32 fuera de rango');
  assert.ok(sky({ set: 15, frame: 1.5 }).length > 0, 'fraccional no admitida');
});
