/**
 * project.js — Datos del mundo demo con terreno procedural de montaña.
 *
 * Usa el generador de terreno del motor para crear una grilla de sectores
 * con alturas irregulares estilo Daggerfall.
 */

import { generateTerrain } from '../engine/core/terrain.js';

// Generar terreno de 16×16 celdas, 2 unidades por celda = 32×32 área total
const terrain = generateTerrain({
  cols: 16,
  rows: 16,
  cellSize: 2,
  seed: 7,
  noiseScale: 0.07,
  heightScale: 8,
  octaves: 5,
  textures: {
    flat: 'grass',
    slope: 'dirt',
    steep: 'rock',
  },
  slopeThresholds: [0.3, 0.7],
  ceilH: 50,
  ceilTex: 'ceil',
  wallTex: 'rock',
});

// Posición inicial: centro del terreno, sobre la superficie
const centerCol = 8;
const centerRow = 8;
// Buscar la altura del centro para posicionar la cámara
const centerSector = terrain.sectors[centerRow * 16 + centerCol];
const avgHeight = centerSector.floorH.reduce((a, b) => a + b, 0) / 4;

export const project = {
  meta: {
    name: 'Terrain Demo',
    schemaVersion: 3,
    renderMode: '3d',
  },
  camera: {
    posX: centerCol * 2 + 1,
    posY: centerRow * 2 + 1,
    posZ: avgHeight + 0.6,
    yaw: 0,
    pitch: 0,
  },
  world: {
    vertices: terrain.vertices,
    sectors: terrain.sectors,
    walls: terrain.walls,
    ramps: [],
    sprites: [],
    textures: {
      grass: './textures/suelo1.svg',
      dirt: './textures/suelo2.svg',
      rock: './textures/muro.svg',
      ceil: './textures/techo.svg',
    },
  },
};
