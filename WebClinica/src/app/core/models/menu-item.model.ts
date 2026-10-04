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
