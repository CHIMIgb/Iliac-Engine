import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldMesh } from '../../engine/three/WorldMesh.js';

function makeTexture() {
  const data = new Uint8Array([255, 0, 0, 255]);
  const tex = new THREE.DataTexture(data, 1, 1);
  tex.needsUpdate = true;
  return tex;
}

const world = {
  vertices: [
    { id: 'v0', x: 0, y: 0 },
    { id: 'v1', x: 4, y: 0 },
    { id: 'v2', x: 4, y: 4 },
    { id: 'v3', x: 0, y: 4 },
  ],
  sectors: [
    {
      id: 's0',
      vertexIds: ['v0', 'v1', 'v2', 'v3'],
      floorH: 0,
      ceilH: 3,
      floorTex: 'stone',
      ceilTex: 'stone',
      wallTex: 'wall',
    },
  ],
  walls: [
    { id: 'w0', a: 'v0', b: 'v1', sectorFront: 's0', sectorBack: null, tex: 'wall' },
    { id: 'w1', a: 'v1', b: 'v2', sectorFront: 's0', sectorBack: null, tex: 'wall' },
    { id: 'w2', a: 'v2', b: 'v3', sectorFront: 's0', sectorBack: null, tex: 'wall' },
    { id: 'w3', a: 'v3', b: 'v0', sectorFront: 's0', sectorBack: null, tex: 'wall' },
  ],
};

test('WorldMesh.buildSectorWorld mergea superficies por textura', () => {
  const scene = new THREE.Scene();
  const textures = { stone: makeTexture(), wall: makeTexture() };
  const project = { world };

  WorldMesh.buildSectorWorld(scene, world, textures);

  const meshes = scene.children.filter((c) => c.isMesh);
  // stone se usa en suelo (doubleside) y techo (doubleside) → 1 mesh.
  // wall se usa en 4 paredes (frontside) → 1 mesh.
  assert.equal(meshes.length, 2, 'solo 2 meshes tras mergear por textura');
});

test('WorldMesh.buildSectorWorld conserva geometría mergeada', () => {
  const scene = new THREE.Scene();
  const textures = { stone: makeTexture(), wall: makeTexture() };
  const project = { world };

  WorldMesh.buildSectorWorld(scene, world, textures);

  for (const mesh of scene.children.filter((c) => c.isMesh)) {
    assert.ok(mesh.geometry, 'cada mesh tiene geometría');
    assert.ok(mesh.geometry.attributes.position, 'geometría tiene posiciones');
    assert.ok(mesh.geometry.index, 'geometría tiene índices');
  }
});

test('WorldMesh.clear elimina meshes del mundo sectorial', () => {
  const scene = new THREE.Scene();
  const textures = { stone: makeTexture(), wall: makeTexture() };

  WorldMesh.buildSectorWorld(scene, world, textures);
  assert.ok(scene.children.filter((c) => c.isMesh).length > 0);

  WorldMesh.clear(scene);
  assert.equal(scene.children.filter((c) => c.isMesh).length, 0, 'no quedan meshes');
});
