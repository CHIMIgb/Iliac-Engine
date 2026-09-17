/**
 * ui/ProjectPicker.ts — selector «Mis proyectos» (C5e).
 *
 * Modal que lista los proyectos del usuario autenticado (nombre + fecha de
 * actualización) con acciones por fila: **Abrir** y **Borrar** (con diálogo de
 * confirmación interno). El pie ofrece **Nuevo proyecto** (desde plantilla,
 * lo resuelve main.ts) y Cerrar.
 *
 * Patrón de modal idéntico a DungeonBrowser/AuthModal (overlay + .modal +
 * header/footer + cierre con Esc/overlay/×), siguiendo DESIGN.md. El modal NO
 * conoce EditorState ni la API: los callbacks onOpen/onNew los inyecta main.ts
 * y la lógica de datos vive en io/MyProjects.ts (testeable sin DOM).
 *
 * Sin sesión el modal no se abre: main llama requireSession antes (el selector
 * «pide iniciar sesión», criterio C5e).
 */
import { Icon } from './Icon';
import { confirmDialog } from './ConfirmDialog';
import { deleteMyProject, listMyProjects, type ProjectMeta } from '../io/MyProjects';

export interface ProjectPickerCallbacks {
  /** Abre el proyecto dado en el editor (main: openProject(id)). */
  onOpen: (id: string) => void;
  /** Crea un proyecto nuevo desde la plantilla (main: createFromTemplate). */
  onNew: () => void;
}

export class ProjectPicker {
  private overlay: HTMLDivElement;
  private list: HTMLDivElement;
  private emptyState: HTMLDivElement;
  private newBtn: HTMLButtonElement;
  private errorBox: HTMLDivElement;
  private callbacks: ProjectPickerCallbacks | null = null;
  private busy = false;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay project-picker';
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) this.close();
    });

    const modal = document.createElement('div');
    modal.className = 'modal project-picker__modal';

    // Cabecera
    const header = document.createElement('div');
    header.className = 'modal__header';
    const title = document.createElement('h2');
    title.className = 'modal__title';
    title.textContent = 'Mis proyectos';
    const closeX = document.createElement('button');
    closeX.className = 'btn btn--icon';
    closeX.title = 'Cerrar (Esc)';
    closeX.textContent = '×';
    closeX.addEventListener('click', () => this.close());
    header.append(title, closeX);
    modal.appendChild(header);

    // Caja de error de carga (se muestra si la lista no llega)
    this.errorBox = document.createElement('div');
    this.errorBox.className = 'project-picker__error';
    modal.appendChild(this.errorBox);

    // Lista de proyectos
    this.list = document.createElement('div');
    this.list.className = 'project-list';
    modal.appendChild(this.list);

    // Estado vacío (cuenta sin proyectos)
    this.emptyState = document.createElement('div');
    this.emptyState.className = 'project-empty';
    this.emptyState.textContent = 'No tienes proyectos todavía. Crea uno con «Nuevo proyecto».';
    this.list.appendChild(this.emptyState);

    // Pie
    const footer = document.createElement('div');
    footer.className = 'modal__footer';
    this.newBtn = document.createElement('button');
    this.newBtn.className = 'btn btn--primary';
    this.newBtn.appendChild(Icon('plus', 16));
    this.newBtn.append(' Nuevo proyecto');
    this.newBtn.addEventListener('click', () => {
      if (!this.callbacks) return;
      this.callbacks.onNew();
      this.close(); // el nuevo proyecto se abre en el editor
    });
    const cancel = document.createElement('button');
    cancel.className = 'btn btn--secondary';
    cancel.textContent = 'Cerrar';
    cancel.addEventListener('click', () => this.close());
    footer.append(this.newBtn, cancel);
    modal.appendChild(footer);

    this.overlay.appendChild(modal);
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close();
  };

  /** Abre el selector y carga la lista de la cuenta. */
  async open(callbacks: ProjectPickerCallbacks): Promise<void> {
    this.callbacks = callbacks;
    document.body.appendChild(this.overlay);
    document.addEventListener('keydown', this.onKey);
    await this.refresh();
  }

  close(): void {
    this.overlay.remove();
    document.removeEventListener('keydown', this.onKey);
    this.callbacks = null;
  }

  /** Re-consulta la lista y repinta (al abrir y tras borrar). */
  async refresh(): Promise<void> {
    this.setError(null);
    this.setBusy(true);
    try {
      const projects = await listMyProjects();
      this.render(projects);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'error desconocido';
      this.setError(`No se pudo cargar la lista (${msg})`);
    } finally {
      this.setBusy(false);
    }
  }

  private setError(message: string | null): void {
    this.errorBox.textContent = '';
    this.errorBox.classList.toggle('project-picker__error--visible', message !== null);
    if (message) this.errorBox.textContent = message;
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.newBtn.disabled = busy;
  }

  private render(projects: ProjectMeta[]): void {
    this.list.textContent = '';
    if (projects.length === 0) {
      this.list.appendChild(this.emptyState);
      return;
    }

    for (const p of projects) {
      this.list.appendChild(this.item(p));
    }
  }

  /** Fila: nombre + fecha de actualización + acciones Abrir/Borrar. */
  private item(p: ProjectMeta): HTMLDivElement {
    const row = document.createElement('div');
    row.className = 'project-item';

    const info = document.createElement('div');
    info.className = 'project-item__info';
    const name = document.createElement('span');
    name.className = 'project-item__name';
    name.textContent = p.nombre;
    const date = document.createElement('span');
    date.className = 'project-item__date';
    date.textContent = `Editado: ${formatDate(p.updatedAt)}`;
    info.append(name, date);

    const actions = document.createElement('div');
    actions.className = 'project-item__actions';

    const openBtn = document.createElement('button');
    openBtn.className = 'btn btn--icon';
    openBtn.title = 'Abrir';
    openBtn.appendChild(Icon('folder-open', 16));
    openBtn.addEventListener('click', () => {
      if (!this.callbacks) return;
      this.callbacks.onOpen(p.id);
      this.close();
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn--icon';
    delBtn.title = 'Borrar';
    delBtn.appendChild(Icon('trash-2', 16));
    delBtn.addEventListener('click', () => {
      void this.confirmDelete(p);
    });

    actions.append(openBtn, delBtn);
    row.append(info, actions);
    return row;
  }

  /** Confirma y borra el proyecto (destructivo: exige confirmación, C5e). */
  private async confirmDelete(p: ProjectMeta): Promise<void> {
    const ok = await confirmDialog(
      `Se borrará el proyecto «${p.nombre}» definitivamente. Esta acción no se puede deshacer.`,
      'Borrar',
    );
    if (ok) await this.doDelete(p);
  }

  /** Borra el proyecto y refresca la lista (criterio: borrar refresca). */
  private async doDelete(p: ProjectMeta): Promise<void> {
    this.setBusy(true);
    this.setError(null);
    try {
      await deleteMyProject(p.id);
      await this.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'error desconocido';
      this.setError(`No se pudo borrar «${p.nombre}» (${msg})`);
    } finally {
      this.setBusy(false);
    }
  }
}

/** Fecha legible; si la cadena no es válida, muestra '—'. */
function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString();
}