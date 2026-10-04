/**
 * Modelos del módulo Inventario de Medicamentos.
 * Espejo 1:1 de las tablas del script SQL:
 * Categoria, Marca, Medicamento, LoteMedicamento, MovimientoInventario (nueva),
 * y las vistas derivadas de Venta/VentaDetalle/Consulta para trazabilidad.
 */

/** Tabla Categoria */
export interface Categoria {
  idCategoria: number;
  nombre: string;
  activa: boolean;
}

/** Tabla Marca */
export interface Marca {
  idMarca: number;
  nombre: string;
  activa: boolean;
}

/** Tabla Medicamento (CHK_Medicamento_Precio: PrecioVenta > 0) */
export interface Medicamento {
  idMedicamento: number;
  idCategoria: number;
  categoriaNombre: string;        // JOIN Categoria
  idMarca: number;
  marcaNombre: string;            // JOIN Marca
  codigo: string;                 // UNIQUE
  nombre: string;
  descripcion: string | null;
  precioVenta: number;
  imagenUrl: string | null;
  activo: boolean;
}

/** Formulario de alta/edición de medicamento */
export interface MedicamentoFormData {
  idCategoria: number | null;
  idMarca: number | null;
  codigo: string;
  nombre: string;
  descripcion: string;
  precioVenta: number | null;
  imagenUrl: string;
  activo: boolean;
}

/** Estado calculado de un lote según CHK_Lote_Cantidad y FechaVencimiento */
export type EstadoLote = 'Disponible' | 'Stock bajo' | 'Agotado' | 'Próx. vencer' | 'Vencido';

/** Tabla LoteMedicamento — mínimo requerido por la especificación:
 *  número de lote, medicamento asociado, fecha de ingreso, fecha de vencimiento
 *  y cantidad disponible. */
export interface LoteMedicamento {
  idLote: number;
  idMedicamento: number;
  medicamentoNombre: string;      // JOIN Medicamento
  medicamentoCodigo: string;      // JOIN Medicamento
  numeroLote: string;             // NumeroLote NOT NULL
  fechaIngreso: string;           // DATE NOT NULL
  fechaVencimiento: string;       // DATE NOT NULL
  cantidadDisponible: number;     // >= 0 (CHK_Lote_Cantidad)
}

/** Formulario de registro de lote */
export interface LoteFormData {
  idMedicamento: number | null;
  numeroLote: string;
  fechaIngreso: string;
  fechaVencimiento: string;
  cantidadDisponible: number | null;
}

/** Tipos de movimiento (entrada/salida). CHECK sugerido en el backend. */
export type TipoMovimiento = 'Entrada' | 'Salida';
export type MotivoMovimiento = 'Compra' | 'Devolución' | 'Venta' | 'Uso clínico' | 'Ajuste' | 'Merma';

/**
 * NUEVA tabla sugerida: MovimientoInventario
 * Registra cada entrada y salida con su origen (venta de farmacia o uso clínico)
 * para dar trazabilidad total del stock.
 */
export interface MovimientoInventario {
  idMovimiento: number;
  idLote: number;
  numeroLote: string;             // JOIN LoteMedicamento
  idMedicamento: number;
  medicamentoNombre: string;      // JOIN Medicamento
  tipo: TipoMovimiento;           // 'Entrada' | 'Salida'
  motivo: MotivoMovimiento;       // Compra / Venta / Uso clínico / ...
  cantidad: number;               // > 0 (CHK)
  referencia: string | null;      // 'Venta #123' | 'Consulta #45' | proveedor...
  idUsuario: number;              // FK Usuario (quien registró)
  usuarioNombre: string;          // JOIN Usuario -> Empleado
  fechaMovimiento: string;        // DATETIME2 DEFAULT SYSUTCDATETIME()
}

/** Formulario de entrada/salida */
export interface MovimientoFormData {
  idLote: number | null;
  tipo: TipoMovimiento;
  motivo: MotivoMovimiento;
  cantidad: number | null;
  referencia: string;
}

/** Fila del listado principal: medicamento + resumen de sus lotes */
export interface MedicamentoConLotes extends Medicamento {
  lotes: LoteMedicamento[];
  stockTotal: number;             // SUM(CantidadDisponible) de lotes no vencidos
  stockMinimoAlerta: boolean;     // stockTotal <= umbral global
}

/** Umbral de alerta de stock bajo (configurable en pantalla) */
export const STOCK_MINIMO_ALERTA = 20;

/** Vencimiento "próximo" = menos de 60 días */
export const DIAS_PROXIMO_VENCIMIENTO = 60;

/* ------------------------------------------------------------------ */
/* KPIs del panel de inventario                                          */
/* ------------------------------------------------------------------ */

export interface ResumenInventario {
  totalMedicamentos: number;
  totalLotes: number;
  unidadesEnStock: number;
  valorInventario: number;        // SUM(cantidad * precioVenta)
  lotesVencidos: number;
  lotesProximoVencer: number;
  lotesAgotados: number;
  movimientosHoy: number;
}

/** Contrato REST esperado del backend .NET (InventarioController):
 *
 *  GET    /api/Catalogos/categorias          -> Categoria[]
 *  GET    /api/Catalogos/marcas              -> Marca[]
 *  GET    /api/Medicamentos?filtro=          -> MedicamentoConLotes[]
 *  POST   /api/Medicamentos                  -> Medicamento   (registro de medicamentos)
 *  PUT    /api/Medicamentos/{id}             -> Medicamento
 *  DELETE /api/Medicamentos/{id}             -> baja lógica (Activo = 0)
 *  GET    /api/Lotes?idMedicamento=          -> LoteMedicamento[]
 *  POST   /api/Lotes                         -> LoteMedicamento (registro de lotes)
 *  PUT    /api/Lotes/{id}                    -> LoteMedicamento
 *  POST   /api/Movimientos                   -> MovimientoInventario (entradas/salidas)
 *  GET    /api/Movimientos?idLote=&tipo=     -> MovimientoInventario[]
 *  GET    /api/Inventario/Resumen            -> ResumenInventario
 */
