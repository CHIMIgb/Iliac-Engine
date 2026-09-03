/**
 * ComponentsDemo.ts — Demo page para /components
 * Muestra todos los componentes en todos sus estados
 */

import './style.css';
import {
  createButton, createInput, createTabs, createTable, createModal,
  createEmptyState, createErrorState, createLoadingState,
  createSpinner, createSkeleton, createProgressBar,
  createPanel, createSplitView, createStack, createGrid,
  createScrollArea, createDivider, createToast,
  showToast, toast,
} from '../ui/index.js';
import { createAppLayout } from '../layout/AppLayout.js';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found');

// Helper para crear secciones
function section(title: string, content: HTMLElement): HTMLElement {
  const sec = document.createElement('section');
  sec.style.marginBottom = 'var(--space-8)';
  sec.innerHTML = `<h2 style="font-size:var(--font-size-lg);font-weight:var(--font-weight-semibold);color:var(--text-primary);margin-bottom:var(--space-4);padding-bottom:var(--space-2);border-bottom:1px solid var(--border-default)">${title}</h2>`;
  sec.appendChild(content);
  return sec;
}

function grid(...children: HTMLElement[]): HTMLElement {
  const div = document.createElement('div');
  div.style.display = 'grid';
  div.style.gridTemplateColumns = 'repeat(auto-fit, minmax(280px, 1fr))';
  div.style.gap = 'var(--space-4)';
  children.forEach(c => div.appendChild(c));
  return div;
}

function card(title: string, content: HTMLElement): HTMLElement {
  const div = document.createElement('div');
  div.style.background = 'var(--bg-panel)';
  div.style.border = '1px solid var(--border-default)';
  div.style.borderRadius = 'var(--border-radius-md)';
  div.style.padding = 'var(--space-4)';
  div.style.display = 'flex';
  div.style.flexDirection = 'column';
  div.style.gap = 'var(--space-3)';
  div.innerHTML = `<h3 style="font-size:var(--font-size-sm);font-weight:var(--font-weight-semibold);color:var(--text-secondary);margin:0">${title}</h3>`;
  div.appendChild(content);
  return div;
}

// ============================================================================
// BUTTONS DEMO
// ============================================================================
const buttonsDemo = grid(
  card('Variants (md)', (() => {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexWrap = 'wrap';
    wrap.style.gap = 'var(--space-2)';
    ['primary', 'secondary', 'danger', 'ghost', 'icon'].forEach(v => {
      wrap.appendChild(createButton({ variant: v as any, label: v, icon: v === 'icon' ? 'save' : undefined, iconOnly: v === 'icon' }));
    });
    return wrap;
  })()),
  card('Sizes (primary)', (() => {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = 'var(--space-2)';
    ['sm', 'md', 'lg'].forEach(s => wrap.appendChild(createButton({ variant: 'primary', label: s, size: s as any })));
    return wrap;
  })()),
  card('States', (() => {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexWrap = 'wrap';
    wrap.style.gap = 'var(--space-2)';
    const normal = createButton({ variant: 'primary', label: 'Normal' });
    const hover = createButton({ variant: 'primary', label: 'Hover (simulated)', className: 'btn--hover-sim' });
    const disabled = createButton({ variant: 'primary', label: 'Disabled', disabled: true });
    const loading = createButton({ variant: 'primary', label: 'Loading', loading: true });
    wrap.append(normal, hover, disabled, loading);
    // Simular hover con clase
    hover.addEventListener('mouseenter', () => hover.classList.add('btn--hover-sim'));
    hover.addEventListener('mouseleave', () => hover.classList.remove('btn--hover-sim'));
    return wrap;
  })()),
  card('With Icons', (() => {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexWrap = 'wrap';
    wrap.style.gap = 'var(--space-2)';
    ['save', 'download', 'upload', 'trash', 'copy', 'paste', 'undo', 'redo'].forEach(icon => {
      wrap.appendChild(createButton({ variant: 'secondary', icon, iconOnly: true, ariaLabel: icon }));
    });
    return wrap;
  })()),
);

// ============================================================================
// INPUTS DEMO
// ============================================================================
const inputsDemo = grid(
  card('TextInput', createInput({ id: 'demo-text', type: 'text', label: 'Nombre', placeholder: 'Escribe algo...', value: 'Valor inicial', help: 'Texto de ayuda' })),
  card('NumberInput', createInput({ id: 'demo-num', type: 'number', label: 'Cantidad', value: 42, min: 0, max: 100, step: 1, help: 'Entre 0 y 100' })),
  card('Select', createInput({ id: 'demo-sel', type: 'select', label: 'Opción', options: [{ value: 'a', label: 'Opción A' }, { value: 'b', label: 'Opción B' }, { value: 'c', label: 'Opción C' }], value: 'b', placeholder: 'Selecciona...' })),
  card('Checkbox', createInput({ id: 'demo-chk', type: 'checkbox', label: 'Acepto términos', checked: true })),
  card('Slider', createInput({ id: 'demo-sld', type: 'slider', label: 'Volumen', value: 65, min: 0, max: 100, step: 5, showValue: true })),
  card('ColorInput', createInput({ id: 'demo-col', type: 'color', label: 'Color', value: '#89b4fa' })),
  card('FileInput (dropzone)', createInput({ id: 'demo-file', type: 'file', label: 'Archivo', accept: 'image/*,.json', dropZone: true, multiple: true })),
  card('Error State', createInput({ id: 'demo-err', type: 'text', label: 'Email', value: 'invalido', error: 'Formato de email inválido', required: true })),
);

// ============================================================================
// TABS DEMO
// ============================================================================
const tabsDemo = createTabs({
  tabs: [
    { id: 'tab1', label: 'Assets', icon: 'folder', content: '<p style="padding:var(--space-4)">Contenido de Assets</p>' },
    { id: 'tab2', label: 'Console', icon: 'terminal', content: '<p style="padding:var(--space-4)">Logs del sistema...</p>' },
    { id: 'tab3', label: 'Output', icon: 'code', content: '<p style="padding:var(--space-4)">Build output...</p>' },
    { id: 'tab4', label: 'Problems', icon: 'alert-triangle', content: '<p style="padding:var(--space-4)">Sin problemas</p>' },
  ],
  activeId: 'tab1',
  onChange: (id) => console.log('Tab:', id),
});

// ============================================================================
// TABLE DEMO
// ============================================================================
const tableDemo = createTable({
  columns: [
    { key: 'name', header: 'Nombre', sortable: true },
    { key: 'type', header: 'Tipo', sortable: true, width: '120px' },
    { key: 'size', header: 'Tamaño', sortable: true, width: '100px', align: 'right' },
    { key: 'modified', header: 'Modificado', sortable: true, width: '160px' },
  ],
  data: [
    { name: 'textures', type: 'Folder', size: '—', modified: '2024-01-15 10:30' },
    { name: 'player.png', type: 'Image', size: '12 KB', modified: '2024-01-14 09:15' },
    { name: 'enemy.png', type: 'Image', size: '18 KB', modified: '2024-01-14 09:15' },
    { name: 'jump.wav', type: 'Audio', size: '45 KB', modified: '2024-01-13 14:22' },
    { name: 'level1.json', type: 'JSON', size: '3 KB', modified: '2024-01-15 08:00' },
  ],
  keyField: 'name',
  selectable: true,
  onSelect: (ids) => console.log('Selected:', ids),
  onRowClick: (row) => showToast({ message: `Clicked: ${row.name}`, variant: 'info' }),
  emptyMessage: 'No hay archivos',
  emptyAction: { label: 'Importar', onClick: () => showToast({ message: 'Importar archivos...', variant: 'info' }) },
});

// ============================================================================
// EMPTY / ERROR / LOADING STATES
// ============================================================================
const statesDemo = grid(
  card('EmptyState', createEmptyState({
    icon: 'folder',
    title: 'No hay proyectos',
    description: 'Crea tu primer proyecto para empezar',
    action: { label: 'Nuevo proyecto', variant: 'primary', onClick: () => showToast({ message: 'Crear proyecto...', variant: 'info' }) },
  })),
  card('ErrorState', createErrorState({
    title: 'Error al cargar',
    description: 'No se pudo conectar con el servidor',
    details: 'Error: connect ECONNREFUSED 127.0.0.1:3000\n    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1494:16)',
    onRetry: () => showToast({ message: 'Reintentando...', variant: 'info' }),
    onDetails: () => showToast({ message: 'Detalles expandidos', variant: 'info' }),
  })),
  card('LoadingState', createLoadingState({ text: 'Cargando proyecto...', size: 'lg' })),
);

// ============================================================================
// SPINNER / SKELETON / PROGRESS
// ============================================================================
const feedbackDemo = grid(
  card('Spinners', (() => {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.alignItems = 'center';
    wrap.style.gap = 'var(--space-4)';
    ['sm', 'md', 'lg'].forEach(s => wrap.appendChild(createSpinner({ size: s as any, label: `Spinner ${s}` })));
    return wrap;
  })()),
  card('Skeletons', (() => {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = 'var(--space-3)';
    wrap.appendChild(createSkeleton({ variant: 'text', lines: 3, animated: true }));
    wrap.appendChild(createSkeleton({ variant: 'rect', width: '100%', height: 60, animated: true }));
    wrap.appendChild(createSkeleton({ variant: 'circle', width: 48, height: 48, animated: true }));
    return wrap;
  })()),
  card('Progress Bars', (() => {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = 'var(--space-3)';
    [0, 25, 50, 75, 100].forEach(v => wrap.appendChild(createProgressBar({ value: v, max: 100, showLabel: true })));
    wrap.appendChild(createProgressBar({ value: 0, indeterminate: true, label: 'Indeterminado' }));
    return wrap;
  })()),
);

// ============================================================================
// PANEL / SPLITVIEW / STACK / GRID / SCROLLAREA / DIVIDER
// ============================================================================
const layoutDemo = grid(
  card('Panel (colapsable)', (() => {
    const panel = createPanel({
      title: 'Panel de prueba',
      icon: 'folder',
      content: '<p style="padding:var(--space-2);color:var(--text-secondary)">Contenido del panel. Se puede colapsar con el botón ▼</p>',
      collapsible: true,
    });
    const wrap = document.createElement('div');
    wrap.style.minHeight = '200px';
    wrap.appendChild((panel as any).element || panel);
    return wrap;
  })()),
  card('SplitView (horizontal)', (() => {
    const split = createSplitView({
      direction: 'horizontal',
      panes: [
        { content: '<div style="height:150px;background:var(--bg-surface);display:flex;align-items:center;justify-content:center;color:var(--text-muted)">Panel Izquierdo (min 200px)</div>', minSize: 150, defaultSize: 200 },
        { content: '<div style="height:150px;background:var(--bg-primary);display:flex;align-items:center;justify-content:center;color:var(--text-muted)">Panel Central (flex: 1)</div>', minSize: 200 },
        { content: '<div style="height:150px;background:var(--bg-surface);display:flex;align-items:center;justify-content:center;color:var(--text-muted)">Panel Derecho (min 180px)</div>', minSize: 150, defaultSize: 220 },
      ],
    });
    const wrap = document.createElement('div');
    wrap.style.height = '150px';
    wrap.appendChild((split as any).element || split);
    return wrap;
  })()),
  card('Stack', (() => {
    const stack = createStack({ direction: 'horizontal', gap: 12, wrap: true });
    ['Uno', 'Dos', 'Tres', 'Cuatro', 'Cinco'].forEach(t => {
      const btn = createButton({ variant: 'secondary', label: t, size: 'sm' });
      stack.appendChild(btn);
    });
    return stack;
  })()),
  card('Grid', (() => {
    const gridComp = createGrid({ columns: 3, gap: 12, minColumnWidth: 150 });
    Array.from({ length: 6 }, (_, i) => i + 1).forEach(n => {
      const item = document.createElement('div');
      item.style.background = 'var(--bg-surface)';
      item.style.border = '1px solid var(--border-default)';
      item.style.borderRadius = 'var(--border-radius-md)';
      item.style.padding = 'var(--space-4)';
      item.style.textAlign = 'center';
      item.textContent = `Item ${n}`;
      gridComp.appendChild(item);
    });
    return gridComp;
  })()),
  card('ScrollArea', (() => {
    const scroll = createScrollArea({
      content: Array.from({ length: 20 }, (_, i) => `<div style="padding:var(--space-3);border-bottom:1px solid var(--border-divider)">Item ${i + 1} - Contenido con scroll personalizado</div>`).join(''),
      vertical: true,
    });
    const wrap = document.createElement('div');
    wrap.style.height = '150px';
    wrap.appendChild(scroll);
    return wrap;
  })()),
  card('Divider', (() => {
    const wrap = document.createElement('div');
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.gap = 'var(--space-4)';
    wrap.appendChild(createDivider({ orientation: 'horizontal' }));
    wrap.appendChild(createDivider({ orientation: 'horizontal', text: 'SECCIÓN' }));
    const vertWrap = document.createElement('div');
    vertWrap.style.display = 'flex';
    vertWrap.style.gap = 'var(--space-4)';
    vertWrap.style.height = '60px';
    vertWrap.style.alignItems = 'center';
    vertWrap.appendChild(createDivider({ orientation: 'vertical' }));
    vertWrap.appendChild(document.createTextNode('Texto'));
    vertWrap.appendChild(createDivider({ orientation: 'vertical' }));
    wrap.appendChild(vertWrap);
    return wrap;
  })()),
);

// ============================================================================
// TOAST DEMO
// ============================================================================
const toastDemo = (() => {
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexWrap = 'wrap';
  wrap.style.gap = 'var(--space-2)';
  ['success', 'warning', 'error', 'info'].forEach(v => {
    const btn = createButton({ variant: 'secondary', label: v, size: 'sm', onClick: () => showToast({ message: `Toast ${v}`, variant: v as any }) });
    wrap.appendChild(btn);
  });
  wrap.appendChild(createButton({ variant: 'secondary', label: 'Con acción', size: 'sm', onClick: () => showToast({ message: '¿Deshacer?', variant: 'warning', action: { label: 'Deshacer', onClick: () => showToast({ message: 'Deshecho', variant: 'success' }) } }) }));
  wrap.appendChild(createButton({ variant: 'secondary', label: 'Cerrar todos', size: 'sm', onClick: () => import('../ui/Toast.js').then(({ closeAllToasts }) => closeAllToasts()) }));
  return wrap;
})();

// ============================================================================
// MONTAR TODO
// ============================================================================
const container = document.createElement('div');
container.style.padding = 'var(--space-6)';
container.style.maxWidth = '1200px';
container.style.margin = '0 auto';

container.append(
  section('Buttons', buttonsDemo),
  section('Inputs', inputsDemo),
  section('Tabs', card('Tabs', tabsDemo)),
  section('Table', card('Table (seleccionable, sortable, clickable)', tableDemo)),
  section('States (Empty / Error / Loading)', statesDemo),
  section('Feedback (Spinner / Skeleton / Progress)', feedbackDemo),
  section('Layout (Panel / SplitView / Stack / Grid / ScrollArea / Divider)', layoutDemo),
  section('Toast (click para probar)', card('Toast Demo', toastDemo)),
);

app.appendChild(container);

// Exponer para debugging
(window as any).demo = {
  showToast,
  toast,
  closeAllToasts,
};