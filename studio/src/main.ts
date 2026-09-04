/**
 * main.ts — Entry point del Studio
 * Bootstrap: monta AppLayout, inicializa toast container, registra atajos globales
 * y arranca el Level Editor en el viewport.
 */

import './style.css';
import './components.css';
import { createAppLayout } from './layout/AppLayout.js';
import { createLevelEditor, type LevelEditorInstance } from './level-editor/LevelEditor.js';
import { showToast } from './ui/Toast.js';
import { iconHTML } from './ui/Icon.js';

// Manejo de errores global
window.addEventListener('error', (e) => {
  console.error('Global error:', e.error);
  showToast({
    message: `Error: ${e.message}`,
    variant: 'error',
    duration: 0,
  });
});

window.addEventListener('unhandledrejection', (e) => {
  console.error('Unhandled rejection:', e.reason);
  showToast({
    message: `Error: ${e.reason?.message || e.reason}`,
    variant: 'error',
    duration: 0,
  });
});

// Función global para cerrar modal superior (usada por Escape)
(window as any).closeTopModal = () => {
  import('./ui/Modal.js').then(({ closeTopModal }) => closeTopModal());
};

// Referencia al editor real, asignada tras montar el layout (las acciones del
// toolbar son closures que la leen en el momento del clic).
let editor: LevelEditorInstance | null = null;

document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (!app) {
    console.error('Element #app not found');
    return;
  }

  // Crear layout principal (el editor puebla viewport y paneles después)
  const layout = createAppLayout({
    toolbarTitle: 'RayCast Studio — Level Editor',
    toolbarActions: [
      { icon: 'plus', variant: 'icon', onClick: () => editor?.newProject(), ariaLabel: 'Nuevo proyecto' },
      { icon: 'save', variant: 'icon', onClick: () => editor?.save(), ariaLabel: 'Guardar' },
      { icon: 'download', variant: 'icon', onClick: () => editor?.exportJson(), ariaLabel: 'Exportar' },
      { icon: 'folder-open', variant: 'icon', onClick: () => editor?.load(), ariaLabel: 'Cargar' },
    ],
    leftPanel: { title: 'Proyecto', icon: 'folder' },
    rightPanel: { title: 'Inspector', icon: 'layout' },
    viewportContent: `
      <div class="app-viewport__placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted);gap:var(--space-4)">
        ${iconHTML('loader', 40)}
        <p>Inicializando Level Editor…</p>
      </div>
    `,
    bottomTabs: [
      { id: 'sectors', label: 'Sectores', icon: 'map', content: `<div class="level-editor__sectors-placeholder">Los sectores se gestionan en el panel izquierdo</div>` },
      { id: 'console', label: 'Console', icon: 'terminal', content: `<div class="empty" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center"><div class="empty__icon" aria-hidden="true">${iconHTML("terminal", 48)}</div><h4 class="empty__title">Consola</h4><p class="empty__desc">Logs, warnings, errors</p></div>` },
    ],
    activeBottomTab: 'sectors',
    statusLeft: [
      { icon: 'map', text: 'Inicializando…' },
    ],
    statusRight: [
      { icon: 'globe', text: 'F3 · Level Editor' },
    ],
    onSave: () => editor?.save(),
  });

  app.appendChild((layout as any).element);
  (window as any).studioLayout = layout;

  // Crear el editor: puebla viewport (2D top-down) + paneles izquierdo/derecho.
  editor = createLevelEditor({ layout });

  showToast({
    message: 'Level Editor listo. F11=fullscreen, Ctrl+S=guardar, rueda=zoom',
    variant: 'success',
    duration: 5000,
  });
});
