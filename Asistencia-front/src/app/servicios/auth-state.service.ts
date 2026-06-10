import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { ApiService } from './api-service';
import { MeResponse } from '../entities';

/** Nombres de permisos alineados con el backend. Usado en: app.routes, permissionGuard, App (menú). */
export const PERMISSIONS = {
  MODIFICAR_ASISTENCIA: 'modificar asistencia',
  LISTAR_ASISTENCIA: 'listar asistencia',
  LISTAR_CLASES: 'listar clases',
  MODIFICAR_CLASES: 'modificar clases',
  ELIMINAR_CLASES: 'eliminar clases',
  LISTAR_ALUMNO: 'listar alumno',
  MODIFICAR_ALUMNO: 'modificar alumno',
  ELIMINAR_ALUMNO: 'eliminar alumno',
} as const;

export type PermissionName = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

/** Gestiona la sesión del usuario: token, roles, permisos y estado de autenticación. Usado en: App, guards, Login y componentes protegidos. */
@Injectable({ providedIn: 'root' })
export class AuthStateService {
  private readonly api = inject(ApiService);

  /** Token JWT guardado en sessionStorage. Usado en: interceptor, guards, App. */
  public readonly token = signal<string | null>(sessionStorage.getItem('token'));
  /** Datos del usuario autenticado (/me). Usado en: App, Perfil, Admin, AlumnoAsistencia. */
  public readonly me = signal<MeResponse | null>(null);
  /** Permisos del usuario actual. Usado en: permissionGuard, App (menú), can* computed. */
  public readonly permissions = signal<string[]>([]);
  /** Roles del usuario actual. Usado en: role guards, homeRoute, App (menú). */
  public readonly role = signal<string[]>([]);

  /** Indica si hay sesión activa. Usado en: App (mostrar/ocultar nav y login). */
  public readonly isLogged = computed(() => !!this.token());
  /** Indica si el usuario es administrador. Usado en: role guards, homeRoute, App. */
  public readonly isAdmin = computed(() => this.hasRole('admin'));
  /** Indica si el usuario es alumno. Usado en: role guards, homeRoute, App. */
  public readonly isAlumno = computed(() => this.hasRole('alumno'));
  /** Indica si el usuario es profesor. Usado en: role guards, homeRoute, App. */
  public readonly isProfesor = computed(() => this.hasRole('profesor'));

  /** Ruta de inicio según el rol del usuario. Usado en: HomeRedirect, Login, role guards. */
  public readonly homeRoute = computed(() => {
    if (this.isAdmin()) {
      return '/admin';
    }
    if (this.isProfesor()) {
      return '/inicio';
    }
    if (this.isAlumno()) {
      return '/alumno/inicio';
    }
    return '/inicio';
  });

  /** Permiso para modificar asistencia. Usado en: App (menú), ruta /asistencia. */
  public readonly canModificarAsistencia = computed(() =>
    this.hasPermission(PERMISSIONS.MODIFICAR_ASISTENCIA),
  );
  /** Permiso para listar asistencia. Usado en: App (menú), rutas /estadísticas y /historial. */
  public readonly canListarAsistencia = computed(() =>
    this.hasPermission(PERMISSIONS.LISTAR_ASISTENCIA),
  );
  /** Permiso para listar clases. Usado en: App (menú), ruta /clases. */
  public readonly canListarClases = computed(() =>
    this.hasPermission(PERMISSIONS.LISTAR_CLASES),
  );
  /** Permiso para modificar clases. Usado en: Clases (formularios de edición). */
  public readonly canModificarClases = computed(() =>
    this.hasPermission(PERMISSIONS.MODIFICAR_CLASES),
  );
  /** Permiso para eliminar clases. Usado en: Clases (botón eliminar). */
  public readonly canEliminarClases = computed(() =>
    this.hasPermission(PERMISSIONS.ELIMINAR_CLASES),
  );
  /** Permiso para listar alumnos. Usado en: Clases (listado de alumnos). */
  public readonly canListarAlumno = computed(() =>
    this.hasPermission(PERMISSIONS.LISTAR_ALUMNO),
  );
  /** Permiso para modificar alumnos. Usado en: Clases (formulario de alumno). */
  public readonly canModificarAlumno = computed(() =>
    this.hasPermission(PERMISSIONS.MODIFICAR_ALUMNO),
  );
  /** Permiso para eliminar alumnos. Usado en: Clases (botón eliminar alumno). */
  public readonly canEliminarAlumno = computed(() =>
    this.hasPermission(PERMISSIONS.ELIMINAR_ALUMNO),
  );

  /** Restaura la sesión al recargar la página si hay token guardado. Usado en: App.ngOnInit. */
  initSession(): void {
    if (!this.token()) {
      return;
    }
    this.loadMe().subscribe();
  }

  /** Guarda el token y carga roles/permisos tras login o registro. Usado en: Login.onSubmit. */
  startSession(token: string): Observable<string[]> {
    sessionStorage.setItem('token', token);
    this.token.set(token);
    return this.loadMe();
  }

  /** Borra token y estado local de la sesión. Usado en: logout, interceptor (401), loadMe (error). */
  clearSession(): void {
    sessionStorage.removeItem('token');
    this.token.set(null);
    this.me.set(null);
    this.permissions.set([]);
    this.role.set([]);
  }

  /** Cierra sesión en el servidor y limpia el estado local. Usado en: App.onLogOut. */
  logout(): Observable<void> {
    if (!this.token()) {
      this.clearSession();
      return of(undefined);
    }

    return this.api.logout().pipe(
      catchError(() => of({ message: 'ok' })),
      tap(() => this.clearSession()),
      map(() => undefined),
    );
  }

  /** Comprueba si el usuario tiene un permiso concreto. Usado en: permissionGuard, can* computed. */
  hasPermission(permission: string): boolean {
    return this.permissions().includes(permission);
  }

  /** Comprueba si tiene al menos uno de los permisos indicados. Usado en: guards y componentes. */
  hasAnyPermission(...permissions: string[]): boolean {
    const actuales = this.permissions();
    return permissions.some((p) => actuales.includes(p));
  }

  /** Comprueba si tiene todos los permisos indicados. Usado en: guards y componentes. */
  hasAllPermissions(...permissions: string[]): boolean {
    const actuales = this.permissions();
    return permissions.every((p) => actuales.includes(p));
  }

  /** Comprueba si el usuario tiene un rol concreto. Usado en: role guards, isAdmin/isAlumno/isProfesor. */
  hasRole(role: string): boolean {
    return this.role().includes(role);
  }

  /** Carga el perfil del usuario y actualiza me, permissions y role. Usado en: initSession, startSession, guards. */
  loadMe(): Observable<string[]> {
    return this.api.me().pipe(
      tap((me) => {
        this.me.set(me);
        this.permissions.set(me.permissions ?? []);
        this.role.set(me.roles ?? []);
      }),
      map((me) => me.permissions ?? []),
      catchError(() => {
        this.clearSession();
        return of([]);
      }),
    );
  }
}
