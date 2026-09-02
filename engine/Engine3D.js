import { Player } from './core/player.js';
import {
  moveWithCollision,
  updateVertical,
  moveWithSectorCollision,
  updateVerticalSector,
} from './core/physics.js';
import { buildSectorIndex } from './core/sector.js';
import { Renderer3D } from './three/Renderer3D.js';
import { WorldMesh } from './three/WorldMesh.js';
import { loadTextures } from './three/textures.js';

export class Engine3D {
  constructor(project) {
    this.project = project;
    this.world = project.world;
    const c = project.camera;
    this.player = new Player(c.posX, c.posY, c.posZ, c.yaw ?? -Math.PI / 2, c.pitch ?? 0);
    this.renderer = null;
    this.loaded = false;
    this.sectorIndex = null;
    if (this.world.vertices && this.world.sectors) {
      this.sectorIndex = buildSectorIndex(this.world);
    }
  }

  async load(canvas) {
    const textures = await loadTextures(this.project.world.textures);
    this.renderer = new Renderer3D(canvas);
    WorldMesh.build(this.renderer.scene, this.project, textures);
    this.loaded = true;
    return this;
  }

  update(input, dt) {
    if (this.world.vertices && this.world.sectors) {
      // Schema v3: física de sectores poligonales.
      const { dirX = 0, dirY = 0, speed = 0 } = input || {};
      if (dirX !== 0 || dirY !== 0) {
        moveWithSectorCollision(this.player, this.world, dirX, dirY, speed, dt, undefined, this.sectorIndex);
      }
      updateVerticalSector(this.player, this.world, dt, this.sectorIndex);
      return;
    }
    // Schema v2: grid de tiles (legacy).
    updateVertical(this.player, this.world.sectorMap, this.world.sectors, dt);
  }

  render() {
    if (!this.loaded) return;
    this.renderer.syncCamera(this.player);
    this.renderer.render();
  }
}

export { Player, moveWithCollision, updateVertical };
