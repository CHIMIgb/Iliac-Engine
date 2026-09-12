import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine, linearToDb, dbToLinear, toAudioCoords, AUDIO_BUSES } from '../../engine/core/audio.js';
import { Engine3D } from '../../engine/Engine3D.js';

/** Stub mínimo del AudioContext: registra params y fuentes como objetos planos. */
function fakeCtx() {
  const param = (v = 0) => ({
    value: v,
    setValueAtTime(x) { this.value = x; return this; },
    linearRampToValueAtTime(x) { this.value = x; this.lastRamp = x; return this; },
    cancelScheduledValues() {},
  });
  const node = (extra = {}) => ({ connect() {}, disconnect() {}, ...extra });
  const sources = [];
  const ctx = {
    state: 'running', currentTime: 0, destination: node(), sources,
    resume: async () => {}, close: async () => {},
    createGain: () => node({ gain: param(1) }),
    createDynamicsCompressor: () => node({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    createPanner: () => node({ positionX: param(), positionY: param(), positionZ: param() }),
    createBufferSource: () => {
      const s = node({ buffer: null, loop: false, playbackRate: param(1), onended: null, starts: 0,
        start() { this.starts++; }, stop() {}, __end() { this.onended?.(); } });
      sources.push(s);
      return s;
    },
    decodeAudioData: async () => ({ fake: true }),
    listener: { positionX: param(), positionY: param(), positionZ: param(),
      forwardX: param(), forwardY: param(), forwardZ: param(), upX: param(), upY: param(), upZ: param() },
  };
  return ctx;
}
const flush = () => new Promise((r) => setTimeout(r, 0));

const DEFS = [
  { id: 'wind', src: '/audio/wind.wav', bus: 'ambience', loop: true, volume: 0.5 },
  { id: 'river', src: '/audio/water.wav', bus: 'ambience', loop: true, volume: 0.7, spatial: { x: 50, y: 18, z: 0 } },
  { id: 'guardian', src: '/audio/sfx-voice.wav', bus: 'ambience', loop: true, volume: 0.6, spatial: { follow: 'npc_guardian' } },
  { id: 'hit', src: '/audio/sfx-hit.wav', bus: 'sfx', volume: 0.9 },
  { id: 'voice', src: '/audio/sfx-voice.wav', bus: 'voice' },
];

async function builtEngine(defs = DEFS) {
  const eng = new AudioEngine(defs, { ctxFactory: fakeCtx });
  eng._decode = async () => ({ fake: true }); // seam de tests: sin fetch/decodificado real
  await eng.resume();
  await flush(); // los loops arrancan al resolverse sus (fake) buffers
  return eng;
}

// ── dB ─────────────────────────────────────────────────────────

test('linearToDb/dbToLinear: 0→−80 (clamp perceptivo), 0.5→≈−6 dB, 1→0 dB y son inversos', () => {
  assert.ok(Math.abs(linearToDb(0) - -80) < 0.01, '0 se clampa a 1e-4 → −80 dB');
  assert.ok(Math.abs(linearToDb(0.5) - -6.02) < 0.05);
  assert.equal(linearToDb(1), 0);
  assert.ok(Math.abs(dbToLinear(linearToDb(0.3)) - 0.3) < 1e-9);
  assert.ok(Math.abs(linearToDb(dbToLinear(-12)) - -12) < 1e-9);
});

// ── buses ──────────────────────────────────────────────────────

test('resume() construye Master→limiter y los 4 buses; sin gesto (ctxFactory null) es no-op', async () => {
  const eng = new AudioEngine(DEFS, { ctxFactory: null });
  assert.equal(await eng.resume(), false, 'navegador sin AudioContext / sin fábrica: silencio seguro');
  assert.equal(eng.ctx, null);

  const e = await builtEngine();
  assert.deepEqual(Object.keys(e.buses).sort(), [...AUDIO_BUSES].sort());
  assert.ok(e.master && e.limiter, 'master con limitador de seguridad');
  // Slider 0..1 → dB (el error clásico es tratar el slider COMO dB). 0.5 → −6 dB,
  // y el motor GUARDA dB (−6), no el 0.5 crudo; la ganancia lineal final es dbToLinear(−6)=0.5.
  e.setBusVolume('sfx', 0.5);
  assert.ok(Math.abs(e._userDb.sfx - -6.02) < 0.05, 'el volumen de bus se almacena en dB');
  assert.ok(Math.abs(e.buses.sfx.gain.value - 0.5) < 1e-6, 'ganancia lineal = inversa del dB');
  e.setBusVolume('sfx', 1);
  assert.equal(e._userDb.sfx, 0);
  assert.equal(e.buses.sfx.gain.value, 1);
});

// ── loops múltiples simultáneos (música+ambiente+NPC a la vez) ─

test('los defs loop:true arrancan TODOS a la vez como fuentes propias', async () => {
  const e = await builtEngine();
  assert.equal(e.loops.length, 3, 'wind, river y guardian suenan simultáneos');
  const loopSources = e.ctx.sources.filter((s) => s.loop);
  assert.equal(loopSources.length, 3);
  assert.ok(loopSources.every((s) => s.starts === 1 && s.buffer), 'cada stem/bucle con su buffer y start');
});

test('updateEmitters() sigue la posición del sprite (spatial.follow) y el listener mueve su oído', async () => {
  const e = await builtEngine();
  const guardian = e.loops.find((l) => l.def.id === 'guardian');
  e.updateEmitters([{ id: 'npc_guardian', pos: { x: 62, y: 60, z: 12 } }]);
  // Mundo(x, y=prof, z=alt) → audio(x, y=alt, z=prof)
  assert.deepEqual(toAudioCoords(62, 60, 12), { ax: 62, ay: 12, az: 60 });
  assert.equal(guardian.panner.positionX.value, 62);
  assert.equal(guardian.panner.positionZ.value, 60);
  e.setListener(10, 20, 30, 0);
  assert.equal(e.ctx.listener.positionX.value, 10);
  assert.equal(e.ctx.listener.positionY.value, 30, 'altura del oído = posZ del mundo');
});

// ── ducking ────────────────────────────────────────────────────

test('duckMusic(true) baja Music ≈12 dB con rampa y duckMusic(false) lo recupera', async () => {
  const e = await builtEngine();
  e.setBusVolume('music', 1);
  e.duckMusic(true);
  assert.ok(Math.abs(e.buses.music.gain.value - dbToLinear(-12)) < 1e-6);
  e.duckMusic(false);
  assert.ok(Math.abs(e.buses.music.gain.value - 1) < 1e-6, 'vuelve al nivel del slider');
});

// ── SFX one-shot con pool (sin fugas de fuentes) ──────────────

test('playSfx reutiliza voces del pool: onended libera la voz y el siguiente no crea fuente', async () => {
  const e = await builtEngine();
  assert.equal(e.playSfx('hit'), true);
  await flush(); // el disparo se materializa al resolverse el (fake) buffer
  const v0 = e._pools.get('hit')[0];
  assert.ok(v0.busy, 'ocupada mientras suena');
  assert.equal(v0.source.starts, 1);
  assert.equal(e.playSfx('hit'), true);
  await flush();
  assert.equal(e._pools.get('hit').length, 2, '2ª simultánea: fuente nueva (no se pisa la primera)');
  v0.source.__end(); // fin de la 1ª → libre
  assert.equal(v0.busy, false, 'onended → busy=false (auto-destrucción lógica)');
  e.playSfx('hit');
  await flush();
  assert.equal(e._pools.get('hit').length, 2, 'la 3ª reutiliza la liberada: el pool no crece');
  assert.equal(e.playSfx('no-existe'), false);
});

test('variación anti-machine-gun: pitch ±6 % y volumen ±20 % aleatorizados', async () => {
  const e = await builtEngine();
  const real = Math.random;
  try {
    globalThis.Math.random = () => 0;   // extremo bajo del rango
    e.playSfx('hit');
    await flush();
    let v = e._pools.get('hit')[0];
    assert.ok(Math.abs(v.source.playbackRate.value - 0.94) < 1e-9);
    assert.ok(Math.abs(v.gain.gain.value - 0.9 * 0.8) < 1e-9, 'vol base 0.9 × 0.8 mínimo');
    globalThis.Math.random = () => 0.9999; // extremo alto
    e.playSfx('hit');
    await flush();
    v = e._pools.get('hit')[1];
    assert.ok(v.source.playbackRate.value > 1.05 && v.source.playbackRate.value <= 1.06);
    assert.ok(v.gain.gain.value > 0.9 * 1.19);
  } finally {
    globalThis.Math.random = real;
  }
});

// ── integración Engine3D (datos → motor, sin WebGL) ────────────

test('Engine3D crea AudioEngine/AdaptiveMusic desde project.audio/music y los re-crea al cambiar', () => {
  const base = {
    meta: { name: 'a', schemaVersion: 3 },
    camera: { posX: 0, posY: 0, posZ: 0.6, yaw: 0, pitch: 0 },
    world: { vertices: [], sectors: [], walls: [], textures: {} },
    audio: [
      { id: 'mus', src: '/audio/music-base.wav', bus: 'music', loop: true,
        layers: ['/audio/music-arp.wav', '/audio/music-perc.wav', '/audio/music-tension.wav'] },
    ],
    music: { id: 'mus', intensity: 2, bpm: 120 },
  };
  const e = new Engine3D(base);
  e._setupAudio();
  assert.ok(e.audio instanceof AudioEngine);
  assert.equal(e.music.level, 2, 'intensity inicial desde project.music');
  // Sin AudioContext (node): todo sigue siendo seguro.
  assert.equal(e.audio.ctx, null);
  assert.equal(e.audio.playSfx('mus'), false);
  // Cambio de firma en setWorld → re-setup con la nueva intensidad.
  const next = { ...base, music: { id: 'mus', intensity: 0, bpm: 120 } };
  assert.equal(e.setWorld(next), true);
  assert.equal(e.music.level, 0);
});
