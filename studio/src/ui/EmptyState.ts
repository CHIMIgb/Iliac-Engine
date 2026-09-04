/**
 * EmptyState.ts — Estado vacío con icono, título, descripción, acción
 * BEM: .empty, .empty__icon, .empty__title, .empty__desc, .empty__action
 */

import { createButton, buttonHTML } from './Button.js';
import { escapeHTML } from './utils.js';
import { iconHTML } from './Icon.js';

export interface EmptyStateOptions {
  icon?: string;              // Nombre icono Lucide (default: 'file')
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  };
  className?: string;
}

/**
 * Crea un estado vacío.
 */
export function createEmptyState(options: EmptyStateOptions): HTMLElement {
  const { icon = 'file', title, description, action, className = '' } = options;

  const empty = document.createElement('div');
  empty.className = `empty ${className}`.trim();
  empty.innerHTML = `
    <div class="empty__icon" aria-hidden="true">${iconHTML(icon, 48)}</div>
    <h3 class="empty__title">${escapeHTML(title)}</h3>
    ${description ? `<p class="empty__desc">${escapeHTML(description)}</p>` : ''}
    ${action ? `<div class="empty__action"></div>` : ''}
  `;

  if (action) {
    const actionContainer = empty.querySelector('.empty__action')!;
    const btn = createButton({
      label: action.label,
      variant: action.variant || 'primary',
      size: 'md',
      onClick: action.onClick,
    });
    actionContainer.appendChild(btn);
  }

  return empty;
}

export function emptyStateHTML(options: EmptyStateOptions): string {
  const { icon = 'file', title, description, action, className = '' } = options;
  return `
    <div class="empty ${className}">
      <div class="empty__icon" aria-hidden="true">${iconHTML(icon, 48)}</div>
      <h3 class="empty__title">${escapeHTML(title)}</h3>
      ${description ? `<p class="empty__desc">${escapeHTML(description)}</p>` : ''}
      ${action ? `<div class="empty__action">${buttonHTML({ label: action.label, variant: action.variant || 'primary', size: 'md' })}</div>` : ''}
    </div>
  `;
}





