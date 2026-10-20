import { Route } from '@angular/router';
import { permisoGuard } from './core/guards/permiso.guard';
import { MODULOS_PERMISO, OPERACIONES_PERMISO, PermisoRequerido } from './core/models/permiso.model';
import { AccesoDenegadoComponent } from './pages/acceso-denegado/acceso-denegado.component';
import { routes } from './app.routes';

describe('rutas de navegación', () => {
  const children = routes.find(route => route.children)?.children ?? [];

  function route(path: string): Route {
    const result = children.find(item => item.path === path);
    if (!result) throw new Error(`No se encontró la ruta ${path}`);
    return result;
  }

  it('conserva una ruta funcional existente con carga diferida y autorización', () => {
    const pacientes = route('pacientes');
    expect(pacientes.loadComponent).toBeDefined();
    expect(pacientes.canActivate).toContain(permisoGuard);
  });

  it('conserva el alias de empleados emitido por el menú', () => {
    expect(route('admin/empleados').redirectTo).toBe('empleados');
    expect(route('admin/empleados').pathMatch).toBe('full');
  });

  it('conserva el alias de medicamentos hacia inventario', () => {
    expect(route('medicamentos').redirectTo).toBe('inventario');
    expect(route('medicamentos').pathMatch).toBe('full');
  });

  it('registra todas las rutas conocidas que siguen pendientes', () => {
    const paths = children.map(item => item.path);
    expect(paths).toContain('citas');
    expect(paths).toContain('reportes/citas');
    expect(paths).toContain('reportes/pacientes');
  });

  it('mantiene las rutas informativas bajo la autenticación del layout sin inventar políticas RBAC', () => {
    for (const path of ['citas', 'reportes/citas', 'reportes/pacientes']) {
      expect(route(path).canActivate).toBeUndefined();
      expect(route(path).data?.['permisos']).toBeUndefined();
    }
  });

  it('carga una pantalla informativa para las rutas pendientes', () => {
    for (const path of ['citas', 'reportes/citas', 'reportes/pacientes']) {
      expect(route(path).loadComponent).toBeDefined();
      expect(route(path).redirectTo).toBeUndefined();
      expect(route(path).data?.['titulo']).toBeTruthy();
    }
  });

  it('registra /consultas como pantalla funcional protegida por Consultas/Consultar', () => {
    const consultas = route('consultas');
    expect(consultas.canActivate).toContain(permisoGuard);
    expect(consultas.loadComponent).toBeDefined();
    expect(consultas.data?.['permisos']).toEqual([{
      modulo: MODULOS_PERMISO.CONSULTAS,
      operacion: OPERACIONES_PERMISO.CONSULTAR,
    }]);
    expect(consultas.data?.['titulo']).toBeUndefined();
  });

  it('registra roles como pantalla funcional protegida', () => {
    const roles = route('admin/roles');
    expect(roles.canActivate).toContain(permisoGuard);
    expect(roles.loadComponent).toBeDefined();
    expect(roles.data?.['permisos']).toEqual([{
      modulo: MODULOS_PERMISO.ROLES,
      operacion: OPERACIONES_PERMISO.CONSULTAR,
    }]);
    expect(roles.data?.['titulo']).toBeUndefined();
  });

  it('registra permisos como pantalla funcional protegida', () => {
    const permisos = route('admin/permisos');
    expect(permisos.canActivate).toContain(permisoGuard);
    expect(permisos.loadComponent).toBeDefined();
    expect(permisos.data?.['permisos']).toEqual([{
      modulo: MODULOS_PERMISO.PERMISOS,
      operacion: OPERACIONES_PERMISO.CONSULTAR,
    }]);
  });

  it('protege formularios de usuario con los permisos reales de sus catálogos', () => {
    for (const path of ['admin/usuarios/nuevo', 'admin/usuarios/editar/:id']) {
      const permisos = route(path).data?.['permisos'] as PermisoRequerido[];
      expect(permisos).toContain({
        modulo: MODULOS_PERMISO.ROLES,
        operacion: OPERACIONES_PERMISO.CONSULTAR,
      });
      expect(permisos).toContain({
        modulo: MODULOS_PERMISO.EMPLEADOS,
        operacion: OPERACIONES_PERMISO.CONSULTAR,
      });
    }
  });

  it('integra entradas en la ruta real de lotes protegida por Consultar', () => {
    const lotes = route('inventario/lotes');
    expect(lotes.canActivate).toContain(permisoGuard);
    expect(lotes.loadComponent).toBeDefined();
    expect(lotes.data?.['permisos']).toEqual([{
      modulo: MODULOS_PERMISO.LOTES_MEDICAMENTO,
      operacion: OPERACIONES_PERMISO.CONSULTAR,
    }]);
  });

  it('no registra rutas antiguas ni una pantalla ficticia de movimientos', () => {
    const paths = children.map(item => item.path);
    expect(paths.some(path => path?.startsWith('dashboard/inventario'))).toBeFalse();
    expect(paths).not.toContain('inventario/movimientos');
  });

  it('mantiene acceso denegado como un estado de navegación distinto', () => {
    const denied = route('acceso-denegado');
    expect(denied.component).toBe(AccesoDenegadoComponent);
    expect(denied.canActivate).toBeUndefined();
  });

  it('presenta una página no encontrada para rutas desconocidas', () => {
    const wildcard = route('**');
    expect(wildcard.loadComponent).toBeDefined();
    expect(wildcard.redirectTo).toBeUndefined();
  });

  it('ubica el comodín al final y elimina la redirección silenciosa al dashboard', () => {
    expect(children.at(-1)?.path).toBe('**');
    expect(children.filter(item => item.path === '**' && item.redirectTo === 'dashboard')).toEqual([]);
  });
});
