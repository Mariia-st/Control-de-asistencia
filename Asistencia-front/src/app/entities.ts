/** Credenciales de login. Usado en: Login, ApiService.login. */
export interface LoginRequest {
    email:string,
    password:string
}

/** Datos de registro de nuevo usuario. Usado en: Login, ApiService.register. */
export interface RegisterRequest {
    name:string,
    email:string,
    apellido:string,
    role:'alumno' | 'profesor' ,
    password:string,
    password_confirmation:string
}

/** Respuesta de login/register con token JWT. Usado en: Login.onSubmit, AuthStateService.startSession. */
export interface LoginResponse {
    access_token:string,
    token_type:string,
    user:User
}

/** Perfil del usuario autenticado con roles y permisos. Usado en: AuthStateService, Perfil, Admin. */
export interface MeResponse{
    id:number,
    name:string,
    email:string,
    role_id:number,
    roles:string[],
    permissions:string[]
}

/** Usuario básico devuelto en login. Usado en: LoginResponse. */
export interface User{
    email:string,
    id:string,
    name:string,
    roles:Roles
}

/** Rol del usuario. Usado en: User. */
export interface Roles{
    id:string,
    name:string,
}

/** Clase escolar con alumnos asignados. Usado en: Home, Clases, Statistics, RegisterAttendance, AlumnoInicio. */
export interface Clase{
    id:number,
    nombre:string, 
    aula:string,
    codigo: string,
    alumnos: Student[]
}

/** Resumen de asistencia de una clase para el día actual. Usado en: Home (tarjetas de resumen). */
export interface EstadisticasClase {
    total: number;
    presentes_hoy: number;
    ausentes_hoy: number;
    tasa_asistencia: number;
}

/** Estadísticas detalladas de una clase (hoy + histórico). Usado en: Statistics. */
export interface EstadisticasClaseResponse {
    clase_id: number;
    total_alumnos: number;
    hoy: EstadisticasDiaResumen & { tasa_asistencia: number };
    por_dia: EstadisticasDiaResumen[];
}

/** Resumen de asistencia de un día concreto. Usado en: EstadisticasClaseResponse, Statistics. */
export interface EstadisticasDiaResumen {
    fecha: string;
    presentes: number;
    ausentes: number;
    sin_marcar: number;
}

/** Alumno con sus clases asignadas. Usado en: Clases (CRUD de alumnos). */
export interface Student{
id:number,
nombre:string,
apellido:string,
clases: Clase[],
email:string,
}

/** Estado posible de un registro de asistencia. Usado en: RegisterAttendance, History, AlumnoAsistencia. */
export type AsistenciaEstado = 'presente' | 'ausente';

/** Registro de asistencia de un alumno en una fecha. Usado en: AlumnoAsistencia, RegisterAttendance. */
export interface AsistenciaRegistro {
    id: number;
    estado: AsistenciaEstado;
    fecha: string;
}

/** Alumno con su asistencia del día en una clase. Usado en: RegisterAttendance, Home. */
export interface AlumnoAsistencia {
    id: number;
    nombre: string;
    apellido: string;
    email: string;
    clase_id: number;
    asistencia: AsistenciaRegistro | null;
}

/** Lista de alumnos y asistencia de una clase en una fecha. Usado en: RegisterAttendance, Home. */
export interface AsistenciaClaseResponse {
    clase_id: number;
    fecha: string;
    alumnos: AlumnoAsistencia[];
}

/** Payload para guardar asistencia masiva de una clase. Usado en: RegisterAttendance.markAsistencia. */
export interface AsistenciaBulkPayload {
    fecha: string;
    asistencias: AsistenciaBulkItem[];
  }

/** Un registro de asistencia dentro del payload masivo. Usado en: AsistenciaBulkPayload. */
  export interface AsistenciaBulkItem {
    alumno_id: number;
    estado: AsistenciaEstado ;
  }

/** Respuesta del guardado masivo de asistencia. Usado en: RegisterAttendance. */
  export interface AsistenciaBulkResponse {
    clase_id: number;
    fecha: string;
    guardados: number;
    asistencias: Asistencia[];
  }

/** Registro de asistencia en base de datos. Usado en: History, AlumnoAsistencia. */
export interface Asistencia {
    id: number;
    alumno_id: number;
    clase_id: number;
    fecha: string;
    estado: AsistenciaEstado;
}

/** Resumen de asistencia de un día para gráficos. Usado en: Statistics (barras de últimos 7 días). */
export interface DiaAsistenciaResumen {
    fecha: string;
    label: string;
    presentes: number;
    ausentes: number;
    sinMarcar: number;
  }

/** Distribución presente/ausente/sin marcar de hoy. Usado en: Statistics (gráfico circular). */
  export interface DistribucionHoy {
    presentes: number;
    ausentes: number;
    sinMarcar: number;
    total: number;
  }

/** Asistencia de hoy de un alumno en una clase. Usado en: AlumnoInicio. */
export interface AlumnoAsistenciaHoyClase {
  clase_id: number;
  nombre: string;
  aula: string;
  asistencia: AsistenciaRegistro | null;
}

/** Asistencia de hoy del alumno en todas sus clases. Usado en: AlumnoInicio. */
export interface AlumnoAsistenciaHoyResponse {
  fecha: string;
  clases: AlumnoAsistenciaHoyClase[];
}

/** Resumen de asistencia del alumno por clase en un periodo. Usado en: AlumnoAsistencia. */
export interface AlumnoAsistenciaResumenClase {
  clase_id: number;
  nombre: string;
  aula: string;
  presentes: number;
  ausentes: number;
  tasa_asistencia: number;
}

/** Resumen global de asistencia del alumno. Usado en: AlumnoAsistencia (tarjetas de resumen). */
export interface AlumnoAsistenciaResumenResponse {
  dias: number;
  fecha_desde: string;
  fecha_hasta: string;
  total_registros: number;
  presentes: number;
  ausentes: number;
  tasa_asistencia: number;
  por_clase: AlumnoAsistenciaResumenClase[];
}

/** Registro de asistencia con datos de la clase incluidos. Usado en: AlumnoAsistencia (tabla e historial). */
export interface AsistenciaConClase extends Asistencia {
  clase?: Pick<Clase, 'id' | 'nombre' | 'aula'>;
}

/** Respuesta paginada del historial de asistencia del alumno. Usado en: AlumnoAsistencia. */
export interface AsistenciasAlumnoPaginated {
  data: AsistenciaConClase[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

/** Resumen del panel de administración. Usado en: Admin (tarjetas de totales). */
export interface AdminDashboard {
  usuarios: number;
  usuarios_por_rol: {
    admin: number;
    profesor: number;
    alumno: number;
  };
  clases: number;
  asistencias: number;
}

/** Usuario listado en el panel de administración. Usado en: Admin (tabla de usuarios). */
export interface AdminUser {
  id: number;
  name: string;
  email: string;
  roles: string[];
  created_at?: string;
  tiene_perfil_profesor: boolean;
  tiene_perfil_alumno: boolean;
}

/** Rol con sus permisos asociados. Usado en: Admin (selector de roles). */
export interface AdminRoleInfo {
  id: number;
  name: string;
  permissions: string[];
}

/** Respuesta paginada genérica del backend. Usado en: Admin, History, AlumnoAsistencia. */
export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
