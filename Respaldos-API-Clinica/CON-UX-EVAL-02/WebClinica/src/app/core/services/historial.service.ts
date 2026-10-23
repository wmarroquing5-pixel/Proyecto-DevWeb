import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ConsultaListadoDto, ConsultaDetalleDto, ConsultaCreateDto, ConsultaUpdateDto, ConsultaFiltroDto,
  DiagnosticoResponse, CrearDiagnosticoRequest, ActualizarDiagnosticoRequest, DiagnosticoFiltroDto,
  HistorialMedicoResponseDto, HistorialMedicoCreateDto, HistorialMedicoFiltroDto,
  TratamientoResponseDto, TratamientoCreateDto, TratamientoUpdateDto, TratamientoFiltroDto,
  ConsumoClinicoCreateDto, ConsumoClinicoResponseDto,
  ExamenResponseDto, ExamenCreateDto, ExamenUpdateDto, ExamenFiltroDto,
  ContactoEmergenciaResponseDto, ContactoEmergenciaCreateDto, ContactoEmergenciaUpdateDto,
  PagedResponse
} from '../models/historial.model';

@Injectable({ providedIn: 'root' })
export class HistorialService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}`;

  // ==================== CONSULTAS ====================

  listarConsultas(filtro: ConsultaFiltroDto): Observable<PagedResponse<ConsultaListadoDto>> {
    let params = new HttpParams()
      .set('page', filtro.page.toString())
      .set('pageSize', filtro.pageSize.toString());
    if (filtro.idPaciente) params = params.set('idPaciente', filtro.idPaciente.toString());
    if (filtro.idMedico) params = params.set('idMedico', filtro.idMedico.toString());
    if (filtro.idSucursal) params = params.set('idSucursal', filtro.idSucursal.toString());
    if (filtro.idClinica) params = params.set('idClinica', filtro.idClinica.toString());
    if (filtro.desde) params = params.set('desde', filtro.desde);
    if (filtro.hasta) params = params.set('hasta', filtro.hasta);
    return this.http.get<PagedResponse<ConsultaListadoDto>>(`${this.apiUrl}/consultas`, { params });
  }

  obtenerConsulta(id: number): Observable<ConsultaDetalleDto> {
    return this.http.get<ConsultaDetalleDto>(`${this.apiUrl}/consultas/${id}`);
  }

  crearConsulta(request: ConsultaCreateDto): Observable<ConsultaDetalleDto> {
    return this.http.post<ConsultaDetalleDto>(`${this.apiUrl}/consultas`, request);
  }

  actualizarConsulta(id: number, request: ConsultaUpdateDto): Observable<ConsultaDetalleDto> {
    return this.http.put<ConsultaDetalleDto>(`${this.apiUrl}/consultas/${id}`, request);
  }

  // ==================== DIAGNÓSTICOS ====================

  listarDiagnosticos(filtro: DiagnosticoFiltroDto): Observable<PagedResponse<DiagnosticoResponse>> {
    let params = new HttpParams()
      .set('page', filtro.page.toString())
      .set('pageSize', filtro.pageSize.toString());
    if (filtro.idConsulta) params = params.set('idConsulta', filtro.idConsulta.toString());
    return this.http.get<PagedResponse<DiagnosticoResponse>>(`${this.apiUrl}/diagnosticos`, { params });
  }

  crearDiagnostico(request: CrearDiagnosticoRequest): Observable<DiagnosticoResponse> {
    return this.http.post<DiagnosticoResponse>(`${this.apiUrl}/diagnosticos`, request);
  }

  actualizarDiagnostico(id: number, request: ActualizarDiagnosticoRequest): Observable<DiagnosticoResponse> {
    return this.http.put<DiagnosticoResponse>(`${this.apiUrl}/diagnosticos/${id}`, request);
  }

  // ==================== HISTORIAL MÉDICO ====================

  listarHistorial(filtro: HistorialMedicoFiltroDto): Observable<PagedResponse<HistorialMedicoResponseDto>> {
    let params = new HttpParams()
      .set('page', filtro.page.toString())
      .set('pageSize', filtro.pageSize.toString());
    if (filtro.idConsulta) params = params.set('idConsulta', filtro.idConsulta.toString());
    if (filtro.idDiagnostico) params = params.set('idDiagnostico', filtro.idDiagnostico.toString());
    if (filtro.idPaciente) params = params.set('idPaciente', filtro.idPaciente.toString());
    return this.http.get<PagedResponse<HistorialMedicoResponseDto>>(`${this.apiUrl}/historial-medico`, { params });
  }

  obtenerHistorial(id: number): Observable<HistorialMedicoResponseDto> {
    return this.http.get<HistorialMedicoResponseDto>(`${this.apiUrl}/historial-medico/${id}`);
  }

  crearEvolucion(request: HistorialMedicoCreateDto): Observable<HistorialMedicoResponseDto> {
    return this.http.post<HistorialMedicoResponseDto>(`${this.apiUrl}/historial-medico`, request);
  }

  // ==================== TRATAMIENTOS ====================

  listarTratamientos(filtro: TratamientoFiltroDto): Observable<PagedResponse<TratamientoResponseDto>> {
    let params = new HttpParams()
      .set('page', filtro.page.toString())
      .set('pageSize', filtro.pageSize.toString());
    if (filtro.idConsulta) params = params.set('idConsulta', filtro.idConsulta.toString());
    return this.http.get<PagedResponse<TratamientoResponseDto>>(`${this.apiUrl}/tratamientos`, { params });
  }

  crearTratamiento(request: TratamientoCreateDto): Observable<TratamientoResponseDto> {
    return this.http.post<TratamientoResponseDto>(`${this.apiUrl}/tratamientos`, request);
  }

  obtenerTratamiento(id: number): Observable<TratamientoResponseDto> {
    return this.http.get<TratamientoResponseDto>(`${this.apiUrl}/tratamientos/${id}`);
  }

  actualizarTratamiento(id: number, request: TratamientoUpdateDto): Observable<TratamientoResponseDto> {
    return this.http.put<TratamientoResponseDto>(`${this.apiUrl}/tratamientos/${id}`, request);
  }

  registrarConsumoClinico(
    idTratamiento: number,
    request: ConsumoClinicoCreateDto,
  ): Observable<ConsumoClinicoResponseDto> {
    return this.http.post<ConsumoClinicoResponseDto>(
      `${this.apiUrl}/tratamientos/${idTratamiento}/consumos`,
      request,
    );
  }

  // ==================== EXÁMENES ====================

  listarExamenes(filtro: ExamenFiltroDto): Observable<PagedResponse<ExamenResponseDto>> {
    let params = new HttpParams()
      .set('page', filtro.page.toString())
      .set('pageSize', filtro.pageSize.toString());
    if (filtro.idConsulta) params = params.set('idConsulta', filtro.idConsulta.toString());
    if (filtro.idDiagnostico) params = params.set('idDiagnostico', filtro.idDiagnostico.toString());
    return this.http.get<PagedResponse<ExamenResponseDto>>(`${this.apiUrl}/examenes`, { params });
  }

  crearExamen(request: ExamenCreateDto): Observable<ExamenResponseDto> {
    return this.http.post<ExamenResponseDto>(`${this.apiUrl}/examenes`, request);
  }

  actualizarExamen(id: number, request: ExamenUpdateDto): Observable<ExamenResponseDto> {
    return this.http.put<ExamenResponseDto>(`${this.apiUrl}/examenes/${id}`, request);
  }

  // ==================== CONTACTO EMERGENCIA ====================

  listarContactosEmergencia(idPaciente: number, page = 1, pageSize = 20): Observable<PagedResponse<ContactoEmergenciaResponseDto>> {
    const params = new HttpParams()
      .set('idPaciente', idPaciente.toString())
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    return this.http.get<PagedResponse<ContactoEmergenciaResponseDto>>(`${this.apiUrl}/contactos-emergencia`, { params });
  }

  crearContactoEmergencia(request: ContactoEmergenciaCreateDto): Observable<ContactoEmergenciaResponseDto> {
    return this.http.post<ContactoEmergenciaResponseDto>(`${this.apiUrl}/contactos-emergencia`, request);
  }

  actualizarContactoEmergencia(id: number, request: ContactoEmergenciaUpdateDto): Observable<ContactoEmergenciaResponseDto> {
    return this.http.put<ContactoEmergenciaResponseDto>(`${this.apiUrl}/contactos-emergencia/${id}`, request);
  }

  eliminarContactoEmergencia(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/contactos-emergencia/${id}`);
  }
}
