/**
 * RayCast Studio — Entry point.
 * Monta el layout, gestiona el EditorState, conecta persistencia
 * (guardar/cargar/exportar/importar) con el viewport 3D.
 */

import './style.css';
import { AppLayout } from './layout/AppLayout';
import { showToast } from './ui/Toast';
import { EditorViewport } from './viewport/EditorViewport';
import { EditorState } from './editor/EditorState';
import { sampleProject } from './sample-project';
import { fromProjectJson, validateProjectJson } from './io/Serializer';
import { saveToLocal, loadFromLocal, exportJson, importJson, clearLocal } from './io/FileManager';

// Montar layout
const app = document.getElementById('app');
if (!app) throw new Error('#app no encontrado');

const layout = new AppLayout();
layout.mount(app);

// ── Estado editable ─────────────────────────────
// Carga desde localStorage si existe y es válido; si no, proyecto de ejemplo.
let doc: EditorState;
const saved = loadFromLocal();
if (saved) {
  const raw = toRawProject(saved);
  const errors = validateProjectJson(raw);
  if (errors.length > 0) {
    // El proyecto guardado está corrupto o desactualizado: descartarlo.
    console.warn('Proyecto guardado inválido, se descarta:', errors);
    clearLocal();
    doc = fromProjectJson(sampleProject as unknown as Record<string, unknown>);
  } else {
    doc = saved;
  }
} else {
  doc = fromProjectJson(sampleProject as unknown as Record<string, unknown>);
}

// ── Viewport 3D ────────────────────────────────
const viewport = new EditorViewport();
layout.viewport.appendChild(viewport.el);

// Carga el mundo con el project que parte del documento editable.
viewport.init(toRawProject(doc) as never).catch((err) => {
  console.error('Error inicializando el viewport:', err);
  showToast(`Error al iniciar el motor: ${err}`, 'error');
});

// ── Toolbar: herramientas ──────────────────────
const toolGroup = layout.toolbar.addGroup();
const toolActions: { icon: string; label: string; key: string; id: string }[] = [
  { icon: 'cursor',       label: 'Seleccionar',  key: 'Q', id: 'select' },
  { icon: 'box',          label: 'Vértices',     key: 'V', id: 'vertex' },
  { icon: 'grid-3x3',     label: 'Sectores',     key: 'S', id: 'sector' },
  { icon: 'layers',       label: 'Paredes',       key: 'W', id: 'wall' },
  { icon: 'ruler',        label: 'Alturas',       key: 'H', id: 'height' },
  { icon: 'person-standing', label: 'Entidades',  key: 'E', id: 'entity' },
];

let activeToolId = 'select';

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

// ── Acciones de archivo (F3: persistencia real) ──
const fileGroup = layout.toolbar.addGroup();

fileGroup.appendChild(
  layout.toolbar.addAction({
    icon: 'save',
    label: 'Guardar',
    shortcut: 'Ctrl+S',
    onClick: () => {
      saveToLocal(doc);
      showToast('Proyecto guardado', 'success');
    },
  })
);

fileGroup.appendChild(
  layout.toolbar.addAction({
    icon: 'download',
    label: 'Exportar JSON',
    shortcut: 'Ctrl+Shift+S',
    onClick: () => {
      exportJson(doc);
      showToast('Proyecto exportado', 'success');
    },
  })
);

fileGroup.appendChild(
  layout.toolbar.addAction({
    icon: 'upload',
    label: 'Importar',
    shortcut: 'Ctrl+O',
    onClick: async () => {
      const result = await importJson();
      if (result.ok) {
        // Reemplazar documento y recargar el viewport
        Object.assign(doc, result.state);
        viewport.reload(toRawProject(doc));
        saveToLocal(doc);
        showToast('Proyecto importado', 'success');
      } else {
        showToast(result.error, 'error');
      }
    },
  })
);

layout.toolbar.addSeparator();

// ── Undo/Redo (stub: se conecta en F6) ─────────
const editGroup = layout.toolbar.addGroup();
editGroup.appendChild(
  layout.toolbar.addAction({
    icon: 'undo',
    label: 'Deshacer',
    shortcut: 'Ctrl+Z',
    onClick: () => showToast('Deshacer — pendiente F6', 'info'),
  })
);
editGroup.appendChild(
  layout.toolbar.addAction({
    icon: 'redo',
    label: 'Rehacer',
    shortcut: 'Ctrl+Shift+Z',
    onClick: () => showToast('Rehacer — pendiente F6', 'info'),
  })
);

layout.toolbar.addSpacer();
layout.toolbar.addLabel(doc.meta.name);
layout.toolbar.addSpacer();

// ── Panel + Playtest (stub: playtest en F6) ─────
const miscGroup = layout.toolbar.addGroup();
miscGroup.appendChild(
  layout.toolbar.addAction({
    icon: 'panel-right',
    label: 'Panel derecho',
    onClick: () => layout.togglePanelRight(),
  })
);
miscGroup.appendChild(
  layout.toolbar.addAction({
    icon: 'play',
    label: 'Playtest',
    shortcut: 'F5',
    onClick: () => showToast('Playtest — pendiente F6', 'info'),
  })
);

// ── Status bar ─────────────────────────────────
layout.statusBar.setItem('mode', 'Modo: Editor');
layout.statusBar.addSeparator();
layout.statusBar.setItem('coords', 'X: 0  Y: 0  Z: 0');
layout.statusBar.addSeparator();
layout.statusBar.setItem('sector', 'Sector: —');
layout.statusBar.addSeparator();
layout.statusBar.setItem('tool', `Herramienta: ${activeToolId}`);

// ── Atajos globales y herramienta activa ────────
function setActiveTool(id: string): void {
  activeToolId = id;
  layout.statusBar.setItem('tool', `Herramienta: ${id}`);
  toolActions.forEach((action, i) => {
    layout.toolbar.setActive(i, action.id === id);
  });
}

document.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  const key = e.key.toUpperCase();

  const toolMap: Record<string, string> = {
    Q: 'select', V: 'vertex', S: 'sector',
    W: 'wall', H: 'height', E: 'entity',
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
    (document.querySelector('[data-import]') as HTMLElement | null)?.click();
  }
});

// ── Coordenadas + modo en tiempo real ───────────
viewport.onCoordsChange = (x, y, z) => {
  layout.statusBar.setItem('coords', `X: ${x.toFixed(1)}  Y: ${y.toFixed(1)}  Z: ${z.toFixed(1)}`);
};

viewport.onModeChange = (mode) => {
  layout.statusBar.setItem('mode', `Modo: ${mode === 'game' ? 'Juego' : 'Editor'}`);
  showToast(
    mode === 'game'
      ? 'Modo juego — usuario + ratón. Tab para volver.'
      : 'Modo editor — orbitar con arrastre. Doble clic para jugar.',
    'info',
    2500,
  );
};

// ── Helpers ────────────────────────────────────
/** Convierte el documento editable a un project.json crudo (los datos que consume el motor). */
function toRawProject(d: EditorState): Record<string, unknown> {
  return JSON.parse(JSON.stringify(d)) as Record<string, unknown>;
}
