/**
 * ProgressBar.ts — Barra de progreso
 * BEM: .progress, .progress--sm, .progress--md, .progress--lg, .progress__track, .progress__fill, .progress__label
 */

export interface ProgressBarOptions {
  value: number;              // 0-100
  max?: number;               // default 100
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;             // Custom label (overrides percentage)
  indeterminate?: boolean;    // Modo indeterminado
  variant?: 'default' | 'success' | 'warning' | 'danger';
  className?: string;
}

/**
 * Crea una barra de progreso.
 */
export function createProgressBar(options: ProgressBarOptions): HTMLElement {
  const {
    value,
    max = 100,
    size = 'md',
    showLabel = true,
    label,
    indeterminate = false,
    variant = 'default',
    className = '',
  } = options;

  const clampedValue = Math.max(0, Math.min(max, value));
  const percentage = max > 0 ? Math.round((clampedValue / max) * 100) : 0;

  const progress = document.createElement('div');
  progress.className = `progress progress--${size} progress--${variant} ${indeterminate ? 'progress--indeterminate' : ''} ${className}`.trim();
  progress.setAttribute('role', 'progressbar');
  progress.setAttribute('aria-valuenow', String(clampedValue));
  progress.setAttribute('aria-valuemin', '0');
  progress.setAttribute('aria-valuemax', String(max));

  const fillColor = variant === 'success' ? 'var(--accent-success)' :
    variant === 'warning' ? 'var(--accent-warning)' :
    variant === 'danger' ? 'var(--accent-danger)' :
    'var(--accent-primary)';

  progress.innerHTML = `
    <div class="progress__track" style="background: var(--bg-surface)">
      <div class="progress__fill" style="width: ${indeterminate ? '100%' : `${percentage}%`}; background: ${fillColor};"></div>
    </div>
    ${showLabel ? `<span class="progress__label">${escapeHTML(label ?? `${percentage}%`)}</span>` : ''}
  `;

  return progress;
}

export function progressBarHTML(options: ProgressBarOptions): string {
  const { value, max = 100, size = 'md', showLabel = true, label, indeterminate = false, variant = 'default', className = '' } = options;
  const clampedValue = Math.max(0, Math.min(max, value));
  const percentage = max > 0 ? Math.round((clampedValue / max) * 100) : 0;

  const fillColor = variant === 'success' ? 'var(--accent-success)' :
    variant === 'warning' ? 'var(--accent-warning)' :
    variant === 'danger' ? 'var(--accent-danger)' :
    'var(--accent-primary)';

  return `
    <div class="progress progress--${size} progress--${variant} ${indeterminate ? 'progress--indeterminate' : ''} ${className}" role="progressbar" aria-valuenow="${clampedValue}" aria-valuemin="0" aria-valuemax="${max}">
      <div class="progress__track" style="background: var(--bg-surface)">
        <div class="progress__fill" style="width: ${indeterminate ? '100%' : `${percentage}%`}; background: ${fillColor};"></div>
      </div>
      ${showLabel ? `<span class="progress__label">${escapeHTML(label ?? `${percentage}%`)}</span>` : ''}
    </div>
  `;
}

function escapeHTML(str: string): string {
  return str
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"')
    .replace(/'/g, '&#039;');
}

export const progressCSS = `
/* ==========================================================================
   ProgressBar Component
   ========================================================================== */

.progress {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  font-size: var(--font-size-xs);
}

.progress__track {
  height: 100%;
  border-radius: var(--border-radius-sm);
  overflow: hidden;
  position: relative;
}

.progress--sm .progress__track { height: 4px; }
.progress--md .progress__track { height: 8px; }
.progress--lg .progress__track { height: 12px; }

.progress__fill {
  height: 100%;
  border-radius: var(--border-radius-sm);
  transition: width var(--transition-base);
  transform-origin: left center;
}

.progress--indeterminate .progress__fill {
  width: 30% !important;
  animation: progress-indeterminate 1.5s ease-in-out infinite;
}

@keyframes progress-indeterminate {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
}

.progress__label {
  color: var(--text-secondary);
  text-align: right;
  font-family: var(--font-mono);
}
`;