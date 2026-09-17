/**
 * start-project.test.ts — arranque del Studio (C5d): el documento de partida
 * sale de una plantilla de la API con sesión; sin sesión el editor arranca
 * vacío y sin peticiones (nunca un mundo hardcodeado en el código).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { isEmptyDoc, loadStartProject } from '../src/io/StartProject';
import { setSession, type AuthSession } from '../src/io/session';
import { fromProjectJson } from '../src/io/Serializer';

/** project.json mínimo que el Serializer acepta. */
const DATA = {
  meta: { name: 'Escenario', schemaVersion: 3, renderMode: '3d' },
  world: { vertices: [], sectors: [], walls: [] },
};

const SESSION: AuthSession = {
  user: { id: 'u1', login: 'chimi', nombre: 'A', apellido: 'G', emailPublico: null, rol: 'creador' },
  accessToken: 'tok-1',
  refreshToken: 'r',
  refreshTokenId: 's',
};

/** Simula la cookie de sesión (mismo patrón que api.test.ts). */
function withSession(): void {
  let jar = '';
  vi.stubGlobal('document', {
    get cookie() { return jar; },
    set cookie(v: string) { jar = v; },
  });
  setSession(SESSION);
}

/** Encadena respuestas del contrato para las llamadas sucesivas a fetch. */
function stubFetch(responses: unknown[]): ReturnType<typeof vi.fn> {
  let i = 0;
  const mock = vi.fn(async () => ({ ok: true, json: async () => responses[i++] } as unknown as Response));
  vi.stubGlobal('fetch', mock);
  return mock as unknown as ReturnType<typeof vi.fn>;
}

afterEach(() => vi.unstubAllGlobals());

describe('loadStartProject (C5d)', () => {
  it('sin sesión arranca vacío y no llama a la API', async () => {
    const fetchMock = stubFetch([]);

    const start = await loadStartProject();
    expect(start.projectId).toBeNull();
    expect(isEmptyDoc(start.state)).toBe(true);
    expect(start.state.world.sectors).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('con sesión abre el último proyecto de la cuenta', async () => {
    withSession();
    const fetchMock = stubFetch([
      { success: true, data: { projects: [{ id: 'p2' }, { id: 'p1' }] }, error: null },
      { success: true, data: { project: { id: 'p2', data: DATA } }, error: null },
    ]);

    const start = await loadStartProject();
    expect(start.projectId).toBe('p2');
    expect(start.state.meta.name).toBe('Escenario');
    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(['/api/projects', '/api/projects/p2']);
  });

  it('con sesión y cuenta vacía crea desde la plantilla (sin subir data)', async () => {
    withSession();
    const fetchMock = stubFetch([
      { success: true, data: { projects: [] }, error: null },
      { success: true, data: { templates: [{ id: 'tpl-demo', nombre: 'Demo', descripcion: '' }] }, error: null },
      { success: true, data: { project: { id: 'p9', data: DATA } }, error: null },
    ]);

    const start = await loadStartProject();
    expect(start.projectId).toBe('p9');

    const [url, init] = fetchMock.mock.calls[2]! as [string, RequestInit];
    expect(url).toBe('/api/projects');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ plantillaId: 'tpl-demo' });
  });

  it('prefiere tpl-studio sobre la del sistema cuando está visible', async () => {
    withSession();
    const fetchMock = stubFetch([
      { success: true, data: { projects: [] }, error: null },
      {
        success: true,
        data: {
          templates: [
            { id: 'tpl-demo', nombre: 'Demo', descripcion: '' },
            { id: 'tpl-studio', nombre: 'Escenario', descripcion: '' },
          ],
        },
        error: null,
      },
      { success: true, data: { project: { id: 'p9', data: DATA } }, error: null },
    ]);

    await loadStartProject();
    const body = JSON.parse((fetchMock.mock.calls[2]![1] as RequestInit).body as string);
    expect(body.plantillaId).toBe('tpl-studio');
  });

  it('con sesión y backend caído lanza (D-C: el Studio no arranca con un mundo inventado)', async () => {
    withSession();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    const err = await loadStartProject().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as { code?: string }).code).toBe('NETWORK_ERROR');
  });

  it('con sesión y sin plantillas en el servidor lanza un error claro', async () => {
    withSession();
    stubFetch([
      { success: true, data: { projects: [] }, error: null },
      { success: true, data: { templates: [] }, error: null },
    ]);
    await expect(loadStartProject()).rejects.toThrow('no hay ninguna plantilla');
  });
});

describe('isEmptyDoc (C5d)', () => {
  it('distingue el documento vacío de uno con sectores', () => {
    expect(isEmptyDoc(fromProjectJson({ world: { vertices: [], sectors: [], walls: [] } }))).toBe(true);
    expect(
      isEmptyDoc(
        fromProjectJson({
          world: { vertices: [{ id: 0, x: 0, y: 0 }], sectors: [{ id: 0, vertexIds: [0] }], walls: [] },
        }),
      ),
    ).toBe(false);
  });
});
