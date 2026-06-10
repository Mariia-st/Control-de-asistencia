import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../../servicios/api-service';
import { AuthStateService } from '../../servicios/auth-state.service';
import { AlumnoAsistenciaHoyResponse, AsistenciaEstado, Clase } from '../../entities';

/** Inicio del alumno: clases inscritas, asistencia de hoy y unirse con código. Usado en: ruta /alumno/inicio. */
@Component({
  selector: 'app-alumno-inicio',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './alumno-inicio.html',
  styleUrl: './alumno-inicio.css',
})
export class AlumnoInicio implements OnInit {

  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthStateService);

  /** Clases en las que está inscrito el alumno. Usado en: alumno-inicio.html (lista de clases). */
  readonly clases = signal<Clase[]>([]);
  /** Asistencia de hoy en todas sus clases. Usado en: alumno-inicio.html (badges de estado). */
  readonly asistenciaHoy = signal<AlumnoAsistenciaHoyResponse | null>(null);
  /** ID de la clase de la que se está saliendo. Usado en: alumno-inicio.html (botón Salir deshabilitado). */
  readonly leavingId = signal<number | null>(null);

  /** Indica carga de clases. Usado en: alumno-inicio.html (spinner). */
  readonly loading = signal(false);
  /** Indica carga de asistencia de hoy. Usado en: alumno-inicio.html (spinner). */
  readonly loadingAsistencia = signal(false);
  /** Indica petición de unirse a clase. Usado en: alumno-inicio.html (botón Unirse). */
  readonly joining = signal(false);
  /** Mensaje de error. Usado en: alumno-inicio.html (alerta roja). */
  readonly error = signal<string | null>(null);
  /** Mensaje de éxito. Usado en: alumno-inicio.html (alerta verde). */
  readonly success = signal<string | null>(null);

  /** Resumen de presentes/ausentes/sin marcar de hoy. Usado en: alumno-inicio.html (tarjetas de resumen). */
  readonly resumenHoy = computed(() => {
    const clases = this.asistenciaHoy()?.clases ?? [];
    const presentes = clases.filter((c) => c.asistencia?.estado === 'presente').length;
    const ausentes = clases.filter((c) => c.asistencia?.estado === 'ausente').length;
    const sinMarcar = clases.filter((c) => !c.asistencia).length;
    return { presentes, ausentes, sinMarcar, total: clases.length };
  });

  /** Formulario para unirse a una clase con código. Usado en: alumno-inicio.html, onUnirse. */
  readonly codigoForm = new FormGroup({
    codigo: new FormControl('', {
      validators: [Validators.required, Validators.minLength(4)],
      nonNullable: true,
    }),
  });

  /** Redirige si es profesor o carga clases y asistencia. Usado en: arranque del componente. */
  ngOnInit(): void {
    const boot = (): void => {
      if (this.auth.isProfesor()) {
        this.router.navigateByUrl('/inicio');
        return;
      }
      this.loadClases();
      this.loadAsistenciaHoy();
    };
    if (this.auth.isLogged() && this.auth.role().length === 0) {
      this.auth.loadMe().subscribe(() => boot());
    } else {
      boot();
    }
  }

  /** Carga las clases del alumno. Usado en: ngOnInit, onUnirse, onSalirClase. */
  loadClases(): void {
    this.loading.set(true);
    this.error.set(null);

    this.api
      .get<Clase[]>('alumno/clases')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => this.clases.set(res),
        error: () => {
          this.clases.set([]);
          this.error.set('No se pudieron cargar tus clases.');
        },
      });
  }

  /** Carga la asistencia de hoy del alumno. Usado en: ngOnInit, onUnirse, onSalirClase. */
  loadAsistenciaHoy(): void {
    this.loadingAsistencia.set(true);

    this.api
      .get<AlumnoAsistenciaHoyResponse>('alumno/asistencia/hoy')
      .pipe(finalize(() => this.loadingAsistencia.set(false)))
      .subscribe({
        next: (res) => this.asistenciaHoy.set(res),
        error: () => this.asistenciaHoy.set(null),
      });
  }

  /** Devuelve el estado de asistencia de hoy de una clase. Usado en: alumno-inicio.html (badge por clase). */
  estadoHoy(claseId: number): AsistenciaEstado | null {
    const item = this.asistenciaHoy()?.clases.find((c) => c.clase_id === claseId);
    return item?.asistencia?.estado ?? null;
  }

  /** Etiqueta legible del estado de asistencia. Usado en: alumno-inicio.html (badge). */
  estadoLabel(estado: AsistenciaEstado | null): string {
    if (estado === 'presente') return 'Presente';
    if (estado === 'ausente') return 'Ausente';
    return 'Sin marcar';
  }

  /** Clase CSS del badge según el estado. Usado en: alumno-inicio.html (badge). */
  estadoClass(estado: AsistenciaEstado | null): string {
    if (estado === 'presente') return 'badge-presente';
    if (estado === 'ausente') return 'badge-ausente';
    return 'badge-sin-marcar';
  }

  /** Une al alumno a una clase con el código introducido. Usado en: alumno-inicio.html (botón Unirse). */
  onUnirse(): void {
    if (this.codigoForm.invalid) {
      this.codigoForm.markAllAsTouched();
      return;
    }

    const codigo = this.codigoForm.controls.codigo.value.trim().toUpperCase();
    this.joining.set(true);
    this.error.set(null);
    this.success.set(null);

    this.api
      .post('alumno/unirse', { codigo })
      .pipe(finalize(() => this.joining.set(false)))
      .subscribe({
        next: (res) => {
          const data = res as unknown as { message: string; clase: Clase };
          this.success.set(data.message);
          this.codigoForm.reset();
          this.loadClases();
          this.loadAsistenciaHoy();
        },
        error: (err) => {
          const msg = err?.error?.message ?? 'No se pudo unir a la clase.';
          this.error.set(msg);
        },
      });
  }

  /** Sale de una clase tras confirmación. Usado en: alumno-inicio.html (botón Salir). */
  onSalirClase(clase: Clase): void {
    if (!confirm(`¿Salir de la clase "${clase.nombre}"?`)) {
      return;
    }

    this.leavingId.set(clase.id);
    this.error.set(null);
    this.success.set(null);

    this.api
      .delete<{ message: string }>(`alumno/clases/${clase.id}`)
      .pipe(finalize(() => this.leavingId.set(null)))
      .subscribe({
        next: (res) => {
          this.success.set(res.message);
          this.loadClases();
          this.loadAsistenciaHoy();
        },
        error: (err) => {
          this.error.set(err?.error?.message ?? 'No se pudo salir de la clase.');
        },
      });
  }
}
