import { Route, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permisoGuard } from './core/guards/permiso.guard';
import { MODULOS_PERMISO, OPERACIONES_PERMISO, PermisoRequerido } from './core/models/permiso.model';
import { MainLayoutComponent } from './layout/main/main-layout.component';
import { LoginComponent } from './pages/login/login.component';
import { AccesoDenegadoComponent } from './pages/acceso-denegado/acceso-denegado.component';

const permiso = (modulo: string, operacion: PermisoRequerido['operacion']): PermisoRequerido =>
  ({ modulo, operacion });

const rutaPendiente = (
  path: string,
  titulo: string,
  descripcion: string,
): Route => ({
  path,
  data: {
    titulo,
    descripcion,
  },
  loadComponent: () =>
    import('./pages/funcionalidad-pendiente/funcionalidad-pendiente.component')
      .then(m => m.FuncionalidadPendienteComponent),
});

export const routes: Routes = [
  // 🔓 LOGIN: fuera del layout
  {
    path: 'login',
    component: LoginComponent,
  },

  // 🔒 LAYOUT PRINCIPAL: sidebar + contenido dinámico
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      // Redirección por defecto
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      // ---------- Dashboard ----------
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },

      // Rutas anunciadas por el menú de la API cuya pantalla funcional sigue pendiente.
      rutaPendiente(
        'citas',
        'Citas médicas',
        'La gestión de citas se encuentra en preparación.',
      ),
      {
        path: 'consultas',
        canActivate: [permisoGuard],
        data: { permisos: [permiso(MODULOS_PERMISO.CONSULTAS, OPERACIONES_PERMISO.CONSULTAR)] },
        loadComponent: () =>
          import('./pages/historial/consultas-list.component')
            .then(m => m.ConsultasListComponent),
      },
      {
        path: 'admin/roles',
        canActivate: [permisoGuard],
        data: { permisos: [permiso(MODULOS_PERMISO.ROLES, OPERACIONES_PERMISO.CONSULTAR)] },
        loadComponent: () =>
          import('./pages/roles/roles.component').then(m => m.RolesComponent),
      },
      rutaPendiente(
        'reportes/citas',
        'Reporte de citas del día',
        'El reporte de citas se encuentra en preparación.',
      ),
      rutaPendiente(
        'reportes/pacientes',
        'Reporte de pacientes atendidos',
        'El reporte de pacientes se encuentra en preparación.',
      ),

      // ---------- Módulo Pacientes ----------
      {
        path: 'pacientes',
        canActivate: [permisoGuard],
        data: { permisos: [permiso(MODULOS_PERMISO.PACIENTES, OPERACIONES_PERMISO.CONSULTAR)] },
        loadComponent: () =>
          import('./pages/pacientes/pacientes.component').then(m => m.PacientesComponent),
      },
      {
        path: 'pacientes/nuevo',
        canActivate: [permisoGuard],
        data: { permisos: [permiso(MODULOS_PERMISO.PACIENTES, OPERACIONES_PERMISO.CREAR)] },
        loadComponent: () =>
          import('./pages/pacientes/paciente-form.component').then(m => m.PacienteFormComponent),
      },
      {
        path: 'pacientes/editar/:id',
        canActivate: [permisoGuard],
        data: { permisos: [
          permiso(MODULOS_PERMISO.PACIENTES, OPERACIONES_PERMISO.CONSULTAR),
          permiso(MODULOS_PERMISO.PACIENTES, OPERACIONES_PERMISO.MODIFICAR),
        ] },
        loadComponent: () =>
          import('./pages/pacientes/paciente-form.component').then(m => m.PacienteFormComponent),
      },

      // ---------- Módulo Empleados ----------
      // Ruta emitida por el menú del backend y usada al volver de los formularios.
      { path: 'admin/empleados', redirectTo: 'empleados', pathMatch: 'full' },
      {
        path: 'empleados',
        canActivate: [permisoGuard],
        data: { permisos: [permiso(MODULOS_PERMISO.EMPLEADOS, OPERACIONES_PERMISO.CONSULTAR)] },
        loadComponent: () =>
          import('./pages/empleados/empleados.component').then(m => m.EmpleadosComponent),
      },
      {
        path: 'admin/empleados/nuevo',
        canActivate: [permisoGuard],
        data: { permisos: [
          permiso(MODULOS_PERMISO.EMPLEADOS, OPERACIONES_PERMISO.CREAR),
          permiso(MODULOS_PERMISO.SUCURSALES, OPERACIONES_PERMISO.CONSULTAR),
          permiso(MODULOS_PERMISO.ESPECIALIDADES, OPERACIONES_PERMISO.CONSULTAR),
          permiso(MODULOS_PERMISO.TURNOS, OPERACIONES_PERMISO.CONSULTAR),
        ] },
        loadComponent: () =>
          import('./pages/empleados/empleado-form.component').then(m => m.EmpleadoFormComponent),
      },
      {
        path: 'admin/empleados/editar/:id',
        canActivate: [permisoGuard],
        data: { permisos: [
          permiso(MODULOS_PERMISO.EMPLEADOS, OPERACIONES_PERMISO.CONSULTAR),
          permiso(MODULOS_PERMISO.EMPLEADOS, OPERACIONES_PERMISO.MODIFICAR),
          permiso(MODULOS_PERMISO.SUCURSALES, OPERACIONES_PERMISO.CONSULTAR),
          permiso(MODULOS_PERMISO.ESPECIALIDADES, OPERACIONES_PERMISO.CONSULTAR),
          permiso(MODULOS_PERMISO.TURNOS, OPERACIONES_PERMISO.CONSULTAR),
        ] },
        loadComponent: () =>
          import('./pages/empleados/empleado-form.component').then(m => m.EmpleadoFormComponent),
      },

      // ---------- Módulo Usuarios (Administración) ----------
      {
        path: 'admin/usuarios',
        canActivate: [permisoGuard],
        data: { permisos: [permiso(MODULOS_PERMISO.USUARIOS, OPERACIONES_PERMISO.CONSULTAR)] },
        loadComponent: () =>
          import('./pages/usuarios/usuarios.component').then(m => m.UsuariosComponent),
      },
      {
        path: 'admin/usuarios/nuevo',
        canActivate: [permisoGuard],
        data: { permisos: [
          permiso(MODULOS_PERMISO.USUARIOS, OPERACIONES_PERMISO.CREAR),
          permiso(MODULOS_PERMISO.ROLES, OPERACIONES_PERMISO.CONSULTAR),
          permiso(MODULOS_PERMISO.EMPLEADOS, OPERACIONES_PERMISO.CONSULTAR),
        ] },
        loadComponent: () =>
          import('./pages/usuarios/usuario-form.component').then(m => m.UsuarioFormComponent),
      },
      {
        path: 'admin/usuarios/editar/:id',
        canActivate: [permisoGuard],
        data: { permisos: [
          permiso(MODULOS_PERMISO.USUARIOS, OPERACIONES_PERMISO.CONSULTAR),
          permiso(MODULOS_PERMISO.USUARIOS, OPERACIONES_PERMISO.MODIFICAR),
          permiso(MODULOS_PERMISO.ROLES, OPERACIONES_PERMISO.CONSULTAR),
          permiso(MODULOS_PERMISO.EMPLEADOS, OPERACIONES_PERMISO.CONSULTAR),
        ] },
        loadComponent: () =>
          import('./pages/usuarios/usuario-form.component').then(m => m.UsuarioFormComponent),
      },

      // ---------- Módulo Historial Médico ----------
{
  path: 'historial/:id',
  canActivate: [permisoGuard],
  data: { permisos: [permiso(MODULOS_PERMISO.CONSULTAS, OPERACIONES_PERMISO.CONSULTAR)] },
  loadComponent: () =>
    import('./pages/historial/historial-paciente.component')
      .then(m => m.HistorialPacienteComponent),
},
{
  path: 'historial/:id/nueva-consulta',
  canActivate: [permisoGuard],
  data: { permisos: [
    permiso(MODULOS_PERMISO.CONSULTAS, OPERACIONES_PERMISO.CREAR),
    permiso(MODULOS_PERMISO.SUCURSALES, OPERACIONES_PERMISO.CONSULTAR),
  ] },
  loadComponent: () =>
    import('./pages/historial/consulta-nueva.component')
      .then(m => m.ConsultaNuevaComponent),
},
{
  path: 'historial/:id/consulta/:idConsulta',
  canActivate: [permisoGuard],
  data: { permisos: [
    permiso(MODULOS_PERMISO.CONSULTAS, OPERACIONES_PERMISO.CONSULTAR),
    permiso(MODULOS_PERMISO.HISTORIAL, OPERACIONES_PERMISO.CONSULTAR),
  ] },
  loadComponent: () =>
    import('./pages/historial/consulta-detalle.component')
      .then(m => m.ConsultaDetalleComponent),
},
// ---------- Módulo Habitaciones ----------
{
  path: 'habitaciones',
  canActivate: [permisoGuard],
  data: { permisos: [permiso(MODULOS_PERMISO.HABITACIONES, OPERACIONES_PERMISO.CONSULTAR)] },
  loadComponent: () =>
    import('./pages/habitaciones/habitaciones-board.component')
      .then(m => m.HabitacionesBoardComponent),
},
{
  path: 'inventario',
  canActivate: [permisoGuard],
  data: { permisos: [
    permiso(MODULOS_PERMISO.MEDICAMENTOS, OPERACIONES_PERMISO.CONSULTAR),
    permiso(MODULOS_PERMISO.CATEGORIAS, OPERACIONES_PERMISO.CONSULTAR),
    permiso(MODULOS_PERMISO.MARCAS, OPERACIONES_PERMISO.CONSULTAR),
  ] },
  loadComponent: () =>
    import('./pages/inventario/inventario-list.component')
      .then(m => m.InventarioListComponent),
},
// Alias del menú del backend; conserva la ruta funcional de inventario.
{ path: 'medicamentos', redirectTo: 'inventario', pathMatch: 'full' },
{
  path: 'inventario/medicamentos/nuevo',
  canActivate: [permisoGuard],
  data: { permisos: [
    permiso(MODULOS_PERMISO.MEDICAMENTOS, OPERACIONES_PERMISO.CREAR),
    permiso(MODULOS_PERMISO.CATEGORIAS, OPERACIONES_PERMISO.CONSULTAR),
    permiso(MODULOS_PERMISO.MARCAS, OPERACIONES_PERMISO.CONSULTAR),
  ] },
  loadComponent: () =>
    import('./pages/inventario/medicamento-form.component')
      .then(m => m.MedicamentoFormComponent),
},
{
  path: 'inventario/medicamentos/editar/:id',
  canActivate: [permisoGuard],
  data: { permisos: [
    permiso(MODULOS_PERMISO.MEDICAMENTOS, OPERACIONES_PERMISO.CONSULTAR),
    permiso(MODULOS_PERMISO.MEDICAMENTOS, OPERACIONES_PERMISO.MODIFICAR),
    permiso(MODULOS_PERMISO.CATEGORIAS, OPERACIONES_PERMISO.CONSULTAR),
    permiso(MODULOS_PERMISO.MARCAS, OPERACIONES_PERMISO.CONSULTAR),
  ] },
  loadComponent: () =>
    import('./pages/inventario/medicamento-form.component')
      .then(m => m.MedicamentoFormComponent),
},
{
  path: 'inventario/lotes',
  canActivate: [permisoGuard],
  data: { permisos: [permiso(MODULOS_PERMISO.LOTES_MEDICAMENTO, OPERACIONES_PERMISO.CONSULTAR)] },
  loadComponent: () =>
    import('./pages/inventario/lotes-medicamento.component')
      .then(m => m.LotesMedicamentoComponent),
},
{
  path: 'inventario/lotes/nuevo',
  canActivate: [permisoGuard],
  data: { permisos: [
    permiso(MODULOS_PERMISO.LOTES_MEDICAMENTO, OPERACIONES_PERMISO.CREAR),
    permiso(MODULOS_PERMISO.MEDICAMENTOS, OPERACIONES_PERMISO.CONSULTAR),
  ] },
  loadComponent: () =>
    import('./pages/inventario/lote-form.component')
      .then(m => m.LoteFormComponent),
},
{
  path: 'inventario/lotes/editar/:id',
  canActivate: [permisoGuard],
  data: { permisos: [
    permiso(MODULOS_PERMISO.LOTES_MEDICAMENTO, OPERACIONES_PERMISO.CONSULTAR),
    permiso(MODULOS_PERMISO.LOTES_MEDICAMENTO, OPERACIONES_PERMISO.MODIFICAR),
    permiso(MODULOS_PERMISO.MEDICAMENTOS, OPERACIONES_PERMISO.CONSULTAR),
  ] },
  loadComponent: () =>
    import('./pages/inventario/lote-form.component')
      .then(m => m.LoteFormComponent),
},
// ---------- Módulo Ventas de Farmacia ----------
{
  path: 'ventas',
  canActivate: [permisoGuard],
  data: { permisos: [permiso(MODULOS_PERMISO.VENTAS, OPERACIONES_PERMISO.CONSULTAR)] },
  loadComponent: () =>
    import('./pages/ventas/ventas-list.component')
      .then(m => m.VentasListComponent),
},
{
  path: 'ventas/nueva',
  canActivate: [permisoGuard],
  data: { permisos: [
    permiso(MODULOS_PERMISO.VENTAS, OPERACIONES_PERMISO.CREAR),
    permiso(MODULOS_PERMISO.MEDICAMENTOS, OPERACIONES_PERMISO.CONSULTAR),
  ] },
  loadComponent: () =>
    import('./pages/ventas/ventas-nueva.component')
      .then(m => m.VentasNuevaComponent),
},
{
  path: 'ventas/:id',
  canActivate: [permisoGuard],
  data: { permisos: [permiso(MODULOS_PERMISO.VENTAS, OPERACIONES_PERMISO.CONSULTAR)] },
  loadComponent: () =>
    import('./pages/ventas/venta-detalle.component')
      .then(m => m.VentaDetalleComponent),
},
// ---------- Módulo Facturación ----------
{
  path: 'facturas',
  canActivate: [permisoGuard],
  data: { permisos: [permiso(MODULOS_PERMISO.FACTURAS, OPERACIONES_PERMISO.CONSULTAR)] },
  loadComponent: () =>
    import('./pages/facturas/facturas-list.component')
      .then(m => m.FacturasListComponent),
},
{
  path: 'facturas/nueva',
  canActivate: [permisoGuard],
  data: { permisos: [permiso(MODULOS_PERMISO.FACTURAS, OPERACIONES_PERMISO.CREAR)] },
  loadComponent: () =>
    import('./pages/facturas/factura-nueva.component')
      .then(m => m.FacturaNuevaComponent),
},
{
  path: 'facturas/:id',
  canActivate: [permisoGuard],
  data: { permisos: [permiso(MODULOS_PERMISO.FACTURAS, OPERACIONES_PERMISO.CONSULTAR)] },
  loadComponent: () =>
    import('./pages/facturas/factura-detalle.component')
      .then(m => m.FacturaDetalleComponent),
},

      // ---------- Módulo Permisos ----------
      {
        path: 'admin/permisos',
        canActivate: [permisoGuard],
        data: { permisos: [permiso(MODULOS_PERMISO.PERMISOS, OPERACIONES_PERMISO.CONSULTAR)] },
        loadComponent: () =>
          import('./pages/permisos/permisos.component').then(m => m.PermisosComponent),
      },

      // ---------- Catálogos administrativos ----------
      {
        path: 'admin/sucursales',
        canActivate: [permisoGuard],
        data: { permisos: [permiso(MODULOS_PERMISO.SUCURSALES, OPERACIONES_PERMISO.CONSULTAR)] },
        loadComponent: () =>
          import('./pages/catalogos/sucursales-admin.component')
            .then(m => m.SucursalesAdminComponent),
      },
      {
        path: 'admin/especialidades',
        canActivate: [permisoGuard],
        data: { permisos: [permiso(MODULOS_PERMISO.ESPECIALIDADES, OPERACIONES_PERMISO.CONSULTAR)] },
        loadComponent: () =>
          import('./pages/catalogos/especialidades-admin.component')
            .then(m => m.EspecialidadesAdminComponent),
      },
      {
        path: 'admin/turnos',
        canActivate: [permisoGuard],
        data: { permisos: [permiso(MODULOS_PERMISO.TURNOS, OPERACIONES_PERMISO.CONSULTAR)] },
        loadComponent: () =>
          import('./pages/catalogos/turnos-admin.component')
            .then(m => m.TurnosAdminComponent),
      },
      {
        path: 'admin/categorias',
        canActivate: [permisoGuard],
        data: { permisos: [permiso(MODULOS_PERMISO.CATEGORIAS, OPERACIONES_PERMISO.CONSULTAR)] },
        loadComponent: () =>
          import('./pages/catalogos/categorias-admin.component')
            .then(m => m.CategoriasAdminComponent),
      },
      {
        path: 'admin/marcas',
        canActivate: [permisoGuard],
        data: { permisos: [permiso(MODULOS_PERMISO.MARCAS, OPERACIONES_PERMISO.CONSULTAR)] },
        loadComponent: () =>
          import('./pages/catalogos/marcas-admin.component')
            .then(m => m.MarcasAdminComponent),
      },
      {
        path: 'admin/clinicas',
        canActivate: [permisoGuard],
        data: { permisos: [permiso(MODULOS_PERMISO.CLINICAS, OPERACIONES_PERMISO.CONSULTAR)] },
        loadComponent: () =>
          import('./pages/catalogos/clinicas-admin.component')
            .then(m => m.ClinicasAdminComponent),
      },
      {
        path: 'admin/servicios',
        canActivate: [permisoGuard],
        data: { permisos: [permiso(MODULOS_PERMISO.SERVICIOS, OPERACIONES_PERMISO.CONSULTAR)] },
        loadComponent: () =>
          import('./pages/catalogos/servicios-admin.component')
            .then(m => m.ServiciosAdminComponent),
      },

      {
        path: 'acceso-denegado',
        component: AccesoDenegadoComponent,
      },

      // Una URL desconocida se informa expresamente; no se oculta con una redirección.
      {
        path: '**',
        loadComponent: () =>
          import('./pages/pagina-no-encontrada/pagina-no-encontrada.component')
            .then(m => m.PaginaNoEncontradaComponent),
      },
    ],
  },

  // Redirect raíz al login
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
