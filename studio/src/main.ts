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
import { DungeonBrowser } from './ui/DungeonBrowser';
import { DUNGEONS } from './dungeons/definitions';
import { assemble, mergeDungeon } from './dungeons/assemble';
import { findSpot } from './dungeons/placement';
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

function showSelection(sel: Selection[]): void {
  const label =
    sel.length === 0 ? '—' :
    sel.length === 1 ? `${sel[0]!.kind} ${sel[0]!.id}` :
    `${sel.length} objetos`;
  layout.statusBar.setItem('sel', `Selección: ${label}`);
}

const toolManager = new ToolManager(doc, {
  onNotice: showToolNotice,
  onSelectionChange: showSelection,
  onToolChange: (tool) => layout.statusBar.setItem('tool', `Herramienta: ${tool}`),
  onStatus: (text) => layout.statusBar.setItem('terrain', text),
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
  { icon: 'move',           label: 'Mover',        key: '3', id: 'move' },
  { icon: 'layers',         label: 'Paredes',       key: '4', id: 'wall' },
  { icon: 'ruler',          label: 'Alturas',       key: '5', id: 'height' },
  { icon: 'person-standing',label: 'Entidades',    key: '6', id: 'entity' },
  { icon: 'mountain',       label: 'Terreno',     key: '7', id: 'terrain' },
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
    onClick: () => {
      setActiveTool(action.id);
      // El selector de entidades cuelga del icono Entidades (debajo de él).
      if (action.id === 'entity') {
        const r = btn.getBoundingClientRect();
        toolManager.openEntityPicker(r.left, r.bottom);
      }
      // El selector de tamaño cuelga del icono Terreno.
      if (action.id === 'terrain') {
        const r = btn.getBoundingClientRect();
        toolManager.openTerrainSizePicker(r.left, r.bottom);
      }
    },
  });
  toolGroup.appendChild(btn);
});

// ── Toolbar: cielo (horizonte Daggerfall) ──────────────────────
const skyBtn = layout.toolbar.addAction({
  icon: 'cloud', label: 'Cielo', shortcut: '8',
  onClick: () => {
    const r = skyBtn.getBoundingClientRect();
    toolManager.openSkyPicker(r.left, r.bottom);
  },
});
toolGroup.appendChild(skyBtn);

// ── Toolbar: pantalla (resolución del playtest) ─────────────────
const screenBtn = layout.toolbar.addAction({
  icon: 'tv', label: 'Pantalla', shortcut: '9',
  onClick: () => {
    const r = screenBtn.getBoundingClientRect();
    toolManager.openScreenPicker(r.left, r.bottom);
  },
});
toolGroup.appendChild(screenBtn);

// ── Toolbar: mazmorras (junto a Entidades) ─────────────────────
const dungeonGroup = layout.toolbar.addGroup();
const dungeonBrowser = new DungeonBrowser();
dungeonGroup.appendChild(layout.toolbar.addAction({
  icon: 'map', label: 'Mazmorras',
  onClick: () => dungeonBrowser.open(DUNGEONS, (def) => {
    const dun = assemble(def);
    const spot = findSpot(doc, dun);
    if (!spot) {
      showToast('No hay espacio libre en la cuadrícula para la mazmorra', 'warning');
      return;
    }
    mergeDungeon(doc, dun, spot.x, spot.y);
    showToast(`${def.name} añadida en (${spot.x}, ${spot.y})`, 'success');
  }),
}));

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
  onClick: () => viewport.setMode(viewport.mode === 'game' ? 'orbit' : 'game'),
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
  layout.statusBar.setItem('terrain', 'Terreno: —');

// ── Coordenadas + modo en tiempo real ──────────────────────────
viewport.onCoordsChange = (x, y, z) => {
  layout.statusBar.setItem('coords', `X: ${x.toFixed(1)}  Y: ${y.toFixed(1)}  Z: ${z.toFixed(1)}`);
};
viewport.onModeChange = (mode) => {
  layout.statusBar.setItem('mode', `Modo: ${mode === 'game' ? 'Juego' : 'Editor'}`);
  showToast(
    mode === 'game'
      ? 'Modo juego — WASD + ratón. Tab para volver.'
      : 'Modo editor — clic izq edita (y orbita en vacío), clic der orbita, medio pan, WASD+QE pan, rueda zoom. Playtest (F5) para jugar.',
    'info', 2500,
  );
};

// ── Atajos globales ────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  const key = e.key.toUpperCase();

  // F5 → playtest (evita el recarga del navegador)
  if (key === 'F5' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    viewport.setMode(viewport.mode === 'game' ? 'orbit' : 'game');
    return;
  }

  // Teclas de herramienta (sin ctrl/meta) — números 1..7
  const toolMap: Record<string, ToolId> = {
    '1': 'select', '2': 'vertex', '3': 'move',
    '4': 'wall', '5': 'height', '6': 'entity',
    '7': 'terrain',
  };
  if (toolMap[key] && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    setActiveTool(toolMap[key]);
    return;
  }

  // Tecla 8: popover del cielo (no es herramienta de canvas)
  if (key === '8' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    toolManager.openSkyPicker();
    return;
  }

  // Tecla 9: popover de pantalla (resolución del playtest)
  if (key === '9' && !e.ctrlKey && !e.metaKey) {
    e.preventDefault();
    toolManager.openScreenPicker();
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

// ── Edición en vivo: onChange → reload con THROTTLE ─────────────
// (No debounce puro: el pincel muta el estado cada frame mientras se mantiene
// el clic; un trailing-debounce se re-programa sin descanso y el viewport no
// se entera hasta soltar. El throttle garantiza ~1 reload cada RELOAD_MS.)
const RELOAD_MS = 120;
let reloadPending = false;
function scheduleReload(): void {
  if (reloadPending) return;
  reloadPending = true;
  setTimeout(() => {
    reloadPending = false;
    const raw = toRawProject(doc);
    const errors = validateProjectJson(raw);
    if (errors.length > 0) {
      showToast(`Error de validación: ${errors[0]}`, 'warning');
      return;
    }
    viewport.reload(raw);
  }, RELOAD_MS);
}
doc.onChange(scheduleReload);

// ── Helpers ────────────────────────────────────────────────────
function toRawProject(d: EditorState): Record<string, unknown> {
  return JSON.parse(JSON.stringify(d)) as Record<string, unknown>;
}