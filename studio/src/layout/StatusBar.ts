/**
 * StatusBar.ts — Status bar inferior (h=24px)
 * BEM: .statusbar, .statusbar__left, .statusbar__right, .statusbar__item
 */

import { createIcon, iconHTML } from '../ui/Icon.js';

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
    'cpu': 'M12 2a2 2 0 00-2 2v2a2 2 0 002 2h4a2 2 0 002-2V4a2 2 0 00-2-2h-4a2 2 0 00-2-2zM12 16a2 2 0 01-2-2v-2a2 2 0 012-2h4a2 2 0 012 2v2a2 2 0 01-2 2h-4a2 2 0 01-2-2z',
    'memory': 'M6 2v2a2 2 0 002 2h8a2 2 0 002-2V2a2 2 0 00-2-2H8a2 2 0 00-2 2zm0 16v-2a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2H8a2 2 0 01-2-2zm-4-8v8a2 2 0 002 2h8a2 2 0 002-2v-8a2 2 0 00-2-2H8a2 2 0 00-2 2z',
    'globe': 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM12 12a3 3 0 100-6 3 3 0 000 6z',
    'user': 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 7a4 4 0 100 8 4 4 0 000-8z',
  };
  const path = ICON_PATHS[name] || ICON_PATHS.globe;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"></path></svg>`;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}