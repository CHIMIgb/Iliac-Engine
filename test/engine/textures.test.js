import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { loadTextures, makeMaterial } from '../../engine/three/textures.js';

const originalLoadAsync = THREE.TextureLoader.prototype.loadAsync;
const loadedUrls = [];

THREE.TextureLoader.prototype.loadAsync = async function (url) {
  loadedUrls.push(url);
  // Simula carga asíncrona para verificar paralelismo vía Promise.all.
  await new Promise((resolve) => setTimeout(resolve, 1));
  return { uuid: url };
};

after(() => {
  THREE.TextureLoader.prototype.loadAsync = originalLoadAsync;
});

test('loadTextures carga texturas en paralelo y aplica filtros/colorSpace una sola vez', async () => {
  loadedUrls.length = 0;
  const textures = await loadTextures({ a: 'a.png', b: 'b.png', c: 'c.png' });

  assert.equal(Object.keys(textures).length, 3, 'carga todas las texturas definidas');
  assert.deepStrictEqual(loadedUrls.sort(), ['a.png', 'b.png', 'c.png'], 'invoca loadAsync por cada URL');

  for (const tex of Object.values(textures)) {
    assert.equal(tex.magFilter, THREE.NearestFilter, 'magFilter = NearestFilter');
    assert.equal(tex.minFilter, THREE.NearestFilter, 'minFilter = NearestFilter');
    assert.equal(tex.colorSpace, THREE.SRGBColorSpace, 'colorSpace = SRGB');
  }
});

test('makeMaterial usa map cuando existe la textura', () => {
  const tex = { uuid: 'tex1' };
  const mat = makeMaterial({ t1: tex }, 't1', 0xff0000);
  assert.equal(mat.map, tex, 'asigna la textura al material');
});

test('makeMaterial no muta la textura', () => {
  const tex = { magFilter: 'keep', minFilter: 'keep', colorSpace: 'keep' };
  makeMaterial({ t1: tex }, 't1', 0xff0000);
  assert.equal(tex.magFilter, 'keep', 'no toca magFilter');
  assert.equal(tex.minFilter, 'keep', 'no toca minFilter');
  assert.equal(tex.colorSpace, 'keep', 'no toca colorSpace');
});

test('makeMaterial usa color fallback cuando falta la textura', () => {
  const mat = makeMaterial({}, 'missing', 0x00ff00);
  assert.equal(mat.color.getHex(), 0x00ff00, 'usa color fallback');
});
