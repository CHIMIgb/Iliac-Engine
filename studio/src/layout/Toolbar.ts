/**
 * Toolbar — barra superior con acciones del editor.
 */

import { Icon } from '../ui/Icon';

export interface ToolbarAction {
  icon: string;
  label: string;
  shortcut?: string;
  onClick: () => void;
  active?: boolean;
}

export class Toolbar {
  readonly el: HTMLElement;
  private actions: ToolbarAction[] = [];
  private actionButtons: HTMLButtonElement[] = [];

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'toolbar';
  }

  /** Añade un botón de acción al toolbar. */
  addAction(action: ToolbarAction): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = `btn btn--icon${action.active ? ' active' : ''}`;
    btn.title = action.label + (action.shortcut ? ` (${action.shortcut})` : '');
    btn.appendChild(Icon(action.icon as any, 16));
    btn.addEventListener('click', action.onClick);

    this.actionButtons.push(btn);
    this.actions.push(action);
    this.el.appendChild(btn);

    return btn;
  }

  /** Añade un separador visual. */
  addSeparator(): void {
    const sep = document.createElement('div');
    sep.className = 'toolbar__separator';
    this.el.appendChild(sep);
  }

  /**
   * Añade un submenú desplegable (details/summary nativo, sin JS de apertura).
   * Devuelve el contenedor del menú para añadirle items.
   */
  addDropdown(label: string, icon?: string): HTMLDivElement {
    const details = document.createElement('details');
    details.className = 'toolbar__dropdown';
    const summary = document.createElement('summary');
    summary.className = 'btn btn--icon';
    summary.title = label;
    if (icon) summary.appendChild(Icon(icon as any, 16));
    details.appendChild(summary);
    const menu = document.createElement('div');
    menu.className = 'dropdown__menu';
    details.appendChild(menu);
    this.el.appendChild(details);
    return menu;
  }

  /** Añade un grupo de botones. */
  addGroup(): HTMLDivElement {
    const group = document.createElement('div');
    group.className = 'toolbar__group';
    this.el.appendChild(group);
    return group;
  }

  /** Añade un espacio flexible. */
  addSpacer(): void {
    const spacer = document.createElement('div');
    spacer.className = 'toolbar__spacer';
    this.el.appendChild(spacer);
  }

  /** Añade una etiqueta de texto. */
  addLabel(text: string): HTMLSpanElement {
    const label = document.createElement('span');
    label.className = 'toolbar__label';
    label.textContent = text;
    this.el.appendChild(label);
    return label;
  }

  /** Actualiza el estado active de un botón por índice. */
  setActive(index: number, active: boolean): void {
    const btn = this.actionButtons[index];
    if (btn) {
      btn.classList.toggle('active', active);
    }
  }
}
