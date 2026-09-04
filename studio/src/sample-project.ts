/**
 * sample-project.ts — Proyecto inicial del Studio.
 *
 * Arranca VACÍO: el usuario crea su propio nivel desde cero.
 * Solo define la configuración base (render, cámara) y un mundo sin geometría.
 */

/**
 * Proyecto inicial del editor: mundo vacío listo para crear.
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
    posX: 0,
    posY: 0,
    posZ: 0.6,
    yaw: -Math.PI / 2,
    pitch: 0,
  },
  world: {
    vertices: [] as { id: string; x: number; y: number }[],
    sectors: [] as { id: string; vertexIds: string[]; floorH: number; ceilH: number; floorTex: string; ceilTex: string; wallTex: string }[],
    walls: [] as { id: string; a: string; b: string; sectorFront: string | null; sectorBack: string | null; tex: string; portal?: boolean }[],
    ramps: [] as unknown[],
    sprites: [] as { id: string; tex: string; pos: { x: number; y: number; z: number }; scale: number; billboard: boolean }[],
    textures: {} as Record<string, string>,
  },
};

export type Project = typeof sampleProject;

