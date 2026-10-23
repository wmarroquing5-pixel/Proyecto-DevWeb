// ==========================================
// MEDICAMENTOS
// ==========================================

// Respuesta del catálogo (con stock calculado y datos de marca/categoría)
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

// Respuesta básica (sin stock ni joins)
export interface MedicamentoResponse {
  idMedicamento: number;
  idCategoria: number;
  idMarca: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precioVenta: number;
  imagenURL: string | null;
  activo: boolean;
  presentacion?: string | null;
}

// Request para crear/actualizar medicamento
export interface GuardarMedicamentoRequest {
  idCategoria: number;
  idMarca: number;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  precioVenta: number;
  imagenURL?: string | null;
  activo?: boolean | null;
}

// Filtro para el catálogo
export interface CatalogoFiltroDto {
  nombre?: string | null;
  categoriaId?: number | null;
  marcaId?: number | null;
  page?: number;
  pageSize?: number;
}

// ==========================================
// LOTES DE MEDICAMENTO
// ==========================================

export interface LoteMedicamentoResponse {
  idLote: number;
  idMedicamento: number;
  numeroLote: string;
  fechaIngreso: string; // DateOnly → "YYYY-MM-DD"
  fechaVencimiento: string; // DateOnly → "YYYY-MM-DD"
  cantidadDisponible: number;
}

export interface GuardarLoteMedicamentoRequest {
  idMedicamento: number;
  numeroLote: string;
  fechaIngreso: string;
  fechaVencimiento: string;
  cantidadDisponible: number;
  idSucursal?: number | null;
  observaciones?: string | null;
}

export interface ActualizarLoteMedicamentoRequest {
  idMedicamento: number;
  numeroLote: string;
  fechaIngreso: string;
  fechaVencimiento: string;
  cantidadDisponible: number;
  cantidadEsperada: number;
  idSucursal?: number | null;
  observaciones?: string | null;
}

export interface RegistrarEntradaInventarioRequest {
  idSucursal: number;
  cantidad: number;
  observaciones?: string | null;
}

export interface EntradaInventarioResponse {
  idMovimiento: number;
  idLote: number;
  idMedicamento: number;
  idSucursal: number;
  cantidad: number;
  cantidadDisponible: number;
  fechaMovimiento: string; // DateTime ISO
  observaciones: string | null;
}

// ==========================================
// CATEGORÍAS Y MARCAS
// ==========================================

export interface CategoriaResponse {
  idCategoria: number;
  nombre: string;
  activa: boolean;
}

export interface MarcaResponse {
  idMarca: number;
  nombre: string;
  activa: boolean;
}

export interface GuardarCatalogoFarmaciaRequest {
  nombre: string;
  activa?: boolean | null;
}

// ==========================================
// GENÉRICO
// ==========================================

export type { PagedResponse } from './paged-response.model';
