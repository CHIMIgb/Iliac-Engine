/**
 * Button.ts — Botón con 5 variantes × 3 tamaños × 4 estados
 * BEM: .btn, .btn--primary, .btn--sm, .btn--disabled
 */

import { createIcon, iconHTML } from './Icon.js';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  label?: string;
  icon?: string;           // Nombre del icono Lucide
  iconOnly?: boolean;      // Solo icono (para variant='icon')
  disabled?: boolean;
  loading?: boolean;
  onClick?: (e: MouseEvent) => void;
  type?: 'button' | 'submit' | 'reset';
  ariaLabel?: string;      // Requerido si iconOnly
  className?: string;
}

/**
 * Crea un botón y lo retorna como HTMLButtonElement.
 */
export function createButton(options: ButtonOptions = {}): HTMLButtonElement {
  const {
    variant = 'secondary',
    size = 'md',
    label = '',
    icon,
    iconOnly = false,
    disabled = false,
    loading = false,
    onClick,
    type = 'button',
    ariaLabel,
    className = '',
  } = options;

  const btn = document.createElement('button');
  btn.type = type;
  btn.className = `btn btn--${variant} btn--${size} ${className}`.trim();
  btn.disabled = disabled || loading;

  if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
  else if (iconOnly && icon) btn.setAttribute('aria-label', label || icon);

  // Construir contenido
  const content: string[] = [];

  if (loading) {
    content.push(`<span class="btn__spinner" aria-hidden="true">${iconHTML('loader', size === 'sm' ? 16 : 20)}</span>`);
  } else if (icon) {
    content.push(`<span class="btn__icon" aria-hidden="true">${iconHTML(icon, size === 'sm' ? 16 : 20)}</span>`);
  }

  if (!iconOnly && label) {
    content.push(`<span class="btn__label">${escapeHTML(label)}</span>`);
  }

  btn.innerHTML = content.join('');

  if (onClick) {
    btn.addEventListener('click', onClick);
  }

  return btn;
}

/**
 * Renderiza un botón como string HTML (para innerHTML).
 */
export function buttonHTML(options: ButtonOptions = {}): string {
  const {
    variant = 'secondary',
    size = 'md',
    label = '',
    icon,
    iconOnly = false,
    disabled = false,
    loading = false,
    type = 'button',
    ariaLabel,
    className = '',
  } = options;

  const classes = `btn btn--${variant} btn--${size} ${className}`.trim();
  const disabledAttr = (disabled || loading) ? 'disabled' : '';
  const ariaLabelAttr = ariaLabel ? `aria-label="${escapeHTML(ariaLabel)}"` : (iconOnly && icon ? `aria-label="${escapeHTML(label || icon)}"` : '');

  let content = '';

  if (loading) {
    content += `<span class="btn__spinner" aria-hidden="true">${iconHTML('loader', size === 'sm' ? 16 : 20)}</span>`;
  } else if (icon) {
    content += `<span class="btn__icon" aria-hidden="true">${iconHTML(icon, size === 'sm' ? 16 : 20)}</span>`;
  }

  if (!iconOnly && label) {
    content += `<span class="btn__label">${escapeHTML(label)}</span>`;
  }

  return `<button type="${type}" class="${classes}" ${disabledAttr} ${ariaLabelAttr}>${content}</button>`;
}

/**
 * Escapa HTML para prevenir XSS.
 */
function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

/**
 * Estilos CSS para Button (inyectar una vez).
 */
export const buttonCSS = `
/* ==========================================================================
   Button Component
   ========================================================================== */

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  border: none;
  border-radius: var(--border-radius-sm);
  font-family: var(--font-ui);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast), box-shadow var(--transition-fast), opacity var(--transition-fast);
  white-space: nowrap;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

/* Tamaños */
.btn--sm {
  height: var(--btn-h-sm);
  padding: var(--btn-padding-sm);
  font-size: var(--btn-font-sm);
}
.btn--md {
  height: var(--btn-h-md);
  padding: var(--btn-padding-md);
  font-size: var(--btn-font-md);
}
.btn--lg {
  height: var(--btn-h-lg);
  padding: var(--btn-padding-lg);
  font-size: var(--btn-font-lg);
}

/* Variantes */
.btn--primary {
  background: var(--accent-primary);
  color: var(--text-inverse);
}
.btn--primary:hover:not(:disabled) {
  background: #7aa3e8;
}
.btn--primary:active:not(:disabled) {
  background: #5a92e0;
}

.btn--secondary {
  background: var(--bg-surface);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}
.btn--secondary:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-focus);
}
.btn--secondary:active:not(:disabled) {
  background: var(--bg-active);
}

.btn--danger {
  background: var(--accent-danger);
  color: var(--text-inverse);
}
.btn--danger:hover:not(:disabled) {
  background: #e87979;
}
.btn--danger:active:not(:disabled) {
  background: #dc6a6a;
}

.btn--ghost {
  background: transparent;
  color: var(--text-secondary);
}
.btn--ghost:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.btn--ghost:active:not(:disabled) {
  background: var(--bg-active);
}

.btn--icon {
  background: transparent;
  color: var(--text-secondary);
  padding: var(--space-1);
  border-radius: var(--border-radius-sm);
}
.btn--icon:hover:not(:disabled) {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.btn--icon:active:not(:disabled) {
  background: var(--bg-active);
}

/* Estados */
.btn:disabled,
.btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.btn:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}

/* Spinner animado */
.btn__spinner {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Icono y label */
.btn__icon,
.btn__label {
  display: flex;
  align-items: center;
}
`;