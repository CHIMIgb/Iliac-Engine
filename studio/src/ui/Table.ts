/**
 * Table.ts — Tabla sortable, selectable, empty state
 * BEM: .table, .table__header, .table__row, .table__cell, .table__sort
 */

import { escapeHTML } from './utils.js';
export interface TableColumn {
  key: string;
  header: string;
  sortable?: boolean;
  render?: (value: any, row: any) => string | HTMLElement;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableOptions {
  columns: TableColumn[];
  data: any[];
  keyField: string;           // Campo único para identificar filas
  selectable?: boolean;
  onSelect?: (selectedIds: string[]) => void;
  onRowClick?: (row: any) => void;
  emptyMessage?: string;
  emptyAction?: { label: string; onClick: () => void };
  className?: string;
  striped?: boolean;
}

/**
 * Crea una tabla y retorna el contenedor.
 */
export function createTable(options: TableOptions): HTMLElement {
  const {
    columns,
    data,
    keyField,
    selectable = false,
    onSelect,
    onRowClick,
    emptyMessage = 'No hay elementos',
    emptyAction,
    className = '',
    striped = true,
  } = options;

  const container = document.createElement('div');
  container.className = `table-wrapper ${className}`.trim();

  const selectedIds = new Set<string>();

  const table = document.createElement('table');
  table.className = `table ${striped ? 'table--striped' : ''}`;
  table.setAttribute('role', selectable ? 'grid' : 'table');

  // Header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  headerRow.className = 'table__header';

  if (selectable) {
    const th = document.createElement('th');
    th.className = 'table__cell table__cell--checkbox';
    th.style.width = '40px';
    const selectAll = document.createElement('input');
    selectAll.type = 'checkbox';
    selectAll.className = 'table__select-all';
    selectAll.addEventListener('change', () => {
      const checked = selectAll.checked;
      data.forEach(row => {
        const id = String(row[keyField]);
        if (checked) selectedIds.add(id);
        else selectedIds.delete(id);
      });
      updateRowCheckboxes();
      onSelect?.(Array.from(selectedIds));
    });
    th.appendChild(selectAll);
    headerRow.appendChild(th);
  }

  columns.forEach(col => {
    const th = document.createElement('th');
    th.className = 'table__cell';
    if (col.width) th.style.width = col.width;
    if (col.align) th.style.textAlign = col.align;

    const headerContent = document.createElement('div');
    headerContent.className = 'table__header-content';
    headerContent.textContent = col.header;
    th.appendChild(headerContent);

    if (col.sortable) {
      th.style.cursor = 'pointer';
      th.classList.add('table__header--sortable');
      const sortIcon = document.createElement('span');
      sortIcon.className = 'table__sort-icon';
      sortIcon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16l5-10 5 10"/><path d="M7 8l5 10 5-10"/></svg>';
      headerContent.appendChild(sortIcon);
      th.addEventListener('click', () => {
        sortData(col.key);
      });
    }
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  // Body
  const tbody = document.createElement('tbody');
  tbody.className = 'table__body';
  container.appendChild(table);
  table.appendChild(tbody);

  let sortColumn: string | null = null;
  let sortDirection: 'asc' | 'desc' = 'asc';

  function renderRows() {
    tbody.innerHTML = '';

    if (data.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.className = 'table__empty';
      td.colSpan = columns.length + (selectable ? 1 : 0);
      td.innerHTML = `
        <div class="table__empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted)">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 12h6M12 9v6"/>
          </svg>
          <p class="table__empty-title">${escapeHTML(emptyMessage)}</p>
          ${emptyAction ? `<button type="button" class="btn btn--primary btn--sm">${escapeHTML(emptyAction.label)}</button>` : ''}
        </div>
      `;
      if (emptyAction) {
        td.querySelector('button')!.addEventListener('click', emptyAction.onClick);
      }
      tr.appendChild(td);
      tbody.appendChild(tr);
      return;
    }

    data.forEach(row => {
      const tr = document.createElement('tr');
      tr.className = 'table__row';
      tr.dataset.key = String(row[keyField]);
      if (onRowClick) tr.style.cursor = 'pointer';

      if (selectable) {
        const td = document.createElement('td');
        td.className = 'table__cell table__cell--checkbox';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'table__row-checkbox';
        checkbox.checked = selectedIds.has(String(row[keyField]));
        checkbox.addEventListener('change', (e) => {
          e.stopPropagation();
          const id = String(row[keyField]);
          if (checkbox.checked) selectedIds.add(id);
          else selectedIds.delete(id);
          updateSelectAll();
          onSelect?.(Array.from(selectedIds));
        });
        td.appendChild(checkbox);
        tr.appendChild(td);
      }

      columns.forEach(col => {
        const td = document.createElement('td');
        td.className = 'table__cell';
        if (col.align) td.style.textAlign = col.align;

        let value = row[col.key];
        if (col.render) {
          const rendered = col.render(value, row);
          if (rendered instanceof HTMLElement) {
            td.appendChild(rendered);
          } else {
            td.innerHTML = rendered;
          }
        } else {
          td.textContent = value ?? '';
        }
        tr.appendChild(td);
      });

      if (onRowClick) {
        tr.addEventListener('click', () => onRowClick!(row));
      }

      tbody.appendChild(tr);
    });

    updateSelectAll();
  }

  function sortData(key: string) {
    const col = columns.find(c => c.key === key);
    if (!col?.sortable) return;

    if (sortColumn === key) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = key;
      sortDirection = 'asc';
    }

    data.sort((a, b) => {
      const aVal = a[key];
      const bVal = b[key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    // Actualizar iconos de ordenación
    thead.querySelectorAll('.table__sort-icon').forEach(icon => {
      icon.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16l5-10 5 10"/><path d="M7 8l5 10 5-10"/></svg>';
    });
    const activeHeader = thead.querySelector(`th:nth-child(${columns.findIndex(c => c.key === key) + 1 + (selectable ? 1 : 0)}) .table__sort-icon`);
    if (activeHeader) {
      activeHeader.innerHTML = sortDirection === 'asc'
        ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16l5-10 5 10"/></svg>'
        : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 8l5 10 5-10"/></svg>';
    }

    renderRows();
  }

  function updateRowCheckboxes() {
    tbody.querySelectorAll('.table__row-checkbox').forEach(cb => {
      const checkbox = cb as HTMLInputElement;
      const tr = checkbox.closest('tr')!;
      checkbox.checked = selectedIds.has(tr.dataset.key!);
      tr.classList.toggle('table__row--selected', checkbox.checked);
    });
  }

  function updateSelectAll() {
    const selectAll = thead.querySelector('.table__select-all') as HTMLInputElement;
    if (!selectAll) return;
    selectAll.checked = data.length > 0 && data.every(row => selectedIds.has(String(row[keyField])));
    selectAll.indeterminate = data.some(row => selectedIds.has(String(row[keyField]))) && !selectAll.checked;
  }

  renderRows();

  // API pública
  (container as any).getSelectedIds = () => Array.from(selectedIds);
  (container as any).setData = (newData: any[]) => {
    data.length = 0;
    data.push(...newData);
    selectedIds.clear();
    renderRows();
  };
  (container as any).refresh = renderRows;

  return container;
}

export function tableHTML(options: TableOptions): string {
  // Versión simplificada para SSR/innerHTML
  const { columns, data, keyField, selectable = false, emptyMessage = 'No hay elementos' } = options;
  const cols = selectable ? ['', ...columns.map(c => c.header)] : columns.map(c => c.header);
  const header = cols.map(h => `<th class="table__cell">${escapeHTML(h)}</th>`).join('');
  const rows = data.length === 0
    ? `<tr><td class="table__empty" colspan="${cols.length}"><div class="table__empty-state"><p>${escapeHTML(emptyMessage)}</p></div></td></tr>`
    : data.map(row => {
        const cells = columns.map(col => {
          const val = row[col.key];
          return `<td class="table__cell" style="text-align:${col.align || 'left'}">${escapeHTML(String(val ?? ''))}</td>`;
        }).join('');
        const checkbox = selectable ? `<td class="table__cell table__cell--checkbox"><input type="checkbox" class="table__row-checkbox" data-key="${escapeHTML(String(row[keyField]))}"></td>` : '';
        return `<tr class="table__row" data-key="${escapeHTML(String(row[keyField]))}">${checkbox}${cells}</tr>`;
      }).join('');

  return `
    <div class="table-wrapper">
      <table class="table" role="${selectable ? 'grid' : 'table'}">
        <thead><tr class="table__header">${header}</tr></thead>
        <tbody class="table__body">${rows}</tbody>
      </table>
    </div>
  `;
}



