/**
 * BottomTabs.ts — Tabs del panel inferior (Assets, Console, Output, Problems)
 * BEM: .bottom-tabs, .bottom-tabs__header, .bottom-tabs__tab, .bottom-tabs__panel
 */

import { createTabs, type TabsOptions } from '../ui/Tabs.js';
import { createIcon, iconHTML } from '../ui/Icon.js';
import { escapeHTML } from '../ui/utils.js';

export interface BottomTabItem {
  id: string;
  label: string;
  icon?: string;
  content?: HTMLElement | string;
  badge?: number;
}

export interface BottomTabsOptions {
  tabs: BottomTabItem[];
  activeId?: string;
  onChange?: (activeId: string) => void;
  className?: string;
}

export interface BottomTabsInstance {
  element: HTMLElement;
  setActiveTab: (id: string) => void;
  getActiveTab: () => string;
  setBadge: (id: string, count: number) => void;
  destroy: () => void;
}

/**
 * Crea el panel de tabs inferior.
 */
export function createBottomTabs(options: BottomTabsOptions): BottomTabsInstance {
  const { tabs, activeId, onChange, className = '' } = options;

  const container = document.createElement('div');
  container.className = `app-bottom-panel ${className}`.trim();
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.height = 'var(--bottom-panel-h)';
  container.style.minHeight = '120px';
  container.style.maxHeight = '400px';
  container.style.resize = 'vertical';
  container.style.overflow = 'hidden';

  // Convertir a formato Tabs
  const tabsOptions: TabsOptions = {
    tabs: tabs.map(t => ({
      id: t.id,
      label: t.label,
      icon: t.icon,
      content: t.content,
    })),
    activeId,
    onChange,
    vertical: false,
  };

  const tabsComponent = createTabs(tabsOptions);
  container.appendChild(tabsComponent);

  // Añadir badges
  tabs.forEach(tab => {
    if (tab.badge !== undefined && tab.badge > 0) {
      const tabBtn = container.querySelector(`#tab-${tab.id}`);
      if (tabBtn) {
        const badge = document.createElement('span');
        badge.className = 'bottom-tabs__badge';
        badge.textContent = tab.badge > 99 ? '99+' : String(tab.badge);
        tabBtn.appendChild(badge);
      }
    }
  });

  // API
  const instance: BottomTabsInstance = {
    element: container,
    setActiveTab: (id: string) => {
      (tabsComponent as any).setActiveTab(id);
    },
    getActiveTab: () => (tabsComponent as any).getActiveTab(),
    setBadge: (id: string, count: number) => {
      const tabBtn = container.querySelector(`#tab-${id}`);
      if (tabBtn) {
        let badge = tabBtn.querySelector('.bottom-tabs__badge');
        if (count > 0) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'bottom-tabs__badge';
            tabBtn.appendChild(badge);
          }
          badge.textContent = count > 99 ? '99+' : String(count);
        } else if (badge) {
          badge.remove();
        }
      }
    },
    destroy: () => container.remove(),
  };

  return instance;
}

export function bottomTabsHTML(options: BottomTabsOptions): string {
  // Usar tabsHTML interno
  const { tabs, activeId, className = '' } = options;
  const tabsOptions = {
    tabs: tabs.map(t => ({ id: t.id, label: t.label, icon: t.icon, content: t.content })),
    activeId,
    vertical: false,
  };
  return `<div class="app-bottom-panel ${className}">${tabsHTML(tabsOptions)}</div>`;
}

// Re-exportar tabsHTML/iconHTML para uso interno
function tabsHTML(options: any): string {
  const { tabs, activeId, vertical = false } = options;
  const currentActive = activeId || tabs[0]?.id || '';
  const headerTabs = tabs.map((tab: any) => {
    const isActive = tab.id === currentActive;
    const icon = tab.icon ? `<span class="tabs__tab-icon" aria-hidden="true">${iconHTML(tab.icon, 16)}</span>` : '';
    const badge = tab.badge ? `<span class="bottom-tabs__badge">${tab.badge > 99 ? '99+' : tab.badge}</span>` : '';
    return `<button type="button" class="tabs__tab ${isActive ? 'tabs__tab--active' : ''}" id="tab-${tab.id}" role="tab" aria-selected="${isActive}" aria-controls="panel-${tab.id}" tabindex="${isActive ? '0' : '-1'}">${icon}<span class="tabs__tab-label">${escapeHTML(tab.label)}</span>${badge}</button>`;
  }).join('');
  const panels = tabs.map((tab: any) => {
    const isActive = tab.id === currentActive;
    let content = '';
    if (tab.content instanceof HTMLElement) content = tab.content.outerHTML;
    else if (typeof tab.content === 'string') content = tab.content;
    return `<div class="tabs__panel ${isActive ? 'tabs__panel--active' : ''}" id="panel-${tab.id}" role="tabpanel" aria-labelledby="tab-${tab.id}" ${!isActive ? 'hidden' : ''}>${content}</div>`;
  }).join('');
  return `<div class="tabs ${vertical ? 'tabs--vertical' : ''}" role="tablist"><div class="tabs__header" role="tablist">${headerTabs}</div><div class="tabs__panels">${panels}</div></div>`;
}



