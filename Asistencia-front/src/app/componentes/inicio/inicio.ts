import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../../servicios/api-service';
import { AsistenciaClaseResponse, Clase, EstadisticasClase } from '../../entities';
import { AuthStateService } from '../../servicios/auth-state.service';

/** Inicio del profesor: selector de clase y resumen de asistencia de hoy. Usado en: ruta /inicio. */
@Component({
  selector: 'app-home',
  imports: [RouterLinkActive, RouterLink],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Home implements OnInit {

  private api = inject(ApiService);
  private router = inject(Router);
  protected readonly auth = inject(AuthStateService);

  /** Clases del profesor. Usado en: home.html (selector de clase). */
  public readonly clase = signal<Clase[]>([]);
  /** ID de la clase seleccionada en el selector. Usado en: home.html, selectedClaseData, loadEstadisticas. */
  public readonly selectedIdClase = signal<string | number>(0);
  /** Resumen de asistencia de hoy de la clase elegida. Usado en: home.html (tarjetas de estadísticas). */
  public readonly estadisticas = signal<EstadisticasClase | null>(null);

  /** Indica carga de clases. Usado en: home.html (spinner). */
  public readonly loading = signal<boolean>(false);
  /** Indica carga de estadísticas. Usado en: home.html (spinner de resumen). */
  public readonly loadingEstadisticas = signal<boolean>(false);
  /** Mensaje de error. Usado en: home.html (alerta). */
  public readonly error = signal<string | null>(null);

  /** Datos de la clase actualmente seleccionada. Usado en: home.html (nombre y aula). */
  selectedClaseData = computed(() => {
    const id = this.selectedIdClase();
    if (!id) return null;
    return this.clase().find((c) => Number(c.id) === Number(id));
  });

  /** Redirige según rol o carga clases si es profesor. Usado en: arranque del componente. */
  ngOnInit() {
    const boot = (): void => {

      if (this.auth.isAdmin()) {
        this.router.navigateByUrl('/admin');
        return;
      }
      if (this.auth.isAlumno() && !this.auth.isProfesor()) {
        this.router.navigateByUrl('/alumno/inicio');
        return;
      }
      this.getClases();
    };

    if (this.auth.isLogged() && this.auth.role().length === 0) {
      this.auth.loadMe().subscribe(() => boot());
    } else {
      boot();
    }
  }

  /** Carga las clases del profesor desde el backend. Usado en: ngOnInit. */
  getClases() {
    this.loading.set(true);
    this.api
      .get<Clase[]>('profesor/clases')
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (res) => {
          this.clase.set(res);
          this.error.set(null);
        },
        error: () => {
          this.clase.set([]);
        },
      });
  }

  /** Carga la asistencia de hoy de la clase seleccionada. Usado en: onClaseSelected. */
  private loadEstadisticas(claseId: number): void {
    this.loadingEstadisticas.set(true);
    this.error.set(null);

    this.api
      .get<AsistenciaClaseResponse>(
        `clases/${claseId}/asistencias?fecha=${this.todayIso()}`
      )
      .pipe(finalize(() => this.loadingEstadisticas.set(false)))
      .subscribe({
        next: (res) => this.estadisticas.set(this.calcularEstadisticas(res.alumnos)),
        error: () => {
          this.estadisticas.set(null);
        },
      });
  }

  /** Al elegir una clase recarga el resumen de asistencia. Usado en: home.html (select de clase). */
  onClaseSelected(event: Event) {
    const element = event.target as HTMLSelectElement;
    const value = element.value;
    this.selectedIdClase.set(value);

    if (value) {
      this.loadEstadisticas(Number(value));
    } else {
      this.estadisticas.set(null);
    }
  }

  /** Calcula presentes, ausentes y tasa de asistencia del día. Usado en: loadEstadisticas. */
  private calcularEstadisticas(alumnos: AsistenciaClaseResponse['alumnos']): EstadisticasClase {
    const total = alumnos.length;
    const presentes_hoy = alumnos.filter(
      (a) => a.asistencia?.estado === 'presente'
    ).length;
    const ausentes_hoy = alumnos.filter(
      (a) => a.asistencia?.estado === 'ausente'
    ).length;

    const tasa_asistencia =
      total > 0 ? Math.round((presentes_hoy / total) * 100) : 0;

    return { total, presentes_hoy, ausentes_hoy, tasa_asistencia };
  }

  /** Devuelve la fecha de hoy en formato ISO (YYYY-MM-DD). Usado en: loadEstadisticas. */
  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
