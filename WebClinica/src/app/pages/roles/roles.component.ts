import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule, NgForm } from '@angular/forms';
import {
  GuardarPermisoRolRequest,
  GuardarRolRequest,
  PermisoRolResponse,
  RolResponse,
} from '../../core/models/rol.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AutorizacionActualizacionService } from '../../core/services/autorizacion-actualizacion.service';
import { PermisosService } from '../../core/services/permisos.service';
import { RolesService } from '../../core/services/roles.service';

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
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roles.component.html',
})
export class RolesComponent implements OnInit {
  private readonly rolesService = inject(RolesService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly actualizacion = inject(AutorizacionActualizacionService);
  readonly permisos = inject(PermisosService);
  readonly MODULOS = MODULOS_PERMISO;

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
      ? this.roles.filter(rol => rol.nombre.toLocaleLowerCase('es').includes(filtro))
      : this.roles;
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
    this.rolEditando = null;
    this.rolForm = { nombre: '', activo: true };
    this.errorRol = '';
    this.mostrarFormularioRol = true;
  }

  abrirEditarRol(rol: RolResponse): void {
    if (!this.permisos.puedeModificar(this.MODULOS.ROLES)) return;
    this.rolEditando = rol;
    this.rolForm = { nombre: rol.nombre, activo: rol.activo };
    this.errorRol = '';
    this.mostrarFormularioRol = true;
  }

  cerrarFormularioRol(): void {
    if (this.guardandoRol) return;
    this.mostrarFormularioRol = false;
    this.rolEditando = null;
    this.errorRol = '';
  }

  puedeGuardarRol(): boolean {
    return this.rolEditando
      ? this.permisos.puedeModificar(this.MODULOS.ROLES)
      : this.permisos.puedeCrear(this.MODULOS.ROLES);
  }

  guardarRol(form: NgForm): void {
    if (form.invalid || !this.puedeGuardarRol() || this.guardandoRol) {
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
    const request$ = this.rolEditando
      ? this.rolesService.actualizarRol(this.rolEditando.idRol, request)
      : this.rolesService.crearRol(request);
    request$.subscribe({
      next: rol => {
        this.aviso = this.rolEditando
          ? `Rol “${rol.nombre}” actualizado.`
          : `Rol “${rol.nombre}” creado.`;
        this.guardandoRol = false;
        this.cerrarFormularioRol();
        this.cargarRoles();
      },
      error: error => {
        this.errorRol = this.errorMessage(error, 'No se pudo guardar el rol.');
        this.guardandoRol = false;
      },
    });
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
    this.rolesService.listarTodosPermisos().subscribe({
      next: permisos => {
        this.filasPermisos = this.crearMatriz(rol.idRol, permisos);
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
    permisos: readonly PermisoRolResponse[],
  ): PermisoFila[] {
    const modulos = new Map<string, string>();
    for (const permiso of permisos) {
      const key = permiso.modulo.toLocaleLowerCase('en-US');
      if (!modulos.has(key)) modulos.set(key, permiso.modulo);
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
      ...this.estadoFila(fila),
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
