/**
 * RayCast Studio — Entry point.
 * Monta el layout, gestiona el EditorState, conecta persistencia
 * y herramientas de edición con el viewport 3D.
 */

import './style.css';
import { AppLayout } from './layout/AppLayout';
import { showToast } from './ui/Toast';
import { EditorViewport } from './viewport/EditorViewport';
import { EditorState } from './editor/EditorState';
import { ToolManager, type ToolId, type Selection } from './tools/ToolManager';
import { sampleProject } from './sample-project';
import { fromProjectJson, validateProjectJson } from './io/Serializer';
import { saveToLocal, loadFromLocal, exportJson, importJson, clearLocal } from './io/FileManager';

// ── Layout ─────────────────────────────────────────────────────
const app = document.getElementById('app');
if (!app) throw new Error('#app no encontrado');
const layout = new AppLayout();
layout.mount(app);

// Limpiar proyecto guardado anterior para arrancar limpio con el proyecto vacío.
// TODO: quitar esta línea cuando el editor tenga flujo "Nuevo proyecto" vs "Abrir".
clearLocal();

// ── Estado editable ────────────────────────────────────────────
let doc: EditorState;
const saved = loadFromLocal();
if (saved) {
  const raw = toRawProject(saved);
  const errors = validateProjectJson(raw);
  if (errors.length > 0) {
    console.warn('Proyecto guardado inválido, se descarta:', errors);
    clearLocal();
    doc = fromProjectJson(sampleProject as unknown as Record<string, unknown>);
  } else {
    doc = saved;
  }
} else {
  doc = fromProjectJson(sampleProject as unknown as Record<string, unknown>);
}

// ── Herramientas (ToolManager) ─────────────────────────────────
function showToolNotice(msg: string, type: 'info' | 'warning' | 'error' | 'success' = 'info'): void {
  showToast(msg, type);
}

function showSelection(sel: Selection): void {
  const label = sel ? `${sel.kind} ${sel.id}` : '—';
  layout.statusBar.setItem('sel', `Selección: ${label}`);
}

const toolManager = new ToolManager(doc, {
  onNotice: showToolNotice,
  onSelectionChange: showSelection,
  onToolChange: (tool) => layout.statusBar.setItem('tool', `Herramienta: ${tool}`),
});

// ── Viewport 3D ────────────────────────────────────────────────
const viewport = new EditorViewport();
viewport.toolManager = toolManager;
layout.viewport.appendChild(viewport.el);

viewport.init(toRawProject(doc) as never).catch((err) => {
  console.error('Error inicializando el viewport:', err);
  showToast(`Error al iniciar el motor: ${err}`, 'error');
});

// ── Toolbar: herramientas ──────────────────────────────────────
const toolGroup = layout.toolbar.addGroup();
const toolActions: { icon: string; label: string; key: string; id: ToolId }[] = [
  { icon: 'cursor',         label: 'Seleccionar',  key: '1', id: 'select' },
  { icon: 'box',            label: 'Vértices',     key: '2', id: 'vertex' },
  { icon: 'layers',         label: 'Paredes',       key: '4', id: 'wall' },
  { icon: 'ruler',          label: 'Alturas',       key: '5', id: 'height' },
  { icon: 'person-standing',label: 'Entidades',    key: '6', id: 'entity' },
];

let activeToolId: ToolId = 'select';

function setActiveTool(id: ToolId): void {
  activeToolId = id;
  toolManager.setTool(id);
  layout.statusBar.setItem('tool', `Herramienta: ${id}`);
  toolActions.forEach((action, i) => layout.toolbar.setActive(i, action.id === id));
}

toolActions.forEach((action) => {
  const btn = layout.toolbar.addAction({
    icon: action.icon,
    label: action.label,
    shortcut: action.key,
    active: action.id === activeToolId,
    onClick: () => setActiveTool(action.id),
  });
  toolGroup.appendChild(btn);
});

layout.toolbar.addSeparator();

// ── Toolbar: archivo ───────────────────────────────────────────
const fileGroup = layout.toolbar.addGroup();

fileGroup.appendChild(layout.toolbar.addAction({
  icon: 'save', label: 'Guardar', shortcut: 'Ctrl+S',
  onClick: () => { saveToLocal(doc); showToast('Proyecto guardado', 'success'); },
}));

fileGroup.appendChild(layout.toolbar.addAction({
  icon: 'download', label: 'Exportar JSON', shortcut: 'Ctrl+Shift+S',
  onClick: () => { exportJson(doc); showToast('Proyecto exportado', 'success'); },
}));

fileGroup.appendChild(layout.toolbar.addAction({
  icon: 'upload', label: 'Importar', shortcut: 'Ctrl+O',
  onClick: async () => {
    const result = await importJson();
    if (result.ok) {
      Object.assign(doc, result.state);
      viewport.reload(toRawProject(doc));
      saveToLocal(doc);
      showToast('Proyecto importado', 'success');
    } else {
      showToast(result.error, 'error');
    }
  },
}));

layout.toolbar.addSeparator();

// ── Toolbar: undo/redo (pendiente) ─────────────────────────────
const editGroup = layout.toolbar.addGroup();
editGroup.appendChild(layout.toolbar.addAction({
  icon: 'undo', label: 'Deshacer', shortcut: 'Ctrl+Z',
  onClick: () => showToast('Deshacer — pendiente F6', 'info'),
}));
editGroup.appendChild(layout.toolbar.addAction({
  icon: 'redo', label: 'Rehacer', shortcut: 'Ctrl+Shift+Z',
  onClick: () => showToast('Rehacer — pendiente F6', 'info'),
}));

layout.toolbar.addSpacer();
layout.toolbar.addLabel(doc.meta.name);
layout.toolbar.addSpacer();

// ── Toolbar: panel / playtest ──────────────────────────────────
const miscGroup = layout.toolbar.addGroup();
miscGroup.appendChild(layout.toolbar.addAction({
  icon: 'panel-right', label: 'Panel derecho',
  onClick: () => layout.togglePanelRight(),
}));
miscGroup.appendChild(layout.toolbar.addAction({
  icon: 'play', label: 'Playtest', shortcut: 'F5',
  onClick: () => showToast('Playtest — pendiente F6', 'info'),
}));

// ── Status bar ─────────────────────────────────────────────────
layout.statusBar.setItem('mode', 'Modo: Editor');
layout.statusBar.addSeparator();
layout.statusBar.setItem('coords', 'X: 0  Y: 0  Z: 0');
layout.statusBar.addSeparator();
layout.statusBar.setItem('sector', 'Sector: —');
layout.statusBar.addSeparator();
layout.statusBar.setItem('tool', `Herramienta: ${activeToolId}`);
layout.statusBar.addSeparator();
layout.statusBar.setItem('sel', 'Selección: —');

// ── Coordenadas + modo en tiempo real ──────────────────────────
viewport.onCoordsChange = (x, y, z) => {
  layout.statusBar.setItem('coords', `X: ${x.toFixed(1)}  Y: ${y.toFixed(1)}  Z: ${z.toFixed(1)}`);
};
viewport.onModeChange = (mode) => {
  layout.statusBar.setItem('mode', `Modo: ${mode === 'game' ? 'Juego' : 'Editor'}`);
  showToast(
    mode === 'game'
      ? 'Modo juego — WASD + ratón. Tab para volver.'
      : 'Modo editor — clic izq edita (y orbita en vacío), clic der orbita, medio pan, WASD+QE pan, rueda zoom. Doble clic para jugar.',
    'info', 2500,
  );
};

// ── Atajos globales ────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  const key = e.key.toUpperCase();

  // Teclas de herramienta (sin ctrl/meta) — números 1,2,4,5,6 (el 3 quedó
// libre: la antigua herramienta Sectores vive ahora en el submenú Nivel)
  const toolMap: Record<string, ToolId> = {
    '1': 'select', '2': 'vertex',
    '4': 'wall', '5': 'height', '6': 'entity',
  };
  if (toolMap[key] && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    setActiveTool(toolMap[key]);
    return;
  }

  // Ctrl+Shift+S → exportar
  if ((e.ctrlKey || e.metaKey) && key === 'S' && e.shiftKey) {
    e.preventDefault();
    exportJson(doc);
    showToast('Proyecto exportado', 'success');
    return;
  }
  // Ctrl+S → guardar
  if ((e.ctrlKey || e.metaKey) && key === 'S') {
    e.preventDefault();
    saveToLocal(doc);
    showToast('Proyecto guardado', 'success');
    return;
  }
  // Ctrl+O → importar
  if ((e.ctrlKey || e.metaKey) && key === 'O') {
    e.preventDefault();
    importJson().then((result) => {
      if (result.ok) {
        Object.assign(doc, result.state);
        viewport.reload(toRawProject(doc));
        saveToLocal(doc);
        showToast('Proyecto importado', 'success');
      } else {
        showToast(result.error, 'error');
      }
    });
    return;
  }

  // Delete → eliminar selección
  if (key === 'DELETE' || e.key === 'Backspace') {
    if (toolManager.onDelete()) {
      showToast('Eliminado', 'info');
    }
  }
});

// ── Edición en vivo: onChange → reload con debounce ─────────────
let reloadTimer: ReturnType<typeof setTimeout> | undefined;
doc.onChange(() => {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    const raw = toRawProject(doc);
    const errors = validateProjectJson(raw);
    if (errors.length > 0) {
      showToast(`Error de validación: ${errors[0]}`, 'warning');
      return;
    }
    viewport.reload(raw);
  }, 150);
});

// ── Helpers ────────────────────────────────────────────────────
function toRawProject(d: EditorState): Record<string, unknown> {
  return JSON.parse(JSON.stringify(d)) as Record<string, unknown>;
}