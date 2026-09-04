/**
 * Toolbar.ts — Toolbar superior (h=40px)
 * BEM: .toolbar, .toolbar__left, .toolbar__center, .toolbar__right, .toolbar__title, .toolbar__breadcrumb
 */

import { createButton, buttonHTML } from '../ui/Button.js';
import { createIcon, iconHTML } from '../ui/Icon.js';
import { escapeHTML } from '../ui/utils.js';

export interface ToolbarOptions {
  title: string;
  breadcrumb?: Array<{ label: string; onClick?: () => void }>;
  actions?: Array<{
    label?: string;
    icon: string;
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'icon';
    onClick: () => void;
    ariaLabel?: string;
  }>;
  className?: string;
}

/**
 * Crea una toolbar.
 */
export function createToolbar(options: ToolbarOptions): HTMLElement {
  const { title, breadcrumb = [], actions = [], className = '' } = options;

  const toolbar = document.createElement('header');
  toolbar.className = `app-toolbar ${className}`.trim();
  toolbar.setAttribute('role', 'toolbar');

  const left = document.createElement('div');
  left.className = 'app-toolbar__left';
  left.innerHTML = `<span class="app-toolbar__title">${escapeHTML(title)}</span>`;

  // Breadcrumb
  if (breadcrumb.length > 0) {
    const bc = document.createElement('div');
    bc.className = 'app-toolbar__breadcrumb';
    breadcrumb.forEach((item, i) => {
      if (i > 0) {
        bc.innerHTML += `<span class="app-toolbar__breadcrumb-separator">${iconHTML('chevron-right', 12)}</span>`;
      }
      const el = item.onClick ? document.createElement('button') : document.createElement('span');
      el.className = item.onClick ? 'app-toolbar__breadcrumb-link' : 'app-toolbar__breadcrumb-current';
      el.textContent = item.label;
      if (item.onClick) {
        el.addEventListener('click', item.onClick);
      }
      bc.appendChild(el);
    });
    left.appendChild(bc);
  }

  const center = document.createElement('div');
  center.className = 'app-toolbar__center';

  const right = document.createElement('div');
  right.className = 'app-toolbar__right';
  actions.forEach(action => {
    const btn = createButton({
      label: action.label,
      icon: action.icon,
      variant: action.variant || 'icon',
      size: 'sm',
      iconOnly: !action.label,
      onClick: action.onClick,
      ariaLabel: action.ariaLabel,
    });
    right.appendChild(btn);
  });

  toolbar.appendChild(left);
  toolbar.appendChild(center);
  toolbar.appendChild(right);

  return toolbar;
}

export function toolbarHTML(options: ToolbarOptions): string {
  const { title, breadcrumb = [], actions = [], className = '' } = options;
  const bcHTML = breadcrumb.map((item, i) => `
    ${i > 0 ? `<span class="app-toolbar__breadcrumb-separator">${iconHTML('chevron-right', 12)}</span>` : ''}
    <${item.onClick ? 'button' : 'span'} class="app-toolbar__breadcrumb-${item.onClick ? 'link' : 'current'}" ${item.onClick ? 'tabindex="0"' : ''}>${escapeHTML(item.label)}</${item.onClick ? 'button' : 'span'}>
  `).join('');
  const actionsHTML = actions.map(a => buttonHTML({
    label: a.label,
    icon: a.icon,
    variant: a.variant || 'icon',
    size: 'sm',
    iconOnly: !a.label,
    ariaLabel: a.ariaLabel,
  })).join('');
  return `
    <header class="app-toolbar ${className}" role="toolbar">
      <div class="app-toolbar__left">
        <span class="app-toolbar__title">${escapeHTML(title)}</span>
        ${breadcrumb.length > 0 ? `<div class="app-toolbar__breadcrumb">${bcHTML}</div>` : ''}
      </div>
      <div class="app-toolbar__center"></div>
      <div class="app-toolbar__right">${actionsHTML}</div>
    </header>
  `;
}



