import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSprites } from '../../engine/three/SpriteSystem.js';

/**
 * sprite-anchor.test.js — anclaje del billboard al suelo.
 *
 * Regresión 2026-09-18: `SpriteSystem` centraba el billboard en `sprite.pos.z`,
 * así que con terrenos elevados la mitad del sprite quedaba enterrada y se veía
 * a media altura de la caja de colisión (cuyo centro sí usa base + h/2). El
 * contrato: `pos.z` = altura del PIE (suelo); el billboard se dibuja apoyado,
 * con el centro en `pos.z + scale/2` (misma disciplina que EntityPreviewMesh).
 */

function makeTexture() {
  const data = new Uint8Array([255, 0, 0, 255]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.needsUpdate = true;
  return tex;
}

test('sprite estático: base apoyada en pos.z (centro = pos.z + scale/2)', () => {
  const scene = new THREE.Scene();
  buildSprites(scene, {
    sprites: [{ id: 'sp0', tex: 'sprite', pos: { x: 3, y: 4, z: 2 }, scale: 3 }],
  }, { sprite: makeTexture() });
  const s = scene.children.find((c) => c.isSprite);
  assert.ok(s, 'sprite creado');
  assert.equal(s.position.y, 2 + 3 / 2, 'centro elevado media altura');
  assert.equal(s.position.x, 3);
  assert.equal(s.position.z, 4);
  assert.equal(s.scale.x, 3);
});

test('sprite animado: misma disciplina (base en pos.z)', () => {
  const scene = new THREE.Scene();
  buildSprites(scene, {
    spriteAnims: { idle: { frames: ['f0', 'f1'] } },
    sprites: [{ id: 'sp1', tex: 'f0', anim: 'idle', pos: { x: 0, y: 0, z: 1.5 }, scale: 2 }],
  }, { f0: makeTexture(), f1: makeTexture() });
  const s = scene.children.find((c) => c.isSprite);
  assert.ok(s, 'sprite animado creado');
  assert.equal(s.position.y, 1.5 + 2 / 2, 'centro elevado media altura');
});

test('scale por defecto 1: base en pos.z + 0.5', () => {
  const scene = new THREE.Scene();
  buildSprites(scene, {
    sprites: [{ id: 'sp2', tex: 'sprite', pos: { x: 0, y: 0, z: 0 } }],
  }, { sprite: makeTexture() });
  const s = scene.children.find((c) => c.isSprite);
  assert.ok(s, 'sprite creado');
  assert.equal(s.position.y, 0.5);
});

test('sprite sin textura sigue ignorándose (ni entierra ni crea objeto)', () => {
  const scene = new THREE.Scene();
  buildSprites(scene, {
    sprites: [{ id: 'sp3', tex: 'missing', pos: { x: 0, y: 0, z: 0 }, scale: 2 }],
  }, {});
  assert.equal(scene.children.length, 0);
});