/**
 * project.js — Demo exhaustiva: muestra TODAS las capacidades del motor.
 *
 * Layout del mundo (30×12 unidades, vista top-down):
 *
 *  Y=12 ┌──────┬──────┬──────┬──────┬──────┐
 *       │ Hill1│ Hill2│ Hill3│ Hill4│ Hill5│  ← Terreno con alturas por vértice
 *  Y=6  ├──────┼──────┼──────┼──────┼──────┤
 *       │Room 1│Slope │ High │Stairs│ Yard │  ← Edificio: pendiente, escaleras
 *       │ⓘ    │  ↗   │ Room │  ↗   │ 🌲   │     techo inclinado, sprites
 *  Y=0  └──────┴──────┴──────┴──────┴──────┘
 *       X=0   X=6   X=12  X=18  X=24  X=30
 *
 * Capacidades demostradas:
 *  1. Sectores 3D poligonales (fan triangulation)
 *  2. Pendientes uniformes (floorSlope en Slope sector)
 *  3. Pendientes de techo (ceilSlope en Room1)
 *  4. Alturas por vértice (Hill1–Hill5, terreno irregular)
 *  5. Alturas de piso/techo variables (Room1=3m, HighRoom=5m, Yard=cielo)
 *  6. Portales entre sectores (13 portales conectan todo)
 *  7. Escaleras de peldaños reales (8 peldaños en sector Stairs)
 *  8. Sprites billboard (decoraciones en Yard y colinas)
 *  9. Texturas múltiples (SVG + color hex para cielo)
 * 10. Física: colisión, gravedad, trepado, deslizamiento
 */

// ─── Vértices: grilla 6 columnas × 3 filas ───
const vertices = [
  // Fila inferior (y=0)
  { id: 'v0_0', x: 0,  y: 0  }, { id: 'v1_0', x: 6,  y: 0  },
  { id: 'v2_0', x: 12, y: 0  }, { id: 'v3_0', x: 18, y: 0  },
  { id: 'v4_0', x: 24, y: 0  }, { id: 'v5_0', x: 30, y: 0  },
  // Fila media (y=6) — borde compartido edificio ↔ terreno
  { id: 'v0_1', x: 0,  y: 6  }, { id: 'v1_1', x: 6,  y: 6  },
  { id: 'v2_1', x: 12, y: 6  }, { id: 'v3_1', x: 18, y: 6  },
  { id: 'v4_1', x: 24, y: 6  }, { id: 'v5_1', x: 30, y: 6  },
  // Fila superior (y=12) — cumbres de las colinas
  { id: 'v0_2', x: 0,  y: 12 }, { id: 'v1_2', x: 6,  y: 12 },
  { id: 'v2_2', x: 12, y: 12 }, { id: 'v3_2', x: 18, y: 12 },
  { id: 'v4_2', x: 24, y: 12 }, { id: 'v5_2', x: 30, y: 12 },
];

// ─── Sectores ───

// Ángulo de slope para subir de 0 a 2 en 6 unidades: atan(2/6) ≈ 18.43°
const slopeAngle = (Math.atan(2 / 6) * 180) / Math.PI;

const sectors = [
  // ═══ FILA INFERIOR: Edificio (5 sectores) ═══

  // Room1: habitación cerrada, techo ligeramente inclinado (ceilSlope)
  {
    id: 'room1',
    vertexIds: ['v0_0', 'v1_0', 'v1_1', 'v0_1'],
    floorH: 0, ceilH: 3,
    ceilSlope: { axis: 'y', angle: -5 },   // ← techo inclinado (feature 3)
    floorTex: 'wood', ceilTex: 'ceil',
  },
  // Slope: rampa continua subiendo de 0 a 2 (floorSlope)
  {
    id: 'slope',
    vertexIds: ['v1_0', 'v2_0', 'v2_1', 'v1_1'],
    floorH: 0, ceilH: 5,
    floorSlope: { axis: 'x', angle: slopeAngle }, // ← pendiente uniforme (feature 2)
    floorTex: 'stone', ceilTex: 'ceil',
  },
  // HighRoom: sala elevada a 2m (altura variable, feature 5)
  {
    id: 'highroom',
    vertexIds: ['v2_0', 'v3_0', 'v3_1', 'v2_1'],
    floorH: 2, ceilH: 5,
    floorTex: 'wood', ceilTex: 'ceil',
  },
  // Stairs sector: contiene escaleras de peldaño real (feature 6)
  {
    id: 'stairs_sector',
    vertexIds: ['v3_0', 'v4_0', 'v4_1', 'v3_1'],
    floorH: 0, ceilH: 5,
    floorTex: 'stone', ceilTex: 'ceil',
  },
  // Yard: patio exterior abierto al cielo (ceilH alto, feature 5)
  {
    id: 'yard',
    vertexIds: ['v4_0', 'v5_0', 'v5_1', 'v4_1'],
    floorH: 0, ceilH: 50,
    floorTex: 'grass', ceilTex: 'sky',   // ← textura hex color (feature 9)
  },

  // ═══ FILA SUPERIOR: Terreno montañoso (5 sectores, feature 4) ═══
  // Cada sector usa floorH como array → alturas por vértice
  // Las alturas en y=6 coinciden con el edificio; en y=12 forman colinas

  {
    id: 'hill1',
    vertexIds: ['v0_1', 'v1_1', 'v1_2', 'v0_2'],
    floorH: [0, 0, 4.0, 1.5],    // pendiente suave
    ceilH: 50, floorTex: 'dirt', ceilTex: 'sky',
  },
  {
    id: 'hill2',
    vertexIds: ['v1_1', 'v2_1', 'v2_2', 'v1_2'],
    floorH: [0, 2, 6.5, 4.0],    // ladera empinada
    ceilH: 50, floorTex: 'rock', ceilTex: 'sky',
  },
  {
    id: 'hill3',
    vertexIds: ['v2_1', 'v3_1', 'v3_2', 'v2_2'],
    floorH: [2, 2, 4.5, 6.5],    // cumbre de la montaña ▲
    ceilH: 50, floorTex: 'rock', ceilTex: 'sky',
  },
  {
    id: 'hill4',
    vertexIds: ['v3_1', 'v4_1', 'v4_2', 'v3_2'],
    floorH: [2, 0, 2.0, 4.5],    // descenso moderado
    ceilH: 50, floorTex: 'dirt', ceilTex: 'sky',
  },
  {
    id: 'hill5',
    vertexIds: ['v4_1', 'v5_1', 'v5_2', 'v4_2'],
    floorH: [0, 0, 0.5, 2.0],    // colina suave
    ceilH: 50, floorTex: 'grass', ceilTex: 'sky',
  },
];

// ─── Paredes ───
const walls = [
  // ═══ BORDE SUR (y=0) — paredes sólidas del edificio ═══
  { id: 'ws0', a: 'v0_0', b: 'v1_0', sectorFront: 'room1',         sectorBack: null, tex: 'wall' },
  { id: 'ws1', a: 'v1_0', b: 'v2_0', sectorFront: 'slope',         sectorBack: null, tex: 'wall' },
  { id: 'ws2', a: 'v2_0', b: 'v3_0', sectorFront: 'highroom',      sectorBack: null, tex: 'wall' },
  { id: 'ws3', a: 'v3_0', b: 'v4_0', sectorFront: 'stairs_sector', sectorBack: null, tex: 'wall' },
  { id: 'ws4', a: 'v4_0', b: 'v5_0', sectorFront: 'yard',          sectorBack: null, tex: 'wall' },

  // ═══ BORDE OESTE (x=0) — paredes sólidas ═══
  { id: 'ww0', a: 'v0_1', b: 'v0_0', sectorFront: 'room1', sectorBack: null, tex: 'wall' },
  { id: 'ww1', a: 'v0_2', b: 'v0_1', sectorFront: 'hill1', sectorBack: null, tex: 'rock' },

  // ═══ BORDE ESTE (x=30) — paredes sólidas ═══
  { id: 'we0', a: 'v5_0', b: 'v5_1', sectorFront: 'yard',  sectorBack: null, tex: 'wall' },
  { id: 'we1', a: 'v5_1', b: 'v5_2', sectorFront: 'hill5', sectorBack: null, tex: 'rock' },

  // ═══ BORDE NORTE (y=12) — paredes sólidas del terreno ═══
  { id: 'wn0', a: 'v0_2', b: 'v1_2', sectorFront: 'hill1', sectorBack: null, tex: 'rock' },
  { id: 'wn1', a: 'v1_2', b: 'v2_2', sectorFront: 'hill2', sectorBack: null, tex: 'rock' },
  { id: 'wn2', a: 'v2_2', b: 'v3_2', sectorFront: 'hill3', sectorBack: null, tex: 'rock' },
  { id: 'wn3', a: 'v3_2', b: 'v4_2', sectorFront: 'hill4', sectorBack: null, tex: 'rock' },
  { id: 'wn4', a: 'v4_2', b: 'v5_2', sectorFront: 'hill5', sectorBack: null, tex: 'rock' },

  // ═══ PORTALES ENTRE SECTORES DEL EDIFICIO (feature 6) ═══
  { id: 'wp0', a: 'v1_0', b: 'v1_1', sectorFront: 'room1',         sectorBack: 'slope',         tex: 'wall', portal: true },
  { id: 'wp1', a: 'v2_0', b: 'v2_1', sectorFront: 'slope',         sectorBack: 'highroom',      tex: 'wall', portal: true },
  { id: 'wp2', a: 'v3_0', b: 'v3_1', sectorFront: 'highroom',      sectorBack: 'stairs_sector', tex: 'wall', portal: true },
  { id: 'wp3', a: 'v4_0', b: 'v4_1', sectorFront: 'stairs_sector', sectorBack: 'yard',          tex: 'wall', portal: true },

  // ═══ PORTALES EDIFICIO ↔ TERRENO (y=6, feature 6) ═══
  { id: 'wbt0', a: 'v0_1', b: 'v1_1', sectorFront: 'room1',         sectorBack: 'hill1', tex: 'wall', portal: true },
  { id: 'wbt1', a: 'v1_1', b: 'v2_1', sectorFront: 'slope',         sectorBack: 'hill2', tex: 'wall', portal: true },
  { id: 'wbt2', a: 'v2_1', b: 'v3_1', sectorFront: 'highroom',      sectorBack: 'hill3', tex: 'wall', portal: true },
  { id: 'wbt3', a: 'v3_1', b: 'v4_1', sectorFront: 'stairs_sector', sectorBack: 'hill4', tex: 'wall', portal: true },
  { id: 'wbt4', a: 'v4_1', b: 'v5_1', sectorFront: 'yard',          sectorBack: 'hill5', tex: 'wall', portal: true },

  // ═══ PORTALES ENTRE COLINAS DEL TERRENO ═══
  { id: 'wt0', a: 'v1_1', b: 'v1_2', sectorFront: 'hill1', sectorBack: 'hill2', tex: 'rock', portal: true },
  { id: 'wt1', a: 'v2_1', b: 'v2_2', sectorFront: 'hill2', sectorBack: 'hill3', tex: 'rock', portal: true },
  { id: 'wt2', a: 'v3_1', b: 'v3_2', sectorFront: 'hill3', sectorBack: 'hill4', tex: 'rock', portal: true },
  { id: 'wt3', a: 'v4_1', b: 'v4_2', sectorFront: 'hill4', sectorBack: 'hill5', tex: 'rock', portal: true },
];

// ─── Escaleras (feature 7) ───
// 8 peldaños de piso 0 a piso 2, cruzando el sector de escaleras
const ramps = [
  {
    id: 'staircase1',
    type: 'stairs',
    pos: { x: 24, y: 1 },          // Base (piso bajo, lado del patio)
    direction: { x: -1, y: 0 },    // Ascienden hacia la sala elevada
    width: 4,
    rise: 2.0,
    run: 6.0,
    steps: 8,
    tex: 'stone',
  },
];

// ─── Sprites billboard (feature 8) ───
const sprites = [
  // Decoración en Room1
  { id: 'sp_lamp', tex: 'sprite_blue', pos: { x: 3, y: 3, z: 0.8 }, scale: 0.7, billboard: true },
  // Árbol en el patio
  { id: 'sp_tree1', tex: 'sprite_green', pos: { x: 27, y: 3, z: 0.9 }, scale: 1.5, billboard: true },
  // Árbol en colina suave (Hill5)
  { id: 'sp_tree2', tex: 'sprite_green', pos: { x: 27, y: 9, z: 1.2 }, scale: 1.8, billboard: true },
  // Árbol en ladera (Hill4)
  { id: 'sp_tree3', tex: 'sprite_green', pos: { x: 21, y: 9, z: 2.5 }, scale: 1.6, billboard: true },
  // Marcador en la cumbre (Hill3)
  { id: 'sp_peak', tex: 'sprite_blue', pos: { x: 15, y: 11, z: 5.8 }, scale: 1.0, billboard: true },
];

// ─── Texturas: SVG pixel-art + hex color (feature 9) ───
const textures = {
  wall:  './textures/muro.svg',     // Ladrillo (paredes del edificio)
  wood:  './textures/suelo1.svg',   // Tablones de madera (piso interior)
  stone: './textures/suelo2.svg',   // Baldosas de piedra (rampa, escaleras)
  ceil:  './textures/techo.svg',    // Paneles (techo interior)
  grass: './textures/suelo1.svg',   // Hierba exterior
  dirt:  './textures/suelo2.svg',   // Tierra (pendiente moderada)
  rock:  './textures/muro.svg',     // Roca (pendiente fuerte)
  sky:   0x87CEEB,                  // ← Color hex: cielo azul (feature 9)
  sprite_green: './textures/verde.svg',
  sprite_blue:  './textures/azul.svg',
};

// ─── Proyecto final ───
export const project = {
  meta: {
    name: 'Engine Showcase — Todas las capacidades',
    schemaVersion: 3,
    renderMode: '3d',
  },
  camera: {
    posX: 3,    // Centro de Room1
    posY: 3,
    posZ: 0.6,  // Altura de ojos sobre el piso
    yaw: 0,     // Mirando hacia +X (→ hacia la rampa)
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
