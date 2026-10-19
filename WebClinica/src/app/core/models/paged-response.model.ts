/** Contrato JSON de API-Clinica/DTOs/PagedResponse.cs. */
export interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  totalPages: number;
  page: number;
  pageSize: number;
}
