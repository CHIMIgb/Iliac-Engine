/**
 * Toast.ts — Toast/Notificaciones (success, warning, error, info)
 * BEM: .toast, .toast--success, .toast__icon, .toast__message, .toast__close
 */

import { escapeHTML } from './utils.js';
import { iconHTML } from './Icon.js';
export type ToastVariant = 'success' | 'warning' | 'error' | 'info';

export interface ToastOptions {
  message: string;
  variant?: ToastVariant;
  duration?: number;        // ms, 0 = no auto-dismiss
  action?: { label: string; onClick: () => void };
  onClose?: () => void;
}

const toasts: HTMLElement[] = [];

function getContainer(): HTMLElement {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container as HTMLElement;
}

const VARIANT_CONFIG: Record<ToastVariant, { icon: string; color: string; defaultDuration: number }> = {
  success: { icon: 'check', color: 'var(--accent-success)', defaultDuration: 3000 },
  warning: { icon: 'alert-triangle', color: 'var(--accent-warning)', defaultDuration: 5000 },
  error:   { icon: 'x', color: 'var(--accent-danger)', defaultDuration: 0 },      // manual
  info:    { icon: 'info', color: 'var(--accent-info)', defaultDuration: 3000 },
};

/**
 * Muestra un toast. Retorna función para cerrarlo manualmente.
 */
export function showToast(options: ToastOptions): () => void {
  const {
    message,
    variant = 'info',
    duration,
    action,
    onClose,
  } = options;

  const config = VARIANT_CONFIG[variant];
  const autoDuration = duration ?? config.defaultDuration;

  const toast = document.createElement('div');
  toast.className = `toast toast--${variant}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', variant === 'error' ? 'assertive' : 'polite');

  toast.innerHTML = `
    <div class="toast__icon" style="color:${config.color}" aria-hidden="true">${iconHTML(config.icon, 20)}</div>
    <div class="toast__message">${escapeHTML(message)}</div>
    ${action ? `<button type="button" class="toast__action">${escapeHTML(action.label)}</button>` : ''}
    <button type="button" class="toast__close" aria-label="Cerrar">${iconHTML('x', 16)}</button>
  `;

  const closeBtn = toast.querySelector('.toast__close')!;
  const actionBtn = toast.querySelector('.toast__action');

  const close = () => {
    toast.classList.add('toast--closing');
    setTimeout(() => {
      if (toast.parentElement) toast.parentElement!.removeChild(toast);
      const idx = toasts.indexOf(toast);
      if (idx >= 0) toasts.splice(idx, 1);
      onClose?.();
    }, 200);
  };

  closeBtn.addEventListener('click', close);
  actionBtn?.addEventListener('click', () => { action?.onClick(); close(); });

  getContainer().appendChild(toast);
  toasts.push(toast);

  // Animación de entrada
  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  // Auto-dismiss
  if (autoDuration > 0) {
    setTimeout(close, autoDuration);
  }

  return close;
}

/**
 * Cierra todos los toasts.
 */
export function closeAllToasts(): void {
  [...toasts].forEach(t => {
    t.classList.add('toast--closing');
    setTimeout(() => t.remove(), 200);
  });
  toasts.length = 0;
}

function getOrCreateContainer(): HTMLElement {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container as HTMLElement;
}





// Helpers de conveniencia
export const toast = {
  success: (msg: string, opts?: Partial<ToastOptions>) => showToast({ ...opts, message: msg, variant: 'success' }),
  warning: (msg: string, opts?: Partial<ToastOptions>) => showToast({ ...opts, message: msg, variant: 'warning' }),
  error: (msg: string, opts?: Partial<ToastOptions>) => showToast({ ...opts, message: msg, variant: 'error' }),
  info: (msg: string, opts?: Partial<ToastOptions>) => showToast({ ...opts, message: msg, variant: 'info' }),
  closeAll: closeAllToasts,
};

