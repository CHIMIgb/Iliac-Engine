export const project = {
  meta: {
    name: 'Sector Demo',
    schemaVersion: 3,
    renderMode: '3d',
  },
  camera: {
    posX: 1.5,
    posY: 1.5,
    posZ: 0.5,
    yaw: 0,
    pitch: 0,
  },
  world: {
    vertices: [
      { id: 'v0', x: 0, y: 0 },
      { id: 'v1', x: 4, y: 0 },
      { id: 'v2', x: 4, y: 4 },
      { id: 'v3', x: 0, y: 4 },
      { id: 'v4', x: 8, y: 0 },
      { id: 'v5', x: 8, y: 4 },
      { id: 'v6', x: 12, y: 0 },
      { id: 'v7', x: 12, y: 4 },
    ],
    sectors: [
      {
        id: 's0',
        vertexIds: ['v0', 'v1', 'v2', 'v3'],
        floorH: 0.0,
        ceilH: 3.0,
        floorTex: 'floor',
        ceilTex: 'ceil',
        wallTex: 'wall',
      },
      {
        id: 's1',
        vertexIds: ['v1', 'v4', 'v5', 'v2'],
        floorH: 0.0,
        ceilH: 3.0,
        floorSlope: { axis: 'x', angle: 14 }, // grados, sube hacia +x
        floorTex: 'floor',
        ceilTex: 'ceil',
        wallTex: 'wall',
      },
      {
        id: 's2',
        vertexIds: ['v4', 'v6', 'v7', 'v5'],
        floorH: 1.0,
        ceilH: 4.0,
        floorTex: 'floor',
        ceilTex: 'ceil',
        wallTex: 'wall',
      },
    ],
    walls: [
      // Sector s0
      { id: 'w0', a: 'v0', b: 'v1', sectorFront: 's0', sectorBack: null, tex: 'wall' },
      { id: 'w1', a: 'v1', b: 'v2', sectorFront: 's0', sectorBack: 's1', tex: 'wall', portal: true },
      { id: 'w2', a: 'v2', b: 'v3', sectorFront: 's0', sectorBack: null, tex: 'wall' },
      { id: 'w3', a: 'v3', b: 'v0', sectorFront: 's0', sectorBack: null, tex: 'wall' },
      // Sector s1
      { id: 'w4', a: 'v1', b: 'v4', sectorFront: 's1', sectorBack: null, tex: 'wall' },
      { id: 'w5', a: 'v4', b: 'v5', sectorFront: 's1', sectorBack: 's2', tex: 'wall', portal: true },
      { id: 'w6', a: 'v5', b: 'v2', sectorFront: 's1', sectorBack: null, tex: 'wall' },
      // Sector s2
      { id: 'w7', a: 'v4', b: 'v6', sectorFront: 's2', sectorBack: null, tex: 'wall' },
      { id: 'w8', a: 'v6', b: 'v7', sectorFront: 's2', sectorBack: null, tex: 'wall' },
      { id: 'w9', a: 'v7', b: 'v5', sectorFront: 's2', sectorBack: null, tex: 'wall' },
    ],
    ramps: [
      {
        id: 'r0',
        sectorId: 's1',
        type: 'slope',
        direction: { x: 1, y: 0 },
        rise: 1.0,
        run: 4.0,
        tex: 'floor',
      },
    ],
    sprites: [
      {
        id: 'sp0',
        tex: 'sprite',
        pos: { x: 2, y: 2, z: 0.5 },
        scale: 1.0,
        billboard: true,
      },
    ],
    textures: {
      wall: './textures/muro.svg',
      floor: './textures/suelo1.svg',
      ceil: './textures/techo.svg',
      sprite: './textures/azul.svg',
    },
  },
};
