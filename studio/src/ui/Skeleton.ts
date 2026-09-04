/**
 * Skeleton.ts — Skeleton shimmer placeholder
 * BEM: .skeleton, .skeleton--text, .skeleton--rect, .skeleton--circle, .skeleton--animated
 */

export interface SkeletonOptions {
  variant?: 'text' | 'rect' | 'circle';
  width?: string | number;
  height?: string | number;
  lines?: number;          // Para variant='text'
  animated?: boolean;
  className?: string;
}

/**
 * Crea un skeleton.
 */
export function createSkeleton(options: SkeletonOptions = {}): HTMLElement {
  const { variant = 'text', width = '100%', height, lines = 1, animated = true, className = '' } = options;

  const skeleton = document.createElement('div');
  skeleton.className = `skeleton skeleton--${variant} ${animated ? 'skeleton--animated' : ''} ${className}`.trim();

  if (variant === 'text') {
    for (let i = 0; i < lines; i++) {
      const line = document.createElement('div');
      line.className = 'skeleton__line';
      line.style.width = i === lines - 1 && lines > 1 ? '60%' : '100%';
      line.style.height = typeof height === 'number' ? `${height}px` : '1rem';
      skeleton.appendChild(line);
    }
  } else if (variant === 'rect' || variant === 'circle') {
    const el = document.createElement('div');
    el.className = `skeleton__shape skeleton__shape--${variant}`;
    el.style.width = typeof width === 'number' ? `${width}px` : width;
    el.style.height = typeof height === 'number' ? `${height}px` : (height || (typeof width === 'number' ? `${width}px` : width));
    skeleton.appendChild(el);
  }

  return skeleton;
}

export function skeletonHTML(options: SkeletonOptions = {}): string {
  const { variant = 'text', width = '100%', height, lines = 1, animated = true, className = '' } = options;
  const animatedClass = animated ? 'skeleton--animated' : '';

  if (variant === 'text') {
    const linesHTML = Array.from({ length: lines }, (_, i) => `
      <div class="skeleton__line" style="width:${i === lines - 1 && lines > 1 ? '60%' : '100%'};height:${typeof height === 'number' ? `${height}px` : '1rem'}"></div>
    `).join('');
    return `<div class="skeleton skeleton--text ${animatedClass} ${className}">${linesHTML}</div>`;
  }

  const shapeClass = `skeleton__shape skeleton__shape--${variant}`;
  return `<div class="skeleton skeleton--${variant} ${animatedClass} ${className}"><div class="${shapeClass}" style="width:${typeof width === 'number' ? `${width}px` : width};height:${typeof height === 'number' ? `${height}px` : (height || (typeof width === 'number' ? `${width}px` : width))}"></div></div>`;
}

