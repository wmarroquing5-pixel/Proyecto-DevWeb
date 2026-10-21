
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  etiquetaModuloPermiso,
  MODULOS_PERMISO,
  OPERACIONES_PERMISO,
  OperacionPermiso,
  operacionDisponible,
} from '../../core/models/permiso.model';
import {
  GuardarPermisoRolRequest,
  PermisoRolResponse,
  RolResponse,
} from '../../core/models/rol.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AutorizacionActualizacionService } from '../../core/services/autorizacion-actualizacion.service';
import { PermisosService } from '../../core/services/permisos.service';
import { RolesService } from '../../core/services/roles.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { UiStateComponent } from '../../shared/components/ui-state.component';
import { correlativoPaginado } from '../../shared/utils/correlativo';

@Component({
    selector: 'app-permisos-admin',
    imports: [FormsModule, ConfirmDialogComponent, UiStateComponent],
    templateUrl: './permisos.component.html'
})
export class PermisosComponent implements OnInit {
  private readonly rolesService = inject(RolesService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly actualizacion = inject(AutorizacionActualizacionService);
  readonly autorizacion = inject(PermisosService);
  readonly MODULOS = MODULOS_PERMISO;
  readonly OPERACIONES = OPERACIONES_PERMISO;
  readonly correlativo = correlativoPaginado;

  roles: readonly RolResponse[] = [];
  modulos: readonly string[] = [];
  asignaciones: PermisoRolResponse[] = [];
  total = 0;
  totalPages = 0;
  page = 1;
  readonly pageSize = 10;

  busqueda = '';
  filtroRol: number | null = null;
  filtroModulo = '';
  cargando = false;
  cargandoCatalogos = false;
  error = '';
  aviso = '';

  mostrarFormulario = false;
  permisoEditando: PermisoRolResponse | null = null;
  formulario: GuardarPermisoRolRequest = this.formularioVacio();
  guardando = false;
  errorFormulario = '';

  permisoPendiente: PermisoRolResponse | null = null;
  eliminando = false;
  private revisionCarga = 0;

  ngOnInit(): void {
    this.cargarCatalogosYPermisos();
  }

  get asignacionesVisibles(): PermisoRolResponse[] {
    const termino = this.busqueda.trim().toLocaleLowerCase('es');
    if (!termino) return this.asignaciones;
    return this.asignaciones.filter(item =>
      item.modulo.toLocaleLowerCase('es').includes(termino)
      || this.nombreRol(item.idRol).toLocaleLowerCase('es').includes(termino),
    );
  }

  cargarCatalogosYPermisos(): void {
    this.cargandoCatalogos = true;
    this.error = '';
    forkJoin({
      roles: this.rolesService.listarTodosRoles(),
      modulos: this.rolesService.listarModulosPermiso(),
    }).subscribe({
      next: ({ roles, modulos }) => {
        this.roles = roles;
        this.modulos = modulos;
        this.cargandoCatalogos = false;
        this.cargarPermisos();
      },
      error: error => {
        this.cargandoCatalogos = false;
        this.error = this.errorMessage(error, 'No se pudieron cargar los catálogos administrativos.');
      },
    });
  }

  cargarPermisos(): void {
    const revision = ++this.revisionCarga;
    this.cargando = true;
    this.error = '';
    this.rolesService.listarPermisos(this.page, this.pageSize, {
      idRol: this.filtroRol ?? undefined,
      modulo: this.filtroModulo || undefined,
    }).subscribe({
      next: response => {
        if (revision !== this.revisionCarga) return;
        this.asignaciones = response.items;
        this.total = response.totalCount;
        this.totalPages = response.totalPages;
        this.cargando = false;
      },
      error: error => {
        if (revision !== this.revisionCarga) return;
        this.asignaciones = [];
        this.cargando = false;
        this.error = this.errorMessage(error, 'No se pudieron cargar los permisos.');
      },
    });
  }

  aplicarFiltros(): void {
    this.page = 1;
    this.busqueda = '';
    this.cargarPermisos();
  }

  limpiarFiltros(): void {
    this.busqueda = '';
    this.filtroRol = null;
    this.filtroModulo = '';
    this.aplicarFiltros();
  }

  cambiarPagina(nuevaPagina: number): void {
    if (nuevaPagina < 1 || nuevaPagina > Math.max(this.totalPages, 1)
      || nuevaPagina === this.page) return;
    this.page = nuevaPagina;
    this.busqueda = '';
    this.cargarPermisos();
  }

  abrirCrear(): void {
    if (!this.autorizacion.puedeCrear(this.MODULOS.PERMISOS)) return;
    const rol = this.roles.find(item => item.activo);
    if (!rol || this.modulos.length === 0) {
      this.error = 'No hay roles activos o módulos disponibles para crear la asignación.';
      return;
    }
    this.permisoEditando = null;
    this.formulario = {
      ...this.formularioVacio(),
      idRol: rol.idRol,
      modulo: this.modulos[0],
    };
    this.errorFormulario = '';
    this.aviso = '';
    this.mostrarFormulario = true;
  }

  abrirEditar(permiso: PermisoRolResponse): void {
    if (!this.autorizacion.puedeModificar(this.MODULOS.PERMISOS)) return;
    this.permisoEditando = permiso;
    this.formulario = {
      idRol: permiso.idRol,
      modulo: permiso.modulo,
      puedeConsultar: permiso.puedeConsultar,
      puedeCrear: permiso.puedeCrear,
      puedeModificar: permiso.puedeModificar,
      puedeEliminar: permiso.puedeEliminar,
    };
    this.errorFormulario = '';
    this.aviso = '';
    this.mostrarFormulario = true;
  }

  cambiarModulo(modulo: string): void {
    this.formulario.modulo = modulo;
    this.limpiarOperacionesNoDisponibles();
  }

  etiquetaModulo(modulo: string): string {
    return etiquetaModuloPermiso(modulo);
  }

  operacionDisponible(operacion: OperacionPermiso): boolean {
    return operacionDisponible(this.formulario.modulo, operacion);
  }

  cerrarFormulario(): void {
    if (this.guardando) return;
    this.mostrarFormulario = false;
    this.permisoEditando = null;
    this.errorFormulario = '';
  }

  guardar(form: NgForm): void {
    if (form.invalid || this.guardando) return;
    const rol = this.roles.find(item => item.idRol === Number(this.formulario.idRol));
    if (!rol?.activo) {
      this.errorFormulario = 'Selecciona un rol activo.';
      return;
    }
    if (!this.modulos.includes(this.formulario.modulo)) {
      this.errorFormulario = 'Selecciona un módulo autorizado por la API.';
      return;
    }

    const editando = this.permisoEditando;
    if (editando && !this.autorizacion.puedeModificar(this.MODULOS.PERMISOS)) return;
    if (!editando && !this.autorizacion.puedeCrear(this.MODULOS.PERMISOS)) return;

    this.guardando = true;
    this.errorFormulario = '';
    const request = this.normalizarSolicitud({
      ...this.formulario,
      idRol: Number(this.formulario.idRol),
    });
    const operation = editando
      ? this.rolesService.actualizarPermiso(editando.idPermiso, request)
      : this.rolesService.crearPermiso(request);
    operation.subscribe({
      next: () => {
        this.guardando = false;
        this.mostrarFormulario = false;
        this.permisoEditando = null;
        this.aviso = editando ? 'Permiso actualizado correctamente.' : 'Permiso creado correctamente.';
        this.revalidarAutorizacion();
        this.cargarPermisos();
      },
      error: error => {
        this.guardando = false;
        this.errorFormulario = this.errorMessage(error, 'No se pudo guardar el permiso.');
      },
    });
  }

  solicitarEliminacion(permiso: PermisoRolResponse): void {
    if (!this.autorizacion.puedeEliminar(this.MODULOS.PERMISOS)) return;
    this.permisoPendiente = permiso;
    this.aviso = '';
  }

  cancelarEliminacion(): void {
    if (!this.eliminando) this.permisoPendiente = null;
  }

  confirmarEliminacion(): void {
    const permiso = this.permisoPendiente;
    if (!permiso || this.eliminando) return;
    this.eliminando = true;
    this.rolesService.eliminarPermiso(permiso.idPermiso).subscribe({
      next: () => {
        this.eliminando = false;
        this.permisoPendiente = null;
        this.aviso = 'Permiso revocado correctamente.';
        if (this.asignaciones.length === 1 && this.page > 1) this.page -= 1;
        this.revalidarAutorizacion();
        this.cargarPermisos();
      },
      error: error => {
        this.eliminando = false;
        this.permisoPendiente = null;
        this.error = this.errorMessage(error, 'No se pudo revocar el permiso.');
      },
    });
  }

  nombreRol(idRol: number): string {
    const rol = this.roles.find(item => item.idRol === idRol);
    if (!rol) return `Rol ${idRol}`;
    return rol.nombre || `Rol sin nombre (ID ${idRol})`;
  }

  rolActivo(idRol: number): boolean {
    return this.roles.find(item => item.idRol === idRol)?.activo ?? false;
  }

  private formularioVacio(): GuardarPermisoRolRequest {
    return {
      idRol: 0,
      modulo: '',
      puedeConsultar: false,
      puedeCrear: false,
      puedeModificar: false,
      puedeEliminar: false,
    };
  }

  private limpiarOperacionesNoDisponibles(): void {
    this.formulario = this.normalizarSolicitud(this.formulario);
  }

  private normalizarSolicitud(request: GuardarPermisoRolRequest): GuardarPermisoRolRequest {
    return {
      ...request,
      puedeConsultar: operacionDisponible(request.modulo, this.OPERACIONES.CONSULTAR)
        && request.puedeConsultar,
      puedeCrear: operacionDisponible(request.modulo, this.OPERACIONES.CREAR)
        && request.puedeCrear,
      puedeModificar: operacionDisponible(request.modulo, this.OPERACIONES.MODIFICAR)
        && request.puedeModificar,
      puedeEliminar: operacionDisponible(request.modulo, this.OPERACIONES.ELIMINAR)
        && request.puedeEliminar,
    };
  }

  private revalidarAutorizacion(): void {
    this.actualizacion.revalidarAhora().subscribe({ error: () => undefined });
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) return this.apiErrors.messageFor(error, fallback);
    return error instanceof Error && error.message ? error.message : fallback;
  }
}
