export const project = {
  camera: {
    posX: 3.5,
    posY: 3.5,
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
    colors: {
      1: 0xcc0000,
      2: 0x00cc00,
      3: 0x0000cc,
    },
    textures: {
      1: 0xcc0000,
      2: 0x00cc00,
      3: 0x0000cc,
    },
    floorColor: 0x202020,
    ceilColor: 0x404040,
  },
};
