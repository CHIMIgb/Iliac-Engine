/**
 * Spinner.ts — Spinner circular (16px, 24px)
 * BEM: .spinner, .spinner--sm, .spinner--md, .spinner--lg, .spinner--inline
 */

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

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

export const spinnerCSS = `
/* ==========================================================================
   Spinner Component
   ========================================================================== */

.spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
  flex-shrink: 0;
}

.spinner--sm { width: 16px; height: 16px; }
.spinner--md { width: 24px; height: 24px; }
.spinner--lg { width: 32px; height: 32px; }

.spinner--inline {
  vertical-align: middle;
}

.spinner__svg {
  width: 100%;
  height: 100%;
  animation: spinner-rotate 1s linear infinite;
}

.spinner__track {
  stroke: currentColor;
}

.spinner__indicator {
  stroke: currentColor;
  transform-origin: center;
  animation: spinner-dash 1.5s ease-in-out infinite;
}

@keyframes spinner-rotate {
  100% { transform: rotate(360deg); }
}

@keyframes spinner-dash {
  0% { stroke-dasharray: 1, 31.4; stroke-dashoffset: 0; }
  50% { stroke-dasharray: 31.4, 31.4; stroke-dashoffset: -15.7; }
  100% { stroke-dasharray: 31.4, 31.4; stroke-dashoffset: -31.4; }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
`;