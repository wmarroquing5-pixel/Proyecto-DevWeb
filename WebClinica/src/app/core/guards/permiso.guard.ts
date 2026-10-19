import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { PermisoRequerido } from '../models/permiso.model';
import { AuthService } from '../services/auth.service';
import { PermisosService } from '../services/permisos.service';
import { AutorizacionActualizacionService } from '../services/autorizacion-actualizacion.service';

export const permisoGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const permisos = inject(PermisosService);
  const router = inject(Router);
  const actualizacion = inject(AutorizacionActualizacionService);

  if (!auth.validateSession()) {
    return router.createUrlTree(['/login']);
  }

  const requisitos = route.data['permisos'];
  if (!Array.isArray(requisitos) || requisitos.length === 0) {
    return router.createUrlTree(['/acceso-denegado']);
  }

  return actualizacion.revalidarSiDesactualizado().pipe(
    map(() => permisos.tieneTodos(requisitos as readonly PermisoRequerido[])
      ? true
      : router.createUrlTree(['/acceso-denegado'])),
    catchError(() => of(router.createUrlTree(['/acceso-denegado']))),
  );
};
