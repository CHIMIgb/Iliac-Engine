/**
 * Divider.ts — Línea separadora horizontal/vertical
 * BEM: .divider, .divider--vertical, .divider--with-text
 */

export interface DividerOptions {
  orientation?: 'horizontal' | 'vertical';
  text?: string;
  className?: string;
}

/**
 * Crea un divider.
 */
export function createDivider(options: DividerOptions = {}): HTMLElement {
  const { orientation = 'horizontal', text, className = '' } = options;

  const divider = document.createElement('div');
  divider.className = `divider divider--${orientation} ${text ? 'divider--with-text' : ''} ${className}`.trim();
  divider.setAttribute('role', 'separator');

  if (text) {
    divider.innerHTML = `
      <div class="divider__before"></div>
      <span class="divider__text">${escapeHTML(text)}</span>
      <div class="divider__after"></div>
    `;
  }

  return divider;
}

export function dividerHTML(options: DividerOptions = {}): string {
  const { orientation = 'horizontal', text, className = '' } = options;
  if (text) {
    return `
      <div class="divider divider--${orientation} divider--with-text ${className}" role="separator">
        <div class="divider__before"></div>
        <span class="divider__text">${escapeHTML(text)}</span>
        <div class="divider__after"></div>
      </div>
    `;
  }
  return `<div class="divider divider--${orientation} ${className}" role="separator"></div>`;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

export const dividerCSS = `
/* ==========================================================================
   Divider Component
   ========================================================================== */

.divider {
  display: flex;
  align-items: center;
  color: var(--border-default);
}

.divider--horizontal {
  width: 100%;
  height: 1px;
}

.divider--vertical {
  width: 1px;
  height: 100%;
}

.divider::before,
.divider::after,
.divider__before,
.divider__after {
  content: '';
  flex: 1;
  height: 1px;
  background: currentColor;
}

.divider--vertical::before,
.divider--vertical::after,
.divider--vertical .divider__before,
.divider--vertical .divider__after {
  width: 1px;
  height: auto;
}

.divider--with-text {
  gap: var(--space-3);
  white-space: nowrap;
}

.divider__text {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}
`;