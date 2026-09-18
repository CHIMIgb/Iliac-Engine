/**
 * asset-api.test.ts — assets del juego por API (C5c): sprites y audio se suben
 * como multipart a `POST /api/assets` y el documento guarda `/api/assets/<id>/file`.
 * Todo con fetch simulado (node, sin jsdom ni sesión real).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  assetUrl,
  dataUrlToBlob,
  deleteSpriteAsset,
  listAudioUrls,
  listSpriteAssets,
  uploadAudioFiles,
  uploadSpriteFrames,
} from '../src/io/assetApi';

afterEach(() => {
  vi.unstubAllGlobals();
});

const PNG_1x1 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

/** Respuesta simulada del contrato {success,data,error}. */
function mockFetch(data: unknown, success = true) {
  const fn = vi.fn(async (_url: string, _init: RequestInit) =>
    ({
      ok: success,
      json: async () => (success ? { success: true, data, error: null } : data),
    }) as unknown as Response,
  );
  vi.stubGlobal('fetch', fn as unknown as typeof fetch);
  return fn;
}

describe('assetApi · dataUrlToBlob', () => {
  it('convierte un dataURL PNG en Blob con su MIME y bytes', async () => {
    const blob = dataUrlToBlob(PNG_1x1);
    expect(blob.type).toBe('image/png');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(bytes[0]).toBe(0x89); // firma PNG
    expect(bytes[1]).toBe(0x50); // 'P'
  });
});

describe('assetApi · subida de sprites (multipart)', () => {
  it('un POST por frame con file/tipo/proyectoId y devuelve key → URL de la API', async () => {
    const fetchMock = mockFetch({ asset: { id: 'a1' }, reused: false });
    const out = await uploadSpriteFrames({ guard_f0: PNG_1x1 }, 'p1');

    expect(out.guard_f0).toEqual({ key: 'guard_f0', url: '/api/assets/a1/file', reused: false, error: null });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/assets');
    expect(init.method).toBe('POST');

    // FormData: el navegador pone el Content-Type (boundary); forzar JSON rompería la subida.
    expect(init.body).toBeInstanceOf(FormData);
    const headers = init.headers as Headers;
    expect(headers.get('Content-Type')).toBeNull();
    const form = init.body as FormData;
    expect(form.get('tipo')).toBe('sprite');
    expect(form.get('proyectoId')).toBe('p1');
    expect((form.get('file') as File).name).toBe('guard_f0.png');
  });

  it('sin proyectoId no manda el campo (la subida sigue siendo válida)', async () => {
    const fetchMock = mockFetch({ asset: { id: 'a1' }, reused: false });
    await uploadSpriteFrames({ f0: PNG_1x1 });
    const [, init] = fetchMock.mock.calls[0]!;
    expect((init.body as FormData).get('proyectoId')).toBeNull();
  });

  it('si el server rechaza un frame, lo reporta sin lanzar (el resto se sube)', async () => {
    mockFetch({ success: false, data: null, error: { code: 'VALIDATION_ERROR', message: 'No es PNG', details: null } }, false);
    const out = await uploadSpriteFrames({ raro_f0: PNG_1x1 });
    expect(out.raro_f0!.url).toBeNull();
    expect(out.raro_f0!.error).toBe('No es PNG');
  });
});

describe('assetApi · subida de audio', () => {
  it('sube un File con tipo audio y propaga el dedupe (reused)', async () => {
    const fetchMock = mockFetch({ asset: { id: 'b2' }, reused: true });
    const audio = new Blob([new Uint8Array([0xff, 0xfb, 0x90, 0x00])], { type: 'audio/mpeg' });
    const out = await uploadAudioFiles([new File([audio], 'viento.mp3', { type: 'audio/mpeg' })], null);

    expect(out).toEqual([{ key: 'viento.mp3', url: '/api/assets/b2/file', reused: true, error: null }]);
    const form = fetchMock.mock.calls[0]![1].body as FormData;
    expect(form.get('tipo')).toBe('audio');
    expect((form.get('file') as File).name).toBe('viento.mp3');
  });
});

describe('assetApi · listado de audios', () => {
  it('pide solo los de tipo audio y devuelve sus URLs servidas', async () => {
    const fetchMock = mockFetch({ assets: [{ id: 'b1' }, { id: 'b2' }] });
    const urls = await listAudioUrls();
    expect(urls).toEqual(['/api/assets/b1/file', '/api/assets/b2/file']);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/assets?tipo=audio');
  });
});

describe('assetApi · assetUrl', () => {
  it('construye la URL pública del blob (D1: el motor la carga sin sesión)', () => {
    expect(assetUrl('abc')).toBe('/api/assets/abc/file');
  });
});

describe('assetApi · sprites de la cuenta (tab «Mis Sprites», Fase F)', () => {
  it('pide solo los de tipo sprite y devuelve los metadatos completos', async () => {
    const fetchMock = mockFetch({
      assets: [
        { id: 's1', nombre: 'guard_f0.png', tipo: 'sprite' },
        { id: 's2', nombre: 'wolf_f0.png', tipo: 'sprite' },
      ],
    });
    const assets = await listSpriteAssets();
    expect(assets).toHaveLength(2);
    expect(assets[0]!.nombre).toBe('guard_f0.png');
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/assets?tipo=sprite');
  });

  it('deleteSpriteAsset borra por id (DELETE /api/assets/:id)', async () => {
    const fn = vi.fn(async (_url: string, init: RequestInit) =>
      ({ ok: true, json: async () => ({ success: true, data: { deleted: true }, error: null }) }) as unknown as Response,
    );
    vi.stubGlobal('fetch', fn as unknown as typeof fetch);
    await deleteSpriteAsset('s1');
    expect(fn.mock.calls[0]![0]).toBe('/api/assets/s1');
    expect(fn.mock.calls[0]![1].method).toBe('DELETE');
  });
});
