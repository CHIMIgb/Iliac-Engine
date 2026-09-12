/**
 * music.js — Música adaptativa por layering vertical (F4.5).
 *
 * Un `audio[]` con `bus: 'music'` y `layers: [stem1, stem2, …]` se reproduce
 * como N stems del MISMO arrancado en el mismo instante de reloj de audio
 * (loop, sincronía garantizada). La intensidad 0..N-1 SOLO mueve ganancias:
 *   nivel 0 → base · nivel 1 → +percusión · nivel 2 → +tensión …
 * con ramps de fade (sin parar/reiniciar fuentes → nunca se desincroniza).
 *
 * Lógica pura: recibe el AudioEngine (que aporta ctx/buses/decoder), sin
 * Three.js; testeable con el mismo stub de contexto.
 */

/** Segundos por beat para un BPM dado. */
export function secondsPerBeat(bpm) {
  return 60 / bpm;
}

/** Cuánto falta para el próximo beat desde `posSec` (0 si justo en el beat). */
export function timeUntilNextBeat(posSec, spb) {
  const m = ((posSec % spb) + spb) % spb;
  return m === 0 ? 0 : spb - m;
}

/** Nivel discreto (0..maxLevel) desde una intensidad continua 0..1. */
export function levelFromIntensity(x, maxLevel = 2) {
  const v = Math.min(1, Math.max(0, x));
  return Math.min(maxLevel, Math.floor(v * (maxLevel + 1 - 1e-9) + 1e-9));
}

export class AdaptiveMusic {
  /**
   * @param {import('./audio.js').AudioEngine} engine
   * @param {{src:string, layers?:string[], volume?:number, fadeIn?:number}} def
   */
  constructor(engine, def) {
    this.engine = engine;
    this.srcs = [def.src, ...(def.layers || [])];
    this.volume = def.volume ?? 1;
    this.fade = def.fadeIn ?? 0.8; // segundos de rampa entre intensidades
    this.level = 0;
    this.voices = [];
    this._built = false;
  }

  /** Crea y arranca los stems sincronizados (tras resume()). Idempotente. */
  build() {
    const ctx = this.engine.ctx;
    if (!ctx || this._built || !this.srcs.length) return;
    for (let i = 0; i < this.srcs.length; i++) {
      const gain = ctx.createGain();
      gain.gain.value = i === 0 ? this.volume : 0;
      gain.connect(this.engine.buses.music);
      const source = ctx.createBufferSource();
      source.loop = true;
      source.connect(gain);
      this.engine._buffer(this.srcs[i]).then((buf) => {
        source.buffer = buf;
        source.start(0);
      }).catch(() => { /* sin archivo: silencio */ });
      this.voices.push({ gain, source });
    }
    this._built = true;
    if (this.level > 0) this.setIntensity(this.level, true);
  }

  /**
   * Sube/baja stems hasta `level` (0 = solo base). Con `immediate` salta el
   * fade (p. ej. primer arranque). Las ganancias van en lineal con rampa
   * temporal: perceptualmente usamos dB solo en buses, aquí es un crossfade.
   */
  setIntensity(level, immediate = false) {
    const l = Math.min(this.srcs.length - 1, Math.max(0, level | 0));
    this.level = l;
    if (!this._built || !this.engine.ctx) return;
    const t = this.engine.ctx.currentTime;
    for (let i = 0; i < this.voices.length; i++) {
      const g = this.voices[i].gain;
      const target = i === 0 ? this.volume : i <= l ? this.volume : 0;
      if (immediate || !g.gain.linearRampToValueAtTime) {
        g.gain.value = target;
      } else {
        g.gain.cancelScheduledValues?.(t);
        g.gain.setValueAtTime?.(g.gain.value, t);
        g.gain.linearRampToValueAtTime(target, t + this.fade);
      }
    }
  }

  dispose() {
    for (const v of this.voices) { try { v.source.stop(); } catch { /* sin start */ } }
    this.voices = [];
    this._built = false;
  }
}
