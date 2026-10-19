/**
 * Modelo para los ítems del menú dinámico.
 * La API .NET debería devolver una lista de esta estructura (o similar).
 */
export interface MenuItem {
  /** Etiqueta visible, ej: "Citas" */
  label: string;
  /** Ruta interna, ej: "/dashboard/citas". Opcional si tiene hijos. */
  route?: string;
  /** Clase de bootstrap-icons, ej: "bi bi-calendar-check" */
  icon?: string;
  /** Submenú (árbol recursivo) */
  children?: MenuItem[];
  /** Roles permitidos para ver el ítem, ej: ['ADMIN', 'MEDICO']. Vacío = todos. */
  roles?: string[];
  /** Si es true, no se muestra (permite desactivar sin borrar) */
  hidden?: boolean;
}

const ICONOS_BOOTSTRAP_POR_CONTRATO: Readonly<Record<string, string>> = {
  'fa-home': 'bi bi-grid-1x2-fill',
  'fa-user-injured': 'bi bi-people-fill',
  'fa-calendar-alt': 'bi bi-calendar-check',
  'fa-stethoscope': 'bi bi-clipboard2-pulse',
  'fa-pills': 'bi bi-capsule-pill',
  'fa-boxes-stacked': 'bi bi-box-seam-fill',
  'fa-bed': 'bi bi-hospital',
  'fa-cash-register': 'bi bi-receipt-cutoff',
  'fa-cogs': 'bi bi-gear-fill',
  'fa-users-cog': 'bi bi-people',
  'fa-user-tag': 'bi bi-person-badge',
  'fa-id-badge': 'bi bi-person-vcard',
  'fa-chart-bar': 'bi bi-bar-chart-fill',
  'fa-calendar-day': 'bi bi-calendar-date',
  'fa-notes-medical': 'bi bi-file-medical',
};

/** Adapta los iconos del contrato actual a Bootstrap Icons, ya incluido en la aplicación. */
export function resolverIconoMenu(icon?: string): string {
  if (!icon) return 'bi bi-grid';
  if (icon.startsWith('bi ')) return icon;
  return ICONOS_BOOTSTRAP_POR_CONTRATO[icon] ?? 'bi bi-grid';
}
