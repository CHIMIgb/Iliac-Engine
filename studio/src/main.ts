/**
 * main.ts — Entry point del Studio
 * Bootstrap: monta AppLayout, inicializa toast container, registra atajos globales
 */

import './style.css';
import './components.css';
import { createAppLayout } from './layout/AppLayout.js';
import { showToast, closeAllToasts } from './ui/Toast.js';
import { closeAllModals } from './ui/Modal.js';
import { iconHTML } from './ui/Icon.js';

// Inicializar contenedor de toasts (se crea automáticamente en showToast)
// Inicializar contenedor de modales (se crea automáticamente en createModal)

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
  // Importar dinámicamente para evitar dependencia circular
  import('./ui/Modal.js').then(({ closeTopModal }) => closeTopModal());
};

// Función global para cerrar todos los modales
(window as any).closeAllModals = () => {
  import('./ui/Modal.js').then(({ closeAllModals }) => closeAllModals());
};

// Función global para cerrar todos los toasts
(window as any).closeAllToasts = closeAllToasts;

// Montar AppLayout cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');
  if (!app) {
    console.error('Element #app not found');
    return;
  }

  // Crear layout principal
  const layout = createAppLayout({
    toolbarTitle: 'RayCast Studio',
    toolbarActions: [
      { icon: 'save', variant: 'icon', onClick: () => showToast({ message: 'Guardado (Ctrl+S)', variant: 'success' }), ariaLabel: 'Guardar' },
      { icon: 'download', variant: 'icon', onClick: () => showToast({ message: 'Exportar proyecto', variant: 'info' }), ariaLabel: 'Exportar' },
      { icon: 'settings', variant: 'icon', onClick: () => showToast({ message: 'Ajustes (por implementar)', variant: 'info' }), ariaLabel: 'Ajustes' },
    ],
    leftPanel: {
      title: 'Proyecto',
      icon: 'folder',
      content: `
        <div style="padding:var(--space-2);display:flex;flex-direction:column;gap:var(--space-3)">
          <div class="empty" style="padding:0">
            <div class="empty__icon" aria-hidden="true">${iconHTML('folder', 32)}</div>
            <h4 class="empty__title" style="font-size:var(--font-size-sm);margin:0">Sin proyecto abierto</h4>
            <p class="empty__desc" style="font-size:var(--font-size-xs);margin:0">Crea o abre un proyecto para empezar</p>
            <button class="btn btn--primary btn--sm" style="margin-top:var(--space-2)" onclick="alert('Nuevo proyecto - por implementar')">Nuevo proyecto</button>
          </div>
        </div>
      `,
      collapsible: true,
    },
    rightPanel: {
      title: 'Inspector',
      icon: 'layout',
      content: `
        <div style="padding:var(--space-2);display:flex;flex-direction:column;gap:var(--space-3)">
          <div class="empty" style="padding:0">
            <div class="empty__icon" aria-hidden="true">${iconHTML('layout', 32)}</div>
            <h4 class="empty__title" style="font-size:var(--font-size-sm);margin:0">Selecciona un elemento</h4>
            <p class="empty__desc" style="font-size:var(--font-size-xs);margin:0">Las propiedades aparecerán aquí</p>
          </div>
        </div>
      `,
      collapsible: true,
    },
    viewportContent: `
      <div class="app-viewport__placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted);gap:var(--space-4)">
        ${iconHTML('layout', 64)}
        <p>Viewport 3D / Editor 2D</p>
        <span style="font-size:var(--font-size-xs)">Presiona F11 para maximizar • F5 para Playtest</span>
      </div>
    `,
    bottomTabs: [
      { id: 'assets', label: 'Assets', icon: 'folder', content: `<div class="empty" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center"><div class="empty__icon" aria-hidden="true">${iconHTML("folder", 48)}</div><h4 class="empty__title">Asset Manager</h4><p class="empty__desc">Arrastra texturas, sprites, audio aquí</p></div>` },
      { id: 'console', label: 'Console', icon: 'terminal', content: `<div class="empty" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center"><div class="empty__icon" aria-hidden="true">${iconHTML("terminal", 48)}</div><h4 class="empty__title">Consola</h4><p class="empty__desc">Logs, warnings, errors</p></div>` },
      { id: 'output', label: 'Output', icon: 'code', content: `<div class="empty" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center"><div class="empty__icon" aria-hidden="true">${iconHTML("code", 48)}</div><h4 class="empty__title">Salida</h4><p class="empty__desc">Build output, task output</p></div>` },
      { id: 'problems', label: 'Problems', icon: 'alert-triangle', badge: 0, content: `<div class="empty" style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center"><div class="empty__icon" aria-hidden="true">${iconHTML("alert-triangle", 48)}</div><h4 class="empty__title">Problemas</h4><p class="empty__desc">Errores y warnings del proyecto</p></div>` },
    ],
    activeBottomTab: 'assets',
    statusLeft: [
      { icon: 'cpu', text: 'Engine: Ready' },
      { text: 'FPS: 60' },
    ],
    statusRight: [
      { icon: 'globe', text: 'v0.1.0' },
      { icon: 'user', text: 'Guest' },
    ],
    onBottomTabChange: (id) => {
      console.log('Bottom tab changed:', id);
    },
    onSplitResize: (sizes) => {
      console.log('Split resized:', sizes);
    },
  });

  app.appendChild((layout as any).element);

  // Exponer layout globalmente para debugging
  (window as any).studioLayout = layout;

  // Toast de bienvenida
  setTimeout(() => {
    showToast({
      message: 'RayCast Studio cargado. F11=fullscreen, F5=playtest, Ctrl+S=guardar',
      variant: 'success',
      duration: 5000,
    });
  }, 500);

  // Demo: simular cambio de estado en 3s
  setTimeout(() => {
    layout.updateStatus(
      [{ icon: 'cpu', text: 'Engine: Running' }, { text: 'FPS: 58' }],
      [{ icon: 'globe', text: 'v0.1.0' }, { icon: 'user', text: 'Guest' }]
    );
  }, 3000);
});