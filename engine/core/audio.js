/**
 * audio.js — Audio Engine (Web Audio API): buses, ganancia en dB, SFX one-shot
 * con variación y pool, loops múltiples simultáneos (música, ambiente, NPCs,
 * enemigos) y ducking de la música bajo la voz.
 *
 * Lógica pura de core/: SIN Three.js ni DOM. El `AudioContext` se construye con
 * la fábrica inyectable `ctxFactory` (en el navegador, `() => new AudioContext()`;
 * en los tests, un stub que registra llamadas). Nada de esto reproduce sonido
 * hasta `resume()` (política de autoplay del navegador: primer gesto).
 *
 * Grafos:
 *   voz → [PannerNode si espacial] → bus(GainNode) → master(GainNode) → limiter → destination
 *
 * Convención de ejes del mundo → Web Audio (derecho, Y-arriba, profundidad):
 *   X = x, Y = z (altura), Z = y (profundidad). El listener usa la misma fórmula.
 */

/** 0..1 lineal → dB perceptual (0 → −∞, 0.5 ≈ −6 dB, 1 → 0 dB). */
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
    this._pools = new Map();          // defId → [{ source, gain, panner, busy }]
    this._bufferPromises = new Map(); // src → Promise<AudioBuffer>
    this._duckDb = 0;                 // offset aplicado al bus music
    this._userDb = { music: 0, sfx: 0, ambience: 0, voice: 0 };
    this._started = false;
    this.music = null; // AdaptiveMusic asignado por Engine3D (se arranca tras resume)
  }

  /**
   * Crea el contexto al primer gesto y arranca los loops. Segura de llamar
   * varias veces (los bots/Studio la invocan en cada entrada a playtest).
   */
  async resume() {
    if (!this._ctxFactory) return false;
    if (!this.ctx) this._build();
    if (this.ctx.state === 'suspended' && this.ctx.resume) await this.ctx.resume();
    if (!this._started) {
      this._started = true;
      // Las defs con `layers` (música adaptativa) las gestiona AdaptiveMusic (music.js).
      for (const def of this.defs) if (def.loop && !def.layers) this._startLoop(def);
      this.music?.build?.();
    }
    return true;
  }

  /** Se Seam de tests: reemplazable para inyectar buffers sin fetch/decodificar. */
  async _decode(src) {
    const res = await fetch(src);
    return this.ctx.decodeAudioData(await res.arrayBuffer());
  }

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
    const lp = (p, v) => { if (p) p.value = v; };
    lp(this.limiter.threshold, -6);
    lp(this.limiter.knee, 6);
    lp(this.limiter.ratio, 12);
    lp(this.limiter.attack, 0.003);
    lp(this.limiter.release, 0.25);
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

  /**
   * Ducking: la música baja ~12 dB con attack rápido y sube suave al terminar.
   * `voiceDefId`/`on` — API simple: duckMusic(true) / duckMusic(false).
   */
  duckMusic(on, db = -12) {
    if (!this.ctx) { this._duckDb = on ? db : 0; return; }
    this._duckDb = on ? db : 0;
    const g = this.buses.music.gain;
    const t = this.ctx.currentTime;
    const target = dbToLinear(this._userDb.music + this._duckDb);
    if (g.linearRampToValueAtTime) {
      g.cancelScheduledValues?.(t);
      g.setValueAtTime?.(g.value, t);
      g.linearRampToValueAtTime(target, t + (on ? 0.01 : 0.4)); // attack 10 ms, release 400 ms
    } else {
      g.value = target;
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
    source.buffer = null;
    source.loop = true;
    source.connect(panner ?? gain);
    const loop = { def, source, gain, panner };
    this.loops.push(loop);
    this._buffer(def.src).then((buf) => {
      source.buffer = buf;
      source.start(0);
    }).catch(() => { /* src inexistente: silencio, sin romper el juego */ });
  }

  /** Actualiza los panners de los bucles con `spatial.follow` a la posición del sprite. */
  updateEmitters(sprites = []) {
    if (!this.ctx) return;
    const byId = new Map(sprites.map((s) => [s.id, s]));
    for (const { def, panner } of this.loops) {
      if (!panner || !def.spatial?.follow) continue;
      const sp = byId.get(def.spatial.follow);
      if (sp) this._setPannerPos(panner, sp.pos?.x ?? 0, sp.pos?.y ?? 0, sp.pos?.z ?? 0);
    }
  }

  _makePanner(spatial) {
    const p = this.ctx.createPanner();
    try { p.panningModel = 'HRTF'; } catch { /* Safari antiguo: deja equalpower */ }
    if (p.distanceModel) p.distanceModel = 'inverse';
    const lp = (prop, v) => { if (prop && v !== undefined) prop.value = v; };
    lp(p.refDistance, spatial.refDistance ?? 3);
    lp(p.maxDistance, spatial.maxDistance ?? 200);
    lp(p.rolloffFactor, spatial.rolloff ?? 1);
    const x = spatial.x ?? 0, y = spatial.y ?? 0, z = spatial.z ?? 0;
    this._setPannerPos(p, x, y, z);
    return p;
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
    if (!this.ctx) return;
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
    // Adelanto y arriba del escucha (mundo sin alabeo): forward = (cos yaw, 0, sin yaw)
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
  }

  // ── SFX one-shot con variación y pool ────────────────────────

  /**
   * Dispara un efecto `id` (def no-loop). Variación anti-machine-gun:
   * muestra del pool (`src` + `variations`), pitch ±6 % y volumen ±20 %.
   * `pos` (opcional) lo posiciona en el mundo (panner HRTF desechable).
   * Reutiliza voces del pool: onended → busy=false (sin acumular fuentes).
   * Devuelve false si el id no existe.
   */
  playSfx(id, pos = null) {
    const def = this._byId.get(id);
    if (!def || !this.ctx) return false;
    const srcs = [def.src, ...(def.variations || [])];
    const src = srcs[Math.floor(Math.random() * srcs.length)];
    const rate = rand(0.94, 1.06);
    const vol = (def.volume ?? 1) * rand(0.8, 1.2);
    const bus = this.buses[def.bus || 'sfx'];

    let pool = this._pools.get(id);
    if (!pool) { pool = []; this._pools.set(id, pool); }
    let voice = pool.find((v) => !v.busy);
    if (!voice) {
      // La fuente del pool nace una vez; su buffer es el mismo src base.
      const source = this.ctx.createBufferSource();
      const gain = this.ctx.createGain();
      source.connect(gain);
      gain.connect(bus);
      voice = { source, gain, busy: false, baseSrc: def.src };
      pool.push(voice);
      this._buffer(def.src).then((buf) => { voice.source.buffer = buf; })
        .catch(() => {});
    }
    if (!voice.source.buffer) {
      // Todavía sin decodificar: reintenta una vez cargado.
      this._buffer(voice.baseSrc).then((buf) => {
        voice.source.buffer = buf;
        this._fire(voice, bus, rate, vol, null);
      }).catch(() => {});
      return true;
    }
    this._fire(voice, bus, rate, vol, pos);
    return true;
  }

  _fire(voice, bus, rate, vol, pos) {
    if (pos) {
      // Con posición: fuente → gain → panner desechable → bus (no pooled).
      const panner = this._makePanner({ x: pos.x, y: pos.y, z: pos.z });
      voice.gain.disconnect?.();
      voice.gain.connect(panner);
      panner.connect(bus);
    } else {
      voice.gain.disconnect?.();
      voice.gain.connect(bus);
    }
    voice.gain.gain.value = vol;
    voice.busy = true;
    voice.source.playbackRate.value = rate;
    voice.source.onended = () => { voice.busy = false; };
    voice.source.start(this.ctx.currentTime);
  }

  dispose() {
    for (const { source } of this.loops) { try { source.stop(); } catch { /* ya parada */ } }
    for (const pool of this._pools.values()) {
      for (const v of pool) { try { v.source.stop(); } catch { /* no iniciada */ } }
    }
    this.loops = [];
    this._pools.clear();
    for (const g of Object.values(this.buses)) g.disconnect();
    this.master?.disconnect();
    this.limiter?.disconnect();
    if (this.ctx?.close) this.ctx.close();
    this.ctx = null;
  }
}
