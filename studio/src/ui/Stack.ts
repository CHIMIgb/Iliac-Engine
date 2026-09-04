/**
 * Stack.ts — Layout vertical/horizontal con gap
 * BEM: .stack, .stack--horizontal, .stack--wrap
 */

export type StackDirection = 'vertical' | 'horizontal';

export interface StackOptions {
  direction?: StackDirection;
  gap?: number | string;      // número = px, string = CSS value
  wrap?: boolean;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  children?: (HTMLElement | string)[];
  className?: string;
}

/**
 * Crea un Stack.
 */
export function createStack(options: StackOptions = {}): HTMLElement {
  const { direction = 'vertical', gap = 16, wrap = false, align = 'stretch', justify = 'start', children = [], className = '' } = options;

  const stack = document.createElement('div');
  stack.className = `stack stack--${direction} ${wrap ? 'stack--wrap' : ''} ${className}`.trim();
  stack.style.display = 'flex';
  stack.style.flexDirection = direction;
  stack.style.gap = typeof gap === 'number' ? `${gap}px` : gap;
  stack.style.alignItems = align;
  stack.style.justifyContent = justify;
  if (wrap) stack.style.flexWrap = 'wrap';

  children.forEach(child => {
    if (child instanceof HTMLElement) {
      stack.appendChild(child);
    } else {
      const wrapper = document.createElement('div');
      wrapper.innerHTML = child;
      stack.appendChild(wrapper);
    }
  });

  return stack;
}

export function stackHTML(options: StackOptions = {}): string {
  const { direction = 'vertical', gap = 16, wrap = false, align = 'stretch', justify = 'start', children = [], className = '' } = options;
  const gapCSS = typeof gap === 'number' ? `${gap}px` : gap;
  const childrenHTML = children.map(c => c instanceof HTMLElement ? '' : c).join('');
  return `
    <div class="stack stack--${direction} ${wrap ? 'stack--wrap' : ''} ${className}" style="display:flex;flex-direction:${direction};gap:${gapCSS};align-items:${align};justify-content:${justify}${wrap ? ';flex-wrap:wrap' : ''}">
      ${childrenHTML}
    </div>
  `;
}

