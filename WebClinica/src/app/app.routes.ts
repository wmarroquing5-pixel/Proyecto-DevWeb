import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './layout/main/main-layout.component';
import { LoginComponent } from './pages/login/login.component';

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

      // ---------- Módulo Pacientes ----------
      {
        path: 'pacientes',
        loadComponent: () =>
          import('./pages/pacientes/pacientes.component').then(m => m.PacientesComponent),
      },
      {
        path: 'pacientes/nuevo',
        loadComponent: () =>
          import('./pages/pacientes/paciente-form.component').then(m => m.PacienteFormComponent),
      },
      {
        path: 'pacientes/editar/:id',
        loadComponent: () =>
          import('./pages/pacientes/paciente-form.component').then(m => m.PacienteFormComponent),
      },

      // ---------- Módulo Empleados ----------
      {
        path: 'empleados',
        loadComponent: () =>
          import('./pages/empleados/empleados.component').then(m => m.EmpleadosComponent),
      },
      {
        path: 'admin/empleados/nuevo',
        loadComponent: () =>
          import('./pages/empleados/empleado-form.component').then(m => m.EmpleadoFormComponent),
      },
      {
        path: 'admin/empleados/editar/:id',
        loadComponent: () =>
          import('./pages/empleados/empleado-form.component').then(m => m.EmpleadoFormComponent),
      },

      // ---------- Módulo Usuarios (Administración) ----------
      {
        path: 'admin/usuarios',
        loadComponent: () =>
          import('./pages/usuarios/usuarios.component').then(m => m.UsuariosComponent),
      },
      {
        path: 'admin/usuarios/nuevo',
        loadComponent: () =>
          import('./pages/usuarios/usuario-form.component').then(m => m.UsuarioFormComponent),
      },
      {
        path: 'admin/usuarios/editar/:id',
        loadComponent: () =>
          import('./pages/usuarios/usuario-form.component').then(m => m.UsuarioFormComponent),
      },
      
      // ---------- Módulo Historial Médico ----------
{
  path: 'historial/:id',
  loadComponent: () =>
    import('./pages/historial/historial-paciente.component')
      .then(m => m.HistorialPacienteComponent),
},
{
  path: 'historial/:id/nueva-consulta',
  loadComponent: () =>
    import('./pages/historial/consulta-nueva.component')
      .then(m => m.ConsultaNuevaComponent),
},
{
  path: 'historial/:id/consulta/:idConsulta',
  loadComponent: () =>
    import('./pages/historial/consulta-detalle.component')
      .then(m => m.ConsultaDetalleComponent),
},
// ---------- Módulo Habitaciones ----------
{
  path: 'habitaciones',
  loadComponent: () =>
    import('./pages/habitaciones/habitaciones-board.component')
      .then(m => m.HabitacionesBoardComponent),
},
{
  path: 'inventario',
  loadComponent: () =>
    import('./pages/inventario/inventario-list.component')
      .then(m => m.InventarioListComponent),
},
{
  path: 'inventario/medicamentos/nuevo',
  loadComponent: () =>
    import('./pages/inventario/medicamento-form.component')
      .then(m => m.MedicamentoFormComponent),
},
{
  path: 'inventario/medicamentos/editar/:id',
  loadComponent: () =>
    import('./pages/inventario/medicamento-form.component')
      .then(m => m.MedicamentoFormComponent),
},
{
  path: 'inventario/lotes',
  loadComponent: () =>
    import('./pages/inventario/lotes-medicamento.component')
      .then(m => m.LotesMedicamentoComponent),
},
{
  path: 'inventario/lotes/nuevo',
  loadComponent: () =>
    import('./pages/inventario/lote-form.component')
      .then(m => m.LoteFormComponent),
},
{
  path: 'inventario/lotes/editar/:id',
  loadComponent: () =>
    import('./pages/inventario/lote-form.component')
      .then(m => m.LoteFormComponent),
},
// ---------- Módulo Ventas de Farmacia ----------
{
  path: 'ventas',
  loadComponent: () =>
    import('./pages/ventas/ventas-list.component')
      .then(m => m.VentasListComponent),
},
{
  path: 'ventas/nueva',
  loadComponent: () =>
    import('./pages/ventas/ventas-nueva.component')
      .then(m => m.VentasNuevaComponent),
},
{
  path: 'ventas/:id',
  loadComponent: () =>
    import('./pages/ventas/venta-detalle.component')
      .then(m => m.VentaDetalleComponent),
},

      // ---------- Módulo Permisos ----------


      // Ruta comodín: redirige al dashboard
      { path: '**', redirectTo: 'dashboard' },
    ],
  },

  // Redirect raíz al login
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];