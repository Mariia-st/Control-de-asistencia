import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthStateService } from './servicios/auth-state.service';

/** Añade el token Bearer a cada petición y renueva el token si el servidor responde 401. Usado en: app.config (provideHttpClient). */
export const interceptorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthStateService);
  const token = sessionStorage.getItem('token');

  /** Rutas públicas que no llevan Authorization. Usado en: login, register y refresh. */
  const isPublic =
    req.url.includes('/login') ||
    req.url.includes('/register') ||
    req.url.includes('/refresh');

  /** Clona la petición con el header Authorization si hay token. Usado en: todas las peticiones autenticadas. */
  const authReq =
    token && !isPublic
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || isPublic || req.url.includes('/refresh')) {
        return throwError(() => err);
      }

      if (!token) {
        auth.clearSession();
        return throwError(() => err);
      }

      const backend = inject(HttpBackend);
      const rawHttp = new HttpClient(backend);

      /** Intenta renovar el token y reintenta la petición original. Usado en: sesiones expiradas. */
      return rawHttp
        .post<{ access_token: string }>(`${environment.apiUrl}/refresh`, null, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .pipe(
          switchMap((res) => {
            sessionStorage.setItem('token', res.access_token);
            auth.token.set(res.access_token);
            const retry = req.clone({
              setHeaders: { Authorization: `Bearer ${res.access_token}` },
            });
            return next(retry);
          }),
          catchError(() => {
            auth.clearSession();
            if (typeof window !== 'undefined') {
              window.location.href = '/';
            }
            return throwError(() => err);
          }),
        );
    }),
  );
};
