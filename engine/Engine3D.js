import { Player } from './core/player.js';
import { moveWithSectorCollision, updateVerticalSector } from './core/physics.js';
import { buildSectorIndex } from './core/sector.js';
import { validateProject } from './core/validate.js';
import { AudioEngine } from './core/audio.js';
import { AdaptiveMusic } from './core/music.js';
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
    this.audio = null;   // AudioEngine (null si el proyecto no declara audio[])
    this.music = null;   // AdaptiveMusic (null si no hay project.music con layers)
    this._audioSig = null;
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
    this._setupAudio();
    this.loaded = true;
    return this;
  }

  /**
   * Vuelve a crear el AudioEngine/AdaptiveMusic si cambió la firma de
   * project.audio / project.music (edición en vivo del Studio). El contexto
   * real no se crea hasta resume() (gesto del usuario): aquí solo datos.
   */
  _setupAudio() {
    const sig = JSON.stringify([this.project.audio ?? null, this.project.music ?? null]);
    if (sig === this._audioSig) return;
    this._audioSig = sig;
    this.music?.dispose();
    this.music = null;
    this.audio?.dispose();
    this.audio = null;
    const defs = this.project.audio;
    if (!Array.isArray(defs) || defs.length === 0) return;
    this.audio = new AudioEngine(defs);
    const m = this.project.music;
    const mdef = m && defs.find((d) => d.id === m.id);
    if (mdef) {
      this.music = new AdaptiveMusic(this.audio, mdef);
      this.audio.music = this.music;
      this.music.setIntensity(m.intensity ?? 0, true);
    }
  }

  /**
    * Carga el horizonte lejano (world.sky = { set: 0–30, frame?: 0–31, base? }).
    * `set` elige la carpeta SKY; `frame` la franja del día. El frame se sincroniza
    * por separado (sin recargar las 32 texturas).
   * Sin sky: limpia el anterior y deja el fondo de color actual (comportamiento
   * histórico). Se dispara async desde setWorld al cambiar la firma del cielo.
   * Carga el nuevo ANTES de tirar del viejo: cambiar de hora no deja parpadeo.
   */
  async _loadSky() {
    const cfg = this.world.sky;
    this._skySig = skySignature(cfg);
    const old = this.sky;
    this.sky = null;
    if (this.renderer) this.renderer.sky = null;
    if (cfg && Number.isInteger(cfg.set) && this.renderer) {
      const sky = new SkySystem(cfg);
      await sky.load();
      // El mundo pudo cambiar mientras se cargaban las texturas: descartar.
      if (skySignature(this.world.sky) !== this._skySig) { sky.dispose(); return; }
      sky.addTo(this.renderer.scene);
      this.sky = sky;
      this.renderer.sky = sky;
    }
    old?.dispose();
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
    if (skySignature(this.world.sky) !== this._skySig) {
      void this._loadSky();
    } else if (this.sky && this.world.sky && this.sky.set === this.world.sky.set && this.sky.frame !== this.world.sky.frame) {
      // Mismo horizonte, distinta franja del día: swap instantáneo, sin recargar.
      this.sky.setFrame(this.world.sky.frame ?? 0);
    }
    if (this.renderer && this.loaded) {
      if (!WorldMesh.applyHeightsIfOnlyChange(this.renderer.scene, prevWorld, this.world)) {
        WorldMesh.build(this.renderer.scene, this.project, this.textures);
      }
    }
    this.sectorIndex = this.world.vertices && this.world.sectors
      ? buildSectorIndex(this.world)
      : null;
    // El audio puede haber cambiado (edición en vivo del Studio): re-crear si
    // cambió la firma. Sin gesto previo no hay contexto, así que no suena ni corta.
    this._setupAudio();
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
    this.music?.dispose();
    this.music = null;
    this.audio?.dispose();
    this.audio = null;
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
    // Oído espacial y emisores que siguen a los sprites. El audio es OPCIONAL y
    // nunca puede romper el frame: cualquier fallo lo aísla aquí (el método ya
    // se auto-silencia por dentro, esto es la segunda barrera en el bucle de juego).
    if (this.audio) {
      try {
        this.audio.setListener(this.player.posX, this.player.posY, this.player.posZ, this.player.yaw);
        this.audio.updateEmitters(this.world.sprites);
      } catch (err) {
        console.warn('[audio] desactivado en el bucle de juego:', err);
        this.audio = null;
        this.music = null;
      }
    }
  }

  /**
   * Desbloquea/reanuda el audio (política de autoplay): llamarla desde un gesto
   * del usuario (click/tecla). Sin proyecto con audio es un no-op.
   */
  async resumeAudio() {
    return this.audio ? this.audio.resume().catch(() => false) : false;
  }

  /** Silencia los bucles al salir del playtest (null si no hay audio: no-op). */
  stopAudio() {
    try { this.audio?.halt?.(); } catch { /* el audio nunca rompe el ciclo de vida */ }
  }

  render() {
    if (!this.loaded) return;
    this.renderer.syncCamera(this.player);
    this.renderer.render();
  }
}
