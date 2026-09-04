/**
 * LevelEditor.ts — Orquestador del Level Editor
 *
 * Conecta el documento (LevelDocument), la vista 2D (LevelCanvas) y la UI (paneles
 * del AppLayout). Gestiona la selección, el inspector, la lista de sectores, el
 * guardado en localStorage y la serialización a project.json v3.
 *
 * NO implementa lógica de render ni de física: delega en el motor (engine/core) y
 * en el modelo de documento. El Studio es un consumidor del motor.
 */

import './level-editor.css';
import type { LevelDocument } from './LevelDocument.js';
import { LevelCanvas, type PickedObject } from './LevelCanvas.js';
import { toProjectJson, fromProjectJson, validate } from './LevelSerializer.js';
import { createDefaultProject } from './defaultProject.js';
import type { AppLayoutInstance } from '../layout/AppLayout.js';
import { showToast } from '../ui/Toast.js';
import { iconHTML } from '../ui/Icon.js';
import { escapeHTML } from '../ui/utils.js';

const STORAGE_KEY = 'raycast.level.current';

export interface LevelEditorOptions {
  layout: AppLayoutInstance;
}

export interface LevelEditorInstance {
  element: HTMLElement;
  getDocument: () => LevelDocument;
  setDocument: (doc: LevelDocument) => void;
  save: () => void;
  load: () => void;
  newProject: () => void;
  exportJson: () => void;
  destroy: () => void;
}

export function createLevelEditor(options: LevelEditorOptions): LevelEditorInstance {
  const { layout } = options;
  const root = document.createElement('div');
  root.className = 'level-editor';
  root.innerHTML = `
    <div class="level-editor__toolbar">
      ${toolbarBtn('square-plus', 'Nuevo sector', 'new-sector')}
      ${toolbarBtn('image-plus', 'Añadir sprite', 'add-sprite')}
      ${toolbarBtn('trash-2', 'Borrar selección', 'delete-selection')}
      <span style="flex:1"></span>
      <span class="level-editor__hint">Scroll: zoom · Arrastrar: pan · Clic: seleccionar</span>
    </div>
    <div class="level-editor__canvas-host"></div>
    <div class="level-editor__overlay"></div>
  `;

  const canvasHost = root.querySelector('.level-editor__canvas-host') as HTMLElement;
  const overlayEl = root.querySelector('.level-editor__overlay') as HTMLElement;

  // --- Cargar documento inicial (guardado o plantilla) ---
  let doc = loadStored() ?? fromProjectJson(createDefaultProject() as any);

  // --- Vista ---
  const canvas = new LevelCanvas(canvasHost, doc, {
    snap: 1,
    onSelect: (picked) => onSelect(picked),
    onCursorWorld: (x, y, sector) => onCursor(x, y, sector),
  });

  // --- Paneles ---
  const sectorsPanel = document.createElement('div');
  sectorsPanel.className = 'level-editor__sectors';
  const inspectorPanel = document.createElement('div');
  inspectorPanel.className = 'level-editor__inspector';
  inspectorPanel.innerHTML = emptyInspector();
  layout.setLeftPanelContent(sectorsPanel);
  layout.setRightPanelContent(inspectorPanel);

  layout.setViewportContent(root);
  refreshLeftPanel();
  refreshStatus();

  // --- Toolbar del editor ---
  root.querySelector('[data-action="new-sector"]')?.addEventListener('click', () => {
    addSector();
  });
  root.querySelector('[data-action="add-sprite"]')?.addEventListener('click', () => {
    addSprite();
  });
  root.querySelector('[data-action="delete-selection"]')?.addEventListener('click', () => {
    deleteSelection();
  });

  // Solo para ver el editor, sin anidar panels dentro del viewport.
  // Los paneles izquierdo/derecho ya se montaron en el layout.

  // --- Interacción panel de sectores ---
  sectorsPanel.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-sector-select]');
    if (btn) {
      const id = btn.dataset.sectorSelect!;
      canvas.forceSelection({ kind: 'sector', id });
      refreshInspector();
      return;
    }
    const addBtn = (e.target as HTMLElement).closest<HTMLElement>('#add-sector-btn');
    if (addBtn) {
      addSector();
    }
  });
  sectorsPanel.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    const dir = input.dataset.dir;
    const sid = input.dataset.sid;
    if (!dir || !sid || !input.value) return;
    const val = parseFloat(input.value);
    if (Number.isNaN(val)) return;
    if (dir === 'floor') doc.setFloorHeight(sid, val);
    else if (dir === 'ceil') doc.setCeilHeight(sid, val);
    canvas.redraw();
  });

  // --- Inspector editable ---
  inspectorPanel.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement;
    const kind = input.dataset.kind;
    const field = input.dataset.field;
    const id = input.dataset.id;
    if (!kind || !field || !id) return;
    const val = parseFloat(input.value);
    if (Number.isNaN(val)) return;
    applyInspectorField(kind, id, field, val);
    canvas.redraw();
    refreshLeftPanel();
  });

  function refreshLeftPanel() {
    // Actualiza el innerHTML del contenedor estable (mantiene sus listeners de eventos),
    // en vez de re-montarlo en el layout en cada cambio.
    sectorsPanel.innerHTML = renderSectorsList(doc);
  }

  function onSelect(picked: PickedObject | null) {
    if (picked) {
      refreshInspectorFor(picked);
    } else {
      inspectorPanel.innerHTML = emptyInspector();
    }
  }

  function refreshInspector() {
    const sel = canvas.selected;
    if (sel) refreshInspectorFor(sel);
  }

  function refreshInspectorFor(picked: PickedObject) {
    if (picked.kind === 'sector') inspectorPanel.innerHTML = renderSectorInspector(picked.id);
    else if (picked.kind === 'vertex') inspectorPanel.innerHTML = renderVertexInspector(picked.id);
    else if (picked.kind === 'sprite') inspectorPanel.innerHTML = renderSpriteInspector(picked.id);
    else inspectorPanel.innerHTML = renderWallInspector(picked.id);
  }

  function refreshStatus() {
    layout.updateStatus(
      [{ icon: 'map', text: `Sectores: ${doc.world.sectors.length}` }, { text: `Vértices: ${doc.world.vertices.length}` }, { text: `Sprites: ${doc.world.sprites.length}` }],
      [{ icon: 'check', text: `Schema v${doc.meta.schemaVersion}` }]
    );
  }

  function onCursor(x: number, y: number, sectorId: string | null) {
    overlayEl.textContent = `x:${round(x)}  y:${round(y)}  ${sectorId ? `· ${sectorId}` : ''}`;
  }

  /** Añade un sector cuadrado de 2x2 en una posición libre. */
  function addSector() {
    // Busca una posición libre a lo largo del eje x (braille de 0..N)
    let x = 0;
    let placed = false;
    for (let testX = 0; testX < 200 && !placed; testX += 2) {
      const occupied = doc.world.vertices.some((v) => Math.abs(v.x - testX) < 1 && Math.abs(v.y - 0) < 1);
      if (!occupied) {
        x = testX;
        placed = true;
      }
    }
    const size = 2;
    const a = doc.addVertex(x, 0);
    const b = doc.addVertex(x + size, 0);
    const c = doc.addVertex(x + size, size);
    const d = doc.addVertex(x, size);
    const id = doc.addSector([a, b, c, d], { floorH: 0, ceilH: 3 });
    // Cierra el borde con paredes sólidas
    doc.addWall(a, b, id);
    doc.addWall(b, c, id);
    doc.addWall(c, d, id);
    doc.addWall(d, a, id);
    canvas.redraw();
    refreshLeftPanel();
    refreshStatus();
    showToast({ message: `Sector ${id} añadido`, variant: 'success' });
  }

  function applyInspectorField(kind: string, id: string, field: string, val: number) {
    if (kind === 'sector') {
      if (field === 'floorH') doc.setFloorHeight(id, val);
      if (field === 'ceilH') doc.setCeilHeight(id, val);
    } else if (kind === 'sprite') {
      const sp = doc.world.sprites.find((s) => s.id === id);
      if (sp) {
        if (field === 'pos.x') sp.pos.x = val;
        if (field === 'pos.y') sp.pos.y = val;
        if (field === 'pos.z') sp.pos.z = val;
        if (field === 'scale') sp.scale = val;
      }
    }
  }

  function deleteSelection() {
    const sel = canvas.selected;
    if (!sel) {
      showToast({ message: 'Nada seleccionado para borrar', variant: 'info' });
      return;
    }
    if (sel.kind === 'sector') {
      doc.removeSector(sel.id);
    } else if (sel.kind === 'sprite') {
      doc.removeSprite(sel.id);
    } else if (sel.kind === 'wall') {
      doc.removeWall(sel.id);
    } else {
      // Vértice: solo se borra si no está en uso
      const inUse = doc.world.sectors.some((s) => s.vertexIds.includes(sel.id)) ||
                    doc.world.walls.some((w) => w.a === sel.id || w.b === sel.id);
      if (inUse) {
        showToast({ message: 'Vértice en uso; no se puede borrar', variant: 'warning' });
        return;
      }
      doc.removeVertex(sel.id);
      showToast({ message: 'Vértice borrado', variant: 'success' });
    }
    canvas.redraw();
    refreshLeftPanel();
    refreshStatus();
    showToast({ message: 'Elemento borrado', variant: 'success' });
  }

  function addSprite() {
    // Punto por defecto: centro aproximado del mundo o 0,0
    let x = 5;
    let y = 5;
    const id = doc.addSprite('lamp', x, y, 1.5, 0.8);
    canvas.forceSelection({ kind: 'sprite', id });
    canvas.redraw();
    refreshLeftPanel();
    refreshStatus();
    showToast({ message: 'Sprite añadido (mueve su vértice en el inspector)', variant: 'success' });
  }

  // --- Persistencia ---
  function save() {
    const v = validate(doc);
    if (!v.valid) {
      showToast({ message: `No se guarda: ${v.errors[0]}`, variant: 'error' });
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toProjectJson(doc)));
      showToast({ message: 'Proyecto guardado (Ctrl+S)', variant: 'success' });
    } catch {
      showToast({ message: 'No se pudo guardar en localStorage', variant: 'error' });
    }
  }

  function exportJson() {
    const v = validate(doc);
    if (!v.valid) {
      showToast({ message: `No se exporta: ${v.errors[0]}`, variant: 'error' });
      return;
    }
    const content = JSON.stringify(toProjectJson(doc), null, 2);
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${doc.meta.name.replace(/\s+/g, '_').toLowerCase() || 'proyecto'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast({ message: 'Proyecto exportado', variant: 'success' });
  }

  function load() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      showToast({ message: 'No hay proyecto guardado', variant: 'info' });
      return;
    }
    try {
      doc = fromProjectJson(JSON.parse(stored));
      canvas.setDocument(doc);
      refreshLeftPanel();
      refreshStatus();
      showToast({ message: 'Proyecto cargado', variant: 'success' });
    } catch {
      showToast({ message: 'Proyecto guardado corrupto', variant: 'error' });
    }
  }

  function newProject() {
    doc = fromProjectJson(createDefaultProject() as any);
    canvas.setDocument(doc);
    canvas.redraw();
    refreshLeftPanel();
    refreshStatus();
    showToast({ message: 'Nuevo proyecto (plantilla)', variant: 'success' });
  }

  return {
    element: root,
    getDocument: () => doc,
    setDocument: (d) => { doc = d; canvas.setDocument(d); refreshLeftPanel(); refreshStatus(); },
    save,
    load,
    newProject,
    exportJson,
    destroy: () => { canvas.dispose(); root.remove(); },
  };
}

function loadStored(): LevelDocument | null {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return fromProjectJson(JSON.parse(stored));
  } catch {
    return null;
  }
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// --- Helpers de HTML ---
function toolbarBtn(icon: string, label: string, action: string): string {
  return `<button type="button" class="btn btn--ghost btn--sm" data-action="${action}" aria-label="${escapeHTML(label)}" title="${escapeHTML(label)}">${iconHTML(icon, 16)}<span>${escapeHTML(label)}</span></button>`;
}

function renderSectorsList(doc: LevelDocument): string {
  const rows = doc.world.sectors.map((s) => `
    <div class="level-editor__sector-row" data-sector-select="${escapeHTML(s.id)}">
      <div class="level-editor__sector-head">
        <span class="level-editor__sector-name">${escapeHTML(s.id)}</span>
        <span class="level-editor__sector-verts">${s.vertexIds.length} vértices</span>
      </div>
      <div class="level-editor__sector-fields">
        <label>Piso <input type="number" step="0.1" value="${s.floorH}" data-dir="floor" data-sid="${escapeHTML(s.id)}"/></label>
        <label>Techo <input type="number" step="0.1" value="${s.ceilH}" data-dir="ceil" data-sid="${escapeHTML(s.id)}"/></label>
      </div>
    </div>
  `).join('');

  return `
    <div class="level-editor__panel-label">Sectores</div>
    <button type="button" class="btn btn--primary btn--sm level-editor__add-sector-btn" id="add-sector-btn">${iconHTML('plus', 14)} Añadir sector</button>
    <div class="level-editor__sector-list">${rows || '<p class="level-editor__empty">Sin sectores</p>'}</div>
  `;
}

function renderSectorInspector(id: string): string {
  // El cuerpo lo rellena el listener de input; aquí solo el encabezado descriptivo.
  return `
    <div class="level-editor__panel-label">Sector ${escapeHTML(id)}</div>
    <p class="level-editor__hint-inspector">Ajusta piso/techo en el panel de sectores (izquierda). Mueve vértices arrastrando en el canvas.</p>
  `;
}

function renderVertexInspector(id: string): string {
  return `
    <div class="level-editor__panel-label">Vértice ${escapeHTML(id)}</div>
    <p class="level-editor__hint-inspector">Arrastra el vértice en el canvas para moverlo (con snapping a 1 unidad).</p>
  `;
}

function renderSpriteInspector(id: string): string {
  return `
    <div class="level-editor__panel-label">Sprite ${escapeHTML(id)}</div>
    <p class="level-editor__hint-inspector">Edita posición/escala en el canvas o arrastra el marcador.</p>
  `;
}

function renderWallInspector(id: string): string {
  return `
    <div class="level-editor__panel-label">Pared ${escapeHTML(id)}</div>
    <p class="level-editor__hint-inspector">Posición del portal/separación entre sectores.</p>
  `;
}

function emptyInspector(): string {
  return `
    <div class="level-editor__panel-label">Inspector</div>
    <p class="level-editor__empty">Selecciona un elemento en el canvas (sector, vértice, pared o sprite).</p>
  `;
}
