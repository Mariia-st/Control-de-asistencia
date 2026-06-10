import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthStateService } from './servicios/auth-state.service';

/** Solo permite acceso a alumnos; redirige al home del rol actual si no aplica. Usado en: /alumno/inicio, /alumno/asistencia. */
export const alumnoRoleGuard: CanActivateFn = () => {
  const auth = inject(AuthStateService);
  const router = inject(Router);

  const check = (): boolean | ReturnType<Router['createUrlTree']> => {
    if (!auth.isLogged()) {
      return router.createUrlTree(['/']);
    }
    if (auth.isAlumno()) {
      return true;
    }
    return router.createUrlTree([auth.homeRoute()]);
  };

  if (auth.isLogged() && auth.role().length === 0) {
    return auth.loadMe().pipe(map(() => check()));
  }

  return check();
};

/** Solo permite acceso a profesores; admin va a 404 y otros roles a su home. Usado en: /inicio, /clases, /asistencia, /estadísticas, /historial. */
export const profesorRoleGuard: CanActivateFn = () => {
  const auth = inject(AuthStateService);
  const router = inject(Router);

  const check = (): boolean | ReturnType<Router['createUrlTree']> => {
    if (!auth.isLogged()) {
      return router.createUrlTree(['/']);
    }
    if (auth.isAdmin()) {
      return router.createUrlTree(['/404']);
    }
    if (auth.isProfesor()) {
      return true;
    }
    return router.createUrlTree([auth.homeRoute()]);
  };

  if (auth.isLogged() && auth.role().length === 0) {
    return auth.loadMe().pipe(map(() => check()));
  }

  return check();
};

/** Solo permite acceso a administradores; otros roles van a su home. Usado en: /admin. */
export const adminRoleGuard: CanActivateFn = () => {
  const auth = inject(AuthStateService);
  const router = inject(Router);

  const check = (): boolean | ReturnType<Router['createUrlTree']> => {
    if (!auth.isLogged()) {
      return router.createUrlTree(['/']);
    }
    if (auth.isAdmin()) {
      return true;
    }
    return router.createUrlTree([auth.homeRoute()]);
  };

  if (auth.isLogged() && auth.role().length === 0) {
    return auth.loadMe().pipe(map(() => check()));
  }

  return check();
};
