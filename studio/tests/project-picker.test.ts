/**
 * project-picker.test.ts — regresión C5e: los botones de cada fila (Abrir /
 * Borrar) deben nacer HABILITADOS. El bug: `refresh()` pintaba la lista con
 * `busy = true`, así que `item()` los creaba con `disabled` y `setBusy(false)`
 * solo re-habilitaba «Nuevo proyecto» — Abrir/Borrar quedaban muertos y el
 * cursor salía "prohibido" (`.btn:disabled { cursor: not-allowed }`).
 *
 * Sin jsdom: stub mínimo de DOM (el picker solo usa createElement(NS),
 * appendChild/append, addEventListener, classList y remove).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('../src/io/MyProjects', () => ({
  listMyProjects: vi.fn(async () => [
    { id: 'p1', nombre: 'Torre del Alba', updatedAt: '2026-09-17T10:00:00.000Z' },
  ]),
  deleteMyProject: vi.fn(async () => undefined),
}));

import { ProjectPicker } from '../src/ui/ProjectPicker';

/** Elemento falso: árbol en memoria + listeners invocables con click(). */
class FakeEl {
  tag: string;
  children: FakeEl[] = [];
  listeners: Record<string, Array<(e: unknown) => void>> = {};
  className = '';
  title = '';
  disabled = false;
  style: Record<string, string> = {};
  classList = { toggle: () => {} };
  private _text = '';
  parent: FakeEl | null = null;

  constructor(tag: string) {
    this.tag = tag;
  }

  get textContent(): string { return this._text; }
  set textContent(v: string) { this._text = v; this.children = []; }

  appendChild(child: FakeEl): FakeEl { this.children.push(child); child.parent = this; return child; }
  append(...nodes: Array<FakeEl | string>): void {
    for (const n of nodes) if (typeof n !== 'string') this.appendChild(n);
  }
  setAttribute(): void {}
  removeEventListener(): void {}
  remove(): void {
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
    this.parent = null;
  }
  addEventListener(type: string, fn: (e: unknown) => void): void {
    (this.listeners[type] ??= []).push(fn);
  }
  click(): void {
    for (const fn of this.listeners['click'] ?? []) fn({ target: this });
  }
}

/** Todos los nodos del árbol que cumplen el predicado. */
function findAll(root: FakeEl, pred: (el: FakeEl) => boolean): FakeEl[] {
  const out: FakeEl[] = [];
  if (pred(root)) out.push(root);
  for (const c of root.children) out.push(...findAll(c, pred));
  return out;
}

let body: FakeEl;

afterEach(() => vi.unstubAllGlobals());

function stubDom(): void {
  body = new FakeEl('body');
  vi.stubGlobal('document', {
    createElement: (tag: string) => new FakeEl(tag),
    createElementNS: (_ns: string, tag: string) => new FakeEl(tag),
    body,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
}

describe('ProjectPicker (C5e · regresión)', () => {
  it('las filas nacen con Abrir/Borrar HABILITADOS', async () => {
    stubDom();
    const picker = new ProjectPicker();
    await picker.open({ onOpen: () => {}, onNew: () => {} });

    const abrir = findAll(body, (el) => el.title === 'Abrir');
    const borrar = findAll(body, (el) => el.title === 'Borrar');
    expect(abrir).toHaveLength(1);
    expect(borrar).toHaveLength(1);
    expect(abrir[0]!.disabled).toBe(false);
    expect(borrar[0]!.disabled).toBe(false);
  });

  it('clic en Abrir → onOpen con el id del proyecto y el modal se cierra', async () => {
    stubDom();
    const onOpen = vi.fn();
    const picker = new ProjectPicker();
    await picker.open({ onOpen, onNew: () => {} });

    findAll(body, (el) => el.title === 'Abrir')[0]!.click();
    expect(onOpen).toHaveBeenCalledWith('p1');
    // close() quita el overlay del body (ya no cuelga del DOM).
    expect(findAll(body, (el) => el.className === 'modal-overlay project-picker')).toHaveLength(0);
  });
});
