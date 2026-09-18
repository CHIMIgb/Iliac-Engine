/**
 * viewport-reload.test.ts — regresión 2026-09-17, bug «al iniciar sesión todas
 * las herramientas dejan de funcionar».
 *
 * El reload caro (cambio REAL de `render`) creaba un `Engine3D` nuevo con el
 * viejo AÚN vivo. `canvas.getContext()` devuelve el MISMO contexto, así que dos
 * WebGLRenderer de Three.js lo compartían: estado GL corrupto, el frame lanza y
 * el try/catch de `_frame` se lo traga — y con él se salta `tm.update()` y
 * `overlay.draw()` (van después de `render()`), o sea TODAS las herramientas.
 *
 * Estos tests fijan la invariante: un solo motor vivo por canvas (el viejo se
 * libera antes de crear el nuevo) y el camino barato cuando el `render` no
 * cambia de valor (aunque las claves vengan reordenadas por Postgres JSONB).
 *
 * Sin jsdom: stub mínimo de DOM y motor falso inyectado por el constructor.
 */
import { describe, it, expect, vi } from 'vitest';
import { EditorViewport } from '../src/viewport/EditorViewport';

class FakeEl {
  tag: string;
  children: FakeEl[] = [];
  listeners: Record<string, Array<(e: unknown) => void>> = {};
  className = '';
  title = '';
  tabIndex = 0;
  width = 800;
  height = 600;
  clientWidth = 800;
  clientHeight = 600;
  style: Record<string, string> = {};
  classList = { toggle: () => {}, add: () => {}, remove: () => {} };
  parent: FakeEl | null = null;

  constructor(tag: string) {
    this.tag = tag;
  }

  getContext(): unknown { return { clearRect: () => {} }; }
  appendChild(child: FakeEl): FakeEl { this.children.push(child); child.parent = this; return child; }
  append(...nodes: FakeEl[]): void { for (const n of nodes) this.appendChild(n); }
  addEventListener(type: string, fn: (e: unknown) => void): void { (this.listeners[type] ??= []).push(fn); }
  removeEventListener(): void {}
  remove(): void {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  getBoundingClientRect(): DOMRect {
    return { left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 } as DOMRect;
  }
}

/** Canvas 2D/WebGL falso + listeners: solo lo que toca el viewport al arrancar. */
const g = globalThis as unknown as Record<string, unknown>;
g.document = {
  createElement: (tag: string) => new FakeEl(tag),
  addEventListener: () => {},
  removeEventListener: () => {},
};
g.window = { addEventListener: () => {}, removeEventListener: () => {}, devicePixelRatio: 1 };

/** Motor falso: registra el ciclo de vida en `log` para comprobar el orden. */
function setup(opts: { loadFails?: boolean } = {}) {
  const log: string[] = [];
  let next = 0;
  const viewport = new EditorViewport((project) => {
    const id = ++next;
    log.push(`create${id}`);
    return {
      project,
      loaded: true,
      renderer: { scene: { getObjectByName: () => null, add: () => {} } },
      async load() {
        log.push(`load${id}`);
        if (opts.loadFails) throw new Error('GL roto');
      },
      setWorld() { log.push(`setWorld${id}`); return true; },
      dispose() { log.push(`dispose${id}`); },
    } as never;
  });
  return { viewport, log, creates: () => next };
}

describe('EditorViewport.reload', () => {
  it('en el reload caro libera el motor viejo ANTES de crear el nuevo', async () => {
    const { viewport, log } = setup();

    await viewport.reload({ render: { fov: 80 }, world: {} }); // primer motor
    await viewport.reload({ render: { fov: 90 }, world: {} }); // render cambió → caro

    expect(log).toEqual(['create1', 'load1', 'dispose1', 'create2', 'load2']);
  });

  it('mismo render con claves reordenadas ⇒ camino barato (no recrea el motor)', async () => {
    const { viewport, log, creates } = setup();

    await viewport.reload({ render: { fov: 80, far: 500 }, world: {} });
    await viewport.reload({ render: { far: 500, fov: 80 }, world: {} });

    expect(creates()).toBe(1);
    expect(log).toEqual(['create1', 'load1', 'setWorld1']);
  });

  it('si el motor nuevo no carga, avisa y no deja un motor a medias', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { viewport, log } = setup({ loadFails: true });
    const errors: string[] = [];
    viewport.onError = (msg) => errors.push(msg);

    await viewport.reload({ render: { fov: 80 }, world: {} });

    expect(errors).toEqual(['GL roto']);
    expect(log).toEqual(['create1', 'load1']);
    expect((viewport as unknown as { engine: unknown }).engine).toBeNull();
  });
});
