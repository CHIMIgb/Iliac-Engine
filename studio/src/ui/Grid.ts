/**
 * Grid.ts — CSS Grid responsive
 * BEM: .grid, .grid--cols-1, .grid--cols-2, etc., .grid__item
 */

export interface GridOptions {
  columns?: number | string;        // número = columnas fijas, string = CSS grid-template-columns
  gap?: number | string;
  minColumnWidth?: number;          // para auto-fit
  children?: (HTMLElement | string)[];
  className?: string;
}

/**
 * Crea un Grid.
 */
export function createGrid(options: GridOptions = {}): HTMLElement {
  const { columns = 12, gap = 16, minColumnWidth, children = [], className = '' } = options;

  const grid = document.createElement('div');
  grid.className = `grid ${className}`.trim();
  grid.style.display = 'grid';
  grid.style.gap = typeof gap === 'number' ? `${gap}px` : gap;

  if (typeof columns === 'number') {
    grid.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
  } else {
    grid.style.gridTemplateColumns = columns;
  }

  // Auto-fit responsive si se especifica minColumnWidth explícitamente
  if (typeof columns === 'number' && minColumnWidth !== undefined && minColumnWidth > 0) {
    grid.style.gridTemplateColumns = `repeat(auto-fit, minmax(${minColumnWidth}px, 1fr))`;
  }

  children.forEach(child => {
    if (child instanceof HTMLElement) {
      grid.appendChild(child);
    } else {
      const wrapper = document.createElement('div');
      wrapper.className = 'grid__item';
      wrapper.innerHTML = child;
      grid.appendChild(wrapper);
    }
  });

  return grid;
}

export function gridHTML(options: GridOptions = {}): string {
  const { columns = 12, gap = 16, minColumnWidth, children = [], className = '' } = options;
  const gapCSS = typeof gap === 'number' ? `${gap}px` : gap;
  let templateColumns: string;
  if (typeof columns === 'number' && minColumnWidth !== undefined && minColumnWidth > 0) {
    templateColumns = `repeat(auto-fit, minmax(${minColumnWidth}px, 1fr))`;
  } else if (typeof columns === 'number') {
    templateColumns = `repeat(${columns}, 1fr)`;
  } else {
    templateColumns = columns;
  }
  const childrenHTML = children.map(c => c instanceof HTMLElement ? '' : `<div class="grid__item">${c}</div>`).join('');
  return `<div class="grid ${className}" style="display:grid;grid-template-columns:${templateColumns};gap:${gapCSS}">${childrenHTML}</div>`;
}

