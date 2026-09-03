import { Player } from './core/player.js';
import { moveWithSectorCollision, updateVerticalSector } from './core/physics.js';
import { buildSectorIndex } from './core/sector.js';
import { validateProject } from './core/validate.js';
import { Renderer3D } from './three/Renderer3D.js';
import { WorldMesh } from './three/WorldMesh.js';
import { loadTextures } from './three/textures.js';

const MAX_DT = 0.05; // 50 ms; evita que un frame largo desestabilice la física.

export class Engine3D {
  constructor(project) {
    const { errors } = validateProject(project);
    if (errors.length) {
      throw new Error(`project.json inválido:\n- ${errors.join('\n- ')}`);
    }
    this.project = project;
    this.world = project.world;
    const c = project.camera;
    this.player = new Player(c.posX, c.posY, c.posZ, c.yaw ?? -Math.PI / 2, c.pitch ?? 0);
    this.renderer = null;
    this.loaded = false;
    this.textures = null;
    this.sectorIndex = null;
    if (this.world.vertices && this.world.sectors) {
      this.sectorIndex = buildSectorIndex(this.world);
    }
  }

  async load(canvas) {
    this.textures = await loadTextures(this.project.world.textures);
    this.renderer = new Renderer3D(canvas);
    WorldMesh.build(this.renderer.scene, this.project, this.textures);
    this.loaded = true;
    return this;
  }

  resize(width, height) {
    if (!this.renderer) return;
    this.renderer.resize(width, height);
  }

  dispose() {
    if (!this.renderer) return;
    WorldMesh.clear(this.renderer.scene);
    for (const key in this.textures || {}) {
      this.textures[key].dispose();
    }
    this.renderer.dispose();
    this.textures = null;
    this.renderer = null;
    this.loaded = false;
  }

  update(input, dt) {
    const safeDt = Math.min(dt, MAX_DT);
    if (!this.world.vertices || !this.world.sectors) return;
    const { dirX = 0, dirY = 0, speed = 0 } = input || {};
    if (dirX !== 0 || dirY !== 0) {
      moveWithSectorCollision(this.player, this.world, dirX, dirY, speed, safeDt, undefined, this.sectorIndex);
    }
    updateVerticalSector(this.player, this.world, safeDt, this.sectorIndex);
  }

  render() {
    if (!this.loaded) return;
    this.renderer.syncCamera(this.player);
    this.renderer.render();
  }
}
