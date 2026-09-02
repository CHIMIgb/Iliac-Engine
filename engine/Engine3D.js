import { Player } from './core/player.js';
import { moveWithCollision, updateVertical } from './core/physics.js';
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
  }

  async load(canvas) {
    const textures = await loadTextures(this.project.world.textures);
    this.renderer = new Renderer3D(canvas);
    WorldMesh.build(this.renderer.scene, this.project, textures);
    this.loaded = true;
    return this;
  }

  update(dt) {
    if (this.world.vertices && this.world.sectors) {
      // Schema v3: física de sectores aún no implementada (Paso 4).
      return;
    }
    updateVertical(this.player, this.world.sectorMap, this.world.sectors, dt);
  }

  render() {
    if (!this.loaded) return;
    this.renderer.syncCamera(this.player);
    this.renderer.render();
  }
}

export { Player, moveWithCollision, updateVertical };
