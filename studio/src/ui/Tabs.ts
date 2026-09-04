/**
 * Tabs.ts — Tabs con header + contenido
 * BEM: .tabs, .tabs__header, .tabs__tab, .tabs__tab--active, .tabs__panel
 */

import { escapeHTML } from './utils.js';
import { iconHTML } from './Icon.js';
export interface TabItem {
  id: string;
  label: string;
  icon?: string;      // Nombre icono Lucide
  disabled?: boolean;
  content?: HTMLElement | string; // HTMLElement o HTML string
}

export interface TabsOptions {
  tabs: TabItem[];
  activeId?: string;
  onChange?: (activeId: string) => void;
  className?: string;
  vertical?: boolean;
}

/**
 * Crea un componente Tabs y retorna el contenedor.
 */
export function createTabs(options: TabsOptions): HTMLElement {
  const { tabs, activeId, onChange, className = '', vertical = false } = options;

  const container = document.createElement('div');
  container.className = `tabs ${vertical ? 'tabs--vertical' : ''} ${className}`.trim();
  container.setAttribute('role', 'tablist');

  // Header
  const header = document.createElement('div');
  header.className = 'tabs__header';
  header.setAttribute('role', 'tablist');

  // Panels container
  const panels = document.createElement('div');
  panels.className = 'tabs__panels';

  let currentActive = activeId || tabs[0]?.id || '';

  tabs.forEach((tab, index) => {
    const isActive = tab.id === currentActive;
    const isDisabled = tab.disabled || false;

    // Tab button
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tabs__tab ${isActive ? 'tabs__tab--active' : ''} ${isDisabled ? 'tabs__tab--disabled' : ''}`.trim();
    btn.id = `tab-${tab.id}`;
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', String(isActive));
    btn.setAttribute('aria-controls', `panel-${tab.id}`);
    btn.setAttribute('tabindex', isActive ? '0' : '-1');
    if (isDisabled) btn.disabled = true;

    let tabContent = '';
    if (tab.icon) {
      tabContent += `<span class="tabs__tab-icon" aria-hidden="true">${iconHTML(tab.icon, 16)}</span>`;
    }
    tabContent += `<span class="tabs__tab-label">${escapeHTML(tab.label)}</span>`;
    btn.innerHTML = tabContent;

    btn.addEventListener('click', () => {
      if (isDisabled) return;
      setActiveTab(tab.id);
    });

    btn.addEventListener('keydown', (e) => {
      if (isDisabled) return;
      let newIndex = index;
      if (vertical) {
        if (e.key === 'ArrowDown') newIndex = (index + 1) % tabs.length;
        else if (e.key === 'ArrowUp') newIndex = (index - 1 + tabs.length) % tabs.length;
      } else {
        if (e.key === 'ArrowRight') newIndex = (index + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') newIndex = (index - 1 + tabs.length) % tabs.length;
      }
      if (newIndex !== index && !tabs[newIndex]!.disabled) {
        e.preventDefault();
        tabs[newIndex]!.id && setActiveTab(tabs[newIndex]!.id);
      }
    });

    header.appendChild(btn);

    // Panel
    const panel = document.createElement('div');
    panel.className = `tabs__panel ${isActive ? 'tabs__panel--active' : ''}`;
    panel.id = `panel-${tab.id}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `tab-${tab.id}`);
    panel.hidden = !isActive;

    if (tab.content instanceof HTMLElement) {
      panel.appendChild(tab.content);
    } else if (typeof tab.content === 'string') {
      panel.innerHTML = tab.content;
    }

    panels.appendChild(panel);
  });

  container.appendChild(header);
  container.appendChild(panels);

  function setActiveTab(id: string) {
    if (currentActive === id) return;
    const prevTab = container.querySelector(`#tab-${currentActive}`);
    const prevPanel = container.querySelector(`#panel-${currentActive}`);
    const newTab = container.querySelector(`#tab-${id}`);
    const newPanel = container.querySelector(`#panel-${id}`);

    if (prevTab) {
      prevTab.classList.remove('tabs__tab--active');
      prevTab.setAttribute('aria-selected', 'false');
      prevTab.setAttribute('tabindex', '-1');
    }
    if (prevPanel) {
      prevPanel.classList.remove('tabs__panel--active');
      (prevPanel as HTMLElement).hidden = true;
    }
    if (newTab) {
      newTab.classList.add('tabs__tab--active');
      newTab.setAttribute('aria-selected', 'true');
      newTab.setAttribute('tabindex', '0');
      (newTab as HTMLElement).focus();
    }
    if (newPanel) {
      newPanel.classList.add('tabs__panel--active');
      (newPanel as HTMLElement).hidden = false;
    }
    currentActive = id;
    onChange?.(id);
  }

  // Exponer API pública
  (container as any).setActiveTab = setActiveTab;
  (container as any).getActiveTab = () => currentActive;

  return container;
}

/**
 * Renderiza tabs como HTML string.
 */
export function tabsHTML(options: TabsOptions): string {
  const { tabs, activeId, vertical = false } = options;
  const currentActive = activeId || tabs[0]?.id || '';

  const headerTabs = tabs.map(tab => {
    const isActive = tab.id === currentActive;
    const isDisabled = tab.disabled || false;
    const icon = tab.icon ? `<span class="tabs__tab-icon" aria-hidden="true">${iconHTML(tab.icon, 16)}</span>` : '';
    return `
      <button type="button"
        class="tabs__tab ${isActive ? 'tabs__tab--active' : ''} ${isDisabled ? 'tabs__tab--disabled' : ''}"
        id="tab-${tab.id}"
        role="tab"
        aria-selected="${isActive}"
        aria-controls="panel-${tab.id}"
        tabindex="${isActive ? '0' : '-1'}"
        ${isDisabled ? 'disabled' : ''}>
        ${icon}<span class="tabs__tab-label">${escapeHTML(tab.label)}</span>
      </button>
    `;
  }).join('');

  const panels = tabs.map(tab => {
    const isActive = tab.id === currentActive;
    let content = '';
    if (tab.content instanceof HTMLElement) {
      content = tab.content.outerHTML;
    } else if (typeof tab.content === 'string') {
      content = tab.content;
    }
    return `
      <div class="tabs__panel ${isActive ? 'tabs__panel--active' : ''}"
        id="panel-${tab.id}"
        role="tabpanel"
        aria-labelledby="tab-${tab.id}"
        ${!isActive ? 'hidden' : ''}>
        ${content}
      </div>
    `;
  }).join('');

  return `
    <div class="tabs ${vertical ? 'tabs--vertical' : ''}" role="tablist">
      <div class="tabs__header" role="tablist">${headerTabs}</div>
      <div class="tabs__panels">${panels}</div>
    </div>
  `;
}

// Importa iconHTML desde Icon.js (arriba)



