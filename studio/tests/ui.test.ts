import { describe, it, expect, vi } from 'vitest';
import { createButton, buttonHTML } from '../src/ui/Button.js';
import { createInput, inputHTML } from '../src/ui/Input.js';
import { createTabs, tabsHTML } from '../src/ui/Tabs.js';
import { createTable, tableHTML } from '../src/ui/Table.js';
import { createModal, closeAllModals } from '../src/ui/Modal.js';
import { showToast, closeAllToasts } from '../src/ui/Toast.js';
import { createSpinner, spinnerHTML } from '../src/ui/Spinner.js';
import { createSkeleton, skeletonHTML } from '../src/ui/Skeleton.js';
import { createProgressBar, progressBarHTML } from '../src/ui/ProgressBar.js';
import { createEmptyState, emptyStateHTML } from '../src/ui/EmptyState.js';
import { createErrorState, errorStateHTML } from '../src/ui/ErrorState.js';
import { createLoadingState, loadingStateHTML } from '../src/ui/LoadingState.js';
import { createPanel, panelHTML } from '../src/ui/Panel.js';
import { createSplitView } from '../src/ui/SplitView.js';
import { createStack } from '../src/ui/Stack.js';
import { createGrid } from '../src/ui/Grid.js';
import { createScrollArea } from '../src/ui/ScrollArea.js';
import { createDivider } from '../src/ui/Divider.js';

describe('UI Components', () => {
  // Cleanup after each test
  afterEach(() => {
    document.body.innerHTML = '';
    closeAllModals();
    closeAllToasts();
  });

  describe('Button', () => {
    it('creates button with variant, size, label', () => {
      const btn = createButton({ variant: 'primary', size: 'md', label: 'Guardar' });
      expect(btn).toBeInstanceOf(HTMLButtonElement);
      expect(btn).toHaveClass('btn--primary');
      expect(btn).toHaveClass('btn--md');
      expect(btn.textContent).toContain('Guardar');
    });

    it('creates icon-only button', () => {
      const btn = createButton({ variant: 'icon', icon: 'save', iconOnly: true, ariaLabel: 'Guardar' });
      expect(btn).toHaveClass('btn--icon');
      expect(btn.getAttribute('aria-label')).toBe('Guardar');
    });

    it('handles disabled and loading states', () => {
      const disabledBtn = createButton({ label: 'Disabled', disabled: true });
      expect(disabledBtn.disabled).toBe(true);

      const loadingBtn = createButton({ label: 'Loading', loading: true });
      expect(loadingBtn.disabled).toBe(true);
      expect(loadingBtn.innerHTML).toContain('spinner');
    });

    it('generates HTML string', () => {
      const html = buttonHTML({ variant: 'secondary', label: 'Test' });
      expect(html).toContain('btn--secondary');
      expect(html).toContain('Test');
    });
  });

  describe('Input', () => {
    it('creates text input with label', () => {
      const wrapper = createInput({ id: 'test', type: 'text', label: 'Nombre', placeholder: 'Escribe...' });
      expect(wrapper).toHaveClass('input-wrapper');
      const input = wrapper.querySelector('input') as HTMLInputElement;
      expect(input).not.toBeNull();
      expect(input.placeholder).toBe('Escribe...');
    });

    it('creates number input with min/max/step', () => {
      const wrapper = createInput({ id: 'num', type: 'number', value: 50, min: 0, max: 100, step: 5 });
      const input = wrapper.querySelector('input') as HTMLInputElement;
      expect(input.min).toBe('0');
      expect(input.max).toBe('100');
      expect(input.step).toBe('5');
    });

    it('creates select with options', () => {
      const wrapper = createInput({
        id: 'sel', type: 'select',
        options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }],
        value: 'b',
      });
      const select = wrapper.querySelector('select') as HTMLSelectElement;
      expect(select.options.length).toBe(2);
      expect(select.value).toBe('b');
    });

    it('creates checkbox with label', () => {
      const wrapper = createInput({ id: 'chk', type: 'checkbox', label: 'Acepto', checked: true });
      const input = wrapper.querySelector('input[type="checkbox"]') as HTMLInputElement;
      expect(input.checked).toBe(true);
    });

    it('creates slider with value display', () => {
      const wrapper = createInput({ id: 'sld', type: 'slider', value: 75, min: 0, max: 100, showValue: true });
      const slider = wrapper.querySelector('input[type="range"]') as HTMLInputElement;
      expect(slider.value).toBe('75');
      const output = wrapper.querySelector('output');
      expect(output).not.toBeNull();
    });

    it('creates color input with swatch', () => {
      const wrapper = createInput({ id: 'col', type: 'color', value: '#ff0000' });
      const swatch = wrapper.querySelector('.input__color-swatch');
      expect(swatch).not.toBeNull();
      expect((swatch as HTMLElement).style.backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('shows error state', () => {
      const wrapper = createInput({ id: 'err', type: 'text', error: 'Campo requerido' });
      expect(wrapper).toHaveClass('input-wrapper--error');
      const errorMsg = wrapper.querySelector('.input__error');
      expect(errorMsg?.textContent).toBe('Campo requerido');
    });
  });

  describe('Tabs', () => {
    it('creates tabs with active state', () => {
      const tabs = createTabs({
        tabs: [
          { id: 'a', label: 'Tab A', content: 'Content A' },
          { id: 'b', label: 'Tab B', content: 'Content B' },
        ],
        activeId: 'a',
      });
      expect(tabs).toHaveClass('tabs');
      const activeTab = tabs.querySelector('.tabs__tab--active');
      expect(activeTab).not.toBeNull();
      expect(activeTab?.id).toBe('tab-a');
    });

    it('switches tabs on click', () => {
      const tabs = createTabs({
        tabs: [
          { id: 'a', label: 'A', content: 'A' },
          { id: 'b', label: 'B', content: 'B' },
        ],
        activeId: 'a',
      });
      const tabB = tabs.querySelector('#tab-b') as HTMLButtonElement;
      tabB.click();
      expect(tabs.querySelector('.tabs__tab--active')?.id).toBe('tab-b');
    });

    it('keyboard navigation works', () => {
      const tabs = createTabs({
        tabs: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }],
        activeId: 'a',
      });
      const tabA = tabs.querySelector('#tab-a') as HTMLButtonElement;
      tabA.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      expect(tabs.querySelector('.tabs__tab--active')?.id).toBe('tab-b');
    });
  });

  describe('Table', () => {
    it('renders columns and data', () => {
      const table = createTable({
        columns: [
          { key: 'name', header: 'Nombre', sortable: true },
          { key: 'value', header: 'Valor' },
        ],
        data: [{ name: 'Item 1', value: '10' }, { name: 'Item 2', value: '20' }],
        keyField: 'name',
      });
      expect(table).toHaveClass('table-wrapper');
      const rows = table.querySelectorAll('.table__row');
      expect(rows.length).toBe(2);
    });

    it('sorting works', () => {
      const table = createTable({
        columns: [{ key: 'name', header: 'Nombre', sortable: true }],
        data: [{ name: 'B' }, { name: 'A' }],
        keyField: 'name',
      });
      const header = table.querySelector('.table__header--sortable') as HTMLTableCellElement;
      header.click();
      const firstRow = table.querySelector('.table__row') as HTMLElement;
      expect(firstRow.dataset.key).toBe('A');
    });

    it('selection works', () => {
      const table = createTable({
        columns: [{ key: 'name', header: 'Nombre' }],
        data: [{ name: 'Item 1' }],
        keyField: 'name',
        selectable: true,
        onSelect: vi.fn(),
      });
      const checkbox = table.querySelector('.table__row-checkbox') as HTMLInputElement;
      checkbox.click();
      expect(checkbox.checked).toBe(true);
    });

    it('empty state shows message', () => {
      const table = createTable({
        columns: [{ key: 'name', header: 'Nombre' }],
        data: [],
        keyField: 'name',
        emptyMessage: 'No hay datos',
      });
      expect(table.querySelector('.table__empty-state')).not.toBeNull();
    });
  });

  describe('Modal', () => {
    it('opens and closes', () => {
      const modal = createModal({
        title: 'Test Modal',
        content: 'Hello World',
        actions: [{ label: 'Cerrar', variant: 'secondary', onClick: m => m.close() }],
      });
      const overlay = document.querySelector('.modal__overlay');
      expect(overlay).not.toBeNull();
      expect(overlay).toBeVisible();

      modal.close();
      // Wait for animation
      return new Promise(r => setTimeout(r, 200)).then(() => {
        expect(document.querySelector('.modal__overlay')).toBeNull();
      });
    });

    it('focus trap works', () => {
      const modal = createModal({
        title: 'Focus Test',
        content: '<button id="btn1">Btn1</button><button id="btn2">Btn2</button>',
        showClose: false, // Disable close button so first focusable is btn1
      });
      // Wait a tick for focus to be set
      return new Promise(r => setTimeout(r, 50)).then(() => {
        const btn1 = document.getElementById('btn1') as HTMLButtonElement;
        expect(document.activeElement).toBe(btn1);
        modal.close();
      });
    });
  });

  describe('Toast', () => {
    it('shows and auto-dismisses', async () => {
      const close = showToast({ message: 'Test toast', variant: 'success', duration: 100 });
      // Wait a tick for container creation
      await new Promise(r => setTimeout(r, 10));
      const toast = document.querySelector('.toast');
      expect(toast).not.toBeNull();
      expect(toast).toHaveClass('toast--success');
      // Wait for auto-dismiss (100ms) + animation (200ms) + buffer
      await new Promise(r => setTimeout(r, 500));
      expect(document.querySelector('.toast')).toBeNull();
    });

    it('persists error toasts', async () => {
      showToast({ message: 'Error', variant: 'error', duration: 0 });
      await new Promise(r => setTimeout(r, 10));
      expect(document.querySelector('.toast--error')).not.toBeNull();
    });

    it('action button works', async () => {
      const action = vi.fn();
      showToast({ message: 'Action', variant: 'warning', action: { label: 'Click', onClick: action } });
      await new Promise(r => setTimeout(r, 10));
      const actionBtn = document.querySelector('.toast__action') as HTMLButtonElement;
      expect(actionBtn).not.toBeNull();
      actionBtn.click();
      expect(action).toHaveBeenCalled();
    });
  });

  describe('Spinner', () => {
    it('creates spinner with size', () => {
      const spinner = createSpinner({ size: 'lg' });
      expect(spinner).toHaveClass('spinner--lg');
    });

    it('has animation classes', () => {
      const spinner = createSpinner({ size: 'md' });
      expect(spinner.querySelector('.spinner__indicator')).not.toBeNull();
    });
  });

  describe('Skeleton', () => {
    it('creates text skeleton with lines', () => {
      const skeleton = createSkeleton({ variant: 'text', lines: 3 });
      const lines = skeleton.querySelectorAll('.skeleton__line');
      expect(lines.length).toBe(3);
    });

    it('creates rect skeleton', () => {
      const skeleton = createSkeleton({ variant: 'rect', width: 200, height: 100 });
      expect(skeleton.querySelector('.skeleton__shape--rect')).not.toBeNull();
    });
  });

  describe('ProgressBar', () => {
    it('shows percentage', () => {
      const pb = createProgressBar({ value: 50, max: 100 });
      const fill = pb.querySelector('.progress__fill') as HTMLElement;
      expect(fill.style.width).toBe('50%');
    });

    it('indeterminate mode', () => {
      const pb = createProgressBar({ value: 0, indeterminate: true });
      expect(pb).toHaveClass('progress--indeterminate');
    });
  });

  describe('EmptyState', () => {
    it('renders icon, title, description, action', () => {
      const empty = createEmptyState({
        title: 'Empty',
        description: 'Nothing here',
        action: { label: 'Create', variant: 'primary', onClick: vi.fn() },
      });
      expect(empty.querySelector('.empty__title')?.textContent).toBe('Empty');
      expect(empty.querySelector('.empty__desc')?.textContent).toBe('Nothing here');
      expect(empty.querySelector('.btn--primary')).not.toBeNull();
    });
  });

  describe('ErrorState', () => {
    it('renders with retry and details', () => {
      const error = createErrorState({
        title: 'Error',
        description: 'Something failed',
        details: 'Stack trace here',
        onRetry: vi.fn(),
        onDetails: vi.fn(),
      });
      expect(error.querySelector('.error__title')?.textContent).toBe('Error');
      expect(error.querySelector('.error__actions .btn--primary')).not.toBeNull();
      expect(error.querySelector('.error__actions .btn--ghost')).not.toBeNull();
    });
  });

  describe('LoadingState', () => {
    it('renders spinner and text', () => {
      const loading = createLoadingState({ text: 'Loading...', size: 'md' });
      expect(loading.querySelector('.loading__spinner')).not.toBeNull();
      expect(loading.querySelector('.loading__text')?.textContent).toBe('Loading...');
    });
  });

  describe('Panel', () => {
    it('collapses and expands', () => {
      const panel = createPanel({ title: 'Test Panel', collapsible: true, collapsed: false });
      const panelEl = (panel as any).element as HTMLElement;
      expect(panelEl).not.toHaveClass('panel--collapsed');
      panel.setCollapsed(true);
      expect(panelEl).toHaveClass('panel--collapsed');
      panel.toggle();
      expect(panelEl).not.toHaveClass('panel--collapsed');
    });
  });

  describe('SplitView', () => {
    it('creates horizontal split with 3 panes', () => {
      const split = createSplitView({
        direction: 'horizontal',
        panes: [
          { content: '<div>Left</div>', minSize: 100, defaultSize: 200 },
          { content: '<div>Center</div>', minSize: 200 },
          { content: '<div>Right</div>', minSize: 100, defaultSize: 200 },
        ],
      });
      const splitEl = (split as any).element as HTMLElement;
      expect(splitEl).toHaveClass('split--horizontal');
      const handles = splitEl.querySelectorAll('.split__handle');
      expect(handles.length).toBe(2);
    });
  });

  describe('Stack', () => {
    it('creates horizontal stack with gap', () => {
      const stack = createStack({ direction: 'horizontal', gap: 16 });
      expect(stack).toHaveClass('stack--horizontal');
      expect(stack.style.gap).toBe('16px');
    });
  });

  describe('Grid', () => {
    it('creates grid with columns', () => {
      const grid = createGrid({ columns: 4, gap: 12 });
      expect(grid).toHaveClass('grid');
      expect(grid.style.gridTemplateColumns).toBe('repeat(4, 1fr)');
    });
  });

  describe('ScrollArea', () => {
    it('creates scrollable area', () => {
      const scroll = createScrollArea({ content: '<div>Content</div>', vertical: true });
      expect(scroll).toHaveClass('scroll-area--vertical');
      expect(scroll.querySelector('.scroll-area__viewport')).not.toBeNull();
    });
  });

  describe('Divider', () => {
    it('creates horizontal divider', () => {
      const div = createDivider({ orientation: 'horizontal' });
      expect(div).toHaveClass('divider--horizontal');
    });

    it('creates divider with text', () => {
      const div = createDivider({ orientation: 'horizontal', text: 'SECTION' });
      expect(div).toHaveClass('divider--with-text');
      expect(div.querySelector('.divider__text')?.textContent).toBe('SECTION');
    });
  });
});