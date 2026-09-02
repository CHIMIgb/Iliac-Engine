export { Engine3D, Player, moveWithCollision, updateVertical } from './Engine3D.js';
export { moveWithSectorCollision, updateVerticalSector } from './core/physics.js';
export { Renderer3D } from './three/Renderer3D.js';
export { WorldMesh } from './three/WorldMesh.js';
export {
  createSectorFloorGeometry,
  createSectorCeilingGeometry,
  createWallGeometry,
} from './three/SectorGeometry.js';
export { buildStairsMeshes } from './three/StairsMesh.js';
export { buildSprites } from './three/SpriteSystem.js';
export { checkCollision } from './core/collision.js';
export * from './core/math.js';
export * from './core/sector.js';
