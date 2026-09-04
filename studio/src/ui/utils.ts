/**
 * utils.ts — Utilidades compartidas para componentes UI
 */

/**
 * Escapa strings HTML para prevenir XSS.
 */
export function escapeHTML(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
