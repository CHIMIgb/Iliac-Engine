/**
 * test/engine/multi-sprite-anims.test.js — regresión 2026-09-18:
 * "no puedo asignar diferentes sprites a diferentes entidades".
 *
 * El usuario colocó varias entidades (mago ×N + aldeano), asignó una animación
 * a cada una, pero SOLO UNA mostraba el sprite. Hipótesis a verificar: el
 * flujo de asignación dejaba el proyecto inválido (sprite.anim sin entrada en
 * world.spriteAnims) y el reload abortaba la reconstrucción completa.
 *
 * AQUÍ se verifica el lado MOTOR: dados N sprites con `anim` válida, el motor
 * construye N billboards (sin deduplicar). Si el motor siempre construyó bien
 * todos, el bug está en el Studio (validación / reload), no aquí.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSprites } from '../../engine/three/SpriteSystem.js';

function makeTexture() {
  const data = new Uint8Array([255, 0, 0, 255]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.needsUpdate = true;
  return tex;
}

test('N entidades con la MISMA anim → N billboards (no deduplica)', () => {
  const scene = new THREE.Scene();
  const world = {
    spriteAnims: { idle: { frames: ['mago_f0', 'mago_f1'], fps: 4, loop: true } },
    sprites: [
      { id: 'sp_mago_1', tex: 'mago_f0', anim: 'idle', pos: { x: 1, y: 1, z: 0 }, scale: 1.8 },
      { id: 'sp_mago_2', tex: 'mago_f0', anim: 'idle', pos: { x: 3, y: 1, z: 0 }, scale: 1.8 },
      { id: 'sp_mago_3', tex: 'mago_f0', anim: 'idle', pos: { x: 5, y: 1, z: 0 }, scale: 1.8 },
    ],
  };
  const animator = buildSprites(scene, world, { mago_f0: makeTexture(), mago_f1: makeTexture() });
  assert.equal(animator?.count, 3, '3 sprites animados');
  assert.equal(scene.children.filter((c) => c.isSprite).length, 3, '3 billboards en escena');
});

test('N entidades con DISTINTAS anims válidas → N billboards (el caso aldeano)', () => {
  const scene = new THREE.Scene();
  const world = {
    spriteAnims: {
      mago_idle: { frames: ['mago_f0', 'mago_f1'], fps: 4, loop: true },
      aldeano_idle: { frames: ['aldeano_f0', 'aldeano_f1'], fps: 4, loop: true },
    },
    sprites: [
      { id: 'sp_mago_1', tex: 'mago_f0', anim: 'mago_idle', pos: { x: 1, y: 1, z: 0 }, scale: 1.8 },
      { id: 'sp_aldeano', tex: 'aldeano_f0', anim: 'aldeano_idle', pos: { x: 4, y: 1, z: 0 }, scale: 1.8 },
    ],
  };
  const animator = buildSprites(scene, world, {
    mago_f0: makeTexture(), mago_f1: makeTexture(),
    aldeano_f0: makeTexture(), aldeano_f1: makeTexture(),
  });
  assert.equal(animator?.count, 2, '2 sprites animados');
  assert.equal(scene.children.filter((c) => c.isSprite).length, 2, '2 billboards en escena');
});

test('sprite con anim INEXISTENTE → cae a estático y usa sprite.tex (fallback)', () => {
  const scene = new THREE.Scene();
  const world = {
    spriteAnims: { mago_idle: { frames: ['mago_f0', 'mago_f1'], fps: 4, loop: true } },
    sprites: [
      { id: 'sp_rotos', tex: 'aldeano_f0', anim: 'no_guardada', pos: { x: 0, y: 0, z: 0 }, scale: 1.8 },
    ],
  };
  buildSprites(scene, world, { mago_f0: makeTexture(), aldeano_f0: makeTexture() });
  assert.equal(scene.children.filter((c) => c.isSprite).length, 1, 'sigue visible con su tex');
});