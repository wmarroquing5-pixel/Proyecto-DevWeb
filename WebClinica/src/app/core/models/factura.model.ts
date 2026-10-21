import { PagedResponse } from './paged-response.model';

export interface FacturaConsultaFiltro {
  idFactura?: number | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  idSucursal?: number | null;
  idPaciente?: number | null;
  idUsuario?: number | null;
  page?: number;
  pageSize?: number;
}

export interface FacturaResumen {
  idFactura: number;
  idUsuario: number;
  idSucursal: number;
  idPaciente: number | null;
  fechaFactura: string;
  tipoFactura: string;
  nit: string | null;
  nombreFacturacion: string | null;
  total: number;
}

export interface FacturaDetalleItem {
  idDetalle: number;
  idServicio: number | null;
  idLote: number | null;
  idMedicamento: number | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

export interface FacturaDetalle extends FacturaResumen {
  detalles: FacturaDetalleItem[];
}

export interface CrearFacturaServicioItem {
  idServicio: number;
  cantidad: number;
}

export interface CrearFacturaMedicamentoItem {
  idMedicamento: number;
  cantidad: number;
}

export interface CrearFacturaRequest {
  idSucursal: number;
  idPaciente: number;
  nit?: string | null;
  nombreFacturacion?: string | null;
  servicios: CrearFacturaServicioItem[];
  medicamentos: CrearFacturaMedicamentoItem[];
}

export interface FacturaCreada extends FacturaDetalle {
  idPaciente: number;
}

export type { PagedResponse };
