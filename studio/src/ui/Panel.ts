/**
 * Panel — panel colapsable con header.
 */

import { Icon } from '../ui/Icon';

export class Panel {
  readonly el: HTMLElement;
  private headerEl: HTMLElement;
  private bodyEl: HTMLElement;
  private collapsed = false;

  constructor(title: string) {
    this.el = document.createElement('div');
    this.el.className = 'panel';

    // Header
    this.headerEl = document.createElement('div');
    this.headerEl.className = 'panel__header';

    const titleEl = document.createElement('span');
    titleEl.className = 'panel__title';
    titleEl.textContent = title;

    const chevron = Icon('chevron-down', 14);
    chevron.style.color = 'var(--text-muted)';

    this.headerEl.appendChild(titleEl);
    this.headerEl.appendChild(chevron);
    this.headerEl.addEventListener('click', () => this.toggle());

    // Body
    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'panel__body';

    this.el.appendChild(this.headerEl);
    this.el.appendChild(this.bodyEl);
  }

  /** Devuelve el contenedor del body para añadir contenido. */
  get body(): HTMLElement {
    return this.bodyEl;
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
    this.bodyEl.classList.toggle('panel__body--hidden', this.collapsed);
  }

  collapse(): void {
    this.collapsed = true;
    this.bodyEl.classList.add('panel__body--hidden');
  }

  expand(): void {
    this.collapsed = false;
    this.bodyEl.classList.remove('panel__body--hidden');
  }
}
