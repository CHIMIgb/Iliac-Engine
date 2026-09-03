// project.js — Demo 1: Habitaciones conectadas (estilo Lode)

const vertices = [
  // Room 1 (SW)
  { id: 'v_r1_0', x: 0, y: 0 }, { id: 'v_r1_1', x: 8, y: 0 },
  { id: 'v_r1_2', x: 8, y: 8 }, { id: 'v_r1_3', x: 0, y: 8 },
  // Room 2 (SE)
  { id: 'v_r2_0', x: 12, y: 0 }, { id: 'v_r2_1', x: 20, y: 0 },
  { id: 'v_r2_2', x: 20, y: 8 }, { id: 'v_r2_3', x: 12, y: 8 },
  // Room 3 (NW)
  { id: 'v_r3_0', x: 0, y: 12 }, { id: 'v_r3_1', x: 8, y: 12 },
  { id: 'v_r3_2', x: 8, y: 20 }, { id: 'v_r3_3', x: 0, y: 20 },
  // Room 4 (NE)
  { id: 'v_r4_0', x: 12, y: 12 }, { id: 'v_r4_1', x: 20, y: 12 },
  { id: 'v_r4_2', x: 20, y: 20 }, { id: 'v_r4_3', x: 12, y: 20 },

  // Puntos adicionales para portales y pasillos (ancho 4)
  // Pasillo H sur (conecta R1 y R2)
  { id: 'v_hs_0', x: 8, y: 2 }, { id: 'v_hs_1', x: 12, y: 2 },
  { id: 'v_hs_2', x: 12, y: 6 }, { id: 'v_hs_3', x: 8, y: 6 },
  
  // Pasillo H norte (conecta R3 y R4)
  { id: 'v_hn_0', x: 8, y: 14 }, { id: 'v_hn_1', x: 12, y: 14 },
  { id: 'v_hn_2', x: 12, y: 18 }, { id: 'v_hn_3', x: 8, y: 18 },

  // Pasillo V oeste (conecta R1 y R3)
  { id: 'v_vw_0', x: 2, y: 8 }, { id: 'v_vw_1', x: 6, y: 8 },
  { id: 'v_vw_2', x: 6, y: 12 }, { id: 'v_vw_3', x: 2, y: 12 },

  // Pasillo V este (conecta R2 y R4)
  { id: 'v_ve_0', x: 14, y: 8 }, { id: 'v_ve_1', x: 18, y: 8 },
  { id: 'v_ve_2', x: 18, y: 12 }, { id: 'v_ve_3', x: 14, y: 12 },
];

// Reutilizamos vértices en la definición de paredes
// Vamos a construir los sectores usando los vértices principales, y añadir los vértices de los portales
// Para que sea un polígono simple, necesitamos vértices ordenados.

// Es más fácil redefinir vértices exactos por sector:
const v2 = [
  // Room 1 (0..10, 0..10)
  { id: 'r1_00', x: 0, y: 0 }, { id: 'r1_10', x: 10, y: 0 }, { id: 'r1_10_10', x: 10, y: 10 }, { id: 'r1_0_10', x: 0, y: 10 },
  // Portal R1-E (10, 4) a (10, 6)
  { id: 'r1_p1_a', x: 10, y: 4 }, { id: 'r1_p1_b', x: 10, y: 6 },
  // Portal R1-N (4, 10) a (6, 10)
  { id: 'r1_p2_a', x: 6, y: 10 }, { id: 'r1_p2_b', x: 4, y: 10 },
];
// Esta es la forma correcta: los vértices definen las esquinas, las paredes conectan vértices.

// Vamos a generar una cuadrícula regular y luego definir los sectores
const gridV = [];
for (let y = 0; y <= 24; y += 2) {
  for (let x = 0; x <= 24; x += 2) {
    gridV.push({ id: `v_${x}_${y}`, x, y });
  }
}

const sectors = [
  // Room 1 (Bottom Left)
  { id: 'room1', vertexIds: ['v_2_2', 'v_8_2', 'v_8_8', 'v_2_8'], floorH: 0, ceilH: 3, floorTex: 'wood', ceilTex: 'ceil', wallTex: 'wall' },
  // Room 2 (Bottom Right)
  { id: 'room2', vertexIds: ['v_16_2', 'v_22_2', 'v_22_8', 'v_16_8'], floorH: 0, ceilH: 3, floorTex: 'wood', ceilTex: 'ceil', wallTex: 'brick' },
  // Room 3 (Top Left)
  { id: 'room3', vertexIds: ['v_2_16', 'v_8_16', 'v_8_22', 'v_2_22'], floorH: 0, ceilH: 3, floorTex: 'wood', ceilTex: 'ceil', wallTex: 'brick' },
  // Room 4 (Top Right)
  { id: 'room4', vertexIds: ['v_16_16', 'v_22_16', 'v_22_22', 'v_16_22'], floorH: 0, ceilH: 3, floorTex: 'wood', ceilTex: 'ceil', wallTex: 'wall' },
  // Hall South (conecta Room 1 y Room 2)
  { id: 'hall_s', vertexIds: ['v_8_4', 'v_16_4', 'v_16_6', 'v_8_6'], floorH: 0, ceilH: 2.5, floorTex: 'stone', ceilTex: 'ceil', wallTex: 'wood_dark' },
  // Hall North (conecta Room 3 y Room 4)
  { id: 'hall_n', vertexIds: ['v_8_18', 'v_16_18', 'v_16_20', 'v_8_20'], floorH: 0, ceilH: 2.5, floorTex: 'stone', ceilTex: 'ceil', wallTex: 'wood_dark' },
  // Hall West (conecta Room 1 y Room 3)
  { id: 'hall_w', vertexIds: ['v_4_8', 'v_6_8', 'v_6_16', 'v_4_16'], floorH: 0, ceilH: 2.5, floorTex: 'stone', ceilTex: 'ceil', wallTex: 'wood_dark' },
  // Hall East (conecta Room 2 y Room 4)
  { id: 'hall_e', vertexIds: ['v_18_8', 'v_20_8', 'v_20_16', 'v_18_16'], floorH: 0, ceilH: 2.5, floorTex: 'stone', ceilTex: 'ceil', wallTex: 'wood_dark' },
];

const walls = [
  // Room 1
  { id: 'w1_1', a: 'v_2_2', b: 'v_8_2', sectorFront: 'room1', sectorBack: null },
  { id: 'w1_2', a: 'v_8_2', b: 'v_8_4', sectorFront: 'room1', sectorBack: null },
  { id: 'wp_r1_hs', a: 'v_8_4', b: 'v_8_6', sectorFront: 'room1', sectorBack: 'hall_s', portal: true },
  { id: 'w1_3', a: 'v_8_6', b: 'v_8_8', sectorFront: 'room1', sectorBack: null },
  { id: 'w1_4', a: 'v_8_8', b: 'v_6_8', sectorFront: 'room1', sectorBack: null },
  { id: 'wp_r1_hw', a: 'v_6_8', b: 'v_4_8', sectorFront: 'room1', sectorBack: 'hall_w', portal: true },
  { id: 'w1_5', a: 'v_4_8', b: 'v_2_8', sectorFront: 'room1', sectorBack: null },
  { id: 'w1_6', a: 'v_2_8', b: 'v_2_2', sectorFront: 'room1', sectorBack: null },

  // Room 2
  { id: 'w2_1', a: 'v_16_2', b: 'v_22_2', sectorFront: 'room2', sectorBack: null },
  { id: 'w2_2', a: 'v_22_2', b: 'v_22_8', sectorFront: 'room2', sectorBack: null },
  { id: 'w2_3', a: 'v_22_8', b: 'v_20_8', sectorFront: 'room2', sectorBack: null },
  { id: 'wp_r2_he', a: 'v_20_8', b: 'v_18_8', sectorFront: 'room2', sectorBack: 'hall_e', portal: true },
  { id: 'w2_4', a: 'v_18_8', b: 'v_16_8', sectorFront: 'room2', sectorBack: null },
  { id: 'w2_5', a: 'v_16_8', b: 'v_16_6', sectorFront: 'room2', sectorBack: null },
  { id: 'wp_r2_hs', a: 'v_16_6', b: 'v_16_4', sectorFront: 'room2', sectorBack: 'hall_s', portal: true },
  { id: 'w2_6', a: 'v_16_4', b: 'v_16_2', sectorFront: 'room2', sectorBack: null },

  // Room 3
  { id: 'w3_1', a: 'v_2_16', b: 'v_4_16', sectorFront: 'room3', sectorBack: null },
  { id: 'wp_r3_hw', a: 'v_4_16', b: 'v_6_16', sectorFront: 'room3', sectorBack: 'hall_w', portal: true },
  { id: 'w3_2', a: 'v_6_16', b: 'v_8_16', sectorFront: 'room3', sectorBack: null },
  { id: 'w3_3', a: 'v_8_16', b: 'v_8_18', sectorFront: 'room3', sectorBack: null },
  { id: 'wp_r3_hn', a: 'v_8_18', b: 'v_8_20', sectorFront: 'room3', sectorBack: 'hall_n', portal: true },
  { id: 'w3_4', a: 'v_8_20', b: 'v_8_22', sectorFront: 'room3', sectorBack: null },
  { id: 'w3_5', a: 'v_8_22', b: 'v_2_22', sectorFront: 'room3', sectorBack: null },
  { id: 'w3_6', a: 'v_2_22', b: 'v_2_16', sectorFront: 'room3', sectorBack: null },

  // Room 4
  { id: 'w4_1', a: 'v_16_16', b: 'v_18_16', sectorFront: 'room4', sectorBack: null },
  { id: 'wp_r4_he', a: 'v_18_16', b: 'v_20_16', sectorFront: 'room4', sectorBack: 'hall_e', portal: true },
  { id: 'w4_2', a: 'v_20_16', b: 'v_22_16', sectorFront: 'room4', sectorBack: null },
  { id: 'w4_3', a: 'v_22_16', b: 'v_22_22', sectorFront: 'room4', sectorBack: null },
  { id: 'w4_4', a: 'v_22_22', b: 'v_16_22', sectorFront: 'room4', sectorBack: null },
  { id: 'w4_5', a: 'v_16_22', b: 'v_16_20', sectorFront: 'room4', sectorBack: null },
  { id: 'wp_r4_hn', a: 'v_16_20', b: 'v_16_18', sectorFront: 'room4', sectorBack: 'hall_n', portal: true },
  { id: 'w4_6', a: 'v_16_18', b: 'v_16_16', sectorFront: 'room4', sectorBack: null },

  // Hall South
  { id: 'hs_1', a: 'v_8_4', b: 'v_16_4', sectorFront: 'hall_s', sectorBack: null },
  { id: 'hs_2', a: 'v_16_6', b: 'v_8_6', sectorFront: 'hall_s', sectorBack: null },

  // Hall North
  { id: 'hn_1', a: 'v_8_18', b: 'v_16_18', sectorFront: 'hall_n', sectorBack: null },
  { id: 'hn_2', a: 'v_16_20', b: 'v_8_20', sectorFront: 'hall_n', sectorBack: null },

  // Hall West
  { id: 'hw_1', a: 'v_4_8', b: 'v_4_16', sectorFront: 'hall_w', sectorBack: null },
  { id: 'hw_2', a: 'v_6_16', b: 'v_6_8', sectorFront: 'hall_w', sectorBack: null },

  // Hall East
  { id: 'he_1', a: 'v_18_8', b: 'v_18_16', sectorFront: 'hall_e', sectorBack: null },
  { id: 'he_2', a: 'v_20_16', b: 'v_20_8', sectorFront: 'hall_e', sectorBack: null },
];

const sprites = [
  // Lámparas en cada habitación (en el techo)
  { id: 's1', tex: 'lamp', pos: { x: 5, y: 5, z: 2.2 }, scale: 0.8, billboard: true },
  { id: 's2', tex: 'lamp', pos: { x: 19, y: 5, z: 2.2 }, scale: 0.8, billboard: true },
  { id: 's3', tex: 'lamp', pos: { x: 5, y: 19, z: 2.2 }, scale: 0.8, billboard: true },
  { id: 's4', tex: 'lamp', pos: { x: 19, y: 19, z: 2.2 }, scale: 0.8, billboard: true },
  
  // Columnas decorativas
  { id: 'c1', tex: 'column', pos: { x: 3, y: 3, z: 1.5 }, scale: 3.0, billboard: true },
  { id: 'c2', tex: 'column', pos: { x: 7, y: 3, z: 1.5 }, scale: 3.0, billboard: true },
  { id: 'c3', tex: 'column', pos: { x: 21, y: 21, z: 1.5 }, scale: 3.0, billboard: true },
];

export const project = {
  meta: { name: 'Demo Habitaciones', schemaVersion: 3, renderMode: '3d' },
  render: {
    fov: 80, near: 0.1, far: 500, backgroundColor: 0x000000,
    ambientLight: { color: 0xffffff, intensity: 0.4 },
    directionalLight: { color: 0xffaa88, intensity: 0.6, position: [12, 10, 12] },
  },
  camera: { posX: 5, posY: 5, posZ: 0.6, yaw: 0.78, pitch: 0 },
  world: {
    vertices: gridV,
    sectors,
    walls,
    ramps: [],
    sprites,
    textures: {
      wall: '../../demo/textures/muro.svg',
      brick: '../../demo/textures/ladrillo.svg',
      wood: '../../demo/textures/suelo1.svg',
      stone: '../../demo/textures/suelo2.svg',
      ceil: '../../demo/textures/techo.svg',
      wood_dark: '../../demo/textures/madera_oscura.svg',
      lamp: '../../demo/textures/azul.svg',
      column: '../../demo/textures/sprite_columna.svg',
    },
  },
};
