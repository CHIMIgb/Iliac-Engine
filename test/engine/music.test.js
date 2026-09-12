import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AudioEngine } from '../../engine/core/audio.js';
import { AdaptiveMusic, secondsPerBeat, timeUntilNextBeat, levelFromIntensity } from '../../engine/core/music.js';

/** Mismo stub de contexto que audio.test.js (solo lo necesario aquí). */
function fakeCtx() {
  const param = (v = 0) => ({
    value: v, rampTo: null,
    setValueAtTime(x) { this.value = x; return this; },
    linearRampToValueAtTime(x) { this.rampTo = x; this.value = x; return this; },
    cancelScheduledValues() {},
  });
  const node = (extra = {}) => ({ connect() {}, disconnect() {}, ...extra });
  const ctx = {
    state: 'running', currentTime: 0, destination: node(),
    resume: async () => {}, close: async () => {},
    createGain: () => node({ gain: param(1) }),
    createDynamicsCompressor: () => node({ threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    createBufferSource: () => { const s = node({ buffer: null, loop: false, playbackRate: param(1), onended: null, starts: 0, start() { this.starts++; }, stop() {} }); return s; },
    createPanner: () => node({ positionX: param(), positionY: param(), positionZ: param() }),
    decodeAudioData: async () => ({ fake: true }),
    listener: {},
  };
  return ctx;
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test('beat math: 120 BPM → 0.5 s/beat y cuantización al siguiente beat', () => {
  assert.equal(secondsPerBeat(120), 0.5);
  assert.ok(Math.abs(timeUntilNextBeat(1.2, 0.5) - 0.3) < 1e-9);
  assert.equal(timeUntilNextBeat(0.5, 0.5), 0, 'justo en el beat: 0');
  assert.ok(Math.abs(timeUntilNextBeat(-0.1, 0.5) - 0.1) < 1e-9, 'robusto a tiempos negativos');
});

test('levelFromIntensity mapea 0..1 a niveles discretos sin salirse del rango', () => {
  assert.equal(levelFromIntensity(0), 0);
  assert.equal(levelFromIntensity(0.5), 1);
  assert.equal(levelFromIntensity(0.9999), 2);
  assert.equal(levelFromIntensity(1), 2);
  assert.equal(levelFromIntensity(0.8, 3), 3);
});

test('AdaptiveMusic: stems arrancan juntos, la intensidad 1 y 2 SOLO sube ganancias (fade)', async () => {
  const defs = [{ id: 'mus', src: '/audio/music-base.wav', bus: 'music', loop: true,
    layers: ['/audio/music-perc.wav', '/audio/music-tension.wav'] }];
  const engine = new AudioEngine(defs, { ctxFactory: fakeCtx });
  engine._decode = async () => ({ fake: true }); // seam de tests: sin fetch real
  await engine.resume();
  const music = new AdaptiveMusic(engine, defs[0]);
  music.build();
  await flush();

  assert.equal(music.voices.length, 3, 'base + 2 stems');
  assert.ok(music.voices.every((v) => v.source.loop && v.source.starts === 1), 'todos en loop y arrancados (sincronía)');
  assert.equal(music.voices[0].gain.gain.value, 1);
  assert.equal(music.voices[1].gain.gain.value, 0, 'nivel 0: percusión off');
  assert.equal(music.voices[2].gain.gain.value, 0);

  music.setIntensity(1);
  assert.equal(music.voices[1].gain.gain.rampTo, 1, 'nivel 1: sube percusión…');
  assert.equal(music.voices[2].gain.gain.rampTo, 0, '…pero no la tensión');
  assert.equal(music.voices[0].source.starts, 1, 'ningún stem se re-arranca: nunca se desincroniza');

  music.setIntensity(2);
  assert.equal(music.voices[2].gain.gain.rampTo, 1, 'nivel 2: también tensión (con rampa, sin reinicio)');

  music.setIntensity(0);
  assert.equal(music.voices[1].gain.gain.rampTo, 0);
  assert.equal(music.voices[2].gain.gain.rampTo, 0);
});

test('setIntensity antes de build() se recuerda y se aplica al arrancar', async () => {
  const defs = [{ id: 'm', src: 'a.wav', bus: 'music', loop: true, layers: ['b.wav'] }];
  const engine = new AudioEngine(defs, { ctxFactory: fakeCtx });
  engine._decode = async () => ({ fake: true });
  await engine.resume();
  const music = new AdaptiveMusic(engine, defs[0]);
  music.setIntensity(1);
  music.build();
  await flush();
  assert.equal(music.voices[1].gain.gain.value, 1, 'el nivel pedido se materializa tras build');
});
