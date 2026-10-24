import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { environment } from './environments/environment';
import { productionEndpointsReady } from './environments/production-config';

if (environment.production && !productionEndpointsReady(environment)) {
  // El bundle puede compilarse sin URL pública, pero no inicia ni envía HTTP.
  const root = document.querySelector('app-root');
  if (root) root.textContent = 'WebClinica no está disponible. Contacte al administrador.';
} else {
  bootstrapApplication(AppComponent, appConfig)
    .catch((err) => console.error(err));
}
