/**
 * my-projects.test.ts — selector de proyectos (C5e): la pieza de datos que el
 * modal «Mis proyectos» consume — lista con nombre/fecha, abrir un proyecto
 * por id (árbol v3 completo → EditorState) y borrarlo. Todo contra fetch
 * simulado, sin DOM (la UI vive en ui/ProjectPicker.ts, sin tests como los
 * demás modales).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { deleteMyProject, listMyProjects, openMyProject } from '../src/io/MyProjects';

/** project.json mínimo que el Serializer acepta. */
const DATA = {
  meta: { name: 'Escenario', schemaVersion: 3, renderMode: '3d' },
  world: { vertices: [], sectors: [], walls: [] },
};

function mockFetchOnce(body: unknown, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok, json: async () => body } as unknown as Response)),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('listMyProjects (C5e)', () => {
  it('devuelve la lista del servidor con nombre y fecha', async () => {
    mockFetchOnce({
      success: true,
      data: {
        projects: [
          { id: 'p1', nombre: 'Aventura 1', updatedAt: '2026-09-17T10:00:00Z' },
          { id: 'p2', nombre: 'Aventura 2', updatedAt: '2026-09-18T12:30:00Z' },
        ],
      },
      error: null,
    });

    const projects = await listMyProjects();
    expect(projects).toHaveLength(2);
    expect(projects[1]).toMatchObject({ id: 'p2', nombre: 'Aventura 2' });
    const [url] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('/api/projects');
  });

  it('cuenta vacía → lista vacía', async () => {
    mockFetchOnce({ success: true, data: { projects: [] }, error: null });
    await expect(listMyProjects()).resolves.toEqual([]);
  });
});

describe('openMyProject (C5e)', () => {
  it('abre un proyecto distinto del último: GET :id → árbol v3 completo', async () => {
    mockFetchOnce({
      success: true,
      data: { project: { id: 'p2', data: DATA } },
      error: null,
    });

    const opened = await openMyProject('p2');
    expect(opened.projectId).toBe('p2');
    expect(opened.state.meta.name).toBe('Escenario');
    const [url] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('/api/projects/p2');
  });

  it('proyecto inexistente → propaga ApiError del server', async () => {
    mockFetchOnce({
      success: false,
      data: null,
      error: { code: 'PROJECT_NOT_FOUND', message: 'El proyecto no existe', details: { id: 'nope' } },
    });
    await expect(openMyProject('nope')).rejects.toMatchObject({ code: 'PROJECT_NOT_FOUND' });
  });
});

describe('deleteMyProject (C5e)', () => {
  it('borra por DELETE :id', async () => {
    mockFetchOnce({ success: true, data: { deleted: true }, error: null });
    await deleteMyProject('p2');
    const [url, init] = vi.mocked(fetch).mock.calls[0]!;
    expect(url).toBe('/api/projects/p2');
    expect(init!.method).toBe('DELETE');
  });
});