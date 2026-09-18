/**
 * asset-server.test.ts — lógica pura del servido estático de assets locales.
 * C5c: la subida vive en la API (`POST /api/assets`), así que aquí solo queda
 * el anti-traversal de `resolveAssetPath`. El middleware en sí (fs/HTTP de Vite)
 * no se testea aquí.
 */
import { describe, it, expect } from 'vitest';
import { resolveAssetPath } from '../src/io/assetServer';

describe('assetServer · resolveAssetPath (anti-traversal)', () => {
  it('normaliza rutas internas de assets/', () => {
    expect(resolveAssetPath('/assets/audio/wind.wav')).toBe('audio/wind.wav');
    expect(resolveAssetPath('/assets/sprites/guard_f0.png')).toBe('sprites/guard_f0.png');
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
