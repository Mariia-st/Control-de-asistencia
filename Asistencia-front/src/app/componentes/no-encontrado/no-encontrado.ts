import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthStateService } from '../../servicios/auth-state.service';

/** Página 404 con enlace de vuelta al inicio del rol. Usado en: rutas /404 y ** (catch-all). */
@Component({
  selector: 'app-not-found',
  imports: [RouterLink],
  templateUrl: './no-encontrado.html',
  styleUrl: './no-encontrado.css',
})
export class NotFound {
  /** Estado de auth para enlazar al home correcto. Usado en: not-found.html (enlace "Volver"). */
  protected readonly auth = inject(AuthStateService);
}
