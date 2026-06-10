import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthStateService } from './servicios/auth-state.service';

/** Verifica que el usuario tenga el permiso definido en route.data. Usado en: /clases, /asistencia, /estadísticas, /historial. */
export const permissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthStateService);
  const router = inject(Router);

  const check = (): boolean | ReturnType<Router['createUrlTree']> => {
    if (!auth.isLogged()) {
      return router.createUrlTree(['/']);
    }
    if (auth.isAdmin()) {
      return router.createUrlTree(['/404']);
    }

    const permission = route.data['permission'] as string | undefined;
    if (!permission) {
      return true;
    }

    return auth.hasPermission(permission) ? true : router.createUrlTree([auth.homeRoute()]);
  };

  if (auth.isLogged() && auth.role().length === 0) {
    return auth.loadMe().pipe(map(() => check()));
  }

  return check();
};
