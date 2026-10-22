import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { ConsultaFiltroDto, ConsultaListadoDto } from '../../core/models/historial.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { HistorialService } from '../../core/services/historial.service';
import { PermisosService } from '../../core/services/permisos.service';
import { correlativoPaginado } from '../../shared/utils/correlativo';

interface FiltrosConsultaForm {
  idPaciente: number | null;
  idMedico: number | null;
  idSucursal: number | null;
  idClinica: number | null;
  desde: string;
  hasta: string;
}

const filtrosVacios = (): FiltrosConsultaForm => ({
  idPaciente: null,
  idMedico: null,
  idSucursal: null,
  idClinica: null,
  desde: '',
  hasta: '',
});

@Component({
    selector: 'app-consultas-list',
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './consultas-list.component.html'
})
export class ConsultasListComponent implements OnInit {
  private readonly service = inject(HistorialService);
  private readonly session = inject(AuthSessionService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;
  readonly correlativo = correlativoPaginado;

  filtros = filtrosVacios();
  consultas: ConsultaListadoDto[] = [];
  page = 1;
  pageSize = 20;
  totalCount = 0;
  totalPages = 0;
  cargando = false;
  error = '';

  private filtrosAplicados = filtrosVacios();
  private solicitud?: Subscription;
  private revisionSolicitud = 0;

  constructor() {
    effect(() => {
      const identidad = this.identidadActual();
      const autorizado = this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS);
      if (!identidad || !autorizado) {
        this.limpiarDatosSensibles();
      }
    });
  }

  ngOnInit(): void {
    this.cargarConsultas();
  }

  buscar(): void {
    const validationError = this.validarFiltros();
    if (validationError) {
      this.error = validationError;
      return;
    }

    this.filtrosAplicados = { ...this.filtros };
    this.page = 1;
    this.cargarConsultas();
  }

  limpiarFiltros(): void {
    this.filtros = filtrosVacios();
    this.filtrosAplicados = filtrosVacios();
    this.page = 1;
    this.cargarConsultas();
  }

  cambiarPagina(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page || this.cargando) return;
    this.page = page;
    this.cargarConsultas();
  }

  cambiarTamanoPagina(pageSize: number): void {
    if (![10, 20, 50, 100].includes(Number(pageSize))) return;
    this.pageSize = Number(pageSize);
    this.page = 1;
    this.cargarConsultas();
  }

  reintentar(): void {
    this.cargarConsultas();
  }

  private cargarConsultas(): void {
    const identidad = this.identidadActual();
    if (!identidad || !this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS)) {
      this.limpiarDatosSensibles();
      return;
    }

    const revision = ++this.revisionSolicitud;
    this.solicitud?.unsubscribe();
    this.cargando = true;
    this.error = '';

    const filtro: ConsultaFiltroDto = {
      idPaciente: this.filtrosAplicados.idPaciente,
      idMedico: this.filtrosAplicados.idMedico,
      idSucursal: this.filtrosAplicados.idSucursal,
      idClinica: this.filtrosAplicados.idClinica,
      desde: this.inicioDelDia(this.filtrosAplicados.desde),
      hasta: this.finDelDia(this.filtrosAplicados.hasta),
      page: this.page,
      pageSize: this.pageSize,
    };

    this.solicitud = this.service.listarConsultas(filtro).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (revision === this.revisionSolicitud) this.cargando = false;
      }),
    ).subscribe({
      next: response => {
        if (!this.respuestaPerteneceASesion(revision, identidad)) return;
        this.consultas = response.items;
        this.page = response.page;
        this.pageSize = response.pageSize;
        this.totalCount = response.totalCount;
        this.totalPages = response.totalPages;
      },
      error: error => {
        if (!this.respuestaPerteneceASesion(revision, identidad)) return;
        this.consultas = [];
        this.totalCount = 0;
        this.totalPages = 0;
        this.error = this.apiErrors.messageFor(
          error,
          'No fue posible cargar las consultas médicas.',
        );
      },
    });
  }

  private validarFiltros(): string {
    const identificadores: Array<[number | null, string]> = [
      [this.filtros.idPaciente, 'paciente'],
      [this.filtros.idMedico, 'médico'],
      [this.filtros.idSucursal, 'sucursal'],
      [this.filtros.idClinica, 'clínica'],
    ];
    const invalido = identificadores.find(([value]) =>
      value !== null && (!Number.isInteger(Number(value)) || Number(value) <= 0));
    if (invalido) return `El identificador de ${invalido[1]} debe ser un entero mayor que cero.`;
    if (this.filtros.desde && this.filtros.hasta && this.filtros.desde > this.filtros.hasta) {
      return 'La fecha Hasta debe ser posterior o igual a Desde.';
    }
    return '';
  }

  private inicioDelDia(value: string): string | null {
    return value ? `${value}T00:00:00` : null;
  }

  private finDelDia(value: string): string | null {
    return value ? `${value}T23:59:59.999` : null;
  }

  private respuestaPerteneceASesion(revision: number, identidad: string): boolean {
    return revision === this.revisionSolicitud
      && identidad === this.identidadActual()
      && this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS);
  }

  private identidadActual(): string | null {
    const userId = this.session.currentUser()?.idUsuario;
    const token = this.session.token;
    return this.session.isAuthenticated() && userId && token ? `${userId}:${token}` : null;
  }

  private limpiarDatosSensibles(): void {
    this.revisionSolicitud++;
    this.solicitud?.unsubscribe();
    this.solicitud = undefined;
    this.consultas = [];
    this.totalCount = 0;
    this.totalPages = 0;
    this.cargando = false;
    this.error = '';
  }
}
