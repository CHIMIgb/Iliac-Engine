/**
 * Tabs.ts — Tabs con header + contenido
 * BEM: .tabs, .tabs__header, .tabs__tab, .tabs__tab--active, .tabs__panel
 */

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
      if (newIndex !== index && !tabs[newIndex].disabled) {
        e.preventDefault();
        tabs[newIndex].id && setActiveTab(tabs[newIndex].id);
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
      prevPanel.hidden = true;
    }
    if (newTab) {
      newTab.classList.add('tabs__tab--active');
      newTab.setAttribute('aria-selected', 'true');
      newTab.setAttribute('tabindex', '0');
      newTab.focus();
    }
    if (newPanel) {
      newPanel.classList.add('tabs__panel--active');
      newPanel.hidden = false;
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

// Helper para iconHTML (evitar importación circular)
function iconHTML(name: string, size: number = 16): string {
  const ICON_PATHS: Record<string, string> = {
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z',
    folder: 'M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z',
    save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M14 9l-5-5-5 5M12 3v12',
    trash: 'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2',
    undo: 'M3 7v6h6M3 13a9 9 0 1 0 2.7-6.3L3 7',
    redo: 'M21 7v6h-6M21 13a9 9 0 1 1-2.7-6.3L21 7',
    copy: 'M16 1H4a2 2 0 0 0-2 2v14h2M8 1H8a2 2 0 0 1 2 2v2M16 1h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2',
    paste: 'M9 9H5a2 2 0 0 1-2-2V3a2 2 0 0 1 2-2h4M15 15h4a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-4v4a2 2 0 0 1-2 2',
    cut: 'M6 3h12M6 3v12M18 3v12',
    search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 16a4 4 0 110-8 4 4 0 010 8z',
    'eye-off': 'M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11a18.5 18.5 0 01-2.16 7.12M1 1l22 22',
    maximize: 'M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3',
    minimize: 'M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1-2-2h3M3 16h3a2 2 0 0 1 2 2v3',
    grid: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
    list: 'M3 12h18M3 6h18M3 18h18',
    move: 'M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l3 3-3 3M19 9l3 3-3 3M2 12h20M12 2v20',
    rotate: 'M23 4v6M1 18v6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15',
    scale: 'M3 3h6v6M21 3h-6v6M3 21v-6h6M21 21h-6v-6',
    cursor: 'M13.5 21.5a.5.5 0 01-.5-.5V13a1 1 0 011-1h4a1 1 0 011 1v8a.5.5 0 01-.5.5h-4a.5.5 0 01-.5-.5zM5 5l3.5 3.5M9.5 9.5l1.5 1.5M15 15l1.5 1.5',
    brush: 'M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 2a8 8 0 118 8 8 8 0 01-8-8z',
    check: 'M20 6L9 17l-5-5',
    x: 'M18 6L6 18M6 6l12 12',
    'alert-triangle': 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
    info: 'M13 16h-2v-4h2M13 12h-2v-2h2M12 2a10 10 0 100 20 10 10 0 000-20z',
    loader: 'M21 12a9 9 0 11-6.219-8.56',
    'chevron-down': 'M6 9l6 6 6-6',
    'chevron-right': 'M9 18l6-6-6-6',
    'chevron-left': 'M15 18l-6-6 6-6',
    'chevron-up': 'M18 15l-6-6-6 6',
    'arrow-left': 'M19 12H5M12 19l-7-7 7-7',
    'arrow-right': 'M5 12h14M12 5l7 7-7 7',
    'arrow-up': 'M12 19V5M5 12l7-7 7 7',
    'arrow-down': 'M12 5v14M19 12l-7 7-7-7',
    play: 'M5 3l14 9-14 9z',
    pause: 'M6 4h4v16H6zm8 0h4v16h-4z',
    stop: 'M6 4h16v16H6z',
    'skip-forward': 'M6 4v16l10-8zM19 4v16',
    'volume-2': 'M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a7 7 0 010 12.14M15.54 8.46a3 3 0 010 4.24',
    'volume-x': 'M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a7 7 0 010 12.14M15.54 8.46a3 3 0 010 4.24',
  };
  const path = ICON_PATHS[name] || ICON_PATHS['alert-triangle'];
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex:none;display:block"><path d="${path}"></path></svg>`;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

export const tabsCSS = `
/* ==========================================================================
   Tabs Component
   ========================================================================== */

.tabs {
  display: flex;
  flex-direction: column;
  background: var(--bg-panel);
  border: 1px solid var(--border-default);
  border-radius: var(--border-radius-md);
  overflow: hidden;
}

.tabs--vertical {
  flex-direction: row;
}

.tabs__header {
  display: flex;
  background: var(--bg-panel);
  border-bottom: 1px solid var(--border-default);
  overflow-x: auto;
}

.tabs--vertical .tabs__header {
  flex-direction: column;
  border-bottom: none;
  border-right: 1px solid var(--border-default);
  min-width: 160px;
}

.tabs__tab {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-4);
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  font-family: var(--font-ui);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: color var(--transition-fast), border-color var(--transition-fast), background var(--transition-fast);
  white-space: nowrap;
}

.tabs--vertical .tabs__tab {
  border-bottom: none;
  border-right: 2px solid transparent;
  justify-content: flex-start;
}

.tabs__tab:hover:not(.tabs__tab--disabled):not(.tabs__tab--active) {
  color: var(--text-secondary);
  background: var(--bg-hover);
}

.tabs__tab--active {
  color: var(--text-primary);
  border-bottom-color: var(--accent-primary);
  background: var(--bg-panel);
}

.tabs--vertical .tabs__tab--active {
  border-bottom-color: transparent;
  border-right-color: var(--accent-primary);
}

.tabs__tab--disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tabs__tab:focus-visible {
  outline: 2px solid var(--border-focus);
  outline-offset: -2px;
  z-index: 1;
}

.tabs__tab-icon {
  flex-shrink: 0;
}

.tabs__panels {
  flex: 1;
  overflow: auto;
  background: var(--bg-panel);
}

.tabs__panel {
  padding: var(--space-4);
  animation: fadeIn var(--transition-base);
}

.tabs__panel[hidden] {
  display: none;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}
`;