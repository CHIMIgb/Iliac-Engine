/**
 * cloud-project.test.ts — persistencia en la nube (C5b): crea/guarda/carga
 * contra la API real (fetch simulado) y valida el árbol v3 antes de enviar,
 * sin duplicar lógica (reutiliza validateProjectJson del Serializer).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createCloudProject, loadCloudMostRecent, saveCloudProject } from '../src/io/CloudProject';
import { fromProjectJson } from '../src/io/Serializer';
import type { EditorState } from '../src/editor/EditorState';
import { ApiError } from '../src/io/api';

/** Estado editable mínimo que pasa la validación v3. */
function emptyState(): EditorState {
  return fromProjectJson({
    meta: { name: 'Prueba C5b', schemaVersion: 3, renderMode: '3d' },
    world: { vertices: [], sectors: [], walls: [] },
  });
}

function mockFetchOnce(body: unknown, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, json: async () => body } as unknown as Response)),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('CloudProject (C5b)', () => {
  it('saveCloudProject PATCHea data + nombre (data reemplaza el árbol completo)', async () => {
    mockFetchOnce({ success: true, data: { project: {} }, error: null });
    const fetchMock = vi.mocked(fetch);
    await saveCloudProject(emptyState(), 'proj-1');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/projects/proj-1');
    expect(init!.method).toBe('PATCH');
    const body = JSON.parse(init!.body as string) as { nombre: string; data: { meta: { name: string } } };
    expect(body.nombre).toBe('Prueba C5b');
    expect(body.data.meta.name).toBe('Prueba C5b'); // sincronizado nombre ↔ meta
  });

  it('createCloudProject hace POST y devuelve el id del proyecto', async () => {
    mockFetchOnce({ success: true, data: { project: { id: 'proj-9' } }, error: null });
    const id = await createCloudProject(emptyState());
    expect(id).toBe('proj-9');
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(init!.method).toBe('POST');
  });

  it('loadCloudMostRecent abre el más reciente (devuelve su id + estado editable)', async () => {
    const calls = [
      { success: true, data: { projects: [{ id: 'proj-2' }, { id: 'proj-1' }] }, error: null },
      {
        success: true,
        data: { project: { id: 'proj-2', data: { meta: { name: 'Reciente', schemaVersion: 3, renderMode: '3d' }, world: { vertices: [], sectors: [], walls: [] } } } },
        error: null,
      },
    ];
    let i = 0;
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => calls[i++]! } as unknown as Response)));

    const recent = await loadCloudMostRecent();
    expect(recent!.projectId).toBe('proj-2');
    expect(recent!.state.meta.name).toBe('Reciente');
  });

  it('loadCloudMostRecent → null si la cuenta no tiene proyectos', async () => {
    mockFetchOnce({ success: true, data: { projects: [] }, error: null });
    await expect(loadCloudMostRecent()).resolves.toBeNull();
  });

  it('data inválida → error local SIN llamar a la API (propaga excepción)', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const bad = fromProjectJson({
      meta: { name: 'Roto', schemaVersion: 3, renderMode: '3d' },
      // world.sectors[0] sin vertexIds → invalida
      world: { vertices: [], sectors: [{ id: 's1' }], walls: [] },
    } as unknown as Record<string, unknown>);

    await expect(saveCloudProject(bad, 'proj-1')).rejects.toThrow('project.json inválido');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('401 → propaga ApiError UNAUTHORIZED (para el toast/logout del main)', async () => {
    mockFetchOnce({
      success: false, data: null,
      error: { code: 'UNAUTHORIZED', message: 'Token inválido o expirado', details: null },
    });
    const err = await saveCloudProject(emptyState(), 'proj-1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: 'UNAUTHORIZED' });
  });
});