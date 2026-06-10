import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthStateService } from '../../servicios/auth-state.service';

/** Redirige al inicio correcto según el rol del usuario. Usado en: ruta '' (raíz). */
@Component({
  selector: 'app-home-redirect',
  template: '',
})
export class HomeRedirect implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthStateService);

  /** Espera a cargar roles si hace falta y navega al home del rol. Usado en: arranque del componente. */
  ngOnInit(): void {
    const go = (): void => {
      this.router.navigateByUrl(this.auth.homeRoute(), { replaceUrl: true });
    };
    if (this.auth.isLogged() && this.auth.role().length === 0) {
      this.auth.loadMe().subscribe(() => go());
    } else {
      go();
    }
  }
}
