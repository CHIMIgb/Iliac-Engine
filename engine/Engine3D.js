import { Player } from './core/player.js';
import { moveWithSectorCollision, updateVerticalSector } from './core/physics.js';
import { buildSectorIndex, getSectorAtOrNearest } from './core/sector.js';
import { validateProject } from './core/validate.js';
import { AudioEngine } from './core/audio.js';
import { AdaptiveMusic } from './core/music.js';
import { Renderer3D } from './three/Renderer3D.js';
import { WorldMesh } from './three/WorldMesh.js';
import { loadTextures } from './three/textures.js';
import { SkySystem, skySignature } from './three/SkySystem.js';
import { SunSystem, sunSignature } from './three/SunSystem.js';

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
    this.sun = null;
    this._skySig = skySignature(null);
    this._sunSig = sunSignature(null);
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
    this._setupSun();
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
    * Carga el horizonte lejano. Según world.sky.style:
    *  - classic (o ausente): telón Daggerfall 2D (SkySystem) — set/frame.
    *  - realista: cielo 3D con sol/luna (SunSystem) — hour/dayLengthSec.
    * El cambio de estilo descarta el sistema anterior (nunca conviven).
    * `set` elige la carpeta SKY; `frame` la franja del día. El frame se sincroniza
    * por separado (sin recargar las 32 texturas).
    * Sin sky: limpia el anterior y deja el fondo de color actual.
    * Se dispara async desde setWorld al cambiar la firma del cielo.
    */
  async _loadSky() {
    const cfg = this.world.sky;
    const style = cfg?.style ?? 'classic';
    this._skySig = skySignature(style === 'classic' ? cfg : null);
    const old = this.sky;
    this.sky = null;
    if (this.renderer) this.renderer.sky = null;
    if (this.renderer && style === 'classic' && cfg && Number.isInteger(cfg.set)) {
      const sky = new SkySystem(cfg);
      await sky.load();
      if (skySignature(this.world.sky) !== this._skySig) { sky.dispose(); return; }
      if ((this.world.sky?.style ?? 'classic') !== 'classic') { sky.dispose(); return; }
      sky.addTo(this.renderer.scene);
      this.sky = sky;
      this.renderer.sky = sky;
    }
    old?.dispose();
  }

  /**
   * Gestiona el sistema de sol/luna (SunSystem) para sky.style === 'realista'.
   * Se dispara en load() y en setWorld() al cambiar la firma del sol.
   */
  _setupSun() {
    const style = this.world.sky?.style ?? 'classic';
    const sig = sunSignature(this.world.sky);
    if (sig === this._sunSig) return;
    this._sunSig = sig;
    const old = this.sun;
    this.sun = null;
    if (this.renderer) this.renderer.sun = null;
    if (this.renderer && style === 'realista') {
      const sun = new SunSystem(this.world.sky);
      sun.addTo(this.renderer.scene);
      this.sun = sun;
      this.renderer.sun = sun;
      this.renderer.setDefaultLights(false); // el sol sustituye las luces fijas
    } else if (this.renderer) {
      this.renderer.setDefaultLights(true);
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
    const style = this.world.sky?.style ?? 'classic';
    if (skySignature(style === 'classic' ? this.world.sky : null) !== this._skySig) {
      void this._loadSky();
    } else if (this.sky && this.world.sky && this.sky.set === this.world.sky.set && this.sky.frame !== this.world.sky.frame) {
      // Mismo horizonte, distinta franja del día: swap instantáneo, sin recargar.
      this.sky.setFrame(this.world.sky.frame ?? 0);
    } else if (this.sun && (this.world.sky?.style ?? 'classic') === 'realista' && this.sun.hour !== (this.world.sky?.hour ?? 12)) {
      // Mismo cielo realista, cambió la hora: actualizar en caliente solo la hora.
      this.sun.hour = this.world.sky.hour ?? 12;
    }
    if (this.sun && (this.world.sky?.style ?? 'classic') === 'realista') {
      // F4.7: ajustes en caliente (sin reconstruir el SunSystem): intensidad
      // del sol, luz de luna y estrellas se aplican en _applyPalette leyendo cfg.
      const s = this.world.sky;
      if (s.sunIntensity != null) this.sun.cfg.sunIntensity = s.sunIntensity;
      if (s.moonIntensity != null) this.sun.cfg.moonIntensity = s.moonIntensity;
      if (s.stars != null) this.sun.cfg.stars = s.stars;
    }
    this._setupSun();
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
    this.sun?.dispose();
    this.sun = null;
    this._sunSig = sunSignature(null);
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
    // El sistema solar avanza su reloj interno (si dayLengthSec está puesto)
    // y ajusta luces; si el jugador está bajo un techo real, el sol se atenúa
    // (comportamiento Daggerfall: interiores sin iluminación solar directa).
    if (this.sun) {
      const idx = this.sectorIndex || buildSectorIndex(this.world);
      const sector = getSectorAtOrNearest(this.world, this.player.posX, this.player.posY, idx.vertexMap, this.player.currentSector);
      // Interior = el sector tiene techo REAL (ceilTex distinto del cielo/los
      // exteriores usan 'sky'; un techo de piedra/madera = casa/cueva). Data-driven:
      // no hay heurística de altura adivinada en el motor.
      const indoor = sector ? sector.ceilTex !== 'sky' : false;
      this.sun.setIndoor(indoor);
      this.sun.update(null, safeDt);
    }
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
    if (this.sun) this.sun.update(this.renderer.camera, 0); // dt 0 en render: el reloj ya avanzó en update()
    this.renderer.render();
  }
}
