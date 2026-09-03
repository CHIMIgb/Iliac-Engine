/**
 * Toast.ts — Toast/Notificaciones (success, warning, error, info)
 * BEM: .toast, .toast--success, .toast__icon, .toast__message, .toast__close
 */

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
  actionBtn?.addEventListener('click', () => { action.onClick(); close(); });

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

function iconHTML(name: string, size: number): string {
  const ICON_PATHS: Record<string, string> = {
    check: 'M20 6L9 17l-5-5',
    x: 'M18 6L6 18M6 6l12 12',
    'alert-triangle': 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
    info: 'M13 16h-2v-4h2M13 12h-2v-2h2M12 2a10 10 0 100 20 10 10 0 000-20z',
  };
  const path = ICON_PATHS[name] || ICON_PATHS.info;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="${path}"></path></svg>`;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

// Helpers de conveniencia
export const toast = {
  success: (msg: string, opts?: Partial<ToastOptions>) => showToast({ ...opts, message: msg, variant: 'success' }),
  warning: (msg: string, opts?: Partial<ToastOptions>) => showToast({ ...opts, message: msg, variant: 'warning' }),
  error: (msg: string, opts?: Partial<ToastOptions>) => showToast({ ...opts, message: msg, variant: 'error' }),
  info: (msg: string, opts?: Partial<ToastOptions>) => showToast({ ...opts, message: msg, variant: 'info' }),
  closeAll: closeAllToasts,
};

export const toastCSS = `
/* ==========================================================================
   Toast Component
   ========================================================================== */

.toast-container {
  position: fixed;
  top: var(--space-4);
  right: var(--space-4);
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  pointer-events: none;
  max-width: 360px;
}

.toast-container > * {
  pointer-events: auto;
}

.toast {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-panel);
  border: 1px solid var(--border-default);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-lg);
  min-width: 280px;
  max-width: 100%;
  transform: translateX(120%);
  opacity: 0;
  transition: transform var(--transition-base), opacity var(--transition-base);
}

.toast--visible {
  transform: translateX(0);
  opacity: 1;
}

.toast--closing {
  transform: translateX(120%);
  opacity: 0;
}

.toast__icon {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 2px;
}

.toast__message {
  flex: 1;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-base);
  color: var(--text-primary);
}

.toast__action {
  flex-shrink: 0;
  padding: var(--space-1) var(--space-2);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--accent-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  text-decoration: underline;
}
.toast__action:hover {
  color: var(--accent-primary);
  opacity: 0.8;
}

.toast__close {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: none;
  border-radius: var(--border-radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
  margin-left: var(--space-2);
}
.toast__close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

/* Variantes - borde lateral */
.toast::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  border-radius: var(--border-radius-md) 0 0 var(--border-radius-md);
}

.toast--success::before { background: var(--accent-success); }
.toast--warning::before { background: var(--accent-warning); }
.toast--error::before { background: var(--accent-danger); }
.toast--info::before { background: var(--accent-info); }
`;