import { Player } from './core/player.js';
import { moveWithSectorCollision, updateVerticalSector } from './core/physics.js';
import { buildSectorIndex } from './core/sector.js';
import { validateProject } from './core/validate.js';
import { Renderer3D } from './three/Renderer3D.js';
import { WorldMesh } from './three/WorldMesh.js';
import { loadTextures } from './three/textures.js';
import { SkySystem, skySignature } from './three/SkySystem.js';

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
    this.sky = null;
    this._skySig = skySignature(null);
    if (this.world.vertices && this.world.sectors) {
      this.sectorIndex = buildSectorIndex(this.world);
    }
  }

  async load(canvas) {
    this.textures = await loadTextures(this.project.world.textures);
    const renderSettings = this.project.render ?? this.project.meta?.render ?? {};
    this.renderer = new Renderer3D(canvas, renderSettings);
    WorldMesh.build(this.renderer.scene, this.project, this.textures);
    await this._loadSky();
    this.loaded = true;
    return this;
  }

  /**
   * Carga el horizonte lejano (world.sky = { set: 0–30, stride?, base? }).
   * Sin sky: limpia el anterior y deja el fondo de color actual (comportamiento
   * histórico). Se dispara async desde setWorld al cambiar la firma del cielo.
   */
  async _loadSky() {
    const cfg = this.world.sky;
    this._skySig = skySignature(cfg);
    if (this.sky) {
      this.sky.dispose();
      this.sky = null;
      if (this.renderer) this.renderer.sky = null;
    }
    if (!cfg || !Number.isInteger(cfg.set) || !this.renderer) return;
    const sky = new SkySystem(cfg);
    await sky.load();
    // El mundo pudo cambiar mientras se cargaban las texturas: descartar.
    if (skySignature(this.world.sky) !== this._skySig) { sky.dispose(); return; }
    sky.addTo(this.renderer.scene);
    this.sky = sky;
    this.renderer.sky = sky;
  }

  /**
   * Cambia el mundo SIN recrear el motor (edición en vivo del Studio):
   * revalida el proyecto, reconstruye el índice de sectores y la malla del
   * mundo, y conserva renderer y texturas (lo caro de un reload completo).
   * Vía rápida: si solo cambiaron alturas de piso de terreno
   * (WorldMesh.applyHeightsIfOnlyChange) se parchea el buffer en el sitio —
   * ni merge de geometrías ni subida nueva, esculpido fluido hasta 32 m.
   * Devuelve false si el proyecto es inválido (el mundo anterior se mantiene).
   * Limitación: las texturas NUEVAS del proyecto no se decodifican hasta un
   * reload completo (ponytail: recargar solo la textura que falte si hace
   * falta en el editor de assets).
   */
  setWorld(project) {
    const { errors } = validateProject(project);
    if (errors.length) return false;
    const prevWorld = this.world;
    this.project = project;
    this.world = project.world;
    if (skySignature(this.world.sky) !== this._skySig) void this._loadSky();
    if (this.renderer && this.loaded) {
      if (!WorldMesh.applyHeightsIfOnlyChange(this.renderer.scene, prevWorld, this.world)) {
        WorldMesh.build(this.renderer.scene, this.project, this.textures);
      }
    }
    this.sectorIndex = this.world.vertices && this.world.sectors
      ? buildSectorIndex(this.world)
      : null;
    return true;
  }

  resize(width, height) {
    if (!this.renderer) return;
    this.renderer.resize(width, height);
  }

  dispose() {
    if (!this.renderer) return;
    this.sky?.dispose();
    this.sky = null;
    this._skySig = skySignature(null);
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
