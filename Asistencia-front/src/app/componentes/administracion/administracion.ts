import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import {
  AdminDashboard,
  AdminRoleInfo,
  AdminUser,
  PaginatedResponse,
} from '../../entities';
import { ApiService } from '../../servicios/api-service';
import { AuthStateService } from '../../servicios/auth-state.service';

/** Roles disponibles en el sistema. Usado en: admin.html (selector de rol). */
const ROLES = ['admin', 'profesor', 'alumno'] as const;
type AppRole = (typeof ROLES)[number];

/** Panel de administración: resumen del sistema y gestión de usuarios. Usado en: ruta /admin. */
@Component({
  selector: 'app-admin',
  imports: [FormsModule],
  templateUrl: './administracion.html',
  styleUrl: './administracion.css',
})
export class Admin implements OnInit {
  private readonly api = inject(ApiService);
  /** Datos del admin logueado para marcar su propia fila. Usado en: admin.html, isCurrentUser. */
  protected readonly auth = inject(AuthStateService);

  /** Lista de roles para el selector. Usado en: admin.html (select de rol). */
  protected readonly roles = ROLES;
  /** Resumen global del sistema. Usado en: admin.html (tarjetas de totales). */
  protected readonly dashboard = signal<AdminDashboard | null>(null);
  /** Usuarios de la página actual. Usado en: admin.html (tabla de usuarios). */
  protected readonly users = signal<AdminUser[]>([]);
  /** Roles con permisos del backend. Usado en: admin.html (info de permisos). */
  protected readonly roleInfo = signal<AdminRoleInfo[]>([]);
  /** Indica carga del dashboard. Usado en: admin.html (spinner). */
  protected readonly loading = signal(false);
  /** Indica carga de usuarios. Usado en: admin.html (spinner de tabla). */
  protected readonly loadingUsers = signal(false);
  /** Mensaje de error. Usado en: admin.html (alerta roja). */
  protected readonly error = signal<string | null>(null);
  /** Mensaje de éxito. Usado en: admin.html (alerta verde). */
  protected readonly success = signal<string | null>(null);
  /** Página actual de la tabla. Usado en: admin.html (paginación). */
  protected readonly currentPage = signal(1);
  /** Última página disponible. Usado en: admin.html (paginación). */
  protected readonly lastPage = signal(1);
  /** Total de usuarios en el sistema. Usado en: admin.html (contador). */
  protected readonly totalUsers = signal(0);
  /** Rol pendiente de guardar por usuario (antes de confirmar). Usado en: admin.html (select de rol). */
  protected readonly pendingRole = signal<Record<number, AppRole>>({});
  /** ID del usuario cuyo rol se está guardando. Usado en: admin.html (botón Guardar deshabilitado). */
  protected readonly savingUserId = signal<number | null>(null);
  /** ID del usuario que se está eliminando. Usado en: admin.html (botón Eliminar deshabilitado). */
  protected readonly deletingUserId = signal<number | null>(null);

  /** Carga dashboard, usuarios y roles al entrar. Usado en: arranque del componente. */
  ngOnInit(): void {
    this.loadDashboard();
    this.loadUsers();
    this.loadRoles();
  }

  /** Carga el resumen global (usuarios, clases, asistencias). Usado en: ngOnInit, saveRole, deleteUser. */
  loadDashboard(): void {
    this.loading.set(true);
    this.api
      .getAdminDashboard()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (data) => this.dashboard.set(data),
        error: () => this.error.set('No se pudo cargar el resumen del sistema.'),
      });
  }

  /** Carga la lista paginada de usuarios. Usado en: ngOnInit, saveRole, deleteUser, goToPage. */
  loadUsers(page = 1): void {
    this.loadingUsers.set(true);
    this.api
      .getAdminUsuarios(page)
      .pipe(finalize(() => this.loadingUsers.set(false)))
      .subscribe({
        next: (res: PaginatedResponse<AdminUser>) => {
          this.users.set(res.data);
          this.currentPage.set(res.current_page);
          this.lastPage.set(res.last_page);
          this.totalUsers.set(res.total);
          const pending: Record<number, AppRole> = {};
          for (const user of res.data) {
            pending[user.id] = (user.roles[0] ?? 'alumno') as AppRole;
          }
          this.pendingRole.set(pending);
        },
        error: () => this.error.set('No se pudo cargar la lista de usuarios.'),
      });
  }

  /** Carga los roles y permisos disponibles. Usado en: ngOnInit. */
  loadRoles(): void {
    this.api.getAdminRoles().subscribe({
      next: (roles) => this.roleInfo.set(roles),
    });
  }

  /** Guarda el rol seleccionado en memoria antes de confirmar. Usado en: admin.html (select de rol). */
  onRoleChange(userId: number, role: string): void {
    this.pendingRole.update((current) => ({ ...current, [userId]: role as AppRole }));
  }

  /** Confirma y guarda el cambio de rol de un usuario. Usado en: admin.html (botón Guardar rol). */
  saveRole(user: AdminUser): void {
    const role = this.pendingRole()[user.id];
    if (!role || role === user.roles[0]) {
      return;
    }

    this.clearMessages();
    this.savingUserId.set(user.id);
    this.api
      .updateAdminUserRole(user.id, role)
      .pipe(finalize(() => this.savingUserId.set(null)))
      .subscribe({
        next: (res) => {
          this.success.set(res.message);
          this.loadUsers(this.currentPage());
          this.loadDashboard();
        },
        error: (err) => {
          this.error.set(err.error?.message ?? 'No se pudo actualizar el rol.');
        },
      });
  }

  /** Elimina un usuario tras confirmación. Usado en: admin.html (botón Eliminar). */
  deleteUser(user: AdminUser): void {
    if (!confirm(`¿Eliminar a ${user.name} (${user.email})? Esta acción no se puede deshacer.`)) {
      return;
    }

    this.clearMessages();
    this.deletingUserId.set(user.id);
    this.api
      .deleteAdminUser(user.id)
      .pipe(finalize(() => this.deletingUserId.set(null)))
      .subscribe({
        next: (res) => {
          this.success.set(res.message);
          this.loadUsers(this.currentPage());
          this.loadDashboard();
        },
        error: (err) => {
          this.error.set(err.error?.message ?? 'No se pudo eliminar el usuario.');
        },
      });
  }

  /** Navega a una página de la tabla de usuarios. Usado en: admin.html (botones de paginación). */
  goToPage(page: number): void {
    if (page < 1 || page > this.lastPage() || page === this.currentPage()) {
      return;
    }
    this.loadUsers(page);
  }

  /** Devuelve la etiqueta legible de un rol. Usado en: admin.html (badges de rol). */
  roleLabel(role: string): string {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      profesor: 'Profesor',
      alumno: 'Alumno',
    };
    return labels[role] ?? role;
  }

  /** Devuelve la clase CSS del badge según el rol. Usado en: admin.html (badges de rol). */
  roleBadgeClass(role: string): string {
    const classes: Record<string, string> = {
      admin: 'bg-danger',
      profesor: 'bg-primary',
      alumno: 'bg-success',
    };
    return classes[role] ?? 'bg-secondary';
  }

  /** true si la fila corresponde al usuario logueado. Usado en: admin.html (ocultar botón eliminar propio). */
  isCurrentUser(user: AdminUser): boolean {
    return user.id === this.auth.me()?.id;
  }

  /** true si el rol seleccionado difiere del actual. Usado en: admin.html (mostrar botón Guardar). */
  roleChanged(user: AdminUser): boolean {
    return this.pendingRole()[user.id] !== user.roles[0];
  }

  /** Limpia mensajes de error y éxito. Usado en: saveRole, deleteUser. */
  private clearMessages(): void {
    this.error.set(null);
    this.success.set(null);
  }
}
