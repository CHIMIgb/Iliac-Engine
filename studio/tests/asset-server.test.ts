/**
 * asset-server.test.ts — logica pura del middleware de assets (F4.6.a):
 * saneado de nombres, extensiones admitidas, traversal bloqueado y payloads
 * de subida validados. El middleware en si (fs/HTTP de Vite) no se testea aqui.
 */
import { describe, it, expect } from 'vitest';
import {
  sanitizeFileName,
  extFromName,
  isAudioName,
  audioUploadToBuffer,
  resolveAssetPath,
  MAX_AUDIO_BYTES,
} from '../src/io/assetServer';

// Base64 portable (sin @types/node): TextEncoder + btoa, globales de Node 16+/browser.
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));

describe('assetServer · saneado de nombres', () => {
  it('sanitizeFileName deja solo [A-Za-z0-9._-] y quita rutas', () => {
    expect(sanitizeFileName('wind.wav')).toBe('wind.wav');
    expect(sanitizeFileName('mi sonido.mp3')).toBe('mi_sonido.mp3');
    expect(sanitizeFileName('a/b/pista.mp4')).toBe('pista.mp4');
    expect(sanitizeFileName('a\\b\\pista.mp4')).toBe('pista.mp4');
    expect(sanitizeFileName('../secret.wav')).not.toContain('..');
    expect(sanitizeFileName('')).toBe('');
  });

  it('extFromName devuelve la extension en minusculas', () => {
    expect(extFromName('WIND.WAV')).toBe('wav');
    expect(extFromName('pista.mp3')).toBe('mp3');
    expect(extFromName('sin-extension')).toBe('');
  });

  it('isAudioName admite wav, mp3, mp4, ogg, flac, m4a, aac, webm... y rechaza otros', () => {
    for (const f of ['a.wav', 'a.mp3', 'a.mp4', 'a.ogg', 'a.oga', 'a.flac', 'a.m4a', 'a.aac', 'a.webm']) {
      expect(isAudioName(f), f).toBe(true);
    }
    for (const f of ['a.txt', 'a.html', 'a.js', 'a']) {
      expect(isAudioName(f), f).toBe(false);
    }
  });
});

describe('assetServer · upload a buffer', () => {
  it('decodifica un payload base64 valido', () => {
    const out = audioUploadToBuffer({ name: 'wind.wav', data: b64('WAVDATA') });
    expect(out).not.toBeNull();
    expect(out!.fileName).toBe('wind.wav');
    expect(String.fromCharCode(...out!.buffer)).toBe('WAVDATA');
  });

  it('tolera prefijo data:audio/...;base64,', () => {
    const out = audioUploadToBuffer({ name: 'pista.mp3', data: `data:audio/mpeg;base64,${b64('MP3')}` });
    expect(out).not.toBeNull();
    expect(String.fromCharCode(...out!.buffer)).toBe('MP3');
  });

  it('rechaza payloads sin nombre, sin data, sin extension o no-audio', () => {
    expect(audioUploadToBuffer({ data: b64('x') })).toBeNull();
    expect(audioUploadToBuffer({ name: 'wind.wav' })).toBeNull();
    expect(audioUploadToBuffer({ name: 'a.txt', data: b64('x') })).toBeNull();
    expect(audioUploadToBuffer({ name: 'a', data: b64('x') })).toBeNull();
    expect(audioUploadToBuffer({ name: 'a.mp3', data: 'no-base64!!!' })).toBeNull();
  });

  it('rechaza archivos que exceden el tamano maximo', () => {
    // Base64 de >50 MB sin decodificar: 'A' (byte 0) repetido; 4/3 >MAX por bytes.
    const big = 'A'.repeat(Math.ceil((MAX_AUDIO_BYTES / 3) * 4) + 4);
    expect(audioUploadToBuffer({ name: 'big.wav', data: big })).toBeNull();
  });
});

describe('assetServer · resolveAssetPath (anti-traversal)', () => {
  it('normaliza rutas internas de assets/', () => {
    expect(resolveAssetPath('/assets/audio/wind.wav')).toBe('audio/wind.wav');
    expect(resolveAssetPath('/assets/audio/x.mp3?t=1#h')).toBe('audio/x.mp3');
  });

  it('bloquea traversal y prefijos raros', () => {
    expect(resolveAssetPath('/assets/../secret')).toBeNull();
    expect(resolveAssetPath('/assets/audio/../../secret')).toBeNull();
    expect(resolveAssetPath('/assets/a\\b')).toBeNull();
    expect(resolveAssetPath('/assets/audio/..%2F..%2Fpackage.json')).toBeNull();
    expect(resolveAssetPath('/assets/a%5Cb')).toBeNull();
    expect(resolveAssetPath('assets/audio/wind.wav')).toBeNull(); // sin / inicial
    expect(resolveAssetPath('/no-assets/x')).toBeNull();
    expect(resolveAssetPath('/assets/')).toBeNull();
  });
});