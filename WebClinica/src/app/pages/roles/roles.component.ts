
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import { forkJoin } from 'rxjs';
import {
  GuardarPermisoRolRequest,
  GuardarRolRequest,
  PermisoRolResponse,
  RolResponse,
} from '../../core/models/rol.model';
import {
  etiquetaModuloPermiso,
  MODULOS_PERMISO,
  OPERACIONES_PERMISO,
  OperacionPermiso,
  operacionDisponible,
} from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AutorizacionActualizacionService } from '../../core/services/autorizacion-actualizacion.service';
import { PermisosService } from '../../core/services/permisos.service';
import { RolesService } from '../../core/services/roles.service';
import { correlativoPaginado } from '../../shared/utils/correlativo';

interface EstadoPermisoFila {
  puedeConsultar: boolean;
  puedeCrear: boolean;
  puedeModificar: boolean;
  puedeEliminar: boolean;
}

interface PermisoFila extends EstadoPermisoFila {
  idPermiso: number | null;
  modulo: string;
  original: EstadoPermisoFila;
  guardando: boolean;
  error: string;
}

@Component({
    selector: 'app-roles',
    imports: [FormsModule],
    templateUrl: './roles.component.html'
})
export class RolesComponent implements OnInit {
  private readonly rolesService = inject(RolesService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly actualizacion = inject(AutorizacionActualizacionService);
  readonly permisos = inject(PermisosService);
  readonly MODULOS = MODULOS_PERMISO;
  readonly OPERACIONES = OPERACIONES_PERMISO;
  readonly correlativo = correlativoPaginado;

  roles: RolResponse[] = [];
  total = 0;
  totalPages = 0;
  page = 1;
  readonly pageSize = 10;
  filtro = '';
  cargandoRoles = false;
  errorRoles = '';
  aviso = '';

  mostrarFormularioRol = false;
  rolEditando: RolResponse | null = null;
  rolForm: GuardarRolRequest = { nombre: '', activo: true };
  guardandoRol = false;
  errorRol = '';
  filasNuevoRol: PermisoFila[] = [];
  cargandoModulosNuevoRol = false;
  errorModulosNuevoRol = '';
  rolCreadoPendiente: RolResponse | null = null;

  rolPermisos: RolResponse | null = null;
  filasPermisos: PermisoFila[] = [];
  cargandoPermisos = false;
  errorPermisos = '';

  ngOnInit(): void {
    this.cargarRoles();
  }

  get rolesVisibles(): RolResponse[] {
    const filtro = this.filtro.trim().toLocaleLowerCase('es');
    return filtro
      ? this.roles.filter(rol => this.nombreRol(rol).toLocaleLowerCase('es').includes(filtro))
      : this.roles;
  }

  nombreRol(rol: RolResponse): string {
    return rol.nombre || `Rol sin nombre (ID ${rol.idRol})`;
  }

  cargarRoles(): void {
    this.cargandoRoles = true;
    this.errorRoles = '';
    this.rolesService.listarRoles(this.page, this.pageSize).subscribe({
      next: response => {
        this.roles = response.items;
        this.total = response.totalCount;
        this.totalPages = response.totalPages;
        this.cargandoRoles = false;
      },
      error: error => {
        this.errorRoles = this.errorMessage(error, 'No se pudieron cargar los roles.');
        this.cargandoRoles = false;
      },
    });
  }

  cambiarPagina(page: number): void {
    if (page < 1 || (this.totalPages > 0 && page > this.totalPages) || page === this.page) return;
    this.page = page;
    this.filtro = '';
    this.cargarRoles();
  }

  abrirCrearRol(): void {
    if (!this.permisos.puedeCrear(this.MODULOS.ROLES)) return;
    if (this.filasPermisos.some(fila => fila.guardando)) return;
    this.rolPermisos = null;
    this.filasPermisos = [];
    this.rolEditando = null;
    this.rolForm = { nombre: '', activo: true };
    this.errorRol = '';
    this.errorModulosNuevoRol = '';
    this.rolCreadoPendiente = null;
    this.filasNuevoRol = [];
    this.mostrarFormularioRol = true;
    this.cargarMatrizNuevoRol();
  }

  abrirEditarRol(rol: RolResponse): void {
    if (!this.permisos.puedeModificar(this.MODULOS.ROLES)) return;
    this.rolEditando = rol;
    this.rolCreadoPendiente = null;
    this.filasNuevoRol = [];
    this.errorModulosNuevoRol = '';
    this.rolForm = { nombre: rol.nombre, activo: rol.activo };
    this.errorRol = '';
    this.mostrarFormularioRol = true;
  }

  cerrarFormularioRol(): void {
    if (this.guardandoRol) return;
    this.mostrarFormularioRol = false;
    this.rolEditando = null;
    this.rolCreadoPendiente = null;
    this.filasNuevoRol = [];
    this.cargandoModulosNuevoRol = false;
    this.errorModulosNuevoRol = '';
    this.errorRol = '';
  }

  puedeGuardarRol(): boolean {
    if (this.rolCreadoPendiente) return this.puedeAsignarPermisosIniciales();
    return this.rolEditando
      ? this.permisos.puedeModificar(this.MODULOS.ROLES)
      : this.permisos.puedeCrear(this.MODULOS.ROLES);
  }

  puedeAsignarPermisosIniciales(): boolean {
    return this.permisos.puedeConsultar(this.MODULOS.PERMISOS)
      && this.permisos.puedeCrear(this.MODULOS.PERMISOS);
  }

  puedeEnviarRol(): boolean {
    return this.puedeGuardarRol()
      && !this.guardandoRol
      && (this.rolEditando !== null
        || !this.puedeAsignarPermisosIniciales()
        || (!this.cargandoModulosNuevoRol && !this.errorModulosNuevoRol));
  }

  cargarMatrizNuevoRol(): void {
    if (this.rolEditando || this.rolCreadoPendiente || !this.puedeAsignarPermisosIniciales()) return;
    this.cargandoModulosNuevoRol = true;
    this.errorModulosNuevoRol = '';
    this.rolesService.listarModulosPermiso().subscribe({
      next: modulos => {
        this.filasNuevoRol = this.crearMatrizVacia(modulos);
        this.cargandoModulosNuevoRol = false;
      },
      error: error => {
        this.filasNuevoRol = [];
        this.cargandoModulosNuevoRol = false;
        this.errorModulosNuevoRol = this.errorMessage(
          error,
          'No se pudo cargar el catálogo autorizado de módulos.',
        );
      },
    });
  }

  guardarRol(form: NgForm): void {
    if (form.invalid || !this.puedeEnviarRol()) {
      form.control.markAllAsTouched();
      return;
    }
    const request: GuardarRolRequest = {
      nombre: this.rolForm.nombre.trim(),
      activo: this.rolForm.activo,
    };
    if (!request.nombre) {
      form.control.markAllAsTouched();
      return;
    }
    this.guardandoRol = true;
    this.errorRol = '';
    if (this.rolCreadoPendiente) {
      this.guardarPermisosIniciales(this.rolCreadoPendiente);
      return;
    }
    const editando = this.rolEditando;
    const request$ = editando
      ? this.rolesService.actualizarRol(editando.idRol, request)
      : this.rolesService.crearRol(request);
    request$.subscribe({
      next: rol => {
        if (editando) {
          this.aviso = `Rol “${rol.nombre}” actualizado.`;
          this.guardandoRol = false;
          this.cerrarFormularioRol();
          this.cargarRoles();
          return;
        }
        this.rolCreadoPendiente = rol;
        this.rolForm = { nombre: rol.nombre, activo: rol.activo };
        this.guardarPermisosIniciales(rol);
      },
      error: error => {
        this.errorRol = this.errorMessage(error, 'No se pudo guardar el rol.');
        this.guardandoRol = false;
      },
    });
  }

  private guardarPermisosIniciales(rol: RolResponse): void {
    if (!this.puedeAsignarPermisosIniciales()) {
      this.finalizarCreacionRol(rol);
      return;
    }
    const pendientes = this.filasNuevoRol.filter(fila =>
      fila.idPermiso === null && this.algunaOperacion(fila));
    if (pendientes.length === 0) {
      this.finalizarCreacionRol(rol);
      return;
    }
    this.guardarPermisoInicialEnSecuencia(rol, pendientes, 0, 0);
  }

  private guardarPermisoInicialEnSecuencia(
    rol: RolResponse,
    pendientes: PermisoFila[],
    indice: number,
    fallidos: number,
  ): void {
    if (indice >= pendientes.length) {
      if (fallidos === 0) {
        this.finalizarCreacionRol(rol);
      } else {
        this.guardandoRol = false;
        this.errorRol = `El rol “${rol.nombre}” fue creado, pero ${fallidos} asignación${fallidos === 1 ? '' : 'es'} no pudo${fallidos === 1 ? '' : 'ieron'} guardarse. Corrige el problema y reintenta únicamente los permisos pendientes.`;
        this.aviso = 'Guardado parcial: las asignaciones confirmadas se conservaron.';
        this.cargarRoles();
      }
      return;
    }

    const fila = pendientes[indice];
    fila.guardando = true;
    fila.error = '';
    this.rolesService.crearPermiso(this.toPermissionRequest(rol.idRol, fila)).subscribe({
      next: permiso => {
        this.aplicarPermiso(fila, permiso);
        fila.guardando = false;
        this.guardarPermisoInicialEnSecuencia(rol, pendientes, indice + 1, fallidos);
      },
      error: error => {
        fila.error = this.errorMessage(error, 'No se pudo guardar este permiso.');
        fila.guardando = false;
        this.guardarPermisoInicialEnSecuencia(rol, pendientes, indice + 1, fallidos + 1);
      },
    });
  }

  private finalizarCreacionRol(rol: RolResponse): void {
    const guardoPermisos = this.filasNuevoRol.some(fila => fila.idPermiso !== null);
    this.aviso = guardoPermisos
      ? `Rol “${rol.nombre}” y permisos guardados correctamente.`
      : `Rol “${rol.nombre}” creado sin asignaciones de permisos.`;
    this.guardandoRol = false;
    this.errorRol = '';
    if (guardoPermisos) {
      this.actualizacion.revalidarAhora().subscribe({ error: () => undefined });
    }
    this.cerrarFormularioRol();
    this.cargarRoles();
  }

  eliminarRol(rol: RolResponse): void {
    if (!this.permisos.puedeEliminar(this.MODULOS.ROLES)) return;
    if (!window.confirm(`¿Eliminar el rol “${rol.nombre}”? Esta operación no se puede deshacer.`)) return;
    this.errorRoles = '';
    this.rolesService.eliminarRol(rol.idRol).subscribe({
      next: () => {
        this.aviso = `Rol “${rol.nombre}” eliminado.`;
        if (this.rolPermisos?.idRol === rol.idRol) this.cerrarPermisos();
        this.cargarRoles();
      },
      error: error => {
        this.errorRoles = this.errorMessage(
          error,
          'No se pudo eliminar el rol. Comprueba si tiene usuarios o permisos asociados.',
        );
      },
    });
  }

  abrirPermisos(rol: RolResponse): void {
    if (!this.permisos.puedeConsultar(this.MODULOS.PERMISOS)) return;
    this.rolPermisos = rol;
    this.filasPermisos = [];
    this.cargandoPermisos = true;
    this.errorPermisos = '';
    forkJoin({
      modulos: this.rolesService.listarModulosPermiso(),
      permisos: this.rolesService.listarTodosPermisos(),
    }).subscribe({
      next: ({ modulos, permisos }) => {
        try {
          this.filasPermisos = this.crearMatriz(rol.idRol, modulos, permisos);
        } catch (error) {
          this.filasPermisos = [];
          this.errorPermisos = this.errorMessage(error, 'No se pudo construir la matriz de permisos.');
        }
        this.cargandoPermisos = false;
      },
      error: error => {
        this.errorPermisos = this.errorMessage(error, 'No se pudieron cargar los permisos.');
        this.cargandoPermisos = false;
      },
    });
  }

  cerrarPermisos(): void {
    if (this.filasPermisos.some(fila => fila.guardando)) return;
    this.rolPermisos = null;
    this.filasPermisos = [];
    this.errorPermisos = '';
  }

  filaModificada(fila: PermisoFila): boolean {
    return fila.puedeConsultar !== fila.original.puedeConsultar
      || fila.puedeCrear !== fila.original.puedeCrear
      || fila.puedeModificar !== fila.original.puedeModificar
      || fila.puedeEliminar !== fila.original.puedeEliminar;
  }

  puedeEditarFila(fila: PermisoFila): boolean {
    return fila.idPermiso === null
      ? this.rolPermisos?.activo === true
        && this.permisos.puedeCrear(this.MODULOS.PERMISOS)
      : this.permisos.puedeModificar(this.MODULOS.PERMISOS);
  }

  etiquetaModulo(modulo: string): string {
    return etiquetaModuloPermiso(modulo);
  }

  operacionDisponible(modulo: string, operacion: OperacionPermiso): boolean {
    return operacionDisponible(modulo, operacion);
  }

  guardarPermiso(fila: PermisoFila): void {
    if (!this.rolPermisos || !this.filaModificada(fila)
      || !this.puedeEditarFila(fila) || fila.guardando) return;
    if (fila.idPermiso === null && !this.algunaOperacion(fila)) {
      this.restablecerFila(fila);
      return;
    }
    const request = this.toPermissionRequest(this.rolPermisos.idRol, fila);
    fila.guardando = true;
    fila.error = '';
    const request$ = fila.idPermiso === null
      ? this.rolesService.crearPermiso(request)
      : this.rolesService.actualizarPermiso(fila.idPermiso, request);
    request$.subscribe({
      next: permiso => {
        this.aplicarPermiso(fila, permiso);
        fila.guardando = false;
        this.aviso = `Permiso de “${fila.modulo}” guardado.`;
        this.actualizacion.revalidarAhora().subscribe({ error: () => undefined });
      },
      error: error => {
        fila.error = this.errorMessage(error, 'No se pudo guardar este permiso.');
        fila.guardando = false;
      },
    });
  }

  restablecerFila(fila: PermisoFila): void {
    if (fila.guardando) return;
    Object.assign(fila, fila.original);
    fila.error = '';
  }

  cancelarCambiosPermisos(): void {
    for (const fila of this.filasPermisos) this.restablecerFila(fila);
  }

  eliminarPermiso(fila: PermisoFila): void {
    if (fila.idPermiso === null || fila.guardando
      || !this.permisos.puedeEliminar(this.MODULOS.PERMISOS)) return;
    if (!window.confirm(`¿Quitar todos los permisos del módulo “${fila.modulo}” para este rol?`)) return;
    fila.guardando = true;
    fila.error = '';
    this.rolesService.eliminarPermiso(fila.idPermiso).subscribe({
      next: () => {
        fila.idPermiso = null;
        fila.puedeConsultar = false;
        fila.puedeCrear = false;
        fila.puedeModificar = false;
        fila.puedeEliminar = false;
        fila.original = this.estadoFila(fila);
        fila.guardando = false;
        this.aviso = `Permiso de “${fila.modulo}” retirado.`;
        this.actualizacion.revalidarAhora().subscribe({ error: () => undefined });
      },
      error: error => {
        fila.error = this.errorMessage(error, 'No se pudo retirar este permiso.');
        fila.guardando = false;
      },
    });
  }

  private crearMatriz(
    idRol: number,
    catalogo: readonly string[],
    permisos: readonly PermisoRolResponse[],
  ): PermisoFila[] {
    const modulos = new Map(
      catalogo.map(modulo => [modulo.toLocaleLowerCase('en-US'), modulo]),
    );
    const desconocido = permisos.find(
      permiso => !modulos.has(permiso.modulo.toLocaleLowerCase('en-US')),
    );
    if (desconocido) {
      throw new Error(`La API devolvió una asignación para el módulo no reconocido “${desconocido.modulo}”.`);
    }
    const permisosRol = new Map(
      permisos.filter(permiso => permiso.idRol === idRol)
        .map(permiso => [permiso.modulo.toLocaleLowerCase('en-US'), permiso]),
    );
    return Array.from(modulos.entries())
      .sort((a, b) => a[1].localeCompare(b[1], 'es'))
      .map(([key, modulo]) => {
        const permiso = permisosRol.get(key);
        const estado: EstadoPermisoFila = permiso
          ? this.estadoFila(permiso)
          : { puedeConsultar: false, puedeCrear: false, puedeModificar: false, puedeEliminar: false };
        return {
          idPermiso: permiso?.idPermiso ?? null,
          modulo,
          ...estado,
          original: { ...estado },
          guardando: false,
          error: '',
        };
      });
  }

  private crearMatrizVacia(modulos: readonly string[]): PermisoFila[] {
    return [...modulos]
      .sort((a, b) => a.localeCompare(b, 'es'))
      .map(modulo => {
        const estado: EstadoPermisoFila = {
          puedeConsultar: false,
          puedeCrear: false,
          puedeModificar: false,
          puedeEliminar: false,
        };
        return {
          idPermiso: null,
          modulo,
          ...estado,
          original: { ...estado },
          guardando: false,
          error: '',
        };
      });
  }

  private aplicarPermiso(fila: PermisoFila, permiso: PermisoRolResponse): void {
    fila.idPermiso = permiso.idPermiso;
    fila.modulo = permiso.modulo;
    fila.puedeConsultar = permiso.puedeConsultar;
    fila.puedeCrear = permiso.puedeCrear;
    fila.puedeModificar = permiso.puedeModificar;
    fila.puedeEliminar = permiso.puedeEliminar;
    fila.original = this.estadoFila(permiso);
    fila.error = '';
  }

  private estadoFila(value: EstadoPermisoFila): EstadoPermisoFila {
    return {
      puedeConsultar: value.puedeConsultar,
      puedeCrear: value.puedeCrear,
      puedeModificar: value.puedeModificar,
      puedeEliminar: value.puedeEliminar,
    };
  }

  private toPermissionRequest(idRol: number, fila: PermisoFila): GuardarPermisoRolRequest {
    return {
      idRol,
      modulo: fila.modulo,
      puedeConsultar: this.operacionDisponible(fila.modulo, this.OPERACIONES.CONSULTAR)
        && fila.puedeConsultar,
      puedeCrear: this.operacionDisponible(fila.modulo, this.OPERACIONES.CREAR)
        && fila.puedeCrear,
      puedeModificar: this.operacionDisponible(fila.modulo, this.OPERACIONES.MODIFICAR)
        && fila.puedeModificar,
      puedeEliminar: this.operacionDisponible(fila.modulo, this.OPERACIONES.ELIMINAR)
        && fila.puedeEliminar,
    };
  }

  private algunaOperacion(fila: EstadoPermisoFila): boolean {
    return fila.puedeConsultar || fila.puedeCrear || fila.puedeModificar || fila.puedeEliminar;
  }

  private errorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) return this.apiErrors.messageFor(error, fallback);
    return error instanceof Error ? error.message : fallback;
  }
}
