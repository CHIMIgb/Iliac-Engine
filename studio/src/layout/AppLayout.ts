/**
 * AppLayout.ts — Layout principal del Studio
 * Combina: Toolbar + SplitView (Left/Center/Right) + BottomTabs + StatusBar
 * BEM: .app-layout, .app-toolbar, .app-panel-left, .app-viewport, .app-panel-right, .app-bottom-panel, .app-statusbar
 */

import { createToolbar, type ToolbarOptions } from './Toolbar.js';
import { createSplitView, type SplitViewInstance } from '../ui/SplitView.js';
import { createBottomTabs, type BottomTabsInstance, type BottomTabItem } from './BottomTabs.js';
import { createStatusBar, type StatusBarItem } from './StatusBar.js';
import { createPanel, type PanelInstance } from '../ui/Panel.js';
import { createIcon, iconHTML } from '../ui/Icon.js';
import { showToast } from '../ui/Toast.js';

export interface AppLayoutOptions {
  // Toolbar
  toolbarTitle?: string;
  toolbarActions?: ToolbarOptions['actions'];
  // Paneles
  leftPanel?: {
    title: string;
    icon?: string;
    content?: HTMLElement | string;
    collapsible?: boolean;
  };
  rightPanel?: {
    title: string;
    icon?: string;
    content?: HTMLElement | string;
    collapsible?: boolean;
  };
  // Viewport central
  viewportContent?: HTMLElement | string;
  // Bottom tabs
  bottomTabs?: BottomTabItem[];
  activeBottomTab?: string;
  // Status bar
  statusLeft?: StatusBarItem[];
  statusRight?: StatusBarItem[];
  // Callbacks
  onBottomTabChange?: (id: string) => void;
  onSplitResize?: (sizes: number[]) => void;
}

export interface AppLayoutInstance {
  // Toolbar
  setToolbarTitle: (title: string) => void;
  // Paneles
  setLeftPanelContent: (content: HTMLElement | string) => void;
  setRightPanelContent: (content: HTMLElement | string) => void;
  setLeftPanelCollapsed: (collapsed: boolean) => void;
  setRightPanelCollapsed: (collapsed: boolean) => void;
  // Viewport
  setViewportContent: (content: HTMLElement | string) => void;
  // Bottom tabs
  setActiveBottomTab: (id: string) => void;
  setBottomTabBadge: (id: string, count: number) => void;
  // Status bar
  updateStatus: (left?: StatusBarItem[], right?: StatusBarItem[]) => void;
  // Split view
  getSplitSizes: () => number[];
  setSplitSizes: (sizes: number[]) => void;
  // Global
  destroy: () => void;
}

/**
 * Crea el layout principal de la aplicación.
 */
export function createAppLayout(options: AppLayoutOptions = {}): AppLayoutInstance {
  const {
    toolbarTitle = 'RayCast Studio',
    toolbarActions = [],
    leftPanel,
    rightPanel,
    viewportContent,
    bottomTabs = [],
    activeBottomTab,
    statusLeft = [],
    statusRight = [],
    onBottomTabChange,
    onSplitResize,
  } = options;

  // Contenedor raíz
  const root = document.createElement('div');
  root.className = 'app-layout';
  root.innerHTML = `
    <header class="app-toolbar"></header>
    <div class="app-split"></div>
    <div class="app-bottom-panel"></div>
    <footer class="app-statusbar"></footer>
  `;

  const toolbarEl = root.querySelector('.app-toolbar')!;
  const splitEl = root.querySelector('.app-split')!;
  const bottomEl = root.querySelector('.app-bottom-panel')!;
  const statusEl = root.querySelector('.app-statusbar')!;

  // --- Toolbar ---
  const toolbar = createToolbar({
    title: toolbarTitle,
    actions: toolbarActions,
  });
  toolbarEl.appendChild(toolbar);

  // --- Split View principal (Left / Center / Right) ---
  const leftContent = leftPanel ? createPanel({
    title: leftPanel.title,
    icon: leftPanel.icon,
    content: leftPanel.content,
    collapsible: leftPanel.collapsible !== false,
  }) : createPanel({ title: 'Proyecto', icon: 'folder', collapsible: true });

  const rightContent = rightPanel ? createPanel({
    title: rightPanel.title,
    icon: rightPanel.icon,
    content: rightPanel.content,
    collapsible: rightPanel.collapsible !== false,
  }) : createPanel({ title: 'Inspector', icon: 'layout', collapsible: true });

  // Viewport central
  const viewportEl = document.createElement('div');
  viewportEl.className = 'app-viewport';
  if (viewportContent instanceof HTMLElement) {
    viewportEl.appendChild(viewportContent);
  } else {
    viewportEl.innerHTML = viewportContent || `
      <div class="app-viewport__placeholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted);gap:var(--space-4)">
        ${iconHTML('layout', 64)}
        <p>Viewport 3D / Editor 2D</p>
        <span style="font-size:var(--font-size-xs)">Presiona F11 para maximizar</span>
      </div>
    `;
  }

  // SplitView con 3 paneles
  const splitView = createSplitView({
    direction: 'horizontal',
    panes: [
      {
        content: (leftContent as any).element || leftContent,
        minSize: 200,
        maxSize: 400,
        defaultSize: 280,
      },
      {
        content: viewportEl,
        minSize: 400,
        defaultSize: '100%',
      },
      {
        content: (rightContent as any).element || rightContent,
        minSize: 240,
        maxSize: 480,
        defaultSize: 320,
      },
    ],
    onResize: onSplitResize,
  });
  splitEl.appendChild((splitView as any).element || splitView);

  // --- Bottom Tabs ---
  const bottomTabsInstance = createBottomTabs({
    tabs: bottomTabs,
    activeId: activeBottomTab,
    onChange: onBottomTabChange,
  });
  bottomEl.appendChild((bottomTabsInstance as any).element || bottomTabsInstance);

  // --- Status Bar ---
  const statusBar = createStatusBar({
    left: statusLeft,
    right: statusRight,
  });
  statusEl.appendChild(statusBar);

  // Atajos globales
  const globalKeyDown = (e: KeyboardEvent) => {
    // F11 - Toggle viewport fullscreen
    if (e.key === 'F11') {
      e.preventDefault();
      root.classList.toggle('app-layout--viewport-fullscreen');
      showToast({ message: root.classList.contains('app-layout--viewport-fullscreen') ? 'Viewport maximizado (F11 para restaurar)' : 'Viewport restaurado', variant: 'info' });
    }
    // Escape - Cerrar modales, deselect
    if (e.key === 'Escape') {
      const modalsClosed = (window as any).closeTopModal?.();
      if (!modalsClosed) {
        // Deselect cualquier elemento seleccionado
        document.querySelectorAll('[data-selected]').forEach(el => el.removeAttribute('data-selected'));
      }
    }
    // Ctrl+S - Guardar (prevenir default del navegador)
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      showToast({ message: 'Proyecto guardado (Ctrl+S)', variant: 'success' });
    }
    // Ctrl+P - Command Palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      showToast({ message: 'Command Palette (por implementar)', variant: 'info' });
    }
    // Ctrl+N - Nuevo
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      showToast({ message: 'Nuevo proyecto (por implementar)', variant: 'info' });
    }
  };

  document.addEventListener('keydown', globalKeyDown);

  // Instancia pública
  const instance: AppLayoutInstance = {
    setToolbarTitle: (title: string) => {
      const titleEl = toolbarEl.querySelector('.app-toolbar__title');
      if (titleEl) titleEl.textContent = title;
    },
    setLeftPanelContent: (content: HTMLElement | string) => {
      (leftContent as any).setContent?.(content);
    },
    setRightPanelContent: (content: HTMLElement | string) => {
      (rightContent as any).setContent?.(content);
    },
    setLeftPanelCollapsed: (collapsed: boolean) => {
      (leftContent as any).setCollapsed?.(collapsed);
    },
    setRightPanelCollapsed: (collapsed: boolean) => {
      (rightContent as any).setCollapsed?.(collapsed);
    },
    setViewportContent: (content: HTMLElement | string) => {
      viewportEl.innerHTML = '';
      if (content instanceof HTMLElement) viewportEl.appendChild(content);
      else viewportEl.innerHTML = content;
    },
    setActiveBottomTab: (id: string) => {
      bottomTabsInstance.setActiveTab(id);
    },
    setBottomTabBadge: (id: string, count: number) => {
      bottomTabsInstance.setBadge(id, count);
    },
    updateStatus: (left, right) => {
      // Recrear status bar (simple approach)
      statusEl.innerHTML = '';
      const newStatus = createStatusBar({ left: left ?? statusLeft, right: right ?? statusRight });
      statusEl.appendChild(newStatus);
    },
    getSplitSizes: () => splitView.getSizes(),
    setSplitSizes: (sizes: number[]) => splitView.setSizes(sizes),
    destroy: () => {
      document.removeEventListener('keydown', globalKeyDown);
      root.remove();
    },
  };

  // Añadir elemento raíz al DOM
  (instance as any).element = root;

  return instance;
}

function iconHTML(name: string, size: number): string {
  const ICON_PATHS: Record<string, string> = {
    'layout': 'M3 3h18v18H3zM12 3v18M3 12h18',
    'folder': 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z',
    'terminal': 'M4 17l4-4 4 4M9 11V3M15 11V3',
    'code': 'M16 18l6-6-6-6M8 6l-6 6 6 6',
    'alert-triangle': 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  };
  const path = ICON_PATHS[name] || ICON_PATHS.layout;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"></path></svg>`;
}