import { Player, checkCollision } from './core/player.js';
import { Renderer3D } from './three/Renderer3D.js';
import * as THREE from 'three';

export class Engine3D {
  constructor(project) {
    this.project = project;
    this.world = project.world;
    const c = project.camera;
    this.player = new Player(c.posX, c.posY, c.posZ, c.yaw ?? -Math.PI / 2, c.pitch ?? 0);
    this.renderer = null;
    this.textures = {};
    this.loaded = false;
  }

  async load(canvas) {
    this.textures = await this.loadTextures(this.project.world.textures);
    this.renderer = new Renderer3D(canvas);
    this.renderer.buildWorld(this.project, this.textures);
    this.loaded = true;
    return this;
  }

  async loadTextures(textureDefs) {
    const textures = {};
    const loader = new THREE.TextureLoader();
    for (const key in textureDefs) {
      const def = textureDefs[key];
      if (typeof def === 'string') {
        textures[key] = await loader.loadAsync(def);
      } else if (typeof def === 'number') {
        textures[key] = this.colorTexture(def);
      }
    }
    return textures;
  }

  colorTexture(hex) {
    const r = ((hex >> 16) & 255) / 255;
    const g = ((hex >> 8) & 255) / 255;
    const b = (hex & 255) / 255;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgb(${r * 255}, ${g * 255}, ${b * 255})`;
    ctx.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(canvas);
  }

  update(dt) {
    this.player.updateZ(this.world.sectorMap, this.world.sectors);
  }

  render() {
    if (!this.loaded) return;
    this.renderer.syncCamera(this.player);
    this.renderer.render();
  }
}

export { Player, checkCollision };
