import { CanActivateFn } from '@angular/router';

/** Bloquea rutas si no hay token en sessionStorage. Usado en: todas las rutas de app.routes. */
export const authGuard: CanActivateFn = () => {
  return !!sessionStorage.getItem('token');
};
