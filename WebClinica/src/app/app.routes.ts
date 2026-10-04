import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { MainLayoutComponent } from './layout/main/main-layout.component';
import { LoginComponent } from './pages/login/login.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'dashboard',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
      },
      {
        path: 'menu-demo',
        loadComponent: () =>
          import('./pages/menu-dinamico/menu-dinamico.component')
            .then(m => m.MenuDinamicoComponent),
      },
      // ---------- Módulo Pacientes ----------
      {
        // i. Registro de datos generales (listado + alta/edición)
        path: 'pacientes',
        loadComponent: () =>
          import('./pages/pacientes/pacientes-list.component')
            .then(m => m.PacientesListComponent),
      },
      {
        // ii. Historial de consultas y tratamientos vinculados al paciente
        path: 'pacientes/:id/historial',
        loadComponent: () =>
          import('./pages/pacientes/paciente-historial.component')
            .then(m => m.PacienteHistorialComponent),
      },
      // ---------- Módulo Empleados (Recursos Humanos) ----------
      {
        // i. Registro de doctores, enfermeras y personal administrativo
        // ii. Asignación de especialidades y roles dentro del sistema
        path: 'empleados',
        loadComponent: () =>
          import('./pages/empleados/empleados-list.component')
            .then(m => m.EmpleadosListComponent),
      },
      // ---------- Módulo Inventario de Medicamentos ----------
      {
        // i. Registro de medicamentos + ii. registro de lotes
        path: 'inventario',
        loadComponent: () =>
          import('./pages/inventario/inventario-list.component')
            .then(m => m.InventarioListComponent),
      },
      {
        // iii. Entradas y salidas por ventas o uso clínico
        path: 'inventario/movimientos',
        loadComponent: () =>
          import('./pages/inventario/inventario-movimientos.component')
            .then(m => m.InventarioMovimientosComponent),
      },
      // ---------- Módulo Habitaciones (internamiento) ----------
      {
        // i. Registro/control de estado · ii. SignalR en tiempo real ·
        // iii. Pacientes por habitación · iv. Asignación · v. Ingreso/egreso
        path: 'habitaciones',
        loadComponent: () =>
          import('./pages/habitaciones/habitaciones-board.component')
            .then(m => m.HabitacionesBoardComponent),
      },
      // ---------- Módulo Ventas de Farmacia ----------
      {
        // i. Historial de ventas con detalle · ii. cantidades, precios, total y usuario
        path: 'ventas',
        loadComponent: () =>
          import('./pages/ventas/ventas-list.component')
            .then(m => m.VentasListComponent),
      },
      {
        path: 'ventas/historial',
        redirectTo: 'ventas',
      },
      {
        // i. Registrar venta con detalle · iii. descuento automático de stock del lote
        // iv. validación de disponibilidad antes de completar
        path: 'ventas/nueva',
        loadComponent: () =>
          import('./pages/ventas/ventas-nueva.component')
            .then(m => m.VentasNuevaComponent),
      },
      // ---------- Módulo Citas ----------
      {
        // Programación paciente↔médico, disponibilidad por franjas,
        // estados (Programada/Confirmada/Atendida/Cancelada) en tiempo real por SignalR.
        path: 'citas',
        loadComponent: () =>
          import('./pages/citas/citas-list.component')
            .then(m => m.CitasListComponent),
      },
    ],
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: '**', redirectTo: 'login' },
];
