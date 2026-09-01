export const project = {
  meta: {
    name: 'RayCast Demo',
    renderMode: '3d',
  },
  camera: {
    posX: 3.5,
    posY: 3.5,
    posZ: 0.5,
    dirX: -1,
    dirY: 0,
    planeX: 0,
    planeY: 0.66,
  },
  world: {
    map: [
      [1, 1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 2, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 3, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1, 1],
    ],
    sectorMap: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    sectors: [
      { floorH: 0.0, ceilH: 1.0 },
    ],
    colors: {
      1: 0xcc0000,
      2: 0x00cc00,
      3: 0x0000cc,
    },
    textures: {
      1: './textures/muro.svg',
      2: './textures/verde.svg',
      3: './textures/azul.svg',
      4: './textures/suelo1.svg',
      5: './textures/suelo2.svg',
      6: './textures/techo.svg',
    },
    floorTextures: [4, 5], // patrón de ajedrez: alterna textura 4 y 5
    ceilTexNum: 6,
  },
};
