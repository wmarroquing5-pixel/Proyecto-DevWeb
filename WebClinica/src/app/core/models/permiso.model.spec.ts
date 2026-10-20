import {
  MODULOS_PERMISO_CANONICOS,
  OPERACIONES_PERMISO,
  operacionDisponible,
} from './permiso.model';

describe('catálogo RBAC canónico', () => {
  it('contiene exactamente los 22 módulos reconocidos por la API', () => {
    expect(MODULOS_PERMISO_CANONICOS).toEqual([
      'AsignacionesHabitacion', 'Categorias', 'Clinicas', 'Consultas',
      'ConsumoClinico', 'ContactosEmergencia', 'Empleados', 'Especialidades',
      'Facturas', 'Habitaciones', 'Historial', 'LotesMedicamento', 'Marcas',
      'Medicamentos', 'Pacientes', 'Permisos', 'Roles', 'Servicios', 'Sucursales',
      'Turnos', 'Usuarios', 'Ventas',
    ]);
  });

  it('no trata secciones visuales como políticas independientes', () => {
    for (const modulo of [
      'Dashboard', 'Inventario', 'Diagnosticos', 'Examenes',
      'Tratamientos', 'Citas', 'Reportes',
    ]) {
      expect(MODULOS_PERMISO_CANONICOS).not.toContain(modulo as never);
    }
  });

  it('refleja las operaciones realmente protegidas por los controladores', () => {
    expect(operacionDisponible('ConsumoClinico', OPERACIONES_PERMISO.CREAR)).toBeTrue();
    expect(operacionDisponible('ConsumoClinico', OPERACIONES_PERMISO.CONSULTAR)).toBeFalse();
    expect(operacionDisponible('Facturas', OPERACIONES_PERMISO.ELIMINAR)).toBeFalse();
    expect(operacionDisponible('Historial', OPERACIONES_PERMISO.MODIFICAR)).toBeTrue();
    expect(operacionDisponible('Historial', OPERACIONES_PERMISO.ELIMINAR)).toBeFalse();
  });
});
