/**
 * Panel.ts — Panel con header colapsable
 * BEM: .panel, .panel__header, .panel__title, .panel__actions, .panel__body, .panel--collapsed
 */

import { createButton, buttonHTML } from './Button.js';
import { createIcon, iconHTML } from './Icon.js';
import { escapeHTML } from './utils.js';

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





