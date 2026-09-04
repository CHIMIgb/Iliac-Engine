/**
 * Button.ts — Botón con 5 variantes × 3 tamaños × 4 estados
 * BEM: .btn, .btn--primary, .btn--sm, .btn--disabled
 */

import { createIcon, iconHTML } from './Icon.js';
import { escapeHTML } from './utils.js';

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


/**
 * Estilos CSS para Button (inyectar una vez).
 */
