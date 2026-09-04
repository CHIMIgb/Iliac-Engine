/**
 * sample-project.ts — Proyecto inicial del Studio.
 *
 * Dos habitaciones 8×16 conectadas por un portal: la base editable mínima.
 * Se carga en el EditorState (F3) y se serializa a project.json v3.
 *
 * Layout (vista top-down):
 *
 * Y=16 ┌──────────────┬──────────────┐
 *      │     room     │     hall     │  ← 2 habitaciones conectadas
 * Y=0  └──────────────┴──────────────┘
 *      X=0          X=8          X=16
 */

const vertices = [
  { id: 'v0_0', x: 0,  y: 0  },
  { id: 'v1_0', x: 8,  y: 0  },
  { id: 'v2_0', x: 16, y: 0  },
  { id: 'v0_2', x: 0,  y: 16 },
  { id: 'v1_2', x: 8,  y: 16 },
  { id: 'v2_2', x: 16, y: 16 },
];

const sectors = [
  // Room: habitación (x=0..8, y=0..16)
  {
    id: 'room',
    vertexIds: ['v0_0', 'v1_0', 'v1_2', 'v0_2'],
    floorH: 0, ceilH: 3,
    floorTex: 'wood', ceilTex: 'ceil', wallTex: 'wall',
  },
  // Hall: pasillo (x=8..16, y=0..16) conectado por portal
  {
    id: 'hall',
    vertexIds: ['v1_0', 'v2_0', 'v2_2', 'v1_2'],
    floorH: 0, ceilH: 3,
    floorTex: 'stone', ceilTex: 'ceil', wallTex: 'wall',
  },
];

const walls = [
  // Borde sur (y=0)
  { id: 'ws0', a: 'v0_0', b: 'v1_0', sectorFront: 'room', sectorBack: null, tex: 'wall' },
  { id: 'ws1', a: 'v1_0', b: 'v2_0', sectorFront: 'hall', sectorBack: null, tex: 'wall' },
  // Borde oeste (x=0)
  { id: 'ww0', a: 'v0_2', b: 'v0_0', sectorFront: 'room', sectorBack: null, tex: 'wall' },
  // Borde este (x=16)
  { id: 'we0', a: 'v2_0', b: 'v2_2', sectorFront: 'hall', sectorBack: null, tex: 'wall' },
  // Borde norte (y=16)
  { id: 'wn0', a: 'v0_2', b: 'v1_2', sectorFront: 'room', sectorBack: null, tex: 'wall' },
  { id: 'wn1', a: 'v1_2', b: 'v2_2', sectorFront: 'hall', sectorBack: null, tex: 'wall' },
  // Portal Room ↔ Hall (borde x=8, y=0..16)
  { id: 'wp_room_hall', a: 'v1_0', b: 'v1_2', sectorFront: 'room', sectorBack: 'hall', tex: 'wall', portal: true },
];

const sprites = [
  { id: 'sp_lamp', tex: 'sprite_blue', pos: { x: 4, y: 4, z: 0.8 }, scale: 0.7, billboard: true },
];

const textures = {
  wall:       '/textures/muro.svg',
  wood:       '/textures/suelo1.svg',
  stone:      '/textures/suelo2.svg',
  ceil:       '/textures/techo.svg',
  sprite_blue: '/textures/azul.svg',
};

/**
 * Proyecto inicial del editor: esqueleto mínimo y válido que el usuario edita.
 */
export const sampleProject = {
  meta: {
    name: 'Proyecto nuevo',
    schemaVersion: 3,
    renderMode: '3d',
  },
  render: {
    fov: 80,
    near: 0.1,
    far: 500,
    backgroundColor: 0x1a1a2e,
    ambientLight: { color: 0xffffff, intensity: 0.5 },
    directionalLight: { color: 0xffffee, intensity: 0.8, position: [20, 30, 20] },
  },
  camera: {
    posX: 4,
    posY: 4,
    posZ: 0.6,
    yaw: Math.PI / 2,
    pitch: 0,
  },
  world: {
    vertices,
    sectors,
    walls,
    ramps: [],
    sprites,
    textures,
  },
};

export type Project = typeof sampleProject;
