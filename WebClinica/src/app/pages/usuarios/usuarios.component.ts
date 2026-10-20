import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UsuariosService } from '../../core/services/usuarios.service';
import { UsuarioResponse, PagedResponse } from '../../core/models/usuario.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PermisosService } from '../../core/services/permisos.service';
import { RolesService } from '../../core/services/roles.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { RolResponse } from '../../core/models/rol.model';
import { EmpleadoListadoResponse } from '../../core/models/empleado.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { UiStateComponent } from '../../shared/components/ui-state.component';
import { correlativoPaginado } from '../../shared/utils/correlativo';

type EstadoCatalogo = 'disponible' | 'sin-autorizacion' | 'error';

interface ResultadoCatalogo<T> {
  estado: EstadoCatalogo;
  valores: ReadonlyMap<number, T>;
}

const CATALOG_PAGE_SIZE = 100;
const MAX_CATALOG_PAGES = 5;

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, ConfirmDialogComponent, UiStateComponent],
  template: `
    <div class="page-shell">
      <header class="page-header">
        <div>
          <h1>Gestión de Usuarios</h1>
          <p class="page-header__subtitle">Administra cuentas, roles y relaciones con empleados.</p>
        </div>
        @if (permisos.puedeCrear(MODULOS_PERMISO.USUARIOS)) {
          <a routerLink="/admin/usuarios/nuevo" class="btn btn-primary" title="Crear usuario">
            <i class="bi bi-plus-lg" aria-hidden="true"></i> Nuevo Usuario
          </a>
        }
      </header>

      @if (cargando) {
        <app-ui-state kind="loading" title="Cargando usuarios…" />
      } @else if (error) {
        <app-ui-state kind="error" title="No fue posible cargar los usuarios" [description]="error" [retryable]="true" (retry)="cargarUsuarios()" />
      } @else if (usuarios.length === 0) {
        <app-ui-state kind="empty" title="No hay usuarios registrados" description="Crea el primer usuario para habilitar el acceso a la aplicación." />
      } @else {
        <div class="ui-table-wrap">
        <table class="table table-hover ui-table">
          <thead>
            <tr>
              <th scope="col" class="ui-col-index">No.</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Tipo de empleado</th>
              <th>Estado</th>
              <th scope="col" class="ui-col-actions">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (user of usuarios; track user.idUsuario; let index = $index) {
              <tr>
                <td class="ui-col-index">{{ correlativo(index, page, pageSize) }}</td>
                <td>{{ user.username }}</td>
                <td>{{ nombreRol(user) }}</td>
                <td>{{ tipoEmpleado(user) }}</td>
                <td>
                  <span class="badge" [class.bg-success]="user.activo" [class.bg-secondary]="!user.activo">
                    {{ user.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td class="ui-actions ui-col-actions">
                  @if (permisos.puedeModificar(MODULOS_PERMISO.USUARIOS)) {
                    <a [routerLink]="['/admin/usuarios/editar', user.idUsuario]" class="btn btn-sm btn-outline-primary ui-icon-button" aria-label="Editar usuario" title="Editar usuario">
                      <i class="bi bi-pencil" aria-hidden="true"></i>
                    </a>
                  }
                  @if (permisos.puedeEliminar(MODULOS_PERMISO.USUARIOS)) {
                    <button type="button" (click)="solicitarEliminacion(user)" class="btn btn-sm btn-outline-danger ui-icon-button" [disabled]="!user.activo || eliminandoId === user.idUsuario" aria-label="Eliminar usuario" title="Eliminar usuario">
                      <i class="bi bi-trash" aria-hidden="true"></i>
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
        </div>

        <!-- Paginación Simple -->
        <div class="d-flex justify-content-between align-items-center mt-3">
          <span>Total: {{ total }} usuarios</span>
          <div>
            <button class="btn btn-outline-secondary btn-sm me-2" (click)="cambiarPagina(page - 1)" [disabled]="page <= 1">Anterior</button>
            <button class="btn btn-outline-secondary btn-sm" (click)="cambiarPagina(page + 1)" [disabled]="page >= totalPages">Siguiente</button>
          </div>
        </div>
      }

      @if (usuarioPendienteEliminacion) {
        <app-confirm-dialog
          title="Eliminar usuario"
          [description]="'¿Deseas desactivar a ' + usuarioPendienteEliminacion.username + '?'"
          consequence="La cuenta dejará de estar activa y no se eliminará físicamente."
          [busy]="eliminandoId === usuarioPendienteEliminacion.idUsuario"
          (confirmed)="confirmarEliminacion()"
          (cancelled)="cancelarEliminacion()" />
      }
    </div>
  `
})
export class UsuariosComponent implements OnInit {
  private service = inject(UsuariosService);
  private rolesService = inject(RolesService);
  private empleadosService = inject(EmpleadosService);
  private session = inject(AuthSessionService);
  private destroyRef = inject(DestroyRef);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;
  readonly correlativo = correlativoPaginado;

  usuarios: UsuarioResponse[] = [];
  total = 0;
  totalPages = 0;
  page = 1;
  pageSize = 10;
  cargando = false;
  error = '';
  private rolesPorId: ReadonlyMap<number, RolResponse> = new Map();
  private empleadosPorId: ReadonlyMap<number, EmpleadoListadoResponse> = new Map();
  private estadoRoles: EstadoCatalogo = 'disponible';
  private estadoEmpleados: EstadoCatalogo = 'disponible';
  private revisionCarga = 0;
  usuarioPendienteEliminacion: UsuarioResponse | null = null;
  eliminandoId: number | null = null;

  ngOnInit() {
    this.cargarUsuarios();
  }

  cargarUsuarios(): void {
    const revision = ++this.revisionCarga;
    const identidad = this.identidadActual();
    if (!identidad) {
      this.usuarios = [];
      this.error = 'La sesión ya no está disponible.';
      this.cargando = false;
      return;
    }
    this.cargando = true;
    this.error = '';
    this.service.listar(this.page, this.pageSize).pipe(
      switchMap((usuarios: PagedResponse<UsuarioResponse>) => forkJoin({
        usuarios: of(usuarios),
        roles: this.cargarRoles(usuarios.items),
        empleados: this.cargarEmpleados(usuarios.items),
      })),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: ({ usuarios, roles, empleados }) => {
        if (!this.esCargaActual(revision, identidad)) return;
        this.usuarios = usuarios.items;
        this.total = usuarios.totalCount;
        this.totalPages = usuarios.totalPages;
        this.rolesPorId = roles.valores;
        this.empleadosPorId = empleados.valores;
        this.estadoRoles = roles.estado;
        this.estadoEmpleados = empleados.estado;
        this.cargando = false;
      },
      error: () => {
        if (!this.esCargaActual(revision, identidad)) return;
        this.error = 'Error al cargar los usuarios. Verifica tus permisos.';
        this.cargando = false;
      }
    });
  }

  cambiarPagina(nuevaPagina: number): void {
    if (nuevaPagina > 0 && nuevaPagina <= Math.max(this.totalPages, 1)) {
      this.page = nuevaPagina;
      this.cargarUsuarios();
    }
  }

  solicitarEliminacion(usuario: UsuarioResponse): void {
    if (!usuario.activo || !this.permisos.puedeEliminar(MODULOS_PERMISO.USUARIOS)) return;
    this.usuarioPendienteEliminacion = usuario;
  }

  cancelarEliminacion(): void {
    if (this.eliminandoId === null) this.usuarioPendienteEliminacion = null;
  }

  confirmarEliminacion(): void {
    const usuario = this.usuarioPendienteEliminacion;
    if (!usuario || this.eliminandoId !== null) return;
    this.eliminandoId = usuario.idUsuario;
    this.service.eliminar(usuario.idUsuario).subscribe({
      next: () => {
        this.eliminandoId = null;
        this.usuarioPendienteEliminacion = null;
        this.cargarUsuarios();
      },
      error: () => {
        this.eliminandoId = null;
        this.error = 'No se pudo desactivar el usuario.';
      },
    });
  }

  nombreRol(usuario: UsuarioResponse): string {
    const rol = this.rolesPorId.get(usuario.idRol);
    if (rol) return rol.nombre;
    return this.estadoRoles === 'sin-autorizacion' ? 'Sin autorización' : 'No disponible';
  }

  tipoEmpleado(usuario: UsuarioResponse): string {
    if (usuario.idEmpleado == null) return 'Sin relación';
    const empleado = this.empleadosPorId.get(usuario.idEmpleado);
    if (empleado) return empleado.tipoEmpleado;
    return this.estadoEmpleados === 'sin-autorizacion' ? 'Sin autorización' : 'No disponible';
  }

  private cargarRoles(usuarios: readonly UsuarioResponse[]): Observable<ResultadoCatalogo<RolResponse>> {
    if (!this.permisos.puedeConsultar(MODULOS_PERMISO.ROLES)) {
      return of(this.sinAutorizacion<RolResponse>());
    }
    return this.cargarCatalogoPaginado(
      new Set(usuarios.map(usuario => usuario.idRol)),
      (page, pageSize) => this.rolesService.listarRoles(page, pageSize),
      rol => rol.idRol,
    ).pipe(
      map(valores => ({ estado: 'disponible' as const, valores })),
      catchError(() => of(this.errorCatalogo<RolResponse>())),
    );
  }

  private cargarEmpleados(
    usuarios: readonly UsuarioResponse[],
  ): Observable<ResultadoCatalogo<EmpleadoListadoResponse>> {
    const ids = new Set(usuarios.flatMap(usuario =>
      usuario.idEmpleado == null ? [] : [usuario.idEmpleado]));
    if (ids.size === 0) {
      return of({ estado: 'disponible', valores: new Map() });
    }
    if (!this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS)) {
      return of(this.sinAutorizacion<EmpleadoListadoResponse>());
    }
    return this.cargarCatalogoPaginado(
      ids,
      (page, pageSize) => this.empleadosService.listar(
        undefined, undefined, undefined, undefined, page, pageSize),
      empleado => empleado.idEmpleado,
    ).pipe(
      map(valores => ({ estado: 'disponible' as const, valores })),
      catchError(() => of(this.errorCatalogo<EmpleadoListadoResponse>())),
    );
  }

  private cargarCatalogoPaginado<T>(
    idsBuscados: ReadonlySet<number>,
    cargarPagina: (page: number, pageSize: number) => Observable<PagedResponse<T>>,
    obtenerId: (item: T) => number,
  ): Observable<ReadonlyMap<number, T>> {
    if (idsBuscados.size === 0) return of(new Map());
    const encontrados = new Map<number, T>();

    const cargar = (page: number): Observable<ReadonlyMap<number, T>> =>
      cargarPagina(page, CATALOG_PAGE_SIZE).pipe(
        switchMap(response => {
          for (const item of response.items) {
            const id = obtenerId(item);
            if (idsBuscados.has(id)) encontrados.set(id, item);
          }
          const completos = Array.from(idsBuscados).every(id => encontrados.has(id));
          const ultimaPagina = Math.min(response.totalPages, MAX_CATALOG_PAGES);
          return completos || page >= ultimaPagina
            ? of(new Map(encontrados))
            : cargar(page + 1);
        }),
      );

    return cargar(1);
  }

  private sinAutorizacion<T>(): ResultadoCatalogo<T> {
    return { estado: 'sin-autorizacion', valores: new Map() };
  }

  private errorCatalogo<T>(): ResultadoCatalogo<T> {
    return { estado: 'error', valores: new Map() };
  }

  private identidadActual(): string | null {
    const idUsuario = this.session.currentUser()?.idUsuario;
    const token = this.session.token;
    return this.session.isAuthenticated() && idUsuario && token
      ? `${idUsuario}:${token}`
      : null;
  }

  private esCargaActual(revision: number, identidad: string): boolean {
    return revision === this.revisionCarga && identidad === this.identidadActual();
  }
}
