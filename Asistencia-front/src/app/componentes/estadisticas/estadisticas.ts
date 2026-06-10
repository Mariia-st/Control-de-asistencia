import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { ApiService } from '../../servicios/api-service';
import {
  Clase,
  DiaAsistenciaResumen,
  DistribucionHoy,
  EstadisticasClase,
  EstadisticasClaseResponse,
  EstadisticasDiaResumen,
} from '../../entities';

/** Pantalla de estadísticas de asistencia con gráficos de barras y circular. Usado en: ruta /estadísticas. */
@Component({
  selector: 'app-statistics',
  imports: [DecimalPipe],
  templateUrl: './estadisticas.html',
  styleUrl: './estadisticas.css',
})
export class Statistics implements OnInit {
  private api = inject(ApiService);

  /** Altura máxima de cada barra del gráfico en píxeles. Usado en: statistics.html, barHeightPx. */
  readonly chartBarMaxPx = 160;

  /** Clases del profesor. Usado en: statistics.html (selector de clase). */
  readonly clases = signal<Clase[]>([]);
  /** ID de la clase seleccionada. Usado en: statistics.html, loadDatos. */
  readonly selectedIdClase = signal<string | number>(0);
  /** Indica carga de clases. Usado en: statistics.html (spinner). */
  readonly loadingClases = signal(false);
  /** Indica carga de estadísticas. Usado en: statistics.html (spinner). */
  readonly loadingDatos = signal(false);
  /** Mensaje de error. Usado en: statistics.html (alerta). */
  readonly error = signal<string | null>(null);
  /** Resumen numérico de hoy. Usado en: statistics.html (tarjetas). */
  readonly estadisticas = signal<EstadisticasClase | null>(null);
  /** Distribución presente/ausente/sin marcar de hoy. Usado en: statistics.html (gráfico circular). */
  readonly distribucionHoy = signal<DistribucionHoy | null>(null);
  /** Datos de los últimos 7 días para el gráfico de barras. Usado en: statistics.html. */
  readonly ultimos7Dias = signal<DiaAsistenciaResumen[]>([]);

  /** Valor máximo de las barras para escalar alturas. Usado en: barHeightPx. */
  readonly maxBarValue = computed(() => {
    const dias = this.ultimos7Dias();
    if (!dias.length) return 1;
    const max = Math.max(...dias.flatMap((d) => [d.presentes, d.ausentes]));
    return Math.max(1, max);
  });

  /** Gradiente CSS del gráfico circular según distribución de hoy. Usado en: statistics.html (style del pie). */
  readonly pieGradient = computed(() => {
    const d = this.distribucionHoy();
    if (!d || d.total === 0) {
      return 'conic-gradient(#cfe2ff 0deg 360deg)';
    }
    const pPresentes = (d.presentes / d.total) * 100;
    const pAusentes = (d.ausentes / d.total) * 100;
    const pSinMarcar = (d.sinMarcar / d.total) * 100;
    const a = pPresentes;
    const b = a + pAusentes;
    const c = b + pSinMarcar;
    return `conic-gradient(
      #1a4ce1 0% ${a}%,
      #6eb5ff ${a}% ${b}%,
      #cfe2ff ${b}% ${c}%
    )`;
  });

  /** Carga las clases al entrar. Usado en: arranque del componente. */
  ngOnInit(): void {
    this.loadClases();
  }

  /** Al elegir clase carga sus estadísticas. Usado en: statistics.html (select). */
  onClaseSelected(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedIdClase.set(value);

    if (value) {
      this.loadDatos(Number(value));
    } else {
      this.estadisticas.set(null);
      this.distribucionHoy.set(null);
      this.ultimos7Dias.set([]);
    }
  }

  /** Calcula el porcentaje de un valor respecto al total. Usado en: statistics.html (etiquetas del pie). */
  pctDelTotal(valor: number, total: number): number {
    return total > 0 ? Math.round((valor / total) * 100) : 0;
  }

  /** Calcula la altura en px de una barra del gráfico. Usado en: statistics.html (barras de 7 días). */
  barHeightPx(valor: number): number {
    if (valor <= 0) return 0;
    const max = this.maxBarValue();
    return Math.round((valor / max) * this.chartBarMaxPx);
  }

  /** Carga las clases del profesor. Usado en: ngOnInit. */
  private loadClases(): void {
    this.loadingClases.set(true);
    this.api
      .get<Clase[]>('profesor/clases')
      .pipe(finalize(() => this.loadingClases.set(false)))
      .subscribe({
        next: (res) => this.clases.set(res),
        error: () => this.error.set('Error al cargar las clases.'),
      });
  }

  /** Carga estadísticas de los últimos 7 días de la clase. Usado en: onClaseSelected. */
  private loadDatos(claseId: number): void {
    this.loadingDatos.set(true);
    this.error.set(null);

    this.api
      .get<EstadisticasClaseResponse>(`clases/${claseId}/estadisticas?dias=7`)
      .pipe(finalize(() => this.loadingDatos.set(false)))
      .subscribe({
        next: (res) => {
          this.estadisticas.set({
            total: res.total_alumnos,
            presentes_hoy: res.hoy.presentes,
            ausentes_hoy: res.hoy.ausentes,
            tasa_asistencia: res.hoy.tasa_asistencia,
          });

          this.distribucionHoy.set({
            presentes: res.hoy.presentes,
            ausentes: res.hoy.ausentes,
            sinMarcar: res.hoy.sin_marcar,
            total: res.total_alumnos,
          });

          this.ultimos7Dias.set(res.por_dia.map((dia) => this.toDiaResumen(dia)));
        },
        error: () => {
          this.estadisticas.set(null);
          this.distribucionHoy.set(null);
          this.ultimos7Dias.set([]);
          this.error.set('No se pudieron cargar las estadísticas.');
        },
      });
  }

  /** Convierte un día del backend al formato del gráfico. Usado en: loadDatos. */
  private toDiaResumen(dia: EstadisticasDiaResumen): DiaAsistenciaResumen {
    return {
      fecha: dia.fecha,
      label: this.formatDiaLabel(dia.fecha),
      presentes: dia.presentes,
      ausentes: dia.ausentes,
      sinMarcar: dia.sin_marcar,
    };
  }

  /** Formatea una fecha ISO como etiqueta corta (ej. "08 jun"). Usado en: toDiaResumen. */
  private formatDiaLabel(isoDate: string): string {
    const [y, m, d] = isoDate.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  }
}
