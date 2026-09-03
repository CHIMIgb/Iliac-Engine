/**
 * ErrorState.ts — Estado de error con icono, título, descripción, reintentar, detalles
 * BEM: .error, .error__icon, .error__title, .error__desc, .error__actions, .error__details
 */

import { createButton, buttonHTML } from './Button.js';

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
  const { title, description, details, className = '' } = options;
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
    'alert-triangle': 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
  };
  const path = ICON_PATHS[name] || ICON_PATHS['alert-triangle'];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"></path></svg>`;
}

export const errorCSS = `
/* ==========================================================================
   ErrorState Component
   ========================================================================== */

.error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-8);
  text-align: center;
  color: var(--text-primary);
}

.error__icon {
  color: var(--accent-danger);
  flex-shrink: 0;
}

.error__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.error__desc {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin: 0;
  max-width: 320px;
  line-height: var(--line-height-base);
}

.error__actions {
  display: flex;
  gap: var(--space-2);
  margin-top: var(--space-2);
}

.error__details {
  width: 100%;
  max-width: 500px;
  background: var(--bg-input);
  border: 1px solid var(--border-default);
  border-radius: var(--border-radius-md);
  overflow: hidden;
}

.error__details-summary {
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.error__details-summary:hover {
  color: var(--text-primary);
}

.error__details-pre {
  padding: var(--space-3);
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  line-height: var(--line-height-base);
  color: var(--text-secondary);
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}
`;