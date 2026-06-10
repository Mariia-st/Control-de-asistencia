import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AdminDashboard,
  AdminRoleInfo,
  AdminUser,
  LoginRequest,
  LoginResponse,
  MeResponse,
  PaginatedResponse,
  RegisterRequest,
} from '../entities';

/** Datos para cambiar la contraseña del usuario autenticado. Usado en: Perfil. */
export interface ChangePasswordRequest {
  current_password: string;
  password: string;
  password_confirmation: string;
}

/** Cliente HTTP centralizado para todas las peticiones al backend. Usado en: servicios y componentes de la app. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl;

  /** Petición GET genérica. Usado en: Home, Clases, History, Statistics, RegisterAttendance, AlumnoInicio, AlumnoAsistencia. */
  get<T>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.baseUrl}/${endpoint}`);
  }

  /** Petición POST genérica. Usado en: Clases, AlumnoInicio, RegisterAttendance. */
  post<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${this.baseUrl}/${endpoint}`, body);
  }

  /** Petición PUT genérica. Usado en: Clases, RegisterAttendance, Perfil. */
  put<T>(endpoint: string, body: unknown): Observable<T> {
    return this.http.put<T>(`${this.baseUrl}/${endpoint}`, body);
  }

  /** Petición DELETE genérica. Usado en: Clases, AlumnoInicio, Admin. */
  delete<T>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.baseUrl}/${endpoint}`);
  }

  /** Autentica al usuario y devuelve el token JWT. Usado en: Login. */
  login(credenciales: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/login`, credenciales);
  }

  /** Registra un nuevo usuario y devuelve el token JWT. Usado en: Login. */
  register(data: RegisterRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.baseUrl}/register`, data);
  }

  /** Obtiene el perfil, roles y permisos del usuario autenticado. Usado en: AuthStateService. */
  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.baseUrl}/me`);
  }

  /** Cambia la contraseña del usuario autenticado. Usado en: Perfil. */
  changePassword(data: ChangePasswordRequest): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.baseUrl}/me/password`, data);
  }

  /** Invalida el token en el servidor. Usado en: AuthStateService (logout desde App). */
  logout(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.baseUrl}/logout`, {});
  }

  /** Resumen global del sistema (usuarios, clases, asistencias). Usado en: Admin. */
  getAdminDashboard(): Observable<AdminDashboard> {
    return this.http.get<AdminDashboard>(`${this.baseUrl}/admin/dashboard`);
  }

  /** Lista paginada de usuarios del sistema. Usado en: Admin. */
  getAdminUsuarios(page = 1): Observable<PaginatedResponse<AdminUser>> {
    return this.http.get<PaginatedResponse<AdminUser>>(
      `${this.baseUrl}/admin/usuarios?page=${page}`,
    );
  }

  /** Lista de roles y sus permisos. Usado en: Admin. */
  getAdminRoles(): Observable<AdminRoleInfo[]> {
    return this.http.get<AdminRoleInfo[]>(`${this.baseUrl}/admin/roles`);
  }

  /** Asigna un rol a un usuario. Usado en: Admin. */
  updateAdminUserRole(
    userId: number,
    role: string,
  ): Observable<{ message: string; user: AdminUser }> {
    return this.http.put<{ message: string; user: AdminUser }>(
      `${this.baseUrl}/admin/usuarios/${userId}/rol`,
      { role },
    );
  }

  /** Elimina un usuario del sistema. Usado en: Admin. */
  deleteAdminUser(userId: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.baseUrl}/admin/usuarios/${userId}`);
  }
}
