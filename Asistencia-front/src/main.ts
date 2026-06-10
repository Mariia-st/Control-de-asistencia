import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

/** Punto de entrada: arranca la aplicación Angular. Usado en: index.html (script main). */
bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
