import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PagedResponse } from '../models/paged-response.model';
import { RecetaFarmaciaDto } from '../models/receta-farmacia.model';

@Injectable({ providedIn: 'root' })
export class RecetaFarmaciaService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/farmacia/recetas`;

  listar(page: number, pageSize: number, idConsulta: number | null): Observable<PagedResponse<RecetaFarmaciaDto>> {
    let params = new HttpParams().set('page', page).set('pageSize', pageSize);
    if (idConsulta !== null) params = params.set('idConsulta', idConsulta);
    return this.http.get<PagedResponse<RecetaFarmaciaDto>>(this.url, { params });
  }

  obtener(idReceta: number): Observable<RecetaFarmaciaDto> {
    return this.http.get<RecetaFarmaciaDto>(`${this.url}/${idReceta}`);
  }
}
