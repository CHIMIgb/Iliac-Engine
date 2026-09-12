/**
 * setup-audio.mjs — Genera assets de audio RETRO procedurales (WAV PCM) para la
 * demo/Studio de F4.5: música adaptativa (3 stems), ambiente y SFX (paso,
 * puerta, impacto, voz). Sintetizados en el propio script → SIN copyright y
 * reproducibles/verificables sin importar Daggerfall.
 *
 * Uso:  cd studio && npm run setup:audio
 * Salida (NO versionadas, ver .gitignore):  studio/public/audio/*.wav  y  demo/audio/*.wav
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SR = 22050; // 22 kHz mono: suficiente para retro, archivos ligeros
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '..', '..');
const dests = [path.join(repo, 'studio', 'public', 'audio'), path.join(repo, 'demo', 'audio')];

// ── WAV writer (16-bit PCM mono) ───────────────────────────────
function wav(samples) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  const w = (o, s) => buf.write(s, o, 'ascii');
  const u32 = (o, v) => buf.writeUInt32LE(v, o);
  const u16 = (o, v) => buf.writeUInt16LE(v, o);
  w(0, 'RIFF'); u32(4, 36 + n * 2); w(8, 'WAVE'); w(12, 'fmt ');
  u32(16, 16); u16(20, 1); u16(22, 1); u32(24, SR); u32(28, SR * 2);
  u16(32, 2); u16(34, 16); w(36, 'data'); u32(40, n * 2);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE((s * 32767) | 0, 44 + i * 2);
  }
  return buf;
}

// ── primitivas de síntesis ─────────────────────────────────────
const TAU = Math.PI * 2;
const noteFreq = (semi) => 440 * Math.pow(2, semi / 12);
const env = (i, n, a, r) => Math.min(1, i / (a * SR), (n - i) / (r * SR)); // ataque/decay lineal

function tone(dur, freq, { type = 'square', vol = 0.5, a = 0.005, r = 0.05 } = {}) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const p = (freq * t) % 1;
    let v;
    if (type === 'square') v = p < 0.5 ? 1 : -1;
    else if (type === 'saw') v = 2 * p - 1;
    else if (type === 'tri') v = 4 * Math.abs(p - 0.5) - 1;
    else v = Math.sin(TAU * freq * t); // sine
    out[i] = v * vol * env(i, n, a, r);
  }
  return out;
}

function noiseBurst(dur, { vol = 0.4, hp = 0 } = {}) {
  const n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    last = white * (1 - hp) + last * hp; // 1-pole (hp alto pasa más, deja grave)
    out[i] = last * vol * env(i, n, 0.002, Math.min(0.1, dur * 0.5));
  }
  return out;
}

const add = (...tracks) => {
  const n = Math.max(...tracks.map((t) => t.length));
  const out = new Float32Array(n);
  for (const t of tracks) for (let i = 0; i < t.length; i++) out[i] += t[i];
  return out;
};
// Coloca `clip` en el offset `at` (segundos) sobre un lienzo de `total` seg.
function place(clip, at, total) {
  const out = new Float32Array(Math.round(total * SR));
  const start = Math.round(at * SR);
  for (let i = 0; i < clip.length && start + i < out.length; i++) out[start + i] += clip[i];
  return out;
}
/** Suma trozos [clip, at] al lienzo de `total` seg (sin copias completas por nota). */
function mix(total, ...chunks) {
  const out = new Float32Array(Math.round(total * SR));
  for (const [clip, at] of chunks) {
    const start = Math.round(at * SR);
    for (let i = 0; i < clip.length && start + i < out.length; i++) out[start + i] += clip[i];
  }
  return out;
}

// ── música: 3 stems de la MISMA duración (loop cuadrado) ──────
// Progresión menor simple (i–VI–III–VII), 4 compases a 120 BPM, 4/4.
const BPM = 120;
const beat = 60 / BPM;            // 0.5 s
const bar = beat * 4;             // 2 s
const LOOP = bar * 4;             // 8 s (los 4 acordes)
const chords = [[0, 3, 7], [-2, 2, 5], [3, 7, 10], [-4, 0, 3]]; // semitonos rel. A

const bassTrack = () => mix(LOOP, ...chords.map((c, ci) => [
  tone(bar, noteFreq(c[0] - 24), { type: 'tri', vol: 0.5, r: 0.1 }), ci * bar,
]));
const arpTrack = () => mix(LOOP, ...chords.flatMap((c, ci) =>
  Array.from({ length: 8 }, (_, s) => [
    tone(beat / 2, noteFreq(c[s % 3] + 12), { type: 'square', vol: 0.18, a: 0.002, r: 0.04 }),
    ci * bar + s * (beat / 2),
  ]),
));
function percTrack() {
  // Kick grave en tiempos 0 y 2, hi-hat (ruido) en contratiempos.
  const kick = () => {
    const n = Math.round(0.12 * SR); const s = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / SR; s[i] = Math.sin(TAU * (120 - 800 * t) * t) * env(i, n, 0.001, 0.12); }
    return s;
  };
  const hat = () => noiseBurst(0.03, { vol: 0.12, hp: 0.6 });
  const chunks = [];
  for (let b = 0; b < 16; b++) {
    if (b % 4 === 0 || b % 4 === 2) chunks.push([kick(), b * beat]);
    else if (b % 2 === 1) chunks.push([hat(), b * beat]);
  }
  return mix(LOOP, ...chunks);
}
function tensionTrack() {
  // Pedal agudo disonante y trémolo: solo entra en combate (nivel 2).
  const out = new Float32Array(Math.round(LOOP * SR));
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    const trem = 0.5 + 0.5 * Math.sin(TAU * 6 * t);
    out[i] = (Math.sin(TAU * noteFreq(15) * t) + 0.5 * Math.sin(TAU * noteFreq(22) * t)) * 0.12 * trem;
  }
  return out;
}

// ── ambiente y SFX ─────────────────────────────────────────────
function windLoop(brown = 0.98, modHz = 0.25, vol = 4) {
  // Ruido filtrado con modulación lenta, loop con fundido de costura.
  const dur = 4, n = Math.round(dur * SR);
  const out = new Float32Array(n);
  let last = 0;
  for (let i = 0; i < n; i++) {
    const white = Math.random() * 2 - 1;
    last = last * brown + white * (1 - brown);
    const mod = 0.6 + 0.4 * Math.sin(TAU * (i / SR) * modHz);
    out[i] = last * vol * mod;
  }
  const seam = Math.round(0.15 * SR);
  for (let i = 0; i < seam; i++) { const f = i / seam; out[i] = out[i] * f + out[n - seam + i] * (1 - f); }
  return out;
}
const sfx = {
  footstep: () => noiseBurst(0.08, { vol: 0.35, hp: 0.5 }),
  door: () => add(
    place(tone(0.25, noteFreq(-9), { type: 'saw', vol: 0.2, a: 0.02, r: 0.1 }), 0, 0.3),
    place(noiseBurst(0.12, { vol: 0.3, hp: 0.3 }), 0.05, 0.3),
  ),
  hit: () => add(noiseBurst(0.1, { vol: 0.5, hp: 0.2 }), tone(0.08, 90, { type: 'square', vol: 0.3, r: 0.08 })),
  voice: () => add(
    place(tone(0.12, noteFreq(3), { type: 'square', vol: 0.3, a: 0.01, r: 0.04 }), 0, 0.26),
    place(tone(0.12, noteFreq(10), { type: 'square', vol: 0.3, a: 0.01, r: 0.04 }), 0.12, 0.26),
  ),
};

const tracks = {
  'music-base.wav': bassTrack(),
  'music-arp.wav': arpTrack(),
  'music-perc.wav': percTrack(),
  'music-tension.wav': tensionTrack(),
  'wind.wav': windLoop(),
  'water.wav': windLoop(0.92, 1.3, 2.2), // ruido más brillante y rápido = rumor de corriente
  'sfx-footstep.wav': sfx.footstep(),
  'sfx-footstep2.wav': sfx.footstep(),
  'sfx-footstep3.wav': sfx.footstep(),
  'sfx-door.wav': sfx.door(),
  'sfx-hit.wav': sfx.hit(),
  'sfx-voice.wav': sfx.voice(),
};

for (const dir of dests) {
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, samples] of Object.entries(tracks)) {
    fs.writeFileSync(path.join(dir, name), wav(samples));
  }
  // Manifiesto = DATO que la herramienta de Audio del Studio lee para sugerir
  // ficheros (nada de listas hardcodeadas en el TS). Rutas absolutas del sitio
  // de Studio; el directorio de la demo reescribe el prefijo a su ruta relativa.
  const base = dir.includes('studio') ? '/audio/' : '../../demo/audio/';
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ files: Object.keys(tracks).map((f) => `${base}${f}`) }, null, 2));
  console.log(`[setup:audio] ${Object.keys(tracks).length} WAVs + manifest.json escritos en ${dir}`);
}
