/**
 * audio.js — Audio Engine (Web Audio API): buses, ganancia en dB, SFX one-shot
 * con variación, loops múltiples simultáneos (música, ambiente, NPCs, enemigos)
 * y ducking de la música bajo la voz.
 *
 * Lógica pura de core/: SIN Three.js ni DOM. El `AudioContext` se construye con
 * la fábrica inyectable `ctxFactory` (en el navegador, `() => new AudioContext()`;
 * en los tests, un stub que registra llamadas). Nada suena hasta `resume()`
 * (política de autoplay: primer gesto).
 *
 * OPCIONAL Y A PRUEBA DE FALLOS: el audio es complementario. Todo método público
 * está protegido; si el navegador lanza (quirks de Chrome/Safari), el motor se
 * marca `_dead`, se silencia con una única warning y NINGÚN frame se rompe. El
 * playtest sigue corriendo sin sonido.
 *
 * Un `AudioBufferSourceNode` NO puede volver a start() tras terminar: cada
 * disparo crea una fuente nueva (barata) y solo se CACHEA el buffer decodificado
 * (lo caro) por `src`. dispose() sobre la fuente al `onended` deja el GC limpiar.
 *
 * Grafos: voz → [PannerNode si espacial] → bus(GainNode) → master(GainNode) → limiter → destination
 * Ejes mundo → Web Audio: X=x, Y=z(altura), Z=y(profundidad).
 */

/** 0..1 lineal → dB perceptual (0 → −80, 0.5 → ≈−6 dB, 1 → 0 dB). */
export function linearToDb(v) {
  const x = Math.max(v, 1e-4);
  return 20 * Math.log10(x);
}

/** dB → lineal (inverso de linearToDb). */
export function dbToLinear(db) {
  return Math.pow(10, db / 20);
}

export const AUDIO_BUSES = ['music', 'sfx', 'ambience', 'voice'];

/** Convierte coordenadas de mundo {x, y(prof), z(altura)} a coords Web Audio. */
export function toAudioCoords(x, y, z) {
  return { ax: x, ay: z, az: y };
}

const rand = (a, b) => a + Math.random() * (b - a);

export class AudioEngine {
  /**
   * @param {object[]} defs — `project.audio` ({ id, src, bus, loop, volume,
   *   spatial, variations }).
   * @param {{ctxFactory?: () => AudioContext}} opts
   */
  constructor(defs = [], opts = {}) {
    this.defs = defs;
    this._byId = new Map(defs.map((d) => [d.id, d]));
    this._ctxFactory = opts.ctxFactory ??
      (typeof AudioContext !== 'undefined' ? () => new AudioContext() : null);
    this.ctx = null;
    this.buses = {};
    this.master = null;
    this.limiter = null;
    this.loops = [];                  // { def, source, gain, panner }
    this._bufferPromises = new Map(); // src → Promise<AudioBuffer> (lo caro, una vez)
    this._duckDb = 0;
    this._userDb = { music: 0, sfx: 0, ambience: 0, voice: 0 };
    this._started = false;
    this._dead = false;               // fail-safe: un error apaga el subsistema, no el juego
    this.music = null;                // AdaptiveMusic asignado por Engine3D (arranca tras resume)
  }

  /** Marca el motor como muerto (una sola warning) y vuelve. Los frames siguen. */
  _fail(err) {
    if (!this._dead) {
      this._dead = true;
      console.warn('[audio] subsistema desactivado por un fallo del navegador — el juego sigue sin sonido:', err);
    }
    return false;
  }

  /**
   * Crea el contexto al primer gesto y arranca los loops. Seguro: si algo falla,
   * queda `_dead` y resuelve a false (nunca lanza hacia el bucle rAF).
   */
  async resume() {
    if (this._dead || !this._ctxFactory) return false;
    try {
      if (!this.ctx) this._build();
      if (this.ctx.state === 'suspended' && this.ctx.resume) await this.ctx.resume();
      if (!this._started) {
        this._started = true;
        // Las defs con `layers` (música adaptativa) las gestiona AdaptiveMusic (music.js).
        for (const def of this.defs) if (def.loop && !def.layers) this._startLoop(def);
        this.music?.build?.();
      }
      return true;
    } catch (err) {
      return this._fail(err);
    }
  }

  /** Seam de tests: reemplazable para inyectar buffers sin fetch/decodificar. */
  async _decode(src) {
    const res = await fetch(src);
    return this.ctx.decodeAudioData(await res.arrayBuffer());
  }

  /** Devuelve (y cachea) la Promise del buffer decodificado para esa ruta. */
  _buffer(src) {
    let p = this._bufferPromises.get(src);
    if (!p) {
      p = this._decode(src);
      this._bufferPromises.set(src, p);
    }
    return p;
  }

  _build() {
    const ctx = this._ctxFactory();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    // Limitador de seguridad (headroom), no mezclador: threshold alto y ratio duro.
    AudioEngine._setNodeProp(this.limiter, 'threshold', -6);
    AudioEngine._setNodeProp(this.limiter, 'knee', 6);
    AudioEngine._setNodeProp(this.limiter, 'ratio', 12);
    AudioEngine._setNodeProp(this.limiter, 'attack', 0.003);
    AudioEngine._setNodeProp(this.limiter, 'release', 0.25);
    this.master.connect(this.limiter);
    this.limiter.connect(ctx.destination);
    for (const name of AUDIO_BUSES) {
      const g = ctx.createGain();
      g.connect(this.master);
      this.buses[name] = g;
    }
  }

  /** Volumen de bus desde slider 0..1 (mapeado a dB, nunca lineal directo). */
  setBusVolume(bus, slider01) {
    if (this._dead) return;
    const g = this.buses[bus];
    if (!g) return;
    this._userDb[bus] = linearToDb(slider01);
    this._applyBusGain(bus);
  }

  _applyBusGain(bus) {
    const g = this.buses[bus];
    if (!g) return;
    const db = this._userDb[bus] + (bus === 'music' ? this._duckDb : 0);
    g.gain.value = dbToLinear(db);
  }

  /** Ducking: la música baja ~12 dB con attack rápido y sube suave al terminar. */
  duckMusic(on, db = -12) {
    if (this._dead) return;
    this._duckDb = on ? db : 0;
    const g = this.buses.music;
    if (!g || !this.ctx) return;
    try {
      const t = this.ctx.currentTime;
      const target = dbToLinear(this._userDb.music + this._duckDb);
      if (g.gain.linearRampToValueAtTime) {
        g.gain.cancelScheduledValues?.(t);
        g.gain.setValueAtTime?.(g.gain.value, t);
        g.gain.linearRampToValueAtTime(target, t + (on ? 0.01 : 0.4)); // attack 10 ms, release 400 ms
      } else {
        g.gain.value = target;
      }
    } catch (err) {
      this._fail(err);
    }
  }

  // ── Loops (música, ambiente, bucles de entidades) ────────────

  _startLoop(def) {
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.value = def.volume ?? 1;
    const panner = def.spatial ? this._makePanner(def.spatial) : null;
    if (panner) panner.connect(gain); else gain.connect(this.buses[def.bus || 'sfx']);
    const source = ctx.createBufferSource();
    source.loop = true;
    source.connect(panner ?? gain);
    const loop = { def, source, gain, panner };
    this.loops.push(loop);
    this._buffer(def.src)
      .then((buf) => { source.buffer = buf; source.start(0); })
      .catch(() => { /* src inexistente o fallo de red: silencio en este loop, no rompe los demás */ });
  }

  /** Actualiza los panners de los bucles con `spatial.follow` a la posición del sprite. */
  updateEmitters(sprites = []) {
    if (this._dead || !this.ctx) return;
    try {
      const byId = new Map(sprites.map((s) => [s.id, s]));
      for (const { def, panner } of this.loops) {
        if (!panner || !def.spatial?.follow) continue;
        const sp = byId.get(def.spatial.follow);
        if (sp) this._setPannerPos(panner, sp.pos?.x ?? 0, sp.pos?.y ?? 0, sp.pos?.z ?? 0);
      }
    } catch (err) {
      this._fail(err);
    }
  }

  _makePanner(spatial) {
    const p = this.ctx.createPanner();
    try { p.panningModel = 'HRTF'; } catch { /* Safari antiguo: deja equalpower */ }
    try { p.distanceModel = 'inverse'; } catch { /* idem */ }
    // refDistance/maxDistance/rolloffFactor: AudioParam según spec, número llano
    // en Chrome. _setNodeProp tolera ambas.
    AudioEngine._setNodeProp(p, 'refDistance', spatial.refDistance ?? 3);
    AudioEngine._setNodeProp(p, 'maxDistance', spatial.maxDistance ?? 200);
    AudioEngine._setNodeProp(p, 'rolloffFactor', spatial.rolloff ?? 1);
    const x = spatial.x ?? 0, y = spatial.y ?? 0, z = spatial.z ?? 0;
    this._setPannerPos(p, x, y, z);
    return p;
  }

  /**
   * Asigna una propiedad de nodo tolerando AudioParam (con .value) o número llano
   * (PannerNode de Chrome expone refDistance/… como doubles simples).
   */
  static _setNodeProp(node, name, value) {
    if (node == null || value === undefined) return;
    const p = node[name];
    if (p != null && typeof p === 'object' && 'value' in p) p.value = value;
    else node[name] = value;
  }

  _setPannerPos(panner, x, y, z) {
    const { ax, ay, az } = toAudioCoords(x, y, z);
    if (panner.positionX) {
      const t = this.ctx.currentTime;
      panner.positionX.setValueAtTime(ax, t);
      panner.positionY.setValueAtTime(ay, t);
      panner.positionZ.setValueAtTime(az, t);
    } else if (panner.setPosition) {
      panner.setPosition(ax, ay, az); // API antigua (Safari)
    }
  }

  /** Oído del jugador/cámara, en coordenadas de mundo. */
  setListener(x, y, z, yaw = 0) {
    if (this._dead || !this.ctx) return;
    try {
      const l = this.ctx.listener;
      const { ax, ay, az } = toAudioCoords(x, y, z);
      if (l.positionX) {
        const t = this.ctx.currentTime;
        l.positionX.setValueAtTime(ax, t);
        l.positionY.setValueAtTime(ay, t);
        l.positionZ.setValueAtTime(az, t);
      } else if (l.setPosition) {
        l.setPosition(ax, ay, az);
      }
      const fx = Math.cos(yaw), fz = Math.sin(yaw);
      if (l.forwardX) {
        const t = this.ctx.currentTime;
        l.forwardX.setValueAtTime(fx, t);
        l.forwardY.setValueAtTime(0, t);
        l.forwardZ.setValueAtTime(fz, t);
        l.upX.setValueAtTime(0, t);
        l.upY.setValueAtTime(1, t);
        l.upZ.setValueAtTime(0, t);
      } else if (l.setOrientation) {
        l.setOrientation(fx, 0, fz, 0, 1, 0);
      }
    } catch (err) {
      this._fail(err);
    }
  }

  // ── SFX one-shot con variación ───────────────────────────────

  /**
   * Dispara un efecto `id` (def no-loop). Fuente nueva por disparo (una
   * AudioBufferSourceNode no puede volver a start()), con variación
   * anti-machine-gun: muestra del pool (`src` + `variations`), pitch ±6 % y
   * volumen ±20 %. `pos` (opcional) lo posiciona en el mundo (panner HRTF).
   * Nunca lanza: en el peor caso devuelve false y el frame del juego sigue.
   */
  playSfx(id, pos = null) {
    if (this._dead || !this.ctx) return false;
    const def = this._byId.get(id);
    if (!def) return false;
    try {
      const srcs = [def.src, ...(def.variations || [])];
      const src = srcs[Math.floor(Math.random() * srcs.length)];
      const rate = rand(0.94, 1.06);
      const vol = (def.volume ?? 1) * rand(0.8, 1.2);
      const bus = this.buses[def.bus || 'sfx'];
      const ctx = this.ctx;
      const t0 = ctx.currentTime;
      this._buffer(src).then((buf) => {
        if (this._dead) return;
        const source = ctx.createBufferSource();
        const gain = ctx.createGain();
        source.buffer = buf;
        source.playbackRate.value = rate;
        gain.gain.value = vol;
        source.connect(gain);
        if (pos) {
          const panner = this._makePanner({ x: pos.x, y: pos.y, z: pos.z });
          gain.connect(panner);
          panner.connect(bus);
        } else {
          gain.connect(bus);
        }
        source.onended = () => { try { source.disconnect(); gain.disconnect(); } catch { /* ya suelto */ } };
        source.start(t0);
      }).catch(() => { /* src inexistente: silencio, no rompe */ });
      return true;
    } catch (err) {
      return this._fail(err);
    }
  }

  /**
   * Silencia los bucles (salir del playtest): detiene las fuentes de loop y las
   * descarta — `resume()` los vuelve a crear (una AudioBufferSourceNode no se
   * rearanca, siempre fuente nueva). Los one-shot vivos se sueltos solos.
   */
  halt() {
    if (!this.ctx) { this.loops = []; this._started = false; return; }
    for (const { source } of this.loops) { try { source.stop(); } catch { /* ya parada */ } }
    this.loops = [];
    this._started = false;
    this.music?.halt?.();
  }

  dispose() {
    this._dead = true;
    for (const { source } of this.loops) { try { source.stop(); } catch { /* ya parada */ } }
    for (const g of Object.values(this.buses)) g.disconnect();
    try { this.master?.disconnect(); } catch { /* */ }
    try { this.limiter?.disconnect(); } catch { /* */ }
    try { if (this.ctx?.state !== 'closed') this.ctx?.close?.(); } catch { /* */ }
    this.loops = [];
    this.ctx = null;
  }
}
