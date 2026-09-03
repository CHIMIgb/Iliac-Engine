/**
 * EmptyState.ts — Estado vacío con icono, título, descripción, acción
 * BEM: .empty, .empty__icon, .empty__title, .empty__desc, .empty__action
 */

import { createButton, buttonHTML } from './Button.js';

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

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

function iconHTML(name: string, size: number): string {
  const ICON_PATHS: Record<string, string> = {
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    folder: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z',
    save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M14 9l-5-5-5 5M12 3v12',
    trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'alert-triangle': 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
    inbox: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    layout: 'M3 3h18v18H3zM12 3v18M3 12h18',
  };
  const path = ICON_PATHS[name] || ICON_PATHS.file;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"></path></svg>`;
}

export const emptyCSS = `
/* ==========================================================================
   EmptyState Component
   ========================================================================== */

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  text-align: center;
  color: var(--text-secondary);
}

.empty__icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.empty__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-secondary);
  margin: 0;
}

.empty__desc {
  font-size: var(--font-size-sm);
  color: var(--text-muted);
  margin: 0;
  max-width: 320px;
  line-height: var(--line-height-base);
}

.empty__action {
  margin-top: var(--space-2);
}
`;