import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildStairsMeshes } from '../../engine/three/StairsMesh.js';
import { buildSprites } from '../../engine/three/SpriteSystem.js';

function makeTexture() {
  const data = new Uint8Array([255, 0, 0, 255]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.needsUpdate = true;
  return tex;
}

test('buildStairsMeshes genera un mesh por peldaño', () => {
  const scene = new THREE.Scene();
  const world = {
    ramps: [
      { id: 'r0', type: 'stairs', pos: { x: 0, y: 0 }, direction: { x: 1, y: 0 }, width: 1, rise: 1, run: 2, steps: 4, tex: 'stair' },
    ],
  };
  const textures = { stair: makeTexture() };
  buildStairsMeshes(scene, world, textures);
  const meshes = scene.children.filter((c) => c.isMesh);
  assert.equal(meshes.length, 4, '4 peldaños');
});

test('buildSprites genera un THREE.Sprite por sprite', () => {
  const scene = new THREE.Scene();
  const world = {
    sprites: [
      { id: 'sp0', tex: 'sprite', pos: { x: 1, y: 2, z: 0.5 }, scale: 1.5 },
    ],
  };
  const textures = { sprite: makeTexture() };
  buildSprites(scene, world, textures);
  const sprites = scene.children.filter((c) => c.isSprite);
  assert.equal(sprites.length, 1);
  assert.equal(sprites[0].position.x, 1);
  assert.equal(sprites[0].position.z, 2);
  assert.equal(sprites[0].position.y, 0.5);
  assert.equal(sprites[0].scale.x, 1.5);
});

test('buildSprites ignora sprites sin textura', () => {
  const scene = new THREE.Scene();
  const world = {
    sprites: [
      { id: 'sp0', tex: 'missing', pos: { x: 0, y: 0, z: 0 } },
    ],
  };
  buildSprites(scene, world, {});
  assert.equal(scene.children.length, 0);
});
