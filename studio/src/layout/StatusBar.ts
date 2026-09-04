/**
 * StatusBar.ts — Status bar inferior (h=24px)
 * BEM: .statusbar, .statusbar__left, .statusbar__right, .statusbar__item
 */

import { createIcon, iconHTML } from '../ui/Icon.js';
import { escapeHTML } from '../ui/utils.js';

export interface StatusBarItem {
  icon?: string;
  text: string;
  onClick?: () => void;
}

export interface StatusBarOptions {
  left?: StatusBarItem[];
  right?: StatusBarItem[];
  className?: string;
}

/**
 * Crea una status bar.
 */
export function createStatusBar(options: StatusBarOptions = {}): HTMLElement {
  const { left = [], right = [], className = '' } = options;

  const statusbar = document.createElement('footer');
  statusbar.className = `app-statusbar ${className}`.trim();
  statusbar.setAttribute('role', 'status');

  const leftContainer = document.createElement('div');
  leftContainer.className = 'app-statusbar__left';
  left.forEach(item => {
    const el = document.createElement('div');
    el.className = 'app-statusbar__item';
    if (item.icon) el.innerHTML += `<span class="app-statusbar__icon" aria-hidden="true">${iconHTML(item.icon, 14)}</span>`;
    el.innerHTML += `<span class="app-statusbar__text">${escapeHTML(item.text)}</span>`;
    if (item.onClick) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', item.onClick);
    }
    leftContainer.appendChild(el);
  });

  const rightContainer = document.createElement('div');
  rightContainer.className = 'app-statusbar__right';
  right.forEach(item => {
    const el = document.createElement('div');
    el.className = 'app-statusbar__item';
    if (item.icon) el.innerHTML += `<span class="app-statusbar__icon" aria-hidden="true">${iconHTML(item.icon, 14)}</span>`;
    el.innerHTML += `<span class="app-statusbar__text">${escapeHTML(item.text)}</span>`;
    if (item.onClick) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', item.onClick);
    }
    rightContainer.appendChild(el);
  });

  statusbar.appendChild(leftContainer);
  statusbar.appendChild(rightContainer);

  return statusbar;
}

export function statusBarHTML(options: StatusBarOptions = {}): string {
  const { left = [], right = [], className = '' } = options;
  const renderItems = (items: StatusBarItem[]) => items.map(item => `
    <div class="app-statusbar__item" ${item.onClick ? 'style="cursor:pointer"' : ''}>
      ${item.icon ? `<span class="app-statusbar__icon" aria-hidden="true">${iconHTML(item.icon, 14)}</span>` : ''}
      <span class="app-statusbar__text">${escapeHTML(item.text)}</span>
    </div>
  `).join('');
  return `
    <footer class="app-statusbar ${className}" role="status">
      <div class="app-statusbar__left">${renderItems(left)}</div>
      <div class="app-statusbar__right">${renderItems(right)}</div>
    </footer>
  `;
}




