/**
 * LoadingState.ts — Estado de carga con spinner y texto
 * BEM: .loading, .loading__spinner, .loading__text
 */

import { createSpinner, spinnerHTML } from './Spinner.js';
import { escapeHTML } from './utils.js';

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



