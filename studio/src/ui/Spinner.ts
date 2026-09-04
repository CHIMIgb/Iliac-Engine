/**
 * Spinner.ts — Spinner circular (16px, 24px)
 * BEM: .spinner, .spinner--sm, .spinner--md, .spinner--lg, .spinner--inline
 */

import { escapeHTML } from './utils.js';
export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerOptions {
  size?: SpinnerSize;
  inline?: boolean;
  label?: string;          // Para screen readers
  className?: string;
}

/**
 * Crea un spinner.
 */
export function createSpinner(options: SpinnerOptions = {}): HTMLElement {
  const { size = 'md', inline = false, label = 'Cargando...', className = '' } = options;

  const spinner = document.createElement('span');
  spinner.className = `spinner spinner--${size} ${inline ? 'spinner--inline' : ''} ${className}`.trim();
  spinner.setAttribute('role', 'status');
  spinner.setAttribute('aria-label', label);
  spinner.innerHTML = `
    <svg class="spinner__svg" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle class="spinner__track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
      <circle class="spinner__indicator" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="31.4 31.4" stroke-dashoffset="0"/>
    </svg>
    ${label ? `<span class="spinner__label sr-only">${escapeHTML(label)}</span>` : ''}
  `;

  return spinner;
}

export function spinnerHTML(options: SpinnerOptions = {}): string {
  const { size = 'md', inline = false, label = 'Cargando...', className = '' } = options;
  return `
    <span class="spinner spinner--${size} ${inline ? 'spinner--inline' : ''} ${className}" role="status" aria-label="${escapeHTML(label)}">
      <svg class="spinner__svg" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle class="spinner__track" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
        <circle class="spinner__indicator" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-dasharray="31.4 31.4"/>
      </svg>
      ${label ? `<span class="spinner__label sr-only">${escapeHTML(label)}</span>` : ''}
    </span>
  `;
}



