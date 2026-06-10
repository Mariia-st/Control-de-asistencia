import { Routes } from '@angular/router';
import { Home } from './componentes/inicio/inicio';
import { Clases } from './componentes/clases/clases';
import { AlumnoInicio } from './componentes/alumno-inicio/alumno-inicio';
import { AlumnoAsistencia } from './componentes/alumno-asistencia/alumno-asistencia';
import { authGuard } from './auth-guard';
import { permissionGuard } from './permission.guard';
import { alumnoRoleGuard, adminRoleGuard, profesorRoleGuard } from './role.guard';
import { HomeRedirect } from './componentes/redireccion-inicio/redireccion-inicio';
import { RegisterAttendance } from './componentes/registrar-asistencia/registrar-asistencia';
import { Statistics } from './componentes/estadisticas/estadisticas';
import { History } from './componentes/historial/historial';
import { Perfil } from './componentes/perfil/perfil';
import { NotFound } from './componentes/no-encontrado/no-encontrado';
import { Admin } from './componentes/administracion/administracion';
import { PERMISSIONS } from './servicios/auth-state.service';

/** Definición de rutas de la aplicación con guards por rol y permiso. Usado en: app.config (provideRouter). */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: HomeRedirect,
    canActivate: [authGuard],
  },
  { path: 'inicio', component: Home, canActivate: [authGuard, profesorRoleGuard] },
  {
    path: 'admin',
    component: Admin,
    canActivate: [authGuard, adminRoleGuard],
  },
  {
    path: 'alumno/inicio',
    component: AlumnoInicio,
    canActivate: [authGuard, alumnoRoleGuard],
  },
  {
    path: 'alumno/asistencia',
    component: AlumnoAsistencia,
    canActivate: [authGuard, alumnoRoleGuard,],
  },
  {
    path: 'clases',
    component: Clases,
    canActivate: [authGuard, profesorRoleGuard, permissionGuard],
    data: { permission: PERMISSIONS.LISTAR_CLASES },
  },
  {
    path: 'asistencia',
    component: RegisterAttendance,
    canActivate: [authGuard, profesorRoleGuard, permissionGuard],
    data: { permission: PERMISSIONS.MODIFICAR_ASISTENCIA },
  },
  {
    path: 'estadísticas',
    component: Statistics,
    canActivate: [authGuard, profesorRoleGuard, permissionGuard],
    data: { permission: PERMISSIONS.LISTAR_ASISTENCIA },
  },
  {
    path: 'historial',
    component: History,
    canActivate: [authGuard, profesorRoleGuard, permissionGuard],
    data: { permission: PERMISSIONS.LISTAR_ASISTENCIA },
  },
  { path: 'perfil', component: Perfil, canActivate: [authGuard] },
  { path: '404', component: NotFound, canActivate: [authGuard] },
  { path: '**', component: NotFound, canActivate: [authGuard] },
];
