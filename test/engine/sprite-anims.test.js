/**
 * test/engine/sprite-anims.test.js — SpriteAnimator (F5): sprites con `anim`
 * cambian de frame con update(dt), los estáticos se mantienen igual.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSprites } from '../../engine/three/SpriteSystem.js';

function makeTexture(label = '') {
  const data = new Uint8Array([255, 0, 0, 255]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.needsUpdate = true;
  tex.userData.label = label;
  return tex;
}

function worldWithAnims() {
  return {
    spriteAnims: {
      idle: { frames: ['g0', 'g1', 'g2', 'g3'], fps: 2, loop: true },
      die: { frames: ['g0', 'g1', 'g2', 'g3'], fps: 2, loop: false },
    },
    sprites: [
      { id: 'sp_anim', tex: 'g0', anim: 'idle', pos: { x: 1, y: 1, z: 0 }, scale: 1 },
      { id: 'sp_die', tex: 'g0', anim: 'die', pos: { x: 2, y: 2, z: 0 }, scale: 1 },
      { id: 'sp_static', tex: 'g0', pos: { x: 3, y: 3, z: 0 }, scale: 1 }, // sin anim
    ],
  };
}

test('buildSprites devuelve null sin animaciones', () => {
  const scene = new THREE.Scene();
  const world = { sprites: [{ id: 's', tex: 'g0', pos: { x: 0, y: 0, z: 0 } }] };
  const animator = buildSprites(scene, world, { g0: makeTexture() });
  assert.equal(animator, null);
});

test('buildSprites devuelve animator con sprites animados y estáticos intactos', () => {
  const scene = new THREE.Scene();
  const textures = { g0: makeTexture('g0'), g1: makeTexture('g1'), g2: makeTexture('g2'), g3: makeTexture('g3') };
  const animator = buildSprites(scene, worldWithAnims(), textures);
  assert.ok(animator, 'hay animator');
  assert.equal(animator.count, 2, 'dos sprites animados (idle y die)');
  const sprites = scene.children.filter((c) => c.isSprite);
  assert.equal(sprites.length, 3, 'los 3 sprites existen (2 animados + 1 estático)');
});

test('update(dt) cambia el map del sprite animado según fps', () => {
  const scene = new THREE.Scene();
  const textures = { g0: makeTexture('g0'), g1: makeTexture('g1'), g2: makeTexture('g2'), g3: makeTexture('g3') };
  const animator = buildSprites(scene, worldWithAnims(), textures);
  const spriteObj = scene.children.find((c) => c.isSprite && c.position.x === 1); // idle
  assert.equal(spriteObj.material.map.userData.label, 'g0', 'frame inicial g0');

  animator.update(0.5); // fps 2 → frame 1 (0.5 * 2 = 1)
  assert.equal(spriteObj.material.map.userData.label, 'g1');

  animator.update(0.5); // acumulado 1.0 → frame 2
  assert.equal(spriteObj.material.map.userData.label, 'g2');
});

test('loop:false clampa al último frame', () => {
  const scene = new THREE.Scene();
  const textures = { g0: makeTexture('g0'), g1: makeTexture('g1'), g2: makeTexture('g2'), g3: makeTexture('g3') };
  const animator = buildSprites(scene, worldWithAnims(), textures);
  const dieObj = scene.children.find((c) => c.isSprite && c.position.x === 2); // die, loop:false
  for (let i = 0; i < 10; i++) animator.update(0.5); // sobrepasa el final
  assert.equal(dieObj.material.map.userData.label, 'g3', 'se queda en el último frame');
});

test('loop:true reinicia al completar el ciclo', () => {
  const scene = new THREE.Scene();
  const textures = { g0: makeTexture('g0'), g1: makeTexture('g1'), g2: makeTexture('g2'), g3: makeTexture('g3') };
  const animator = buildSprites(scene, worldWithAnims(), textures);
  const idleObj = scene.children.find((c) => c.isSprite && c.position.x === 1); // idle, loop:true
  animator.update(2); // 4 frames * 0.5 s = ciclo completo → vuelve a 0
  assert.equal(idleObj.material.map.userData.label, 'g0', 'wrap al frame inicial');
});

test('sprite con anim inexistente cae a estático (compatibilidad)', () => {
  const scene = new THREE.Scene();
  const textures = { g0: makeTexture('g0') };
  const world = {
    spriteAnims: { idle: { frames: ['g0', 'g0'], fps: 1, loop: true } },
    sprites: [{ id: 'spx', tex: 'g0', anim: 'otra', pos: { x: 0, y: 0, z: 0 } }],
  };
  const animator = buildSprites(scene, world, textures);
  // Sin anim válida → sprite estático; y como no hay ningún animado → null.
  assert.equal(animator, null);
  assert.equal(scene.children.filter((c) => c.isSprite).length, 1);
});

test('dt negativo o ausente no rompe el animator', () => {
  const scene = new THREE.Scene();
  const textures = { g0: makeTexture('g0'), g1: makeTexture('g1'), g2: makeTexture('g2'), g3: makeTexture('g3') };
  const animator = buildSprites(scene, worldWithAnims(), textures);
  animator.update(-1);
  animator.update(undefined);
  animator.update(0);
  assert.equal(animator.count, 2, 'sigue funcionando');
});