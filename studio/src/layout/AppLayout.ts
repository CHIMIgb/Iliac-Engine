/**
 * AppLayout — shell principal del Studio.
 *
 * Estructura:
 * ┌──────────────────────────────┐
 * │  Toolbar (40px)              │
 * ├──────────────────────┬───────┤
 * │                      │ Panel │
 * │     Viewport         │ Right │
 * │     (flex: 1)        │(280px)│
 * ├──────────────────────┴───────┤
 * │  Status Bar (24px)           │
 * └──────────────────────────────┘
 */

import { Toolbar } from './Toolbar';
import { StatusBar } from './StatusBar';

export class AppLayout {
  readonly el: HTMLElement;
  readonly toolbar: Toolbar;
  readonly viewport: HTMLElement;
  readonly panelRight: HTMLElement;
  readonly statusBar: StatusBar;

  constructor() {
    // Root
    this.el = document.createElement('div');
    this.el.className = 'app';

    // Toolbar
    this.toolbar = new Toolbar();
    this.el.appendChild(this.toolbar.el);

    // Main area (viewport + panel derecho)
    const mainArea = document.createElement('div');
    mainArea.className = 'main-area';

    // Viewport
    this.viewport = document.createElement('div');
    this.viewport.className = 'viewport';
    this.viewport.id = 'viewport';

    // Panel derecho
    this.panelRight = document.createElement('div');
    this.panelRight.className = 'panel-right';

    mainArea.appendChild(this.viewport);
    mainArea.appendChild(this.panelRight);
    this.el.appendChild(mainArea);

    // Status bar
    this.statusBar = new StatusBar();
    this.el.appendChild(this.statusBar.el);
  }

  /** Monta el layout en un contenedor del DOM. */
  mount(container: HTMLElement): void {
    container.appendChild(this.el);
  }

  /** Alterna la visibilidad del panel derecho. */
  togglePanelRight(): void {
    this.panelRight.classList.toggle('panel-right--collapsed');
  }
}
