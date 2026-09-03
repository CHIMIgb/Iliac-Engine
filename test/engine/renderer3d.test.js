import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Renderer3D } from '../../engine/three/Renderer3D.js';

function fakeRenderer() {
  return {
    setSize(w, h) { this.width = w; this.height = h; },
    render() { this.rendered = true; },
    dispose() { this.disposed = true; },
  };
}

class FakeCanvas {
  constructor() {
    this.width = 640;
    this.height = 480;
    this.listeners = {};
    this.renderers = 0;
  }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  dispatch(type, event) {
    const e = { preventDefault() {}, ...(event || {}) };
    this.listeners[type] && this.listeners[type](e);
  }
}

test('Renderer3D recrea el renderer al restaurarse el contexto WebGL', () => {
  const canvas = new FakeCanvas();
  const fake = { renderers: [] };
  const r = new Renderer3D(canvas, {
    createRenderer(c) {
      const r = fakeRenderer();
      fake.renderers.push(r);
      return r;
    },
  });
  assert.equal(fake.renderers.length, 1, 'un renderer al construir');

  // Contexto perdido: se marca y no se renderiza.
  canvas.dispatch('webglcontextlost');
  assert.equal(r.contextLost, true);
  r.render();
  assert.equal(fake.renderers[0].rendered, undefined, 'no renderiza con contexto perdido');

  // Contexto restaurado: recrea el renderer y vuelve a renderizar.
  canvas.dispatch('webglcontextrestored');
  assert.equal(r.contextLost, false);
  assert.equal(fake.renderers.length, 2, 'recrea el renderer al restaurar');
  r.render();
  assert.equal(fake.renderers[1].rendered, true, 'renderiza con el renderer nuevo');
});

test('Renderer3D no lanza al perderse el contexto (evento con preventDefault)', () => {
  const canvas = new FakeCanvas();
  let prevented = false;
  const r = new Renderer3D(canvas, { createRenderer: () => fakeRenderer() });
  canvas.dispatch('webglcontextlost', {
    preventDefault() { prevented = true; },
  });
  assert.equal(prevented, true, 'llama a preventDefault para permitir restauración');
  assert.equal(r.contextLost, true);
});
