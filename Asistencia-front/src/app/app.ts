import { Component, inject, signal } from '@angular/core';

import { Router, RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';

import {MatIconModule} from '@angular/material/icon';
import {MatDividerModule} from '@angular/material/divider';
import {MatButtonModule} from '@angular/material/button';
import {MatMenuModule} from '@angular/material/menu';
import { Login } from './componentes/inicio-sesion/inicio-sesion';
import { AuthStateService } from './servicios/auth-state.service';

/** Componente raíz: layout, navegación y login. Usado en: main.ts (bootstrapApplication). */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, FormsModule, RouterLink, RouterLinkActive, MatButtonModule, MatDividerModule, MatIconModule, MatMenuModule,Login],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly router = inject(Router);

  /** Estado de autenticación compartido. Usado en: app.html (menú, nav, login). */
  protected readonly authState = inject(AuthStateService);
  /** Atajo al signal isLogged. Usado en: app.html (@if isLoged). */
  public readonly isLoged = this.authState.isLogged;
  /** Controla si el menú móvil está abierto. Usado en: app.html (toggle nav). */
  protected readonly navOpen = signal(false);

  /** Abre o cierra el menú de navegación móvil. Usado en: app.html (botón hamburguesa). */
  protected toggleNav(): void {
    this.navOpen.update((open) => !open);
  }

  /** Cierra el menú móvil al navegar. Usado en: app.html (clic en enlace). */
  protected closeNav(): void {
    this.navOpen.set(false);
  }

  /** Restaura la sesión al cargar la app si hay token guardado. Usado en: arranque de la app. */
  ngOnInit(): void {
    this.authState.initSession();
  }

  /** Cierra sesión y redirige al login. Usado en: app.html (botón cerrar sesión). */
  onLogOut(): void {
    this.authState.logout().subscribe(() => {
      this.router.navigateByUrl('/');
    });
  }
}
