/**
 * SplitView.ts — División redimensionable (horizontal/vertical)
 * BEM: .split, .split--horizontal, .split--vertical, .split__pane, .split__handle
 */

export type SplitDirection = 'horizontal' | 'vertical';

export interface SplitViewOptions {
  direction: SplitDirection;
  panes: Array<{
    content: HTMLElement | string;
    minSize?: number;      // px
    maxSize?: number;      // px
    defaultSize?: number | string;  // px o % (ej: '50%')
  }>;
  className?: string;
  onResize?: (sizes: number[]) => void;
}

export interface SplitViewInstance {
  element: HTMLElement;
  setSizes: (sizes: number[]) => void;
  getSizes: () => number[];
  destroy: () => void;
}

/**
 * Crea un SplitView.
 */
export function createSplitView(options: SplitViewOptions): SplitViewInstance {
  const { direction, panes, className = '', onResize } = options;

  const split = document.createElement('div');
  split.className = `split split--${direction} ${className}`.trim();
  split.style.display = 'flex';
  split.style.flexDirection = direction === 'horizontal' ? 'row' : 'column';
  split.style.height = '100%';
  split.style.width = '100%';

  const panesElements: HTMLElement[] = [];
  const handles: HTMLElement[] = [];

  panes.forEach((pane, index) => {
    const paneEl = document.createElement('div');
    paneEl.className = 'split__pane';
    paneEl.style.flex = '1';
    paneEl.style.overflow = 'auto';
    paneEl.style.minWidth = '0';
    paneEl.style.minHeight = '0';

    if (typeof pane.defaultSize === 'string' && pane.defaultSize.endsWith('%')) {
      paneEl.style.flexBasis = pane.defaultSize;
    } else if (typeof pane.defaultSize === 'number') {
      paneEl.style.flexBasis = `${pane.defaultSize}px`;
    }

    if (pane.minSize !== undefined) {
      paneEl.style.minWidth = direction === 'vertical' ? 'auto' : `${pane.minSize}px`;
      paneEl.style.minHeight = direction === 'horizontal' ? 'auto' : `${pane.minSize}px`;
    }
    if (pane.maxSize !== undefined) {
      paneEl.style.maxWidth = direction === 'vertical' ? 'none' : `${pane.maxSize}px`;
      paneEl.style.maxHeight = direction === 'horizontal' ? 'none' : `${pane.maxSize}px`;
    }

    if (pane.content instanceof HTMLElement) {
      paneEl.appendChild(pane.content);
    } else {
      paneEl.innerHTML = pane.content;
    }

    split.appendChild(paneEl);
    panesElements.push(paneEl);

    // Handle entre paneles (no después del último)
    if (index < panes.length - 1) {
      const handle = document.createElement('div');
      handle.className = `split__handle split__handle--${direction === 'horizontal' ? 'vertical' : 'horizontal'}`;
      handle.setAttribute('role', 'separator');
      handle.setAttribute('aria-orientation', direction);
      handle.setAttribute('tabindex', '0');
      handle.style.flexShrink = '0';
      handle.style.background = 'var(--border-divider)';
      handle.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
      handle.style.width = direction === 'horizontal' ? '4px' : 'auto';
      handle.style.height = direction === 'horizontal' ? 'auto' : '4px';

      let isDragging = false;
      let startPos = 0;
      let startSizes: number[] = [];

      const handleDrag = (clientX: number, clientY: number) => {
        if (!isDragging) return;
        const delta = direction === 'horizontal' ? clientX - startPos : clientY - startPos;
        const newSizes = [...startSizes];
        const pane1 = panesElements[index]!;
        const pane2 = panesElements[index + 1]!;
        const rect1 = pane1.getBoundingClientRect();
        const rect2 = pane2.getBoundingClientRect();

        if (direction === 'horizontal') {
          const newWidth1 = Math.max(panes[index]!.minSize || 200, rect1.width + delta);
          const newWidth2 = Math.max(panes[index + 1]!.minSize || 200, rect2.width - delta);
          pane1.style.flexBasis = `${newWidth1}px`;
          pane2.style.flexBasis = `${newWidth2}px`;
        } else {
          const newHeight1 = Math.max(panes[index]!.minSize || 200, rect1.height + delta);
          const newHeight2 = Math.max(panes[index + 1]!.minSize || 200, rect2.height - delta);
          pane1.style.flexBasis = `${newHeight1}px`;
          pane2.style.flexBasis = `${newHeight2}px`;
        }

        onResize?.(getSizes());
      };

      const handleMouseDown = (e: MouseEvent | TouchEvent) => {
        isDragging = true;
        startPos = direction === 'horizontal'
          ? (e as MouseEvent).clientX || (e as TouchEvent).touches[0]!.clientX
          : (e as MouseEvent).clientY || (e as TouchEvent).touches[0]!.clientY;
        startSizes = getSizes();
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('touchend', handleMouseUp);
        handle.classList.add('split__handle--dragging');
        e.preventDefault();
      };

      const handleMouseMove = (e: MouseEvent) => handleDrag(e.clientX, e.clientY);
      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();
        handleDrag(e.touches[0]!.clientX, e.touches[0]!.clientY);
      };
      const handleMouseUp = () => {
        isDragging = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchend', handleMouseUp);
        handle.classList.remove('split__handle--dragging');
        onResize?.(getSizes());
      };

      handle.addEventListener('mousedown', handleMouseDown);
      handle.addEventListener('touchstart', handleMouseDown, { passive: false });

      // Keyboard support
      handle.addEventListener('keydown', (e) => {
        const step = 20;
        let delta = 0;
        if (direction === 'horizontal') {
          if (e.key === 'ArrowLeft') delta = -step;
          else if (e.key === 'ArrowRight') delta = step;
        } else {
          if (e.key === 'ArrowUp') delta = -step;
          else if (e.key === 'ArrowDown') delta = step;
        }
        if (delta !== 0) {
          e.preventDefault();
          const pane1 = panesElements[index]!;
          const pane2 = panesElements[index + 1]!;
          const rect1 = pane1.getBoundingClientRect();
          const rect2 = pane2.getBoundingClientRect();
          if (direction === 'horizontal') {
            const newWidth1 = Math.max(panes[index]!.minSize || 200, rect1.width + delta);
            const newWidth2 = Math.max(panes[index + 1]!.minSize || 200, rect2.width - delta);
            pane1.style.flexBasis = `${newWidth1}px`;
            pane2.style.flexBasis = `${newWidth2}px`;
          } else {
            const newHeight1 = Math.max(panes[index]!.minSize || 200, rect1.height + delta);
            const newHeight2 = Math.max(panes[index + 1]!.minSize || 200, rect2.height - delta);
            pane1.style.flexBasis = `${newHeight1}px`;
            pane2.style.flexBasis = `${newHeight2}px`;
          }
          onResize?.(getSizes());
        }
      });

      split.appendChild(handle);
      handles.push(handle);
    }
  });

  function getSizes(): number[] {
    return panesElements.map(el => direction === 'horizontal' ? el.offsetWidth : el.offsetHeight);
  }

  function setSizes(sizes: number[]) {
    sizes.forEach((size, i) => {
      if (i < panesElements.length) {
        panesElements[i]!.style.flexBasis = `${size}px`;
      }
    });
    onResize?.(getSizes());
  }

  return {
    element: split,
    setSizes,
    getSizes,
    destroy: () => split.remove(),
  };
}

export function splitViewHTML(options: SplitViewOptions): string {
  // Solo para SSR - no interactivo
  const { direction, panes, className = '' } = options;
  const panesHTML = panes.map(p => `
    <div class="split__pane" style="flex:1;overflow:auto;min-width:0;min-height:0">
      ${p.content instanceof HTMLElement ? '' : p.content}
    </div>
  `).join(`<div class="split__handle split__handle--${direction === 'horizontal' ? 'vertical' : 'horizontal'}"></div>`);
  return `<div class="split split--${direction} ${className}" style="display:flex;flex-direction:${direction === 'horizontal' ? 'row' : 'column'};height:100%">${panesHTML}</div>`;
}

