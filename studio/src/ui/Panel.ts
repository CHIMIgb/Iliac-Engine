/**
 * Panel.ts — Panel con header colapsable
 * BEM: .panel, .panel__header, .panel__title, .panel__actions, .panel__body, .panel--collapsed
 */

import { createButton, buttonHTML } from './Button.js';
import { createIcon, iconHTML } from './Icon.js';

export interface PanelOptions {
  title: string;
  icon?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  actions?: Array<{ label?: string; icon: string; onClick: () => void; variant?: 'ghost' | 'icon'; ariaLabel?: string }>;
  content?: HTMLElement | string;
  className?: string;
  onToggle?: (collapsed: boolean) => void;
}

export interface PanelInstance {
  element: HTMLElement;
  setCollapsed: (collapsed: boolean) => void;
  toggle: () => void;
  setContent: (content: HTMLElement | string) => void;
  setTitle: (title: string) => void;
  destroy: () => void;
}

/**
 * Crea un panel y retorna la instancia para controlarlo.
 */
export function createPanel(options: PanelOptions): PanelInstance {
  const { title, icon, collapsible = true, collapsed = false, actions = [], content, className = '', onToggle } = options;

  const panel = document.createElement('div');
  panel.className = `panel ${collapsed ? 'panel--collapsed' : ''} ${className}`.trim();

  const header = document.createElement('div');
  header.className = 'panel__header';
  header.innerHTML = `
    <div class="panel__title-wrapper">
      ${icon ? `<span class="panel__icon" aria-hidden="true">${iconHTML(icon, 16)}</span>` : ''}
      <h3 class="panel__title">${escapeHTML(title)}</h3>
    </div>
    <div class="panel__actions"></div>
    ${collapsible ? `<button type="button" class="panel__toggle" aria-label="${collapsed ? 'Expandir' : 'Colapsar'}" aria-expanded="${!collapsed}">${iconHTML('chevron-down', 16)}</button>` : ''}
  `;

  const actionsContainer = header.querySelector('.panel__actions')!;
  actions.forEach(action => {
    const btn = createButton({
      icon: action.icon,
      variant: action.variant || 'ghost',
      size: 'sm',
      iconOnly: true,
      onClick: action.onClick,
      ariaLabel: action.ariaLabel || action.icon,
    });
    actionsContainer.appendChild(btn);
  });

  const body = document.createElement('div');
  body.className = 'panel__body';
  if (content instanceof HTMLElement) {
    body.appendChild(content);
  } else if (typeof content === 'string') {
    body.innerHTML = content;
  }

  panel.appendChild(header);
  panel.appendChild(body);

  const toggleBtn = header.querySelector('.panel__toggle') as HTMLButtonElement;

  function setCollapsed(newCollapsed: boolean) {
    panel.classList.toggle('panel--collapsed', newCollapsed);
    if (toggleBtn) {
      toggleBtn.setAttribute('aria-expanded', String(!newCollapsed));
      toggleBtn.setAttribute('aria-label', newCollapsed ? 'Expandir' : 'Colapsar');
    }
    onToggle?.(newCollapsed);
  }

  function toggle() {
    setCollapsed(!panel.classList.contains('panel--collapsed'));
  }

  if (collapsible && toggleBtn) {
    toggleBtn.addEventListener('click', toggle);
  }

  const instance: PanelInstance = {
    element: panel,
    setCollapsed,
    toggle,
    setContent: (newContent) => {
      body.innerHTML = '';
      if (newContent instanceof HTMLElement) body.appendChild(newContent);
      else body.innerHTML = newContent;
    },
    setTitle: (newTitle) => {
      const titleEl = header.querySelector('.panel__title');
      if (titleEl) titleEl.textContent = newTitle;
    },
    destroy: () => panel.remove(),
  };

  return instance;
}

export function panelHTML(options: PanelOptions): string {
  const { title, icon, collapsible = true, collapsed = false, actions = [], content = '', className = '' } = options;
  const actionsHTML = actions.map(a => buttonHTML({
    icon: a.icon,
    variant: a.variant || 'ghost',
    size: 'sm',
    iconOnly: true,
    ariaLabel: a.ariaLabel || a.icon,
  })).join('');
  return `
    <div class="panel ${collapsed ? 'panel--collapsed' : ''} ${className}">
      <div class="panel__header">
        <div class="panel__title-wrapper">
          ${icon ? `<span class="panel__icon" aria-hidden="true">${iconHTML(icon, 16)}</span>` : ''}
          <h3 class="panel__title">${escapeHTML(title)}</h3>
        </div>
        <div class="panel__actions">${actionsHTML}</div>
        ${collapsible ? `<button type="button" class="panel__toggle" aria-label="${collapsed ? 'Expandir' : 'Colapsar'}" aria-expanded="${!collapsed}">${iconHTML('chevron-down', 16)}</button>` : ''}
      </div>
      <div class="panel__body">${content}</div>
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
    'chevron-down': 'M6 9l6 6 6-6',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    folder: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z',
    save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M14 9l-5-5-5 5M12 3v12',
    trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    'alert-triangle': 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z',
    search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    layout: 'M3 3h18v18H3zM12 3v18M3 12h18',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 16a4 4 0 110-8 4 4 0 010 8z',
    layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    grid: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
    settings: 'M12.22 2h-.44a2 2 0 0 0-2 2v.44a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM21 10.22V9.78a2 2 0 0 0-2-2h-.44a2 2 0 0 0-2 2v.44a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2zm-8 10h.44a2 2 0 0 0 2-2v-.44a2 2 0 0 0-2-2h-.44a2 2 0 0 0-2 2v.44a2 2 0 0 0 2 2zm-10 0h.44a2 2 0 0 0 2-2v-.44a2 2 0 0 0-2-2h-.44a2 2 0 0 0-2 2v.44a2 2 0 0 0 2 2z',
  };
  const path = ICON_PATHS[name] || ICON_PATHS['chevron-down'];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"></path></svg>`;
}

export const panelCSS = `
/* ==========================================================================
   Panel Component
   ========================================================================== */

.panel {
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border: 1px solid var(--border-default);
  border-radius: var(--border-radius-md);
  overflow: hidden;
}

.panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-2) var(--space-3);
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border-default);
  flex-shrink: 0;
  min-height: var(--panel-header-h);
}

.panel__title-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex: 1;
  min-width: 0;
}

.panel__icon {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.panel__title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.panel__actions {
  display: flex;
  gap: var(--space-1);
  flex-shrink: 0;
}

.panel__toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: var(--border-radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast), transform var(--transition-fast);
  flex-shrink: 0;
}
.panel__toggle:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.panel__toggle:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: 2px;
}
.panel--collapsed .panel__toggle {
  transform: rotate(-90deg);
}

.panel__body {
  padding: var(--panel-padding);
  overflow: auto;
  transition: opacity var(--transition-fast), max-height var(--transition-base);
}

.panel--collapsed .panel__body {
  display: none;
}
`;