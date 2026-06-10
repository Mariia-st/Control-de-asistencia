import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../../servicios/api-service';
import { AuthStateService } from '../../servicios/auth-state.service';

/** Página de perfil del usuario para cambiar contraseña. Usado en: ruta /perfil. */
@Component({
  selector: 'app-perfil',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './perfil.html',
  styleUrl: './perfil.css',
})
export class Perfil {
  private readonly api = inject(ApiService);
  /** Datos del usuario para mostrar nombre y email. Usado en: perfil.html. */
  protected readonly auth = inject(AuthStateService);

  /** Indica petición en curso. Usado en: perfil.html (botón deshabilitado). */
  readonly loading = signal(false);
  /** Mensaje de éxito tras cambiar contraseña. Usado en: perfil.html (alerta verde). */
  readonly success = signal<string | null>(null);
  /** Mensaje de error. Usado en: perfil.html (alerta roja). */
  readonly error = signal<string | null>(null);

  /** Formulario de cambio de contraseña. Usado en: perfil.html, onChangePassword. */
  readonly passwordForm = new FormGroup({
    current_password: new FormControl('', {
      validators: [Validators.required],
      nonNullable: true,
    }),
    password: new FormControl('', {
      validators: [Validators.required, Validators.minLength(6)],
      nonNullable: true,
    }),
    password_confirmation: new FormControl('', {
      validators: [Validators.required],
      nonNullable: true,
    }),
  });

  /** Envía el cambio de contraseña al backend. Usado en: perfil.html (submit del formulario). */
  onChangePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const raw = this.passwordForm.getRawValue();
    if (raw.password !== raw.password_confirmation) {
      this.error.set('Las contraseñas nuevas no coinciden.');
      this.success.set(null);
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.success.set(null);

    this.api
      .changePassword(raw)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.success.set(res.message);
          this.passwordForm.reset();
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudo cambiar la contraseña.');
        },
      });
  }
}
