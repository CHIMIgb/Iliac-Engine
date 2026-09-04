/**
 * defaultProject.ts — Plantilla inicial del Level Editor (schema v3)
 *
 * Proyecto de arranque: una habitación de 10x10 + una adyacente sin conectar,
 * un portal real y un sprite. Las texturas referencia los placeholder SVG de
 * `demo/textures/` (rutas relativas al project.json que guarda el editor).
 *
 * Nota sobre texturas: son placeholders de desarrollo. Con el Asset Manager
 * (F5) el creador asignará sus propias texturas por id.
 */

import type { LevelProject } from './LevelDocument.js';

export const VERTEX_GRID = (): Array<{ id: string; x: number; y: number }> => {
  const out: Array<{ id: string; x: number; y: number }> = [];
  for (let y = 0; y <= 16; y += 2) {
    for (let x = 0; x <= 16; x += 2) {
      out.push({ id: `v_${x}_${y}`, x, y });
    }
  }
  return out;
};

export const DEFAULT_PROJECT_TEXTURES: Record<string, string> = {
  wall: './textures/muro.svg',
  brick: './textures/ladrillo.svg',
  floor: './textures/suelo1.svg',
  stone: './textures/suelo2.svg',
  ceil: './textures/techo.svg',
  lamp: './textures/azul.svg',
  column: './textures/sprite_columna.svg',
};

/** Plantilla por defecto del proyecto en formato schema v3. */
export function createDefaultProject(): LevelProject {
  const vertices = VERTEX_GRID();
  const sectors = [
    {
      id: 'room_a',
      vertexIds: ['v_2_2', 'v_8_2', 'v_8_8', 'v_2_8'],
      floorH: 0,
      ceilH: 3,
      floorTex: 'floor',
      ceilTex: 'ceil',
      wallTex: 'wall',
    },
    {
      id: 'room_b',
      vertexIds: ['v_12_2', 'v_14_2', 'v_14_8', 'v_12_8'],
      floorH: 0,
      ceilH: 3,
      floorTex: 'stone',
      ceilTex: 'ceil',
      wallTex: 'brick',
    },
  ];
  // Portal: pared compartida entre room_a (frontal) y room_b (trasero).
  const walls = [
    // room_a
    { id: 'w1', a: 'v_2_2', b: 'v_8_2', sectorFront: 'room_a', sectorBack: null },
    { id: 'w2', a: 'v_8_2', b: 'v_8_4', sectorFront: 'room_a', sectorBack: null },
    { id: 'portal_ab', a: 'v_8_4', b: 'v_8_6', sectorFront: 'room_a', sectorBack: 'room_b', portal: true },
    { id: 'w3', a: 'v_8_6', b: 'v_8_8', sectorFront: 'room_a', sectorBack: null },
    { id: 'w4', a: 'v_8_8', b: 'v_2_8', sectorFront: 'room_a', sectorBack: null },
    { id: 'w5', a: 'v_2_8', b: 'v_2_2', sectorFront: 'room_a', sectorBack: null },
    // room_b
    { id: 'w6', a: 'v_14_2', b: 'v_12_2', sectorFront: 'room_b', sectorBack: null },
    { id: 'w7', a: 'v_12_2', b: 'v_12_8', sectorFront: 'room_b', sectorBack: null },
    { id: 'w8', a: 'v_12_8', b: 'v_14_8', sectorFront: 'room_b', sectorBack: null },
    { id: 'w9', a: 'v_14_8', b: 'v_14_2', sectorFront: 'room_b', sectorBack: null },
  ];

  return {
    meta: { name: 'Nivel sin título', schemaVersion: 3, renderMode: '3d' },
    render: {
      fov: 80,
      near: 0.1,
      far: 500,
      backgroundColor: 0x000000,
      ambientLight: { color: 0xffffff, intensity: 0.4 },
      directionalLight: { color: 0xffaa88, intensity: 0.6, position: [12, 10, 12] },
    },
    camera: { posX: 5, posY: 5, posZ: 0.6, yaw: -0.5, pitch: 0 },
    world: {
      vertices,
      sectors,
      walls,
      ramps: [],
      sprites: [
        { id: 'lamp1', tex: 'lamp', pos: { x: 5, y: 5, z: 2.2 }, scale: 0.8, billboard: true },
        { id: 'column1', tex: 'column', pos: { x: 13, y: 5, z: 1.5 }, scale: 3.0, billboard: true },
      ],
      textures: { ...DEFAULT_PROJECT_TEXTURES },
    },
  };
}