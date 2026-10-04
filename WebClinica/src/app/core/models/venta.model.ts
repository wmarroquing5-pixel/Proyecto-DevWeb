/**
 * Modelos del módulo Ventas de Farmacia.
 * Espejo 1:1 de las tablas del script SQL: Venta, VentaDetalle,
 * LoteMedicamento (descarga de stock) y Usuario (quien realizó la venta).
 */

/** Tabla Venta */
export interface Venta {
  idVenta: number;
  idUsuario: number;              // FK Usuario (quien realizó la venta)
  usuarioNombre: string;          // JOIN Usuario -> Empleado (Nombres + Apellidos)
  idSucursal: number;             // FK Sucursal
  sucursalNombre: string;         // JOIN Sucursal
  fechaVenta: string;             // DATETIME2 DEFAULT SYSUTCDATETIME()
  total: number;                  // CHK_Venta_Total: Total > 0
  detalle: VentaDetalle[];        // JOIN inverso (para listar/facturar sin N+1)
}

/** Tabla VentaDetalle
 *  CHKs replicados en validaciones: Cantidad > 0, PrecioUnitario > 0, Subtotal > 0 */
export interface VentaDetalle {
  idVentaDetalle: number;
  idVenta: number;
  idLote: number;                 // FK LoteMedicamento (lote exacto que se descuenta)
  numeroLote: string;             // JOIN LoteMedicamento
  idMedicamento: number;          // JOIN LoteMedicamento -> Medicamento
  medicamentoCodigo: string;      // JOIN Medicamento
  medicamentoNombre: string;      // JOIN Medicamento
  cantidad: number;               // > 0
  precioUnitario: number;         // > 0 (precargado desde Medicamento.PrecioVenta)
  subtotal: number;               // cantidad * precioUnitario (> 0)
  stockAnterior: number;          // trazabilidad: existencia del lote ANTES de la venta
  stockNuevo: number;             // trazabilidad: existencia del lote DESPUÉS de la venta
}

/** Fila del carrito de venta (snapshot del catálogo al momento de agregar) */
export interface CarritoItem {
  idLote: number;
  numeroLote: string;
  idMedicamento: number;
  medicamentoCodigo: string;
  medicamentoNombre: string;
  categoriaNombre: string;
  fechaVencimiento: string;       // para avisar si vence pronto
  stockDisponible: number;        // existencia actual del lote (CHK_Lote_Cantidad >= 0)
  precioUnitario: number;         // editable pero debe quedar > 0
  cantidad: number;               // validada contra stockDisponible antes de completar
}

/** Payload que envía el frontend al backend (.NET) para registrar una venta */
export interface VentaPayload {
  idUsuario: number;
  idSucursal: number;
  detalles: Array<{ idLote: number; cantidad: number; precioUnitario: number }>;
}

/** Resultado de POST /api/Ventas: venta confirmada + lotes actualizados */
export interface RegistrarVentaResult {
  venta: Venta;
  movimientosGenerados: number;   // nº de salidas insertadas en MovimientoInventario
}

/** KPIs del punto de venta */
export interface ResumenVentas {
  ventasHoy: number;
  montoHoy: number;
  unidadesVendidasHoy: number;
  ticketPromedio: number;
  ventasMes: number;
  montoMes: number;
  topProductos: Array<{ nombre: string; unidades: number; monto: number }>;
}

/** Contrato REST esperado del backend .NET (VentasController):
 *
 *  GET  /api/Ventas?desde=&hasta=&idUsuario=     -> Venta[]            (historial)
 *  GET  /api/Ventas/{id}                          -> Venta              (detalle/factura)
 *  POST /api/Ventas                               -> RegistrarVentaResult
 *        Transacción SQL Server:
 *          1. Valida por lote: SUM(Cantidad) <= CantidadDisponible y lote no vencido
 *             (si falla devuelve 409 INSUFFICIENT_STOCK / EXPIRED_LOTE).
 *          2. INSERT Venta (Total calculado en el servidor, nunca de confianza del cliente)
 *          3. INSERT VentaDetalle por producto (Cantidad/Precio/Subtotal > 0)
 *          4. UPDATE LoteMedicamento SET CantidadDisponible -= @cantidad  (>= 0 garantizado)
 *          5. INSERT MovimientoInventario (Salida / Venta, referencia 'Venta #Id')
 *
 *  GET  /api/Ventas/Resumen                       -> ResumenVentas
 *  GET  /api/Catalogos/sucursales                 -> { idSucursal, nombre }[]
 *
 *  Catálogo de productos disponibles para la venta:
 *  GET  /api/Farmacia/disponibles?filtro=         -> LoteDisponible[] (join Medicamento,
 *        filtrado: Medicamento.Activo=1, Lote.CantidadDisponible>0, FechaVencimiento>=hoy,
 *        orden FEFO: lote que vence primero se ofrece primero)
 */
