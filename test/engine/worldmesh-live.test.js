import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { WorldMesh } from '../../engine/three/WorldMesh.js';

// Terreno 2×2 tipo grilla: 9 vértices compartidos, celdas con floorH array.
function terrainWorld() {
  const vertices = [];
  for (let r = 0; r <= 2; r++) {
    for (let c = 0; c <= 2; c++) vertices.push({ id: `v${c}_${r}`, x: c, y: r });
  }
  const sectors = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      sectors.push({
        id: `s${c}_${r}`,
        vertexIds: [`v${c}_${r}`, `v${c + 1}_${r}`, `v${c + 1}_${r + 1}`, `v${c}_${r + 1}`],
        floorH: [0, 0, 0, 0],
        ceilH: 50,
        floorTex: 'grass',
        ceilTex: 'sky',
        wallTex: 'rock',
      });
    }
  }
  return { vertices, sectors, walls: [], textures: {} };
}

const asProject = (world) => ({
  meta: { name: 't', schemaVersion: 3, renderMode: '3d' },
  world,
});
// El grupo 'grass:DoubleSide' se inserta primero → mesh de suelo en children[0].
const floorAttr = (scene) => scene.children[0].geometry.attributes.position;

test('applyHeightsIfOnlyChange deja el buffer idéntico a un build completo', () => {
  const oldWorld = terrainWorld();
  const newWorld = JSON.parse(JSON.stringify(oldWorld));
  newWorld.sectors[0].floorH = [1.5, 0.25, 2, 0];
  newWorld.sectors[3].floorH = [0.5, 0.5, 3, 0.5];

  // Referencia: build completo desde cero con el mundo nuevo (primero, para
  // que el registro global de slots quede de la escena parcheada).
  const sceneRef = new THREE.Scene();
  WorldMesh.build(sceneRef, asProject(newWorld), {});

  // Escena viva: build con el mundo viejo y parche in-place hacia el nuevo.
  const scene = new THREE.Scene();
  WorldMesh.build(scene, asProject(oldWorld), {});
  assert.equal(WorldMesh.applyHeightsIfOnlyChange(scene, oldWorld, newWorld), true);

  assert.deepEqual([...floorAttr(scene).array], [...floorAttr(sceneRef).array]);
  assert.deepEqual(
    [...scene.children[0].geometry.attributes.normal.array],
    [...sceneRef.children[0].geometry.attributes.normal.array],
  );
});

test('applyHeightsIfOnlyChange no toca sectores sin cambios y detecta alturas reales', () => {
  const oldWorld = terrainWorld();
  const newWorld = JSON.parse(JSON.stringify(oldWorld));
  newWorld.sectors[2].floorH = [0, 0, 4, 0];
  const scene = new THREE.Scene();
  WorldMesh.build(scene, asProject(oldWorld), {});
  assert.equal(WorldMesh.applyHeightsIfOnlyChange(scene, oldWorld, newWorld), true);
  // sector 2 = bloque de vértices [8..12) del buffer grass; su v2 (y=3, z=1→pos) sube a 4
  assert.equal(floorAttr(scene).getY(8 + 2), 4);
  assert.equal(floorAttr(scene).getY(0), 0); // sector 0 intacto
});

test('applyHeightsIfOnlyChange exige rebuild si un vértice cambió de XZ', () => {
  const oldWorld = terrainWorld();
  const newWorld = JSON.parse(JSON.stringify(oldWorld));
  newWorld.vertices[4].x += 1; // vértice central movido (herramienta Mover)
  const scene = new THREE.Scene();
  WorldMesh.build(scene, asProject(oldWorld), {});
  assert.equal(WorldMesh.applyHeightsIfOnlyChange(scene, oldWorld, newWorld), false);
});

test('applyHeightsIfOnlyChange exige rebuild si cambió la topología', () => {
  const oldWorld = terrainWorld();
  const newWorld = JSON.parse(JSON.stringify(oldWorld));
  newWorld.sectors.pop();
  const scene = new THREE.Scene();
  WorldMesh.build(scene, asProject(oldWorld), {});
  assert.equal(WorldMesh.applyHeightsIfOnlyChange(scene, oldWorld, newWorld), false);
});
