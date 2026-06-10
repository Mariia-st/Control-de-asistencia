import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { Router, RouterLink } from '@angular/router';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { concatMap, finalize, from, map, Observable, of, reduce, switchMap } from 'rxjs';
import {
  AlumnoAsistenciaResumenResponse,
  AsistenciaConClase,
  AsistenciasAlumnoPaginated,
  Clase,
} from '../../entities';
import { ApiService } from '../../servicios/api-service';
import { AuthStateService } from '../../servicios/auth-state.service';

/** Historial y resumen de asistencia del alumno con exportación PDF. Usado en: ruta /alumno/asistencia. */
@Component({
  selector: 'app-alumno-asistencia',
  imports: [MatPaginatorModule, RouterLink],
  templateUrl: './alumno-asistencia.html',
  styleUrl: './alumno-asistencia.css',
})
export class AlumnoAsistencia implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  /** Nombre del alumno para el PDF. Usado en: generarPdf. */
  protected readonly auth = inject(AuthStateService);

  /** Opciones de tamaño de página. Usado en: alumno-asistencia.html (mat-paginator). */
  readonly pageSizeOptions = [10, 15, 25, 50];
  /** Clases del alumno para el filtro. Usado en: alumno-asistencia.html (select). */
  readonly clases = signal<Clase[]>([]);
  /** Resumen de asistencia del periodo. Usado en: alumno-asistencia.html (tarjetas de resumen). */
  readonly resumen = signal<AlumnoAsistenciaResumenResponse | null>(null);
  /** Registros de la página actual. Usado en: alumno-asistencia.html (tabla). */
  readonly registros = signal<AsistenciaConClase[]>([]);
  /** Total de registros. Usado en: alumno-asistencia.html (paginador). */
  readonly totalRegistros = signal(0);
  /** Índice de página actual. Usado en: alumno-asistencia.html (mat-paginator). */
  readonly pageIndex = signal(0);
  /** Tamaño de página. Usado en: alumno-asistencia.html (mat-paginator). */
  readonly pageSize = signal(15);
  /** ID de clase seleccionada en el filtro. Usado en: alumno-asistencia.html (select). */
  readonly selectedIdClase = signal<number | null>(null);
  /** Filtro fecha desde. Usado en: alumno-asistencia.html (input date). */
  readonly fechaDesde = signal('');
  /** Filtro fecha hasta. Usado en: alumno-asistencia.html (input date). */
  readonly fechaHasta = signal('');
  /** Días del resumen (7, 30, 90). Usado en: alumno-asistencia.html (select de periodo). */
  readonly diasResumen = signal(30);

  /** Indica carga de clases. Usado en: alumno-asistencia.html (spinner). */
  readonly loadingClases = signal(false);
  /** Indica carga del resumen. Usado en: alumno-asistencia.html (spinner). */
  readonly loadingResumen = signal(false);
  /** Indica carga del historial. Usado en: alumno-asistencia.html (spinner). */
  readonly loadingHistorial = signal(false);
  /** Indica generación del PDF. Usado en: alumno-asistencia.html (botón descargar). */
  readonly loadingPdf = signal(false);
  /** Mensaje de error. Usado en: alumno-asistencia.html (alerta). */
  readonly error = signal<string | null>(null);

  /** true si fechaDesde > fechaHasta. Usado en: alumno-asistencia.html (deshabilitar buscar). */
  readonly rangoInvalido = computed(() => {
    const desde = this.fechaDesde();
    const hasta = this.fechaHasta();
    if (!desde || !hasta) return false;
    return desde > hasta;
  });

  /** Redirige si es profesor o carga datos del alumno. Usado en: arranque del componente. */
  ngOnInit(): void {
    const boot = (): void => {
      if (this.auth.isProfesor()) {
        this.router.navigateByUrl('/inicio');
        return;
      }
      this.loadClases();
      this.loadResumen();
      this.loadHistorial();
    };

    if (this.auth.isLogged() && this.auth.role().length === 0) {
      this.auth.loadMe().subscribe(() => boot());
    } else {
      boot();
    }
  }

  /** Al elegir clase recarga el historial. Usado en: alumno-asistencia.html (select). */
  onClaseSelected(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedIdClase.set(value ? Number(value) : null);
    this.pageIndex.set(0);
    this.loadHistorial();
  }

  /** Actualiza filtro fecha desde. Usado en: alumno-asistencia.html (input date). */
  onFechaDesdeChange(event: Event): void {
    this.fechaDesde.set((event.target as HTMLInputElement).value);
  }

  /** Actualiza filtro fecha hasta. Usado en: alumno-asistencia.html (input date). */
  onFechaHastaChange(event: Event): void {
    this.fechaHasta.set((event.target as HTMLInputElement).value);
  }

  /** Cambia el periodo del resumen y recarga. Usado en: alumno-asistencia.html (select de días). */
  onDiasResumenChange(event: Event): void {
    const dias = Number((event.target as HTMLSelectElement).value);
    this.diasResumen.set(dias);
    this.loadResumen();
  }

  /** Aplica filtros y recarga historial. Usado en: alumno-asistencia.html (botón Buscar). */
  buscarHistorial(): void {
    if (this.rangoInvalido()) return;
    this.pageIndex.set(0);
    this.loadHistorial();
  }

  /** Limpia filtros y recarga historial. Usado en: alumno-asistencia.html (botón Limpiar). */
  limpiarFiltro(): void {
    this.selectedIdClase.set(null);
    this.fechaDesde.set('');
    this.fechaHasta.set('');
    this.pageIndex.set(0);
    this.loadHistorial();
  }

  /** Cambia de página o tamaño. Usado en: alumno-asistencia.html (mat-paginator). */
  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadHistorial();
  }

  /** Etiqueta legible del estado. Usado en: alumno-asistencia.html (tabla), generarPdf. */
  estadoLabel(estado: string): string {
    return estado === 'presente' ? 'Presente' : 'Ausente';
  }

  /** Clase CSS del badge de estado. Usado en: alumno-asistencia.html (tabla). */
  estadoClass(estado: string): string {
    return estado === 'presente' ? 'badge-presente' : 'badge-ausente';
  }

  /** Formatea la fecha de un registro como DD/MM/YYYY. Usado en: alumno-asistencia.html (tabla), generarPdf. */
  fechaRegistro(registro: AsistenciaConClase): string {
    const raw = String(registro.fecha);
    const iso = raw.includes('T') ? raw.split('T')[0] : raw.slice(0, 10);
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  }

  /** Descarga el historial completo como PDF. Usado en: alumno-asistencia.html (botón Descargar PDF). */
  descargarPdf(): void {
    if (this.totalRegistros() === 0) return;

    this.loadingPdf.set(true);
    this.error.set(null);

    this.fetchAllRegistros()
      .pipe(finalize(() => this.loadingPdf.set(false)))
      .subscribe({
        next: (registros) => this.generarPdf(registros),
        error: () => this.error.set('No se pudo generar el PDF.'),
      });
  }

  /** Genera y descarga el PDF con jsPDF. Usado en: descargarPdf. */
  private generarPdf(registros: AsistenciaConClase[]): void {
    const doc = new jsPDF();
    const nombre = this.auth.me()?.name ?? 'Alumno';

    doc.setFontSize(16);
    doc.text('Mi historial de asistencia', 14, 18);
    doc.setFontSize(11);
    doc.text(`Alumno: ${nombre}`, 14, 26);
    doc.text(`Total registros: ${registros.length}`, 14, 33);
    doc.text(`Generado: ${new Date().toLocaleString('es-ES')}`, 14, 40);

    autoTable(doc, {
      startY: 48,
      head: [['Fecha', 'Clase', 'Aula', 'Estado']],
      body: registros.map((r) => [
        this.fechaRegistro(r),
        r.clase?.nombre ?? '—',
        r.clase?.aula ?? '—',
        this.estadoLabel(r.estado),
      ]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [26, 76, 225], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 249, 250] },
    });

    doc.save(`mi-asistencia-${nombre.replace(/\s+/g, '-').toLowerCase()}.pdf`);
  }

  /** Obtiene todos los registros paginando secuencialmente para el PDF. Usado en: descargarPdf. */
  private fetchAllRegistros(): Observable<AsistenciaConClase[]> {
    const perPage = 100;
    const buildParams = (page: number) => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
      });
      const claseId = this.selectedIdClase();
      if (claseId) params.set('clase_id', String(claseId));
      if (this.fechaDesde()) params.set('fecha_desde', this.fechaDesde());
      if (this.fechaHasta()) params.set('fecha_hasta', this.fechaHasta());
      return params.toString();
    };

    return this.api.get<AsistenciasAlumnoPaginated>(`alumno/asistencia?${buildParams(1)}`).pipe(
      switchMap((first) => {
        const lastPage = first.last_page ?? 1;
        if (lastPage <= 1) {
          return of(first.data ?? []);
        }

        const paginas = Array.from({ length: lastPage - 1 }, (_, i) => i + 2);
        const inicial = [...(first.data ?? [])];

        return from(paginas).pipe(
          concatMap((page) =>
            this.api.get<AsistenciasAlumnoPaginated>(`alumno/asistencia?${buildParams(page)}`),
          ),
          map((pagina) => pagina.data ?? []),
          reduce((acc, chunk) => acc.concat(chunk), inicial),
        );
      }),
    );
  }

  /** Carga las clases del alumno. Usado en: ngOnInit. */
  private loadClases(): void {
    this.loadingClases.set(true);
    this.api
      .get<Clase[]>('alumno/clases')
      .pipe(finalize(() => this.loadingClases.set(false)))
      .subscribe({
        next: (res) => this.clases.set(res),
        error: () => this.error.set('No se pudieron cargar tus clases.'),
      });
  }

  /** Carga el resumen de asistencia del periodo seleccionado. Usado en: ngOnInit, onDiasResumenChange. */
  private loadResumen(): void {
    this.loadingResumen.set(true);
    this.api
      .get<AlumnoAsistenciaResumenResponse>(`alumno/asistencia/resumen?dias=${this.diasResumen()}`)
      .pipe(finalize(() => this.loadingResumen.set(false)))
      .subscribe({
        next: (res) => this.resumen.set(res),
        error: () => this.resumen.set(null),
      });
  }

  /** Carga el historial paginado con los filtros activos. Usado en: buscarHistorial, onPageChange, ngOnInit. */
  private loadHistorial(): void {
    const params = new URLSearchParams({
      page: String(this.pageIndex() + 1),
      per_page: String(this.pageSize()),
    });

    const claseId = this.selectedIdClase();
    if (claseId) params.set('clase_id', String(claseId));
    if (this.fechaDesde()) params.set('fecha_desde', this.fechaDesde());
    if (this.fechaHasta()) params.set('fecha_hasta', this.fechaHasta());

    this.loadingHistorial.set(true);
    this.error.set(null);

    this.api
      .get<AsistenciasAlumnoPaginated>(`alumno/asistencia?${params}`)
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
          this.error.set('No se pudo cargar tu historial de asistencia.');
        },
      });
  }
}
