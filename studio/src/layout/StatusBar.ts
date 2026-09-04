/**
 * StatusBar — barra inferior con información de estado.
 */

export class StatusBar {
  readonly el: HTMLElement;
  private items: Map<string, HTMLSpanElement> = new Map();

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'statusbar';
  }

  /** Establece un item de estado. Crea o actualiza. */
  setItem(id: string, text: string): void {
    let item = this.items.get(id);
    if (!item) {
      item = document.createElement('span');
      item.className = 'statusbar__item';
      this.el.appendChild(item);
      this.items.set(id, item);
    }
    item.textContent = text;
  }

  /** Añade un separador visual. */
  addSeparator(): void {
    const sep = document.createElement('div');
    sep.className = 'statusbar__separator';
    this.el.appendChild(sep);
  }
}
