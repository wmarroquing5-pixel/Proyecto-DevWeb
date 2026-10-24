export interface RecetaFarmaciaLineaDto {
  idMedicamento: number;
  nombreMedicamento: string;
  presentacion: string | null;
  cantidadPrescritaUnidades: number;
}

export interface RecetaFarmaciaDto {
  idReceta: number;
  idConsulta: number;
  nombrePaciente: string;
  nombreMedicoPrescriptor: string | null;
  fechaPrescripcionUtc: string;
  estado: string;
  medicamentos: RecetaFarmaciaLineaDto[];
}
