import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { ConsultaFiltroDto, ConsultaListadoDto } from '../../core/models/historial.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { HistorialService } from '../../core/services/historial.service';
import { PacientesService } from '../../core/services/paciente.service';
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
    templateUrl: './consultas-list.component.html',
    styles: [`
      .consultas-flujo { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .75rem; }
      .consultas-flujo__item { display: flex; align-items: center; gap: .65rem; padding: .8rem 1rem; border: 1px solid #dce5ee; border-radius: .5rem; background: #f8fafc; color: var(--ui-heading); font-weight: 600; }
      .consultas-flujo__item i { color: #0d6efd; font-size: 1.25rem; }
      .consultas-identidad { display: flex; align-items: center; gap: .75rem; min-width: 12rem; }
      .consultas-avatar { width: 2.75rem; height: 2.75rem; flex: 0 0 2.75rem; border-radius: 50%; object-fit: cover; }
      .consultas-avatar--empty { display: inline-flex; align-items: center; justify-content: center; background: #e8eef4; color: #627589; font-size: 1.25rem; }
      .consultas-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .5rem; }
      .consultas-actions .btn { display: inline-flex; align-items: center; gap: .35rem; white-space: nowrap; }
      .consultas-table td.ui-col-actions { white-space: normal; }
      @media (max-width: 767.98px) { .consultas-flujo { grid-template-columns: repeat(2, minmax(0, 1fr)); } .consultas-actions { justify-content: flex-start; } }
      @media (max-width: 479.98px) { .consultas-flujo { grid-template-columns: 1fr; } }
    `]
})
export class ConsultasListComponent implements OnInit, OnDestroy {
  private readonly service = inject(HistorialService);
  private readonly pacientesService = inject(PacientesService);
  private readonly empleadosService = inject(EmpleadosService);
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
  private identidadCarga: string | null = null;
  private solicitudesPacientes = new Subscription();
  private solicitudesMedicos = new Subscription();
  private readonly nombresPacientes = new Map<number, string>();
  private readonly nombresMedicos = new Map<number, string>();
  private readonly fotos = new Map<number, string>();

  constructor() {
    effect(() => {
      const identidad = this.identidadActual();
      const autorizado = this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS);
      const pacientesAutorizados = this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES);
      const medicosAutorizados = this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS);
      if (!identidad || !autorizado) {
        this.limpiarDatosSensibles();
      } else if (this.identidadCarga && this.identidadCarga !== identidad) {
        this.limpiarDatosSensibles();
      }
      if (!pacientesAutorizados) this.limpiarPacientes();
      if (!medicosAutorizados) this.limpiarMedicos();
    });
  }

  ngOnInit(): void {
    this.cargarConsultas();
  }

  ngOnDestroy(): void {
    this.solicitud?.unsubscribe();
    this.limpiarRelacionados();
  }

  nombrePaciente(id: number): string {
    return this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES)
      ? this.nombresPacientes.get(id) ?? 'Paciente no disponible'
      : 'Paciente no disponible';
  }

  nombreMedico(id: number): string {
    return this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS)
      ? this.nombresMedicos.get(id) ?? 'Médico no disponible'
      : 'Médico no disponible';
  }

  fotoUrl(id: number): string | null {
    return this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES)
      ? this.fotos.get(id) ?? null : null;
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
    this.limpiarRelacionados();
    this.identidadCarga = identidad;
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
        this.cargarRelacionados(response.items, revision, identidad);
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

  private cargarRelacionados(items: ConsultaListadoDto[], revision: number, identidad: string): void {
    if (this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES)) {
      for (const id of new Set(items.map(item => item.idPaciente))) {
        if (!Number.isSafeInteger(id) || id <= 0) continue;
        this.solicitudesPacientes.add(this.pacientesService.obtener(id).subscribe({
          next: paciente => {
            if (!this.respuestaRelacionadaVigente(revision, identidad, id, 'paciente') || paciente.idPaciente !== id) return;
            const nombre = `${paciente.nombres ?? ''} ${paciente.apellidos ?? ''}`.trim();
            if (nombre) this.nombresPacientes.set(id, nombre);
          },
          error: () => { /* La referencia sigue visible sin divulgar datos de otro paciente. */ },
        }));
        this.solicitudesPacientes.add(this.pacientesService.obtenerFoto(id).subscribe({
          next: blob => {
            if (!this.respuestaRelacionadaVigente(revision, identidad, id, 'paciente')) return;
            if (!(blob instanceof Blob) || blob.size === 0 ||
                !['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) return;
            const anterior = this.fotos.get(id);
            if (anterior) URL.revokeObjectURL(anterior);
            this.fotos.set(id, URL.createObjectURL(blob));
          },
          error: () => { /* Una foto ausente o inaccesible usa el marcador neutro. */ },
        }));
      }
    }
    if (this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS)) {
      for (const id of new Set(items.map(item => item.idMedico))) {
        if (!Number.isSafeInteger(id) || id <= 0) continue;
        this.solicitudesMedicos.add(this.empleadosService.obtener(id).subscribe({
          next: medico => {
            if (!this.respuestaRelacionadaVigente(revision, identidad, id, 'medico') || medico.idEmpleado !== id) return;
            const nombre = `${medico.nombres ?? ''} ${medico.apellidos ?? ''}`.trim();
            if (nombre) this.nombresMedicos.set(id, nombre);
          },
          error: () => { /* No se sustituye por un nombre no verificado. */ },
        }));
      }
    }
  }

  private respuestaRelacionadaVigente(revision: number, identidad: string, id: number, tipo: 'paciente' | 'medico'): boolean {
    return this.respuestaPerteneceASesion(revision, identidad)
      && this.consultas.some(item => tipo === 'paciente' ? item.idPaciente === id : item.idMedico === id)
      && this.permisos.puedeConsultar(tipo === 'paciente' ? MODULOS_PERMISO.PACIENTES : MODULOS_PERMISO.EMPLEADOS);
  }

  private limpiarPacientes(): void {
    this.solicitudesPacientes.unsubscribe();
    this.solicitudesPacientes = new Subscription();
    this.nombresPacientes.clear();
    for (const url of this.fotos.values()) URL.revokeObjectURL(url);
    this.fotos.clear();
  }

  private limpiarMedicos(): void {
    this.solicitudesMedicos.unsubscribe();
    this.solicitudesMedicos = new Subscription();
    this.nombresMedicos.clear();
  }

  private limpiarRelacionados(): void {
    this.limpiarPacientes();
    this.limpiarMedicos();
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
    this.identidadCarga = null;
    this.limpiarRelacionados();
    this.consultas = [];
    this.totalCount = 0;
    this.totalPages = 0;
    this.cargando = false;
    this.error = '';
  }
}
