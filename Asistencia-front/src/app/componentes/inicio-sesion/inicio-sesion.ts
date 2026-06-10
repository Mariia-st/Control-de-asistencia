import { Component, inject, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { AbstractControl, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ApiService } from '../../servicios/api-service';
import { LoginRequest, RegisterRequest } from '../../entities';
import { Router } from '@angular/router';
import { AuthStateService } from '../../servicios/auth-state.service';

/** Pantalla de login y registro. Usado en: App (cuando no hay sesión). */
@Component({
  selector: 'app-login',
  imports: [MatIcon, ReactiveFormsModule],
  templateUrl: './inicio-sesion.html',
  styleUrl: './inicio-sesion.css',
})
export class Login {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly authState = inject(AuthStateService);

  /** true = formulario de registro, false = login. Usado en: login.html (toggle de modo). */
  public isRegisterMode = signal<boolean>(false);
  /** Mensaje de error de la última petición. Usado en: login.html (alerta de error). */
  public readonly errorMessage = signal<string | null>(null);
  /** Indica si hay una petición en curso. Usado en: login.html (botón deshabilitado). */
  public readonly loading = signal(false);
  /** Muestra u oculta los campos de contraseña. Usado en: login.html (icono ojo). */
  public readonly showPassword = signal(false);

  /** Formulario reactivo compartido para login y registro. Usado en: login.html, onSubmit, toggleMode. */
  public myForm = new FormGroup({
    email: new FormControl('', {
      validators: [Validators.required, Validators.email],
      nonNullable: true,
    }),
    name: new FormControl('', {
      validators: [],
      nonNullable: true,
    }),
    apellido: new FormControl('', {
      validators: [],
      nonNullable: true,
    }),
    role: new FormControl('', {
      validators: [],
      nonNullable: true,
    }),
    password: new FormControl('', {
      validators: [Validators.required],
      nonNullable: true,
    }),
    password_confirmation: new FormControl('', {
      validators: [],
      nonNullable: true,
    }),
  });

  /** Valida que contraseña y confirmación coincidan en modo registro. Usado en: toggleMode (setValidators). */
  private passwordMatchValidator = (form: AbstractControl): ValidationErrors | null => {
    const password = form.get('password')?.value;
    const passwordConfirmation = form.get('password_confirmation')?.value;
    return password === passwordConfirmation ? null : { passwordMismatch: true };
  };

  /** Alterna visibilidad de los campos de contraseña. Usado en: login.html (botón ojo). */
  toggleShowPassword(): void {
    this.showPassword.update((visible) => !visible);
  }

  /** Cambia entre modo login y registro, ajustando validadores. Usado en: login.html (enlace "Registrarse"). */
  toggleMode() {
    this.isRegisterMode.set(!this.isRegisterMode());
    this.errorMessage.set(null);
    this.showPassword.set(false);

    const name = this.myForm.controls.name;
    const role = this.myForm.controls.role;
    const apellido = this.myForm.controls.apellido;
    const password = this.myForm.controls.password;
    const passwordConfirmation = this.myForm.controls.password_confirmation;

    if (this.isRegisterMode()) {
      name.setValidators([Validators.required, Validators.minLength(2)]);
      apellido.setValidators([Validators.required, Validators.minLength(2)]);
      role.setValidators([Validators.required]);
      password.setValidators([Validators.required, Validators.minLength(6)]);
      passwordConfirmation.setValidators([Validators.required]);
      this.myForm.setValidators([this.passwordMatchValidator]);
    } else {
      name.setValidators([]);
      apellido.setValidators([]);
      role.setValidators([]);
      password.setValidators([Validators.required]);
      passwordConfirmation.setValidators([]);
      this.myForm.clearValidators();
      name.setValue('');
      role.setValue('');
      passwordConfirmation.setValue('');
    }

    name.updateValueAndValidity();
    role.updateValueAndValidity();
    apellido.updateValueAndValidity();
    password.updateValueAndValidity();
    passwordConfirmation.updateValueAndValidity();
    this.myForm.updateValueAndValidity();
  }

  /** Envía login o registro según el modo activo y redirige al home del rol. Usado en: login.html (submit del formulario). */
  onSubmit() {
    if (this.myForm.invalid) {
      this.myForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.loading.set(true);

    const data = this.myForm.getRawValue();
    const request$ = this.isRegisterMode()
      ? this.api.register(data as RegisterRequest)
      : this.api.login(data as LoginRequest);

    request$.subscribe({
      next: (res) => {
        this.authState.startSession(res.access_token).subscribe(() => {
          this.loading.set(false);
          this.router.navigateByUrl(this.authState.homeRoute());
        });
      },
      error: (err) => {
        this.loading.set(false);
        const msg =
          err?.error?.message ??
          err?.error?.error ??
          (this.isRegisterMode()
            ? 'No se pudo crear la cuenta. Revisa los datos e inténtalo de nuevo.'
            : 'Email o contraseña incorrectos.');
        this.errorMessage.set(msg);
      },
    });
  }
}
