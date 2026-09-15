/**
 * test/engine/anims.test.js — animFrameIndex puro (sin Three.js).
 *
 * Cubre: avance por fps, loop:true (wrap), loop:false (clamp al último frame),
 * fps inválido → default, tiempo negativo, frames vacíos.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { animFrameIndex, DEFAULT_FPS, MIN_FPS } from '../../engine/core/anims.js';

const ANIM = { frames: ['a', 'b', 'c', 'd'], fps: 4, loop: true };
const NON_LOOP = { frames: ['a', 'b', 'c', 'd'], fps: 4, loop: false };

test('animFrameIndex: elapsed 0 → frame 0', () => {
  assert.equal(animFrameIndex(ANIM, 0), 0);
});

test('animFrameIndex: avanza un frame cada 1/fps segundos', () => {
  assert.equal(animFrameIndex(ANIM, 1 / 4), 1);
  assert.equal(animFrameIndex(ANIM, 2 / 4), 2);
  assert.equal(animFrameIndex(ANIM, 3 / 4), 3);
});

test('animFrameIndex: loop:true reinicia al terminar (wrap)', () => {
  assert.equal(animFrameIndex(ANIM, 4 / 4), 0); // ciclo completo
  assert.equal(animFrameIndex(ANIM, 5 / 4), 1);
  assert.equal(animFrameIndex(ANIM, 8 / 4), 0); // dos ciclos
});

test('animFrameIndex: loop:false se clampa al último frame', () => {
  assert.equal(animFrameIndex(NON_LOOP, 3 / 4), 3);
  assert.equal(animFrameIndex(NON_LOOP, 10 / 4), 3); // ya terminó
  assert.equal(animFrameIndex(NON_LOOP, 1000), 3);
});

test('animFrameIndex: loop ausente = lo mismo que loop:false', () => {
  const undef = { frames: ['a', 'b'], fps: 2 };
  assert.equal(animFrameIndex(undef, 5 / 2), 1);
});

test('animFrameIndex: fps inválido (0, negativo, NaN) usa default', () => {
  for (const bad of [0, -3, NaN, '4', undefined, null]) {
    const anim = { frames: ['a', 'b', 'c', 'd'], fps: bad, loop: true };
    assert.equal(
      animFrameIndex(anim, 1 / DEFAULT_FPS),
      1,
      `fps ${String(bad)} debería degradar a DEFAULT_FPS`,
    );
  }
});

test('animFrameIndex: fps por debajo de MIN_FPS también degrada', () => {
  const anim = { frames: ['a', 'b'], fps: MIN_FPS / 2 };
  assert.equal(animFrameIndex(anim, 10), 9 % 2 === 0 ? 0 : 1); // default fps=1
});

test('animFrameIndex: tiempo negativo se trata como 0', () => {
  assert.equal(animFrameIndex(ANIM, -5), 0);
});

test('animFrameIndex: frames vacíos o anim ausente devuelven 0 (nunca NaN)', () => {
  assert.equal(animFrameIndex({ frames: [], fps: 4 }, 10), 0);
  assert.equal(animFrameIndex(null, 10), 0);
  assert.equal(animFrameIndex(undefined, 10), 0);
});

test('animFrameIndex: un solo frame sin loop siempre devuelve 0', () => {
  assert.equal(animFrameIndex({ frames: ['x'], fps: 60 }, 50), 0);
});