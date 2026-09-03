/**
 * ScrollArea.ts — Contenedor con scroll custom (scrollbar personalizada)
 * BEM: .scroll, .scroll__viewport, .scroll__content
 */

export interface ScrollAreaOptions {
  content: HTMLElement | string;
  horizontal?: boolean;
  vertical?: boolean;
  className?: string;
}

/**
 * Crea un ScrollArea.
 */
export function createScrollArea(options: ScrollAreaOptions): HTMLElement {
  const { content, horizontal = false, vertical = true, className = '' } = options;

  const scroll = document.createElement('div');
  scroll.className = `scroll-area ${horizontal ? 'scroll-area--horizontal' : ''} ${vertical ? 'scroll-area--vertical' : ''} ${className}`.trim();
  scroll.style.overflow = 'hidden';
  scroll.style.position = 'relative';

  const viewport = document.createElement('div');
  viewport.className = 'scroll-area__viewport';
  viewport.style.overflow = `${vertical ? 'auto' : 'hidden'} ${horizontal ? 'auto' : 'hidden'}`;
  viewport.style.position = 'absolute';
  viewport.style.inset = '0';

  const contentEl = document.createElement('div');
  contentEl.className = 'scroll-area__content';
  if (content instanceof HTMLElement) {
    contentEl.appendChild(content);
  } else {
    contentEl.innerHTML = content;
  }

  viewport.appendChild(contentEl);
  scroll.appendChild(viewport);

  return scroll;
}

export function scrollAreaHTML(options: ScrollAreaOptions): string {
  const { content, horizontal = false, vertical = true, className = '' } = options;
  return `
    <div class="scroll-area ${horizontal ? 'scroll-area--horizontal' : ''} ${vertical ? 'scroll-area--vertical' : ''} ${className}" style="overflow:hidden;position:relative">
      <div class="scroll-area__viewport" style="overflow:${vertical ? 'auto' : 'hidden'} ${horizontal ? 'auto' : 'hidden'};position:absolute;inset:0">
        <div class="scroll-area__content">${content instanceof HTMLElement ? '' : content}</div>
      </div>
    </div>
  `;
}

export const scrollAreaCSS = `
/* ==========================================================================
   ScrollArea Component
   ========================================================================== */

.scroll-area {
  position: relative;
  overflow: hidden;
}

.scroll-area__viewport {
  position: absolute;
  inset: 0;
  overflow: auto;
  /* Scrollbar personalizada via ::webkit-scrollbar en tokens.css */
}

.scroll-area__content {
  min-height: 100%;
  min-width: 100%;
}
`;