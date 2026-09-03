/**
 * Modal.ts — Modal/Dialog con overlay, focus trap, animación
 * BEM: .modal, .modal__overlay, .modal__content, .modal__header, .modal__body, .modal__footer
 */

export interface ModalOptions {
  title: string;
  content: HTMLElement | string;
  size?: 'sm' | 'md' | 'lg' | 'xl'; // max-width: 320, 480, 640, 800
  showClose?: boolean;
  closeOnOverlay?: boolean;
  closeOnEscape?: boolean;
  actions?: Array<{
    label: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    onClick: (modal: ModalInstance) => void | Promise<void>;
    disabled?: boolean;
  }>;
  onClose?: () => void;
  onOpen?: () => void;
}

export interface ModalInstance {
  close: () => void;
  setTitle: (title: string) => void;
  setContent: (content: HTMLElement | string) => void;
  destroy: () => void;
}

const openModals: ModalInstance[] = [];

/**
 * Crea y abre un modal. Retorna la instancia para controlarlo.
 */
export function createModal(options: ModalOptions): ModalInstance {
  const {
    title,
    content,
    size = 'md',
    showClose = true,
    closeOnOverlay = true,
    closeOnEscape = true,
    actions = [],
    onClose,
    onOpen,
  } = options;

  // Overlay
  const overlay = document.createElement('div');
  overlay.className = 'modal__overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'modal-title');

  // Contenido
  const modal = document.createElement('div');
  modal.className = `modal modal--${size}`;
  modal.innerHTML = `
    <div class="modal__header">
      <h2 class="modal__title" id="modal-title">${escapeHTML(title)}</h2>
      ${showClose ? '<button type="button" class="modal__close" aria-label="Cerrar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>' : ''}
    </div>
    <div class="modal__body"></div>
    ${actions.length > 0 ? '<div class="modal__footer"></div>' : ''}
  `;

  const body = modal.querySelector('.modal__body')!;
  if (content instanceof HTMLElement) {
    body.appendChild(content);
  } else {
    body.innerHTML = content;
  }

  const footer = modal.querySelector('.modal__footer');
  if (footer && actions.length > 0) {
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn btn--${action.variant || 'secondary'} btn--md`;
      btn.textContent = action.label;
      btn.disabled = action.disabled || false;
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await action.onClick(instance);
        } finally {
          if (document.body.contains(overlay)) btn.disabled = action.disabled || false;
        }
      });
      footer.appendChild(btn);
    });
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Focus trap
  const focusableElements = modal.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  let firstFocusable = focusableElements[0];
  let lastFocusable = focusableElements[focusableElements.length - 1];

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape' && closeOnEscape) {
      e.preventDefault();
      instance.close();
      return;
    }
    if (e.key === 'Tab') {
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    }
  }

  function handleOverlayClick(e: MouseEvent) {
    if (closeOnOverlay && e.target === overlay) {
      instance.close();
    }
  }

  function updateFocusable() {
    const elements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    firstFocusable = elements[0];
    lastFocusable = elements[elements.length - 1];
  }

  const instance: ModalInstance = {
    close: () => {
      overlay.classList.add('modal__overlay--closing');
      modal.classList.add('modal--closing');
      setTimeout(() => {
        if (document.body.contains(overlay)) {
          document.body.removeChild(overlay);
        }
        const idx = openModals.indexOf(instance);
        if (idx >= 0) openModals.splice(idx, 1);
        onClose?.();
      }, 150);
      document.removeEventListener('keydown', handleKeydown);
      overlay.removeEventListener('click', handleOverlayClick);
    },
    setTitle: (newTitle: string) => {
      const titleEl = modal.querySelector('#modal-title');
      if (titleEl) titleEl.textContent = newTitle;
    },
    setContent: (newContent: HTMLElement | string) => {
      body.innerHTML = '';
      if (newContent instanceof HTMLElement) body.appendChild(newContent);
      else body.innerHTML = newContent;
      updateFocusable();
    },
    destroy: () => instance.close(),
  };

  // Animación de entrada
  requestAnimationFrame(() => {
    overlay.classList.add('modal__overlay--open');
    modal.classList.add('modal--open');
  });

  // Event listeners
  document.addEventListener('keydown', handleKeydown);
  overlay.addEventListener('click', handleOverlayClick);

  // Focus inicial
  setTimeout(() => firstFocusable?.focus(), 50);

  openModals.push(instance);
  onOpen?.();

  return instance;
}

/**
 * Cierra el modal superior (útil para Escape global).
 */
export function closeTopModal(): boolean {
  const modal = openModals[openModals.length - 1];
  if (modal) {
    modal.close();
    return true;
  }
  return false;
}

export function closeAllModals(): void {
  [...openModals].forEach(m => m.close());
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

export const modalCSS = `
/* ==========================================================================
   Modal Component
   ========================================================================== */

.modal__overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-overlay);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-4);
  z-index: var(--z-modal-overlay);
  opacity: 0;
  transition: opacity var(--transition-base);
}

.modal__overlay--open {
  opacity: 1;
}

.modal__overlay--closing {
  opacity: 0;
}

.modal {
  background: var(--bg-panel);
  border: 1px solid var(--border-default);
  border-radius: var(--border-radius-lg);
  box-shadow: var(--shadow-lg);
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  transform: scale(0.95) translateY(10px);
  opacity: 0;
  transition: transform var(--transition-base), opacity var(--transition-base);
}

.modal--open {
  transform: scale(1) translateY(0);
  opacity: 1;
}

.modal--closing {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

/* Tamaños */
.modal--sm { width: min(320px, 90vw); }
.modal--md { width: min(480px, 90vw); }
.modal--lg { width: min(640px, 90vw); }
.modal--xl { width: min(800px, 90vw); }

.modal__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-4) var(--space-5);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
}

.modal__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.modal__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: var(--border-radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
  flex-shrink: 0;
}
.modal__close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.modal__close:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}

.modal__body {
  padding: var(--space-5);
  overflow: auto;
  flex: 1;
}

.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-5);
  border-top: 1px solid var(--border-default);
  flex-shrink: 0;
}
`;