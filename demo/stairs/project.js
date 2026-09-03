// project.js — Demo 2: Rampas y Escaleras

const gridV = [];
for (let y = 0; y <= 24; y += 8) {
  for (let x = 0; x <= 24; x += 8) {
    gridV.push({ id: `v_${x}_${y}`, x, y });
  }
}

const sectors = [
  // Platform 1 (SW, z=0)
  { id: 'p1', vertexIds: ['v_0_0', 'v_8_0', 'v_8_8', 'v_0_8'], floorH: 0, ceilH: 50, floorTex: 'stone', ceilTex: 'sky', wallTex: 'brick' },
  // Stair Sector 1 (S, z=0) -> holds stairs from P1 to P2
  { id: 's1', vertexIds: ['v_8_0', 'v_16_0', 'v_16_8', 'v_8_8'], floorH: 0, ceilH: 50, floorTex: 'dirt', ceilTex: 'sky', wallTex: 'brick' },
  // Platform 2 (SE, z=3)
  { id: 'p2', vertexIds: ['v_16_0', 'v_24_0', 'v_24_8', 'v_16_8'], floorH: 3, ceilH: 50, floorTex: 'stone', ceilTex: 'sky', wallTex: 'brick' },
  
  // Ramp Sector (W) -> uses floorH array for a smooth ramp from z=0 to z=3
  // Vertices: SW (v_0_8), SE (v_8_8), NE (v_8_16), NW (v_0_16)
  // Heights: SW=0, SE=0, NE=3, NW=3
  { id: 'ramp_w', vertexIds: ['v_0_8', 'v_8_8', 'v_8_16', 'v_0_16'], floorH: [0, 0, 3, 3], ceilH: 50, floorTex: 'wood', ceilTex: 'sky', wallTex: 'brick' },
  
  // Platform 4 (NW, z=3)
  { id: 'p4', vertexIds: ['v_0_16', 'v_8_16', 'v_8_24', 'v_0_24'], floorH: 3, ceilH: 50, floorTex: 'stone', ceilTex: 'sky', wallTex: 'brick' },
  
  // Central Void (C) -> just empty space (a pit), floor at z=-2
  { id: 'pit', vertexIds: ['v_8_8', 'v_16_8', 'v_16_16', 'v_8_16'], floorH: -2, ceilH: 50, floorTex: 'dirt', ceilTex: 'sky', wallTex: 'rock' },
  
  // Stair Sector 2 (E, z=3) -> holds stairs from P2 to P3
  { id: 's2', vertexIds: ['v_16_8', 'v_24_8', 'v_24_16', 'v_16_16'], floorH: 3, ceilH: 50, floorTex: 'dirt', ceilTex: 'sky', wallTex: 'brick' },
  
  // Platform 3 (NE, z=6)
  { id: 'p3', vertexIds: ['v_16_16', 'v_24_16', 'v_24_24', 'v_16_24'], floorH: 6, ceilH: 50, floorTex: 'stone', ceilTex: 'sky', wallTex: 'brick' },
  
  // Bridge (N, z=6) -> connects P4(z=3) to P3(z=6) via stairs down? 
  // Let's make it a steep stair from P4 to P3.
  { id: 's3', vertexIds: ['v_8_16', 'v_16_16', 'v_16_24', 'v_8_24'], floorH: 3, ceilH: 50, floorTex: 'wood', ceilTex: 'sky', wallTex: 'brick' },
];

const walls = [
  // Outer boundary
  { id: 'ob_s1', a: 'v_0_0', b: 'v_8_0', sectorFront: 'p1', sectorBack: null },
  { id: 'ob_s2', a: 'v_8_0', b: 'v_16_0', sectorFront: 's1', sectorBack: null },
  { id: 'ob_s3', a: 'v_16_0', b: 'v_24_0', sectorFront: 'p2', sectorBack: null },
  
  { id: 'ob_e1', a: 'v_24_0', b: 'v_24_8', sectorFront: 'p2', sectorBack: null },
  { id: 'ob_e2', a: 'v_24_8', b: 'v_24_16', sectorFront: 's2', sectorBack: null },
  { id: 'ob_e3', a: 'v_24_16', b: 'v_24_24', sectorFront: 'p3', sectorBack: null },
  
  { id: 'ob_n1', a: 'v_24_24', b: 'v_16_24', sectorFront: 'p3', sectorBack: null },
  { id: 'ob_n2', a: 'v_16_24', b: 'v_8_24', sectorFront: 's3', sectorBack: null },
  { id: 'ob_n3', a: 'v_8_24', b: 'v_0_24', sectorFront: 'p4', sectorBack: null },
  
  { id: 'ob_w1', a: 'v_0_24', b: 'v_0_16', sectorFront: 'p4', sectorBack: null },
  { id: 'ob_w2', a: 'v_0_16', b: 'v_0_8', sectorFront: 'ramp_w', sectorBack: null },
  { id: 'ob_w3', a: 'v_0_8', b: 'v_0_0', sectorFront: 'p1', sectorBack: null },

  // Internal borders - Portals between adjacent sectors
  { id: 'in_p1_s1', a: 'v_8_0', b: 'v_8_8', sectorFront: 's1', sectorBack: 'p1', portal: true },
  { id: 'in_s1_p2', a: 'v_16_0', b: 'v_16_8', sectorFront: 'p2', sectorBack: 's1', portal: true },
  
  { id: 'in_p2_s2', a: 'v_16_8', b: 'v_24_8', sectorFront: 's2', sectorBack: 'p2', portal: true },
  { id: 'in_s2_p3', a: 'v_16_16', b: 'v_24_16', sectorFront: 'p3', sectorBack: 's2', portal: true },
  
  { id: 'in_p3_s3', a: 'v_16_16', b: 'v_16_24', sectorFront: 'p3', sectorBack: 's3', portal: true },
  { id: 'in_s3_p4', a: 'v_8_16', b: 'v_8_24', sectorFront: 's3', sectorBack: 'p4', portal: true },
  
  { id: 'in_p4_rw', a: 'v_0_16', b: 'v_8_16', sectorFront: 'p4', sectorBack: 'ramp_w', portal: true },
  { id: 'in_rw_p1', a: 'v_0_8', b: 'v_8_8', sectorFront: 'ramp_w', sectorBack: 'p1', portal: true },

  // The central pit boundaries (solid walls so player falls in but must jump out, or we make them solid)
  // Let's just leave them as portals so you can fall in and are trapped (or add a ladder later).
  // Actually, let's make them solid so the player doesn't fall into an inescapable pit for now.
  { id: 'pit_s', a: 'v_16_8', b: 'v_8_8', sectorFront: 's1', sectorBack: null },
  { id: 'pit_e', a: 'v_16_16', b: 'v_16_8', sectorFront: 's2', sectorBack: null },
  { id: 'pit_n', a: 'v_8_16', b: 'v_16_16', sectorFront: 's3', sectorBack: null },
  { id: 'pit_w', a: 'v_8_8', b: 'v_8_16', sectorFront: 'ramp_w', sectorBack: null },
];

const ramps = [
  // Escalera 1: P1 (z=0) -> P2 (z=3) a través de s1 (ancho total)
  {
    id: 'stair1', type: 'stairs', pos: { x: 8, y: 0 }, direction: { x: 1, y: 0 },
    width: 8, rise: 3.0, run: 8.0, steps: 16, tex: 'stone'
  },
  // Escalera 2: P2 (z=3) -> P3 (z=6) a través de s2 (mitad de ancho)
  {
    id: 'stair2', type: 'stairs', pos: { x: 20, y: 8 }, direction: { x: 0, y: 1 },
    width: 4, rise: 3.0, run: 8.0, steps: 12, tex: 'wood'
  },
  // Escalera 3: s3 (z=3) -> P3 (z=6) (sube al este)
  {
    id: 'stair3', type: 'stairs', pos: { x: 8, y: 18 }, direction: { x: 1, y: 0 },
    width: 4, rise: 3.0, run: 8.0, steps: 8, tex: 'brick'
  }
];

const sprites = [
  // Antorchas en las plataformas
  { id: 't1', tex: 'torch', pos: { x: 4, y: 4, z: 1.0 }, scale: 1.5, billboard: true },
  { id: 't2', tex: 'torch', pos: { x: 20, y: 4, z: 4.0 }, scale: 1.5, billboard: true },
  { id: 't3', tex: 'torch', pos: { x: 20, y: 20, z: 7.0 }, scale: 1.5, billboard: true },
  { id: 't4', tex: 'torch', pos: { x: 4, y: 20, z: 4.0 }, scale: 1.5, billboard: true },
];

export const project = {
  meta: { name: 'Demo Escaleras', schemaVersion: 3, renderMode: '3d' },
  render: {
    fov: 80, near: 0.1, far: 500, backgroundColor: 0x87ceeb,
    ambientLight: { color: 0xffffff, intensity: 0.6 },
    directionalLight: { color: 0xffffff, intensity: 0.8, position: [10, 20, -10] },
  },
  camera: { posX: 4, posY: 4, posZ: 0.6, yaw: 0, pitch: 0 },
  world: {
    vertices: gridV,
    sectors,
    walls,
    ramps,
    sprites,
    textures: {
      wall: '../../demo/textures/muro.svg',
      brick: '../../demo/textures/ladrillo.svg',
      wood: '../../demo/textures/suelo1.svg',
      stone: '../../demo/textures/suelo2.svg',
      dirt: '../../demo/textures/pasto.svg', // pasto verde
      rock: '../../demo/textures/roca.svg',
      torch: '../../demo/textures/sprite_antorcha.svg',
      sky: 0x87CEEB,
    },
  },
};
