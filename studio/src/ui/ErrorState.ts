/**
 * ErrorState.ts — Estado de error con icono, título, descripción, reintentar, detalles
 * BEM: .error, .error__icon, .error__title, .error__desc, .error__actions, .error__details
 */

import { createButton, buttonHTML } from './Button.js';
import { escapeHTML } from './utils.js';
import { iconHTML } from './Icon.js';

export interface ErrorStateOptions {
  title: string;
  description?: string;
  details?: string;           // Stack trace o info técnica (se muestra al hacer click en Detalles)
  onRetry?: () => void;
  onDetails?: () => void;
  className?: string;
}

/**
 * Crea un estado de error.
 */
export function createErrorState(options: ErrorStateOptions): HTMLElement {
  const { title, description, details, onRetry, onDetails, className = '' } = options;

  const error = document.createElement('div');
  error.className = `error ${className}`.trim();

  let detailsHTML = '';
  if (details) {
    detailsHTML = `
      <details class="error__details" style="margin-top: var(--space-3); text-align: left;">
        <summary class="error__details-summary">Detalles</summary>
        <pre class="error__details-pre">${escapeHTML(details)}</pre>
      </details>
    `;
  }

  error.innerHTML = `
    <div class="error__icon" aria-hidden="true">${iconHTML('alert-triangle', 48)}</div>
    <h3 class="error__title">${escapeHTML(title)}</h3>
    ${description ? `<p class="error__desc">${escapeHTML(description)}</p>` : ''}
    <div class="error__actions"></div>
    ${detailsHTML}
  `;

  const actionsContainer = error.querySelector('.error__actions')!;
  if (onRetry) {
    const retryBtn = createButton({
      label: 'Reintentar',
      variant: 'primary',
      size: 'md',
      onClick: onRetry,
    });
    actionsContainer.appendChild(retryBtn);
  }
  if (onDetails || details) {
    const detailsBtn = createButton({
      label: 'Detalles',
      variant: 'ghost',
      size: 'md',
      onClick: onDetails || (() => {
        const detailsEl = error.querySelector('.error__details') as HTMLDetailsElement;
        if (detailsEl) detailsEl.open = !detailsEl.open;
      }),
    });
    actionsContainer.appendChild(detailsBtn);
  }

  return error;
}

export function errorStateHTML(options: ErrorStateOptions): string {
  const { title, description, details, onRetry, className = '' } = options;
  return `
    <div class="error ${className}">
      <div class="error__icon" aria-hidden="true">${iconHTML('alert-triangle', 48)}</div>
      <h3 class="error__title">${escapeHTML(title)}</h3>
      ${description ? `<p class="error__desc">${escapeHTML(description)}</p>` : ''}
      <div class="error__actions">
        ${onRetry ? buttonHTML({ label: 'Reintentar', variant: 'primary', size: 'md' }) : ''}
        ${details ? buttonHTML({ label: 'Detalles', variant: 'ghost', size: 'md' }) : ''}
      </div>
      ${details ? `
        <details class="error__details" style="margin-top: var(--space-3); text-align: left;">
          <summary class="error__details-summary">Detalles</summary>
          <pre class="error__details-pre">${escapeHTML(details)}</pre>
        </details>
      ` : ''}
    </div>
  `;
}





