import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { RouterLink } from '@angular/router';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { concatMap, finalize, from, map, Observable, of, reduce, switchMap } from 'rxjs';
import { ApiService } from '../../servicios/api-service';
import { AuthStateService } from '../../servicios/auth-state.service';
import { Asistencia, Clase } from '../../entities';
import { DatePipe } from '@angular/common';

/** Registro de asistencia con datos del alumno incluidos. Usado en: History (tabla e historial). */
export interface AsistenciaHistorial extends Asistencia {
  alumno?: {
    id: number;
    nombre: string;
    apellido: string;
    email: string;
  };
}

/** Respuesta paginada del historial de asistencia del profesor. Usado en: loadHistorial, fetchAllRegistros. */
interface AsistenciasPaginated {
  data: AsistenciaHistorial[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/** Pantalla de historial de asistencia con filtros y exportación PDF. Usado en: ruta /historial. */
@Component({
  selector: 'app-history',
  imports: [MatIconModule, MatPaginatorModule, RouterLink, DatePipe],
  templateUrl: './historial.html',
  styleUrl: './historial.css',
})
export class History implements OnInit {
  private api = inject(ApiService);
  protected readonly auth = inject(AuthStateService);

  /** Opciones de tamaño de página del paginador. Usado en: history.html (mat-paginator). */
  readonly pageSizeOptions = [10, 15, 25, 50];
  /** Clases del profesor. Usado en: history.html (selector de clase). */
  readonly clases = signal<Clase[]>([]);
  /** ID de la clase seleccionada. Usado en: history.html, loadHistorial. */
  readonly selectedIdClase = signal<number | null>(null);
  /** Filtro fecha desde. Usado en: history.html (input date). */
  readonly fechaDesde = signal('');
  /** Filtro fecha hasta. Usado en: history.html (input date). */
  readonly fechaHasta = signal('');
  /** Filtro por nombre de alumno. Usado en: history.html (input texto). */
  readonly filtroNombre = signal('');
  /** Registros de la página actual. Usado en: history.html (tabla). */
  readonly registros = signal<AsistenciaHistorial[]>([]);
  /** Total de registros que coinciden con los filtros. Usado en: history.html (paginador). */
  readonly totalRegistros = signal(0);
  /** Índice de página actual (0-based). Usado en: history.html (mat-paginator). */
  readonly pageIndex = signal(0);
  /** Tamaño de página actual. Usado en: history.html (mat-paginator). */
  readonly pageSize = signal(15);
  /** Indica carga de clases. Usado en: history.html (spinner). */
  readonly loadingClases = signal(false);
  /** Indica carga del historial. Usado en: history.html (spinner). */
  readonly loadingHistorial = signal(false);
  /** Indica generación del PDF. Usado en: history.html (botón descargar). */
  readonly loadingPdf = signal(false);
  /** Mensaje de error. Usado en: history.html (alerta). */
  readonly error = signal<string | null>(null);

  /** Datos de la clase seleccionada. Usado en: history.html (cabecera), generarPdf. */
  readonly claseSeleccionada = computed(() => {
    const id = this.selectedIdClase();
    return this.clases().find((c) => c.id === id) ?? null;
  });

  /** Etiqueta legible del rango de fechas activo. Usado en: history.html, generarPdf. */
  readonly rangoLabel = computed(() => {
    const desde = this.fechaDesde();
    const hasta = this.fechaHasta();
    if (desde && hasta) return `${this.formatFecha(desde)} – ${this.formatFecha(hasta)}`;
    if (desde) return `desde ${this.formatFecha(desde)}`;
    if (hasta) return `hasta ${this.formatFecha(hasta)}`;
    return 'hoy';
  });

  /** true si fechaDesde es posterior a fechaHasta. Usado en: history.html (deshabilitar buscar). */
  readonly rangoInvalido = computed(() => {
    const desde = this.fechaDesde();
    const hasta = this.fechaHasta();
    if (!desde || !hasta) return false;
    return desde > hasta;
  });

  /** Carga las clases al entrar. Usado en: arranque del componente. */
  ngOnInit(): void {
    this.loadClases();
  }

  /** Al elegir clase resetea filtros y carga historial de hoy. Usado en: history.html (select). */
  onClaseSelected(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const claseId = value ? Number(value) : null;
    this.selectedIdClase.set(claseId);
    this.error.set(null);

    if (claseId) {
      this.filtroNombre.set('');
      this.aplicarFiltroHoy();
      this.loadHistorial(true);
    } else {
      this.fechaDesde.set('');
      this.fechaHasta.set('');
      this.filtroNombre.set('');
      this.registros.set([]);
      this.totalRegistros.set(0);
      this.pageIndex.set(0);
    }
  }

  /** Actualiza el filtro fecha desde. Usado en: history.html (input date). */
  onFechaDesdeChange(event: Event): void {
    this.fechaDesde.set((event.target as HTMLInputElement).value);
  }

  /** Actualiza el filtro fecha hasta. Usado en: history.html (input date). */
  onFechaHastaChange(event: Event): void {
    this.fechaHasta.set((event.target as HTMLInputElement).value);
  }

  /** Actualiza el filtro por nombre de alumno. Usado en: history.html (input texto). */
  onFiltroNombreInput(event: Event): void {
    this.filtroNombre.set((event.target as HTMLInputElement).value);
  }

  /** Aplica los filtros y recarga el historial desde la página 1. Usado en: history.html (botón Buscar). */
  buscarHistorial(): void {
    if (!this.selectedIdClase()) return;
    if (this.rangoInvalido()) return;
    this.loadHistorial(true);
  }

  /** Restaura filtros a hoy y recarga. Usado en: history.html (botón Limpiar). */
  limpiarFiltro(): void {
    this.error.set(null);
    this.filtroNombre.set('');
    this.aplicarFiltroHoy();
    if (this.selectedIdClase()) {
      this.loadHistorial(true);
    } else {
      this.registros.set([]);
      this.totalRegistros.set(0);
      this.pageIndex.set(0);
    }
  }

  /** Cambia de página o tamaño de página. Usado en: history.html (mat-paginator). */
  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadHistorial();
  }

  /** Descarga el historial completo como PDF. Usado en: history.html (botón Descargar PDF). */
  descargarPdf(): void {
    if (!this.selectedIdClase() || this.totalRegistros() === 0) return;

    this.loadingPdf.set(true);
    this.error.set(null);

    this.fetchAllRegistros()
      .pipe(finalize(() => this.loadingPdf.set(false)))
      .subscribe({
        next: (registros) => this.generarPdf(registros),
        error: () => this.error.set('No se pudo generar el PDF del historial.'),
      });
  }

  /** Devuelve la etiqueta legible del estado. Usado en: history.html (tabla), generarPdf. */
  estadoLabel(estado: string): string {
    return estado === 'presente' ? 'Presente' : 'Ausente';
  }

  /** Devuelve la clase CSS del badge de estado. Usado en: history.html (tabla). */
  estadoClass(estado: string): string {
    return estado === 'presente' ? 'badge-presente' : 'badge-ausente';
  }

  /** Establece fechaDesde y fechaHasta al día de hoy. Usado en: onClaseSelected, limpiarFiltro. */
  private aplicarFiltroHoy(): void {
    const hoy = this.hoyIso();
    this.fechaDesde.set(hoy);
    this.fechaHasta.set(hoy);
  }

  /** Fecha de hoy en formato ISO local. Usado en: aplicarFiltroHoy. */
  private hoyIso(): string {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  /** Formatea una fecha ISO como DD/MM/YYYY. Usado en: rangoLabel, fechaRegistro. */
  private formatFecha(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  /** Formatea la fecha de un registro para mostrar en tabla o PDF. Usado en: generarPdf. */
  private fechaRegistro(registro: AsistenciaHistorial): string {
    const raw = String(registro.fecha);
    const iso = raw.includes('T') ? raw.split('T')[0] : raw.slice(0, 10);
    return this.formatFecha(iso);
  }

  /** Construye los query params para la petición de historial. Usado en: loadHistorial, fetchAllRegistros. */
  private buildHistorialParams(page: number, perPage: number): string {
    const claseId = this.selectedIdClase();
    const params = new URLSearchParams({
      clase_id: String(claseId),
      page: String(page),
      per_page: String(perPage),
    });
    if (this.fechaDesde()) params.set('fecha_desde', this.fechaDesde());
    if (this.fechaHasta()) params.set('fecha_hasta', this.fechaHasta());
    const nombre = this.filtroNombre().trim();
    if (nombre) params.set('nombre', nombre);
    return params.toString();
  }

  /** Obtiene todos los registros paginando secuencialmente para el PDF. Usado en: descargarPdf. */
  private fetchAllRegistros(): Observable<AsistenciaHistorial[]> {
    const perPage = 500;

    return this.api
      .get<AsistenciasPaginated>(`asistencias?${this.buildHistorialParams(1, perPage)}`)
      .pipe(
        switchMap((first) => {
          const lastPage = first.last_page ?? 1;
          if (lastPage <= 1) {
            return of(first.data ?? []);
          }

          const paginas = Array.from({ length: lastPage - 1 }, (_, i) => i + 2);
          const inicial = [...(first.data ?? [])];

          return from(paginas).pipe(
            concatMap((page) =>
              this.api.get<AsistenciasPaginated>(
                `asistencias?${this.buildHistorialParams(page, perPage)}`,
              ),
            ),
            map((pagina) => pagina.data ?? []),
            reduce((acc, chunk) => acc.concat(chunk), inicial),
          );
        }),
      );
  }

  /** Genera y descarga el PDF con jsPDF. Usado en: descargarPdf. */
  private generarPdf(registros: AsistenciaHistorial[]): void {
    const clase = this.claseSeleccionada();
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text('Historial de asistencia', 14, 18);
    doc.setFontSize(11);
    doc.text(`Clase: ${clase?.nombre ?? '—'} — Aula ${clase?.aula ?? '—'}`, 14, 26);
    doc.text(`Rango: ${this.rangoLabel()}`, 14, 33);
    const nombreFiltro = this.filtroNombre().trim();
    if (nombreFiltro) {
      doc.text(`Alumno: contiene "${nombreFiltro}"`, 14, 40);
    }
    const totalY = nombreFiltro ? 47 : 40;
    doc.text(`Total registros: ${registros.length}`, 14, totalY);
    doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 14, totalY + 7);

    autoTable(doc, {
      startY: totalY + 14,
      head: [['Fecha', 'Alumno', 'Estado', 'Email']],
      body: registros.map((r) => [
        this.fechaRegistro(r),
        r.alumno ? `${r.alumno.nombre} ${r.alumno.apellido}` : '—',
        this.estadoLabel(r.estado),
        r.alumno?.email ?? '—',
      ]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [26, 115, 232], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 249, 250] },
    });

    const nombreClase = (clase?.nombre ?? 'clase').replace(/\s+/g, '-').toLowerCase();
    const desde = this.fechaDesde() || 'sin-fecha';
    doc.save(`historial-${nombreClase}-${desde}.pdf`);
  }

  /** Carga las clases del profesor. Usado en: ngOnInit. */
  private loadClases(): void {
    this.loadingClases.set(true);
    this.api
      .get<Clase[]>('profesor/clases')
      .pipe(finalize(() => this.loadingClases.set(false)))
      .subscribe({
        next: (res) => this.clases.set(res),
        error: () => this.error.set('No se pudieron cargar las clases.'),
      });
  }

  /** Carga el historial paginado con los filtros activos. Usado en: buscarHistorial, onPageChange, onClaseSelected. */
  private loadHistorial(resetPage = false): void {
    const claseId = this.selectedIdClase();
    if (!claseId) return;

    if (resetPage) {
      this.pageIndex.set(0);
    }

    const params = this.buildHistorialParams(this.pageIndex() + 1, this.pageSize());

    this.loadingHistorial.set(true);
    this.error.set(null);

    this.api
      .get<AsistenciasPaginated>(`asistencias?${params}`)
      .pipe(finalize(() => this.loadingHistorial.set(false)))
      .subscribe({
        next: (res) => {
          this.registros.set(res.data ?? []);
          this.totalRegistros.set(res.total ?? 0);
          this.pageIndex.set(Math.max((res.current_page ?? 1) - 1, 0));
          if (res.per_page) {
            this.pageSize.set(res.per_page);
          }
        },
        error: () => {
          this.registros.set([]);
          this.totalRegistros.set(0);
          this.error.set('No se pudo cargar el historial de asistencia.');
        },
      });
  }
}
