/**
 * level-editor.integration.test.ts — Test de humo de la integración del Level Editor
 *
 * Monta el LevelEditor completo (orquestador + layout + vista) en jsdom para
 * validar que conecta sin errores: documento, paneles, guardado/carga en
 * localStorage y el canvas no rompe al montarse. No valida el render de píxeles
 * (jsdom no implementa canvas 2D); esa parte se prueba en el navegador.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAppLayout } from '../src/layout/AppLayout.js';
import { createLevelEditor } from '../src/level-editor/LevelEditor.js';
import { toProjectJson, validate } from '../src/level-editor/LevelSerializer.js';

function createCtxStub() {
  const fn = vi.fn();
  return {
    arc: fn, beginPath: fn, clearRect: fn, closePath: fn, fill: fn,
    fillRect: fn, fillText: fn, lineTo: fn, moveTo: fn, setLineDash: fn,
    stroke: fn, strokeStyle: '', fillStyle: '', lineWidth: 1, font: '', textAlign: '',
  };
}

describe('LevelEditor — integración', () => {
  let getContextSpy: ReturnType<typeof vi.spyOn>;

  function mountEditor() {
    const layout = createAppLayout({ leftPanel: { title: 'Proyecto' }, rightPanel: { title: 'Inspector' } });
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.appendChild(layout.element);
    const editor = createLevelEditor({ layout });
    return { layout, editor };
  }

  beforeEach(() => {
    localStorage.clear();
    // Mock del contexto 2D (jsdom no implementa canvas)
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext' as any).mockReturnValue(createCtxStub() as any) as any;
  });

  it('monta el editor con la plantilla por defecto válida', () => {
    const { editor } = mountEditor();
    const doc = editor.getDocument();
    expect(doc.world.sectors.length).toBeGreaterThan(0);
    const result = validate(doc);
    expect(result.valid).toBe(true);
    // La vista (canvas) debe existir en el DOM del viewport
    const canvas = document.querySelector('.level-canvas');
    expect(canvas).not.toBeNull();
  });

  it('añade un sector y lo refleja en el documento', () => {
    const { editor } = mountEditor();
    const before = editor.getDocument().world.sectors.length;

    // Ejecutar la lógica de añadir sector vía la API del documento (el botón
    // usa esta misma operación internamente).
    const doc = editor.getDocument();
    const a = doc.addVertex(20, 20), b = doc.addVertex(22, 20);
    const c = doc.addVertex(22, 22), d = doc.addVertex(20, 22);
    const id = doc.addSector([a, b, c, d], { floorH: 0, ceilH: 3 });
    expect(doc.world.sectors.length).toBe(before + 1);
    expect(validate(doc).valid).toBe(true);
    expect(id).toContain('sector');
  });

  it('guarda y carga en localStorage (round-trip)', () => {
    const { editor } = mountEditor();
    const baseCount = editor.getDocument().world.sectors.length;

    // Añadir un sector extra y guardarlo
    const doc = editor.getDocument();
    const a = doc.addVertex(30, 30), b = doc.addVertex(32, 30);
    const c = doc.addVertex(32, 32), d = doc.addVertex(30, 32);
    doc.addSector([a, b, c, d], { floorH: 0, ceilH: 3 });
    const withExtra = doc.world.sectors.length;
    editor.save();
    expect(localStorage.getItem('raycast.level.current')).not.toBeNull();

    // Reset (vuelve a la plantilla: distinto de withExtra) y carga: el sector extra se recupera
    editor.newProject();
    expect(editor.getDocument().world.sectors.length).not.toBe(withExtra);
    editor.load();
    expect(editor.getDocument().world.sectors.length).toBe(withExtra);
  });

  it('serializa a project.json v3 válido que el motor acepta', () => {
    const { editor } = mountEditor();
    const project = toProjectJson(editor.getDocument());
    const result = validate(project);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
