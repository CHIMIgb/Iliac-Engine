/**
 * LoadingState.ts — Estado de carga con spinner y texto
 * BEM: .loading, .loading__spinner, .loading__text
 */

import { createSpinner, spinnerHTML } from './Spinner.js';

export interface LoadingStateOptions {
  text?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Crea un estado de carga.
 */
export function createLoadingState(options: LoadingStateOptions = {}): HTMLElement {
  const { text = 'Cargando...', size = 'md', className = '' } = options;

  const loading = document.createElement('div');
  loading.className = `loading ${className}`.trim();
  loading.innerHTML = `
    <div class="loading__spinner" aria-hidden="true">${spinnerHTML({ size })}</div>
    <p class="loading__text">${escapeHTML(text)}</p>
  `;

  return loading;
}

export function loadingStateHTML(options: LoadingStateOptions = {}): string {
  const { text = 'Cargando...', size = 'md', className = '' } = options;
  return `
    <div class="loading ${className}">
      <div class="loading__spinner" aria-hidden="true">${spinnerHTML({ size })}</div>
      <p class="loading__text">${escapeHTML(text)}</p>
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

export const loadingCSS = `
/* ==========================================================================
   LoadingState Component
   ========================================================================== */

.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-6);
  color: var(--text-secondary);
  text-align: center;
}

.loading__spinner {
  flex-shrink: 0;
}

.loading__text {
  font-size: var(--font-size-sm);
  margin: 0;
}
`;