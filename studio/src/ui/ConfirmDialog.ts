/**
 * ui/ConfirmDialog.ts — diálogo de confirmación reutilizable (C5e).
 *
 * Mini-modal sobre el contenido actual (mismo patrón overlay + .modal) que
 * resuelve con `true` si el usuario confirma la acción destructiva y con
 * `false` si la cancela (Esc, clic en overlay o botón Cancelar). Usado por el
 * selector «Mis proyectos» (borrar) y por main.ts (avisar de cambios sin
 * guardar antes de abrir otro), siguiendo DESIGN.md.
 */
export function confirmDialog(message: string, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar'): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay confirm-dialog';

    const dialog = document.createElement('div');
    dialog.className = 'modal confirm-dialog__modal';

    const body = document.createElement('div');
    body.className = 'confirm-dialog__body';
    const msg = document.createElement('p');
    msg.textContent = message;
    body.appendChild(msg);
    dialog.appendChild(body);

    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    const cancel = document.createElement('button');
    cancel.className = 'btn btn--secondary';
    cancel.textContent = cancelLabel;
    cancel.addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });
    const confirm = document.createElement('button');
    confirm.className = 'btn btn--danger';
    confirm.textContent = confirmLabel;
    confirm.addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });
    footer.append(cancel, confirm);
    dialog.appendChild(footer);

    overlay.appendChild(dialog);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        resolve(false);
      }
    });
    document.body.appendChild(overlay);
    document.addEventListener('keydown', onKey);
    confirm.focus();

    function onKey(e: KeyboardEvent): void {
      if (e.key !== 'Escape') return;
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(false);
    }
  });
}