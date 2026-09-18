/**
 * ui/AuthModal.ts — Login / Registro del Studio (C5a).
 *
 * Modal con dos pestañas (Iniciar sesión / Registrarse) que consume la API
 * del backend vía apiLogin/apiRegister. Los errores del contrato se muestran
 * en una caja roja con el `message` amigable (nunca el code crudo; el code
 * queda para el código, no para el usuario).
 *
 * Patrón de modal idéntico a DungeonBrowser (overlay + .modal + header/
 * footer + cierre con Esc/overlay/×), siguiendo DESIGN.md.
 */
import { apiLogin, apiRegister, ApiError } from '../io/api';
import type { AuthSession } from '../io/session';

export class AuthModal {
  private overlay: HTMLDivElement;
  private tabLogin: HTMLButtonElement;
  private tabRegister: HTMLButtonElement;
  private formLogin: HTMLFormElement;
  private formRegister: HTMLFormElement;
  private errorBox: HTMLDivElement;
  private submitLogin: HTMLButtonElement;
  private submitRegister: HTMLButtonElement;
  private onSuccess: ((session: AuthSession) => void) | null = null;
  private busy = false;

  constructor() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'modal-overlay auth-modal';
    this.overlay.addEventListener('mousedown', (e) => {
      if (e.target === this.overlay) this.close();
    });

    const modal = document.createElement('div');
    modal.className = 'modal';

    // Cabecera
    const header = document.createElement('div');
    header.className = 'modal__header';
    const title = document.createElement('h2');
    title.className = 'modal__title';
    title.textContent = 'Cuenta de Iliac';
    const closeX = document.createElement('button');
    closeX.className = 'btn btn--icon';
    closeX.title = 'Cerrar (Esc)';
    closeX.textContent = '×';
    closeX.addEventListener('click', () => this.close());
    header.append(title, closeX);
    modal.appendChild(header);

    // Pestañas
    const tabs = document.createElement('div');
    tabs.className = 'auth-tabs';
    this.tabLogin = this.makeTab('Iniciar sesión', true, () => this.show('login'));
    this.tabRegister = this.makeTab('Registrarse', false, () => this.show('register'));
    tabs.append(this.tabLogin, this.tabRegister);
    modal.appendChild(tabs);

    // Caja de error compartida (se rellena según el formulario activo)
    this.errorBox = document.createElement('div');
    this.errorBox.className = 'auth-error';
    modal.appendChild(this.errorBox);

    // Formulario de login
    this.formLogin = document.createElement('form');
    this.formLogin.className = 'auth-form';
    this.formLogin.append(
      this.field('Usuario', this.input('text', 'login-login', '')),
      this.field('Contraseña', this.input('password', 'login-password', '')),
    );
    this.submitLogin = this.submit('Entrar');
    this.formLogin.appendChild(this.submitLogin);
    this.formLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.doLogin();
    });
    modal.appendChild(this.formLogin);

    // Formulario de registro
    this.formRegister = document.createElement('form');
    this.formRegister.className = 'auth-form';
    this.formRegister.append(
      this.field('Nombre', this.input('text', 'reg-nombre', '')),
      this.field('Apellido', this.input('text', 'reg-apellido', '')),
      this.field('Usuario', this.input('text', 'reg-login', '')),
      this.field('Email (opcional)', this.input('email', 'reg-email', '')),
      this.field('Contraseña (mín. 8)', this.input('password', 'reg-password', '')),
    );
    this.submitRegister = this.submit('Crear cuenta');
    this.formRegister.appendChild(this.submitRegister);
    this.formRegister.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.doRegister();
    });
    modal.appendChild(this.formRegister);

    this.overlay.appendChild(modal);
    this.show('login');
  }

  /** Abre el modal; onSuccess recibe la sesión al autenticarse. */
  open(onSuccess: (session: AuthSession) => void): void {
    this.onSuccess = onSuccess;
    this.setError(null);
    document.body.appendChild(this.overlay);
    this.formLogin.querySelector('input')?.focus();
    document.addEventListener('keydown', this.onKey);
  }

  close(): void {
    this.overlay.remove();
    document.removeEventListener('keydown', this.onKey);
    this.onSuccess = null;
  }

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') this.close();
  };

  private makeTab(label: string, initial: boolean, onSelect: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `auth-tabs__tab${initial ? ' active' : ''}`;
    btn.textContent = label;
    btn.addEventListener('click', onSelect);
    return btn;
  }

  private input(type: string, id: string, placeholder: string): HTMLInputElement {
    const el = document.createElement('input');
    el.type = type;
    el.id = `${id}-c5a`;
    el.className = 'input';
    el.placeholder = placeholder;
    el.autocomplete = type === 'password' ? 'current-password' : 'username';
    return el;
  }

  private field(labelText: string, input: HTMLInputElement): HTMLLabelElement {
    const label = document.createElement('label');
    label.className = 'field';
    const span = document.createElement('span');
    span.className = 'field__label';
    span.textContent = labelText;
    label.append(span, input);
    return label;
  }

  private submit(text: string): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'btn btn--primary';
    btn.textContent = text;
    return btn;
  }

  private setError(message: string | null): void {
    this.errorBox.textContent = '';
    this.errorBox.classList.toggle('auth-error--visible', message !== null);
    if (message) this.errorBox.textContent = message;
  }

  private setBusy(busy: boolean): void {
    this.busy = busy;
    this.submitLogin.disabled = busy;
    this.submitRegister.disabled = busy;
  }

  /** Muestra Login o Registro y limpia el error de la pestaña anterior. */
  private show(which: 'login' | 'register'): void {
    const login = which === 'login';
    this.tabLogin.classList.toggle('active', login);
    this.tabRegister.classList.toggle('active', !login);
    this.formLogin.hidden = !login;
    this.formRegister.hidden = login;
    this.setError(null);
  }

  private async doLogin(): Promise<void> {
    if (this.busy) return;
    const login = (this.formLogin.querySelector('#login-login-c5a') as HTMLInputElement).value.trim();
    const password = (this.formLogin.querySelector('#login-password-c5a') as HTMLInputElement).value;
    if (!login || !password) {
      this.setError('Usuario y contraseña son obligatorios');
      return;
    }
    this.setBusy(true);
    this.setError(null);
    try {
      const session = await apiLogin(login, password);
      this.emit(session);
    } catch (err) {
      this.setError(err instanceof ApiError ? err.message : 'Error inesperado al iniciar sesión');
      this.setBusy(false);
    }
  }

  private async doRegister(): Promise<void> {
    if (this.busy) return;
    const val = (id: string) =>
      (this.formRegister.querySelector(`#${id}-c5a`) as HTMLInputElement).value.trim();
    const nombre = val('reg-nombre');
    const apellido = val('reg-apellido');
    const login = val('reg-login');
    const email = val('reg-email');
    const password = (this.formRegister.querySelector('#reg-password-c5a') as HTMLInputElement).value;

    if (!nombre || !apellido || !login) {
      this.setError('Nombre, apellido y usuario son obligatorios');
      return;
    }
    if (password.length < 8) {
      this.setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    this.setBusy(true);
    this.setError(null);
    try {
      const session = await apiRegister({
        nombre,
        apellido,
        login,
        password,
        ...(email ? { emailPublico: email } : {}),
      });
      this.emit(session);
    } catch (err) {
      this.setError(err instanceof ApiError ? err.message : 'Error inesperado al registrarse');
      this.setBusy(false);
    }
  }

  private emit(session: AuthSession): void {
    this.setBusy(false);
    const cb = this.onSuccess;
    this.close();
    cb?.(session);
  }
}