/**
 * Divider.ts — Línea separadora horizontal/vertical
 * BEM: .divider, .divider--vertical, .divider--with-text
 */

import { escapeHTML } from './utils.js';
export interface DividerOptions {
  orientation?: 'horizontal' | 'vertical';
  text?: string;
  className?: string;
}

/**
 * Crea un divider.
 */
export function createDivider(options: DividerOptions = {}): HTMLElement {
  const { orientation = 'horizontal', text, className = '' } = options;

  const divider = document.createElement('div');
  divider.className = `divider divider--${orientation} ${text ? 'divider--with-text' : ''} ${className}`.trim();
  divider.setAttribute('role', 'separator');

  if (text) {
    divider.innerHTML = `
      <div class="divider__before"></div>
      <span class="divider__text">${escapeHTML(text)}</span>
      <div class="divider__after"></div>
    `;
  }

  return divider;
}

export function dividerHTML(options: DividerOptions = {}): string {
  const { orientation = 'horizontal', text, className = '' } = options;
  if (text) {
    return `
      <div class="divider divider--${orientation} divider--with-text ${className}" role="separator">
        <div class="divider__before"></div>
        <span class="divider__text">${escapeHTML(text)}</span>
        <div class="divider__after"></div>
      </div>
    `;
  }
  return `<div class="divider divider--${orientation} ${className}" role="separator"></div>`;
}



