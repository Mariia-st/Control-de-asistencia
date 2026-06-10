import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  AlumnoAsistencia,
  AsistenciaBulkPayload,
  AsistenciaClaseResponse,
  Clase,
} from '../../entities';
import { ApiService } from '../../servicios/api-service';

/** Pantalla de registro diario de asistencia por clase y fecha. Usado en: ruta /asistencia. */
@Component({
  selector: 'app-register-attendance',
  imports: [FormsModule],
  templateUrl: './registrar-asistencia.html',
  styleUrl: './registrar-asistencia.css',
})
export class RegisterAttendance implements OnInit {
  private api = inject(ApiService);

  /** Clases del profesor autenticado. Usado en: register-attendance.html (selector de clase). */
  public readonly clases = signal<Clase[]>([]);
  /** Alumnos de la clase con su asistencia del día. Usado en: register-attendance.html (tabla). */
  public readonly alumnos = signal<AlumnoAsistencia[]>([]);
  /** ID de la clase elegida. Usado en: register-attendance.html, loadAsistencias, markAsistencia. */
  public readonly selectedClaseId = signal<number | null>(null);
  /** Fecha del registro (YYYY-MM-DD). Usado en: register-attendance.html (input date). */
  public readonly fecha = signal(this.todayIso());
  /** Indica carga de clases o asistencias. Usado en: register-attendance.html (spinner). */
  public readonly loading = signal(false);
  /** Alumno cuyo botón está guardando. Usado en: register-attendance.html (estado de botón). */
  public readonly savingAlumnoId = signal<number | null>(null);
  /** Mensaje de error. Usado en: register-attendance.html (alerta). */
  public readonly error = signal<string | null>(null);

  /** Datos de la clase seleccionada. Usado en: register-attendance.html (cabecera de tabla). */
  public readonly selectedClase = computed(() => {
    const id = this.selectedClaseId();
    if (!id) return null;
    return this.clases().find((c) => c.id === id) ?? null;
  });

  /** true si todos los alumnos están marcados presentes. Usado en: register-attendance.html (checkbox "todos presentes"). */
  readonly todosPresentes = computed(() => {
    const list = this.alumnos();
    return list.length > 0 && list.every((a) => a.asistencia?.estado === 'presente');
  });

  /** true si todos los alumnos están marcados ausentes. Usado en: register-attendance.html (checkbox "todos ausentes"). */
  readonly todosAusentes = computed(() => {
    const list = this.alumnos();
    return list.length > 0 && list.every((a) => a.asistencia?.estado === 'ausente');
  });

  /** Carga las clases al entrar. Usado en: arranque del componente. */
  ngOnInit(): void {
    this.loadClases();
  }

  /** Al cambiar la clase recarga alumnos y asistencia. Usado en: register-attendance.html (select). */
  onClaseChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const claseId = value ? Number(value) : null;
    this.selectedClaseId.set(claseId);
    if (claseId) {
      this.loadAsistencias();
    } else {
      this.alumnos.set([]);
    }
  }

  /** Al cambiar la fecha recarga la asistencia de ese día. Usado en: register-attendance.html (input date). */
  onFechaChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.fecha.set(value);
    if (this.selectedClaseId()) {
      this.loadAsistencias();
    }
  }

  /** Guarda la asistencia masiva de todos los alumnos. Usado en: register-attendance.html (botón Guardar). */
  markAsistencia(): void {
    this.loading.set(true);
    const body = {
      fecha: this.fecha(),
      asistencias: this.alumnos().map((a) => ({
        alumno_id: a.id,
        estado: a.asistencia?.estado ?? 'ausente' ,
      })),
    };
    this.api
      .put<AsistenciaBulkPayload>(`clases/${this.selectedClaseId()}/asistencias`, body)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => {
          this.loadAsistencias();
        },
        error: () => {
          this.error.set('No se pudo guardar la asistencia.');
        },
      });
  }

  /** Marca todos presentes o desmarca según el checkbox. Usado en: register-attendance.html. */
  marcarTodosComoPresentes(event: Event): void {
    this.marcarTodosPorEstado(event, 'presente');
  }

  /** Marca todos ausentes o desmarca según el checkbox. Usado en: register-attendance.html. */
  marcarTodosComoAusentes(event: Event): void {
    this.marcarTodosPorEstado(event, 'ausente');
  }

  /** Aplica presente/ausente a todos los alumnos según el estado del checkbox. Usado en: marcarTodosComoPresentes/Ausentes. */
  private marcarTodosPorEstado(
    event: Event,
    estado: 'presente' | 'ausente'
  ): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.alumnos.update((list) =>
      list.map((a) => ({
        ...a,
        asistencia: checked
          ? {
              id: a.asistencia?.id ?? 0,
              estado,
              fecha: this.fecha(),
            }
          : null,
      })),
    );
  }

  /** Marca un alumno como presente o ausente en memoria (antes de guardar). Usado en: register-attendance.html (botones por fila). */
  setPendiente(alumno: AlumnoAsistencia, estado: 'presente' | 'ausente'): void {
    this.alumnos.update((list) =>
      list.map((a) =>
        a.id === alumno.id
          ? {
              ...a,
              asistencia: {
                id: a.asistencia?.id ?? 0,
           estado,
                fecha: this.fecha(),
              },
            }
          : a,
      ),
    );
  }

  /** true si el alumno está marcado presente. Usado en: register-attendance.html (clase CSS del botón). */
  isPresente(alumno: AlumnoAsistencia): boolean {
    return alumno.asistencia?.estado === 'presente';
  }

  /** true si el alumno está marcado ausente. Usado en: register-attendance.html (clase CSS del botón). */
  isAusente(alumno: AlumnoAsistencia): boolean {
    return alumno.asistencia?.estado === 'ausente';
  }

  /** Carga las clases del profesor. Usado en: ngOnInit. */
  private loadClases(): void {
    this.loading.set(true);
    this.api
      .get<Clase[]>('profesor/clases')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => this.clases.set(res),
        error: () => this.error.set('No se pudieron cargar las clases.'),
      });
  }

  /** Carga alumnos y asistencia del día para la clase seleccionada. Usado en: onClaseChange, onFechaChange, markAsistencia. */
  private loadAsistencias(): void {
    const claseId = this.selectedClaseId();
    if (!claseId) return;

    this.loading.set(true);
    this.error.set(null);

    this.api
      .get<AsistenciaClaseResponse>(`clases/${claseId}/asistencias?fecha=${this.fecha()}`)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => this.alumnos.set(res.alumnos),
        error: () => {
          this.alumnos.set([]);
          this.error.set('No se pudo cargar la asistencia del día.');
        },
      });
  }

  /** Fecha de hoy en formato ISO. Usado en: fecha (signal inicial). */
  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
