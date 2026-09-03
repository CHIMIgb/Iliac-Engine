/**
 * project.js — Demo: Casa de 2 pisos + montaña exterior con pozos.
 *
 * Layout (vista top-down, 40×32 unidades):
 *
 * Y=32 ┌──────────────┬──────────────┬──────────────┐
 *      │  Mountain    │  Mountain    │  Mountain    │  ← Terreno montañoso (vértices irregulares)
 * Y=24 ├──────────────┼──────────────┼──────────────┤
 *      │   Mountain   │   Balcony    │   Mountain   │  ← Balcón/exterior (conecta al pasillo 2º piso)
 * Y=16 ├──────────────┼──────────────┼──────────────┤
 *      │  Stairwell   │  Hallway 2F  │  Mountain    │  ← 2º piso: escalera sube → pasillo (floorH=3)
 * Y=8  ├──────────────┼──────────────┼──────────────┤
 *      │    Room      │              │              │  ← Planta baja: habitación cerrada
 * Y=0  └──────────────┴──────────────┴──────────────┘
 *      X=0          X=8           X=16          X=24         X=32         X=40
 *
 * Flujo del jugador:
 * 1. Spawnea en Room (piso 0, habitación cerrada 8×8).
 * 2. Portal a Stairwell (comparten borde x=8, y=0..8).
 * 3. Sube escaleras en Stairwell: base en (x=4, y=8), suben en +y hacia y=16, rise=3m (0→3).
 * 4. Arriba (y=16) entra a Hallway2F (floorH=3) — comparten borde y=16, x=0..8.
 * 5. Camina por Hallway2F al Balcony (portal sin pared en x=16, y=8..16).
 * 6. Balcony (floorH=3) → exterior montañoso con pozos.
 */

// ─── Vértices: grilla 6 cols × 5 rows (Y: 0, 8, 16, 24, 32) ───
const vertices = [
  // Fila Y=0 (suelo planta baja)
  { id: 'v0_0', x: 0,  y: 0  }, { id: 'v1_0', x: 8,  y: 0  },
  { id: 'v2_0', x: 16, y: 0  }, { id: 'v3_0', x: 24, y: 0  },
  { id: 'v4_0', x: 32, y: 0  }, { id: 'v5_0', x: 40, y: 0  },
  // Fila Y=8
  { id: 'v0_1', x: 0,  y: 8  }, { id: 'v1_1', x: 8,  y: 8  },
  { id: 'v2_1', x: 16, y: 8  }, { id: 'v3_1', x: 24, y: 8  },
  { id: 'v4_1', x: 32, y: 8  }, { id: 'v5_1', x: 40, y: 8  },
  // Fila Y=16 (nivel 2º piso)
  { id: 'v0_2', x: 0,  y: 16 }, { id: 'v1_2', x: 8,  y: 16 },
  { id: 'v2_2', x: 16, y: 16 }, { id: 'v3_2', x: 24, y: 16 },
  { id: 'v4_2', x: 32, y: 16 }, { id: 'v5_2', x: 40, y: 16 },
  // Fila Y=24
  { id: 'v0_3', x: 0,  y: 24 }, { id: 'v1_3', x: 8,  y: 24 },
  { id: 'v2_3', x: 16, y: 24 }, { id: 'v3_3', x: 24, y: 24 },
  { id: 'v4_3', x: 32, y: 24 }, { id: 'v5_3', x: 40, y: 24 },
  // Fila Y=32
  { id: 'v0_4', x: 0,  y: 32 }, { id: 'v1_4', x: 8,  y: 32 },
  { id: 'v2_4', x: 16, y: 32 }, { id: 'v3_4', x: 24, y: 32 },
  { id: 'v4_4', x: 32, y: 32 }, { id: 'v5_4', x: 40, y: 32 },
];

// ─── Sectores ───

// Ángulo de rampa para escaleras: suben 3m en 8u de run → atan(3/8) ≈ 20.5°
const stairAngle = (Math.atan(3 / 8) * 180) / Math.PI;

const sectors = [
  // ═══ PLANTA BAJA (Y=0..8) ═══
  
  // Room: habitación cerrada 8×8, piso 0, techo 3m
  {
    id: 'room',
    vertexIds: ['v0_0', 'v1_0', 'v1_1', 'v0_1'],
    floorH: 0, ceilH: 3,
    floorTex: 'wood', ceilTex: 'ceil', wallTex: 'wall',
  },
  // Stairwell: hueco de escalera 8×8 (x=0..8, y=8..16), floor 0, techo alto
  {
    id: 'stairwell',
    vertexIds: ['v0_1', 'v1_1', 'v1_2', 'v0_2'],
    floorH: 0, ceilH: 6,
    floorTex: 'stone', ceilTex: 'ceil', wallTex: 'wall',
  },
  // Exterior frontal (y=0..8, x=8..40) — solo geometría, bloqueado por muro sur
  {
    id: 'yard_front',
    vertexIds: ['v1_0', 'v2_0', 'v2_1', 'v1_1'],
    floorH: 0, ceilH: 50,
    floorTex: 'grass', ceilTex: 'sky', wallTex: 'wall',
  },
  {
    id: 'yard_front2',
    vertexIds: ['v2_0', 'v3_0', 'v3_1', 'v2_1'],
    floorH: 0, ceilH: 50,
    floorTex: 'grass', ceilTex: 'sky', wallTex: 'wall',
  },
  {
    id: 'yard_front3',
    vertexIds: ['v3_0', 'v4_0', 'v4_1', 'v3_1'],
    floorH: 0, ceilH: 50,
    floorTex: 'grass', ceilTex: 'sky', wallTex: 'wall',
  },
  {
    id: 'yard_front4',
    vertexIds: ['v4_0', 'v5_0', 'v5_1', 'v4_1'],
    floorH: 0, ceilH: 50,
    floorTex: 'grass', ceilTex: 'sky', wallTex: 'wall',
  },

  // ═══ SEGUNDO PISO (Y=8..16) — floorH = 3 ═══
  
  // Hallway2F: pasillo del 2º piso, 8×8, elevado a 3m (x=0..8, y=8..16)
  {
    id: 'hallway2f',
    vertexIds: ['v0_1', 'v1_1', 'v1_2', 'v0_2'],
    floorH: 3, ceilH: 6,
    floorTex: 'wood', ceilTex: 'ceil', wallTex: 'wall',
  },
  // Balcony: balcón/exterior 8×8 conectado al pasillo, floorH=3 (x=8..16, y=8..16)
  {
    id: 'balcony',
    vertexIds: ['v1_1', 'v2_1', 'v2_2', 'v1_2'],
    floorH: 3, ceilH: 50,
    floorTex: 'stone', ceilTex: 'sky', wallTex: 'wall',
  },
  // Mountain sector 1 (conecta al balcón al este, x=16..24, y=8..16)
  {
    id: 'mountain1',
    vertexIds: ['v2_1', 'v3_1', 'v3_2', 'v2_2'],
    floorH: [3, 3, 6, 5],
    ceilH: 50, floorTex: 'rock', ceilTex: 'sky',
  },
  // Mountain sector 2 (x=24..32, y=8..16)
  {
    id: 'mountain2',
    vertexIds: ['v3_1', 'v4_1', 'v4_2', 'v3_2'],
    floorH: [3, 4, 5, 6],
    ceilH: 50, floorTex: 'rock', ceilTex: 'sky',
  },
  // Mountain sector 3 (x=32..40, y=8..16)
  {
    id: 'mountain3',
    vertexIds: ['v4_1', 'v5_1', 'v5_2', 'v4_2'],
    floorH: [4, 2, 3, 5],  // pozo en v5_1 (2m)
    ceilH: 50, floorTex: 'dirt', ceilTex: 'sky',
  },

  // ═══ TERRENO MONTAÑOSO SUPERIOR (Y=16..24) ═══
  
  {
    id: 'mtn_nw',
    vertexIds: ['v0_2', 'v1_2', 'v1_3', 'v0_3'],
    floorH: [5, 5.5, 7, 6],
    ceilH: 50, floorTex: 'dirt', ceilTex: 'sky',
  },
  {
    id: 'mtn_n',
    vertexIds: ['v1_2', 'v2_2', 'v2_3', 'v1_3'],
    floorH: [5.5, 6.5, 8, 7],    // cumbre principal ~8m
    ceilH: 50, floorTex: 'rock', ceilTex: 'sky',
  },
  {
    id: 'mtn_ne',
    vertexIds: ['v2_2', 'v3_2', 'v3_3', 'v2_3'],
    floorH: [6.5, 4, 5, 6],      // pozo en v3_2 (4m vs vecinos 6.5/6)
    ceilH: 50, floorTex: 'rock', ceilTex: 'sky',
  },
  {
    id: 'mtn_cw',
    vertexIds: ['v3_2', 'v4_2', 'v4_3', 'v3_3'],
    floorH: [4, 2, 3, 5],        // pozo profundo en v4_2 (2m)
    ceilH: 50, floorTex: 'dirt', ceilTex: 'sky',
  },
  {
    id: 'mtn_ce',
    vertexIds: ['v4_2', 'v5_2', 'v5_3', 'v4_3'],
    floorH: [2, 1, 2, 3],        // zona de pozos (depresiones 1-2m)
    ceilH: 50, floorTex: 'dirt', ceilTex: 'sky',
  },

  // ═══ TERRENO MONTAÑOSO SUPERIOR (Y=24..32) ═══
  
  {
    id: 'mtn_far_nw',
    vertexIds: ['v0_3', 'v1_3', 'v1_4', 'v0_4'],
    floorH: [7, 8, 9, 8],
    ceilH: 50, floorTex: 'rock', ceilTex: 'sky',
  },
  {
    id: 'mtn_far_n',
    vertexIds: ['v1_3', 'v2_3', 'v2_4', 'v1_4'],
    floorH: [7, 5, 6, 8],  // valle/pozo en v2_3 (5m)
    ceilH: 50, floorTex: 'rock', ceilTex: 'sky',
  },
  {
    id: 'mtn_far_ne',
    vertexIds: ['v2_3', 'v3_3', 'v3_4', 'v2_4'],
    floorH: [5, 4, 5, 6],
    ceilH: 50, floorTex: 'dirt', ceilTex: 'sky',
  },
  {
    id: 'mtn_far_cw',
    vertexIds: ['v3_3', 'v4_3', 'v4_4', 'v3_4'],
    floorH: [5, 3, 4, 5],
    ceilH: 50, floorTex: 'dirt', ceilTex: 'sky',
  },
  {
    id: 'mtn_far_ce',
    vertexIds: ['v4_3', 'v5_3', 'v5_4', 'v4_4'],
    floorH: [3, 2, 3, 4],
    ceilH: 50, floorTex: 'dirt', ceilTex: 'sky',
  },
];

// ─── Paredes ───
const walls = [
  // ═══ BORDE SUR (y=0) — muro exterior cerrado ═══
  { id: 'ws0', a: 'v0_0', b: 'v1_0', sectorFront: 'room',       sectorBack: null, tex: 'wall' },
  { id: 'ws1', a: 'v1_0', b: 'v2_0', sectorFront: 'yard_front', sectorBack: null, tex: 'wall' },
  { id: 'ws2', a: 'v2_0', b: 'v3_0', sectorFront: 'yard_front2', sectorBack: null, tex: 'wall' },
  { id: 'ws3', a: 'v3_0', b: 'v4_0', sectorFront: 'yard_front3', sectorBack: null, tex: 'wall' },
  { id: 'ws4', a: 'v4_0', b: 'v5_0', sectorFront: 'yard_front4', sectorBack: null, tex: 'wall' },

  // ═══ BORDE OESTE (x=0) ═══
  { id: 'ww0', a: 'v0_1', b: 'v0_0', sectorFront: 'room',      sectorBack: null, tex: 'wall' },
  { id: 'ww1', a: 'v0_2', b: 'v0_1', sectorFront: 'stairwell', sectorBack: null, tex: 'wall' },
  { id: 'ww2', a: 'v0_3', b: 'v0_2', sectorFront: 'mtn_nw',    sectorBack: null, tex: 'rock' },
  { id: 'ww3', a: 'v0_4', b: 'v0_3', sectorFront: 'mtn_far_nw', sectorBack: null, tex: 'rock' },

  // ═══ BORDE ESTE (x=40) ═══
  { id: 'we0', a: 'v5_0', b: 'v5_1', sectorFront: 'yard_front4', sectorBack: null, tex: 'wall' },
  { id: 'we1', a: 'v5_1', b: 'v5_2', sectorFront: 'mountain3',   sectorBack: null, tex: 'rock' },
  { id: 'we2', a: 'v5_2', b: 'v5_3', sectorFront: 'mtn_ce',      sectorBack: null, tex: 'rock' },
  { id: 'we3', a: 'v5_3', b: 'v5_4', sectorFront: 'mtn_far_ce',  sectorBack: null, tex: 'rock' },

  // ═══ BORDE NORTE (y=32) ═══
  { id: 'wn0', a: 'v0_4', b: 'v1_4', sectorFront: 'mtn_far_nw', sectorBack: null, tex: 'rock' },
  { id: 'wn1', a: 'v1_4', b: 'v2_4', sectorFront: 'mtn_far_n',  sectorBack: null, tex: 'rock' },
  { id: 'wn2', a: 'v2_4', b: 'v3_4', sectorFront: 'mtn_far_ne', sectorBack: null, tex: 'rock' },
  { id: 'wn3', a: 'v3_4', b: 'v4_4', sectorFront: 'mtn_far_cw', sectorBack: null, tex: 'rock' },
  { id: 'wn4', a: 'v4_4', b: 'v5_4', sectorFront: 'mtn_far_ce', sectorBack: null, tex: 'rock' },

  // ═══ PORTALES PLANTA BAJA: Room ↔ Stairwell (borde x=8, y=0..8) ═══
  { id: 'wp_room_stair', a: 'v1_0', b: 'v1_1', sectorFront: 'room',      sectorBack: 'stairwell', tex: 'wall', portal: true },

  // ═══ PORTALES 2º PISO: Stairwell → Hallway2F (borde y=16, x=0..8) ═══
  // Stairwell (y=8..16) comparte borde y=16 con Hallway2F (y=8..16) en x=0..8
  // La escalera sube en +y dentro de Stairwell y llega a y=16 → Hallway2F
  { id: 'wp_stair_hall', a: 'v0_2', b: 'v1_2', sectorFront: 'stairwell', sectorBack: 'hallway2f', tex: 'wall', portal: true },

  // ═══ PORTALES 2º PISO: Hallway2F ↔ Balcony (borde x=16, y=8..16) — APERTURA TOTAL ═══
  { id: 'wp_hall_bal', a: 'v1_1', b: 'v1_2', sectorFront: 'hallway2f', sectorBack: 'balcony', tex: 'wall', portal: true },

  // ═══ PORTALES EXTERIOR: Balcony → Mountain1 (borde x=24, y=8..16) ═══
  { id: 'wp_bal_mtn', a: 'v2_1', b: 'v2_2', sectorFront: 'balcony', sectorBack: 'mountain1', tex: 'wall', portal: true },

  // ═══ PORTALES ENTRE MONTAÑAS FILA Y=8..16 ═══
  { id: 'wmt0', a: 'v2_1', b: 'v3_1', sectorFront: 'mountain1', sectorBack: 'mountain2', tex: 'rock', portal: true },
  { id: 'wmt1', a: 'v3_1', b: 'v4_1', sectorFront: 'mountain2', sectorBack: 'mountain3', tex: 'rock', portal: true },
  { id: 'wmt2', a: 'v4_1', b: 'v5_1', sectorFront: 'mountain3', sectorBack: null, tex: 'rock', portal: false }, // borde este

  // ═══ PORTALES ENTRE MONTAÑAS FILA Y=16..24 ═══
  { id: 'wmt3', a: 'v1_2', b: 'v1_3', sectorFront: 'mtn_nw', sectorBack: 'mtn_n', tex: 'rock', portal: true },
  { id: 'wmt4', a: 'v2_2', b: 'v2_3', sectorFront: 'mtn_n', sectorBack: 'mtn_ne', tex: 'rock', portal: true },
  { id: 'wmt5', a: 'v3_2', b: 'v3_3', sectorFront: 'mtn_ne', sectorBack: 'mtn_cw', tex: 'rock', portal: true },
  { id: 'wmt6', a: 'v4_2', b: 'v4_3', sectorFront: 'mtn_cw', sectorBack: 'mtn_ce', tex: 'rock', portal: true },
  { id: 'wmt7', a: 'v5_2', b: 'v5_3', sectorFront: 'mtn_ce', sectorBack: null, tex: 'rock', portal: false },

  // Laterales fila Y=16..24
  { id: 'wmt_lat0', a: 'v1_3', b: 'v2_3', sectorFront: 'mtn_nw', sectorBack: 'mtn_n', tex: 'rock', portal: true },
  { id: 'wmt_lat1', a: 'v2_3', b: 'v3_3', sectorFront: 'mtn_n', sectorBack: 'mtn_ne', tex: 'rock', portal: true },
  { id: 'wmt_lat2', a: 'v3_3', b: 'v4_3', sectorFront: 'mtn_ne', sectorBack: 'mtn_cw', tex: 'rock', portal: true },
  { id: 'wmt_lat3', a: 'v4_3', b: 'v5_3', sectorFront: 'mtn_cw', sectorBack: 'mtn_ce', tex: 'rock', portal: true },

  // ═══ PORTALES ENTRE MONTAÑAS FILA Y=24..32 ═══
  { id: 'wmt8', a: 'v1_3', b: 'v1_4', sectorFront: 'mtn_nw', sectorBack: 'mtn_far_nw', tex: 'rock', portal: true },
  { id: 'wmt9', a: 'v2_3', b: 'v2_4', sectorFront: 'mtn_n', sectorBack: 'mtn_far_n', tex: 'rock', portal: true },
  { id: 'wmt10', a: 'v3_3', b: 'v3_4', sectorFront: 'mtn_ne', sectorBack: 'mtn_far_ne', tex: 'rock', portal: true },
  { id: 'wmt11', a: 'v4_3', b: 'v4_4', sectorFront: 'mtn_cw', sectorBack: 'mtn_far_cw', tex: 'rock', portal: true },
  { id: 'wmt12', a: 'v5_3', b: 'v5_4', sectorFront: 'mtn_ce', sectorBack: 'mtn_far_ce', tex: 'rock', portal: true },

  // Laterales fila Y=24..32
  { id: 'wmt_lat4', a: 'v1_4', b: 'v2_4', sectorFront: 'mtn_far_nw', sectorBack: 'mtn_far_n', tex: 'rock', portal: true },
  { id: 'wmt_lat5', a: 'v2_4', b: 'v3_4', sectorFront: 'mtn_far_n', sectorBack: 'mtn_far_ne', tex: 'rock', portal: true },
  { id: 'wmt_lat6', a: 'v3_4', b: 'v4_4', sectorFront: 'mtn_far_ne', sectorBack: 'mtn_far_cw', tex: 'rock', portal: true },
  { id: 'wmt_lat7', a: 'v4_4', b: 'v5_4', sectorFront: 'mtn_far_cw', sectorBack: 'mtn_far_ce', tex: 'rock', portal: true },
];

// ─── Escaleras ───
// Suben desde el suelo del stairwell (floor 0) hasta el nivel del pasillo 2F (floor 3)
// Stairwell ocupa x=0..8, y=8..16. Escalera base en centro-x (x=4), y=8 (borde inferior).
// Dirección: +y (hacia arriba en Y). Rise: 3m (0→3). Run: 8u (cruza stairwell en Y). Steps: 12.
const ramps = [
  {
    id: 'main_stairs',
    type: 'stairs',
    pos: { x: 4, y: 8 },
    direction: { x: 0, y: 1 },
    width: 4,
    rise: 3.0,
    run: 8.0,
    steps: 12,
    tex: 'stone',
  },
];

// ─── Sprites billboard (decoración) ───
const sprites = [
  // Lámpara en la habitación
  { id: 'sp_lamp', tex: 'sprite_blue', pos: { x: 4, y: 4, z: 0.8 }, scale: 0.7, billboard: true },
  // Marcador en la cumbre principal
  { id: 'sp_peak', tex: 'sprite_blue', pos: { x: 12, y: 20, z: 9.5 }, scale: 1.2, billboard: true },
  // Árboles en terreno
  { id: 'sp_tree1', tex: 'sprite_green', pos: { x: 6, y: 18, z: 6.5 }, scale: 1.6, billboard: true },
  { id: 'sp_tree2', tex: 'sprite_green', pos: { x: 28, y: 20, z: 6.0 }, scale: 1.8, billboard: true },
  { id: 'sp_tree3', tex: 'sprite_green', pos: { x: 36, y: 12, z: 4.0 }, scale: 1.5, billboard: true },
  { id: 'sp_tree4', tex: 'sprite_green', pos: { x: 30, y: 28, z: 5.0 }, scale: 1.7, billboard: true },
];

// ─── Texturas: SVG + hex color ───
const textures = {
  wall:       './textures/muro.svg',
  wood:       './textures/suelo1.svg',
  stone:      './textures/suelo2.svg',
  ceil:       './textures/techo.svg',
  grass:      './textures/suelo1.svg',
  dirt:       './textures/suelo2.svg',
  rock:       './textures/muro.svg',
  sky:        0x87CEEB,
  sprite_green: './textures/verde.svg',
  sprite_blue:  './textures/azul.svg',
};

// ─── Proyecto final ───
export const project = {
  meta: {
    name: 'Two-Story House + Mountain Exterior',
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
    posX: 4,    // Centro de Room
    posY: 4,
    posZ: 0.6,
    yaw: Math.PI / 2,  // Mirando hacia +Y (hacia escaleras)
    pitch: 0,
  },
  world: {
    vertices,
    sectors,
    walls,
    ramps,
    sprites,
    textures,
  },
};