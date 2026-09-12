/**
 * demo/audio — proyecto de la vitrina del Audio Engine (F4.5):
 * sala 20×20 con música adaptativa, viento, río espacial, antorcha-entidad
 * con bucle propio y SFX variados. Los WAVs los genera `npm run setup:audio`
 * en assets/audio/ (no versionados); aquí se referencian de forma relativa.
 */
export const project = {
  meta: { name: 'Demo Audio', schemaVersion: 3, renderMode: '3d', author: 'RayCast Studio' },
  camera: { posX: 10, posY: 10, posZ: 1.4, yaw: -Math.PI / 2, pitch: 0 },
  render: {
    fov: 80, near: 0.1, far: 100, backgroundColor: 0x101018,
    ambientLight: { color: 0xffffff, intensity: 0.55 },
    directionalLight: { color: 0xfff2cc, intensity: 0.7, position: [10, 30, 10] },
  },
  world: {
    vertices: [
      { id: 'v0', x: 0, y: 0 }, { id: 'v1', x: 20, y: 0 },
      { id: 'v2', x: 20, y: 20 }, { id: 'v3', x: 0, y: 20 },
    ],
    sectors: [
      { id: 'sala', vertexIds: ['v0', 'v1', 'v2', 'v3'], floorH: 1, ceilH: 8, floorTex: 'wood', ceilTex: 'ceil', wallTex: 'wall' },
    ],
    walls: [
      { id: 'w0', a: 'v0', b: 'v1', sectorFront: 'sala', sectorBack: null, tex: 'wall' },
      { id: 'w1', a: 'v1', b: 'v2', sectorFront: 'sala', sectorBack: null, tex: 'wall' },
      { id: 'w2', a: 'v2', b: 'v3', sectorFront: 'sala', sectorBack: null, tex: 'wall' },
      { id: 'w3', a: 'v3', b: 'v0', sectorFront: 'sala', sectorBack: null, tex: 'wall' },
    ],
    sprites: [
      { id: 'antorcha', tex: 'brick', pos: { x: 10, y: 3, z: 4 }, scale: 1.5, billboard: true },
      { id: 'rincn', tex: 'brick', pos: { x: 17, y: 17, z: 3 }, scale: 1.2, billboard: true },
    ],
    textures: {
      wall: '../../demo/textures/muro.svg',
      wood: '../../demo/textures/suelo1.svg',
      ceil: '../../demo/textures/suelo2.svg',
      brick: '../../demo/textures/ladrillo.svg',
    },
  },
  // ── Audio: 3+ fuentes sonando A LA VEZ (música, viento, río, bucles de sprites) ──
  audio: [
    { id: 'music', src: '../../assets/audio/music-base.wav', bus: 'music', loop: true, volume: 0.8,
      layers: ['../../assets/audio/music-perc.wav', '../../assets/audio/music-tension.wav'] },
    { id: 'wind', src: '../../assets/audio/wind.wav', bus: 'ambience', loop: true, volume: 0.45 },
    { id: 'river', src: '../../assets/audio/water.wav', bus: 'ambience', loop: true, volume: 0.8,
      spatial: { x: 16, y: 6, z: 1.2, refDistance: 4, maxDistance: 40, rolloff: 1 } },
    { id: 'antorchaLoop', src: '../../assets/audio/water.wav', bus: 'ambience', loop: true, volume: 0.35,
      spatial: { follow: 'antorcha', refDistance: 2, maxDistance: 15, rolloff: 1.6 } },
    { id: 'footstep', src: '../../assets/audio/sfx-footstep.wav', bus: 'sfx', volume: 0.5,
      variations: ['../../assets/audio/sfx-footstep2.wav', '../../assets/audio/sfx-footstep3.wav'] },
    { id: 'door', src: '../../assets/audio/sfx-door.wav', bus: 'sfx', volume: 0.9 },
    { id: 'hit', src: '../../assets/audio/sfx-hit.wav', bus: 'sfx', volume: 1 },
    { id: 'voice', src: '../../assets/audio/sfx-voice.wav', bus: 'voice', volume: 1 },
  ],
  music: { id: 'music', intensity: 0, bpm: 120 },
};
