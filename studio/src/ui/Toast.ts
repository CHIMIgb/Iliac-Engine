/**
 * Toast — notificaciones efímeras.
 * Tipos: success (3s), warning (5s), error (manual), info (3s).
 */

export type ToastType = 'success' | 'warning' | 'error' | 'info';

let container: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement {
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  return container;
}

export function showToast(message: string, type: ToastType = 'info', duration?: number): void {
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  el.textContent = message;

  ensureContainer().appendChild(el);

  const timeout = duration ?? (type === 'error' ? 8000 : type === 'warning' ? 5000 : 3000);

  setTimeout(() => {
    el.classList.add('toast--exit');
    el.addEventListener('animationend', () => el.remove());
  }, timeout);
}
