import { MenuItem } from '../models/menu-item.model';

/**
 * Menú de desarrollo. Estructura idéntica a la que devolverá la API .NET.
 * Cuando el backend esté listo, desactiva `useMockMenu` en environment.ts.
 */
export const MOCK_MENU: MenuItem[] = [
  { label: 'Dashboard', route: '/dashboard', icon: 'bi bi-speedometer2' },
  {
    label: 'Mantenimiento',
    icon: 'bi bi-tools',
    children: [
      { label: 'Pacientes', route: '/dashboard/pacientes', icon: 'bi bi-people' },
      {
        label: 'Historial clínico',
        route: '/dashboard/pacientes',
        icon: 'bi bi-clipboard2-pulse',
        roles: ['ADMIN', 'MEDICO'],
      },
      {
        label: 'Empleados',
        route: '/dashboard/empleados',
        icon: 'bi bi-person-badge',
        roles: ['ADMIN'],
      },
      { label: 'Medicamentos', route: '/dashboard/inventario', icon: 'bi bi-capsule' },
      {
        label: 'Ventas de farmacia',
        icon: 'bi bi-cash-stack',
        children: [
          { label: 'Registrar venta', route: '/dashboard/ventas/nueva', icon: 'bi bi-cart-plus' },
          { label: 'Historial de ventas', route: '/dashboard/ventas', icon: 'bi bi-receipt' },
        ],
      },
      {
        label: 'Habitaciones',
        route: '/dashboard/habitaciones',
        icon: 'bi bi-door-closed',
      },
      {
        label: 'Inventario: entradas/salidas',
        route: '/dashboard/inventario/movimientos',
        icon: 'bi bi-arrow-left-right',
      },
      { label: 'Usuarios', route: '/dashboard/usuarios', icon: 'bi bi-person-gear', roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Citas',
    icon: 'bi bi-calendar-check',
    children: [
      { label: 'Agenda del día', route: '/dashboard/citas', icon: 'bi bi-calendar-week' },
      { label: 'Pacientes', route: '/dashboard/pacientes', icon: 'bi bi-people', roles: ['ADMIN', 'MEDICO', 'RECEPCION'] },
    ],
  },
  { label: 'Reportes', route: '/dashboard/reportes', icon: 'bi bi-bar-chart', roles: ['ADMIN', 'MEDICO'] },
];

/** Usuario simulado para el modo demo (sin backend) */
export const MOCK_USER = {
  id: 1,
  username: 'demo',
  fullName: 'Usuario Demo',
  email: 'demo@clinica.com',
  roles: ['ADMIN'],
};
