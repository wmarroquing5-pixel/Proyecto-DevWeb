// ==========================================
// VENTAS DE FARMACIA
// ==========================================

export interface CrearVentaRequest {
  idSucursal: number;
  items: CrearVentaItemRequest[];
}

export interface CrearVentaItemRequest {
  idMedicamento: number;
  cantidad: number;
}

export interface VentaDetalleResponse {
  idVentaDetalle: number;
  idLote: number;
  idMedicamento: number;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface VentaResponse {
  idVenta: number;
  idUsuario: number;
  idSucursal: number;
  fechaVenta: string;
  total: number;
  detalles: VentaDetalleResponse[];
}

// Para listado
export interface VentaConsultaFiltroDto {
  idVenta?: number | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  idSucursal?: number | null;
  idPaciente?: number | null;
  idUsuario?: number | null;
  page?: number;
  pageSize?: number;
}

export interface VentaConsultaResumenResponse {
  idVenta: number;
  idUsuario: number;
  idSucursal: number;
  idPaciente: number | null;
  fechaVenta: string;
  total: number;
}

// Para detalle
export interface VentaConsultaDetalleResponse {
  idDetalle: number;
  idLote: number | null;
  idMedicamento: number | null;
  idServicio: number | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface VentaConsultaResponse {
  idVenta: number;
  idUsuario: number;
  idSucursal: number;
  idPaciente: number | null;
  fechaVenta: string;
  tipoFactura: string;
  total: number;
  detalles: VentaConsultaDetalleResponse[];
}

// Genérico
export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// Catálogo de medicamento (para búsqueda en nueva venta)
export interface CatalogoMedicamentoResponse {
  idMedicamento: number;
  codigo: string;
  nombre: string;
  precioVenta: number;
  marca: string;
  categoria: string;
  descripcion: string | null;
  imagenURL: string | null;
  existenciaTotal: number;
}