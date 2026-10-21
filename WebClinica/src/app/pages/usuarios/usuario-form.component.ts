
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged, finalize } from 'rxjs';
import { EmpleadoListadoResponse } from '../../core/models/empleado.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { RolResponse } from '../../core/models/rol.model';
import { ActualizarUsuarioRequest, CrearUsuarioRequest } from '../../core/models/usuario.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { PermisosService } from '../../core/services/permisos.service';
import { RolesService } from '../../core/services/roles.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { UiStateComponent } from '../../shared/components/ui-state.component';

type EstadoCatalogo = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unauthorized';

interface UsuarioFormData {
  idUsuario?: number;
  username: string;
  idRol: number | null;
  idEmpleado: number | null;
  activo: boolean;
}

const EMPLOYEE_PAGE_SIZE = 20;

@Component({
    selector: 'app-usuario-form',
    imports: [RouterModule, FormsModule, UiStateComponent],
    template: `
    <div class="page-shell">
      <header class="page-header">
        <div>
          <h1>{{ esEdicion ? 'Editar usuario' : 'Nuevo usuario' }}</h1>
          <p class="page-header__subtitle">Selecciona el rol y el empleado por su descripción; se conservarán sus identificadores reales.</p>
        </div>
      </header>

      @if (error) { <div class="alert alert-danger" role="alert">{{ error }}</div> }

      <form #usuarioForm="ngForm" (ngSubmit)="guardar()" class="ui-card ui-form" novalidate>
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label required" for="usuario-username">Nombre de usuario</label>
            <input id="usuario-username" type="text" class="form-control"
                   [(ngModel)]="form.username" name="username" required maxlength="50"
                   autocomplete="username">
          </div>

          @if (!esEdicion) {
            <div class="col-md-6">
              <label class="form-label required" for="usuario-password">Contraseña</label>
              <input id="usuario-password" type="password" class="form-control"
                     [(ngModel)]="formPassword" name="password" required minlength="8" maxlength="128"
                     autocomplete="new-password">
            </div>
          }

          <div class="col-md-6">
            <label class="form-label required" for="usuario-rol">Rol</label>
            <select id="usuario-rol" class="form-select" [(ngModel)]="form.idRol"
                    name="idRol" required [disabled]="estadoRoles !== 'ready' && estadoRoles !== 'empty'">
              <option [ngValue]="null">Selecciona un rol</option>
              @for (rol of rolesDisponibles; track rol.idRol) {
                <option [ngValue]="rol.idRol" [disabled]="!rol.activo">
                  {{ rol.nombre }}{{ rol.activo ? '' : ' (inactivo)' }}
                </option>
              }
            </select>
            @if (!permisos.puedeModificar(MODULOS_PERMISO.ROLES)) {
              <div class="ui-catalog-meta">Solo puedes conservar el rol actual permitido por la API.</div>
            }
            @if (estadoRoles === 'loading') {
              <app-ui-state kind="loading" title="Cargando roles…" [compact]="true" />
            } @else if (estadoRoles === 'empty') {
              <app-ui-state kind="empty" title="No hay roles activos disponibles" [compact]="true" />
            } @else if (estadoRoles === 'error') {
              <app-ui-state kind="error" title="No fue posible cargar los roles" [retryable]="true"
                            [compact]="true" (retry)="cargarRoles()" />
            } @else if (estadoRoles === 'unauthorized') {
              <app-ui-state kind="error" title="No tienes permiso para consultar roles" [compact]="true" />
            }
          </div>

          <div class="col-md-6">
            <label class="form-label" for="usuario-empleado-busqueda">Buscar empleado</label>
            <input id="usuario-empleado-busqueda" type="search" class="form-control"
                   [(ngModel)]="busquedaEmpleado" name="busquedaEmpleado"
                   (ngModelChange)="programarBusquedaEmpleado($event)"
                   [disabled]="estadoEmpleados === 'unauthorized'"
                   placeholder="Nombre o apellido" autocomplete="off">

            <label class="form-label mt-2" for="usuario-empleado">Empleado relacionado (opcional)</label>
            <select id="usuario-empleado" class="form-select" [(ngModel)]="form.idEmpleado"
                    name="idEmpleado" (ngModelChange)="seleccionarEmpleado($event)"
                    [disabled]="estadoEmpleados === 'loading' || estadoEmpleados === 'error' || estadoEmpleados === 'unauthorized'">
              <option [ngValue]="null">Sin empleado relacionado</option>
              @for (empleado of empleadosDisponibles; track empleado.idEmpleado) {
                <option [ngValue]="empleado.idEmpleado">
                  {{ empleado.nombres }} {{ empleado.apellidos }} — {{ empleado.tipoEmpleado }}{{ empleado.activo ? '' : ' (inactivo, relación actual)' }}
                </option>
              }
            </select>

            @if (estadoEmpleados === 'loading') {
              <app-ui-state kind="loading" title="Buscando empleados…" [compact]="true" />
            } @else if (estadoEmpleados === 'empty') {
              <app-ui-state kind="empty" title="No se encontraron empleados activos" description="Puedes dejar la relación vacía o cambiar la búsqueda." [compact]="true" />
            } @else if (estadoEmpleados === 'error') {
              <app-ui-state kind="error" title="No fue posible cargar los empleados" [retryable]="true"
                            [compact]="true" (retry)="cargarEmpleados(empleadoPagina)" />
            } @else if (estadoEmpleados === 'unauthorized') {
              <app-ui-state kind="error" title="No tienes permiso para consultar empleados" [compact]="true" />
            }

            @if (estadoEmpleados === 'ready' && empleadoTotalPages > 1) {
              <div class="d-flex align-items-center justify-content-between gap-2 mt-2" aria-label="Paginación de empleados">
                <button type="button" class="btn btn-outline-secondary btn-sm"
                        (click)="cargarEmpleados(empleadoPagina - 1)" [disabled]="empleadoPagina <= 1">Anterior</button>
                <span class="ui-catalog-meta mt-0">Página {{ empleadoPagina }} de {{ empleadoTotalPages }}</span>
                <button type="button" class="btn btn-outline-secondary btn-sm"
                        (click)="cargarEmpleados(empleadoPagina + 1)" [disabled]="empleadoPagina >= empleadoTotalPages">Siguiente</button>
              </div>
            }
          </div>

          @if (esEdicion) {
            <div class="col-12 form-check ms-2">
              <input type="checkbox" class="form-check-input" id="usuario-activo"
                     [(ngModel)]="form.activo" name="activo">
              <label class="form-check-label" for="usuario-activo">Usuario activo</label>
            </div>
          }
        </div>

        <div class="ui-form__actions">
          <button type="submit" class="btn btn-success"
                  [disabled]="guardando || cargandoUsuario || usuarioForm.invalid || !puedeGuardar">
            <i class="bi bi-check-lg" aria-hidden="true"></i>
            {{ guardando ? 'Guardando…' : 'Guardar' }}
          </button>
          <a routerLink="/admin/usuarios" class="btn btn-outline-secondary">
            <i class="bi bi-x-lg" aria-hidden="true"></i> Cancelar
          </a>
        </div>
      </form>
    </div>
  `
})
export class UsuarioFormComponent implements OnInit {
  private readonly service = inject(UsuariosService);
  private readonly rolesService = inject(RolesService);
  private readonly empleadosService = inject(EmpleadosService);
  private readonly session = inject(AuthSessionService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;

  esEdicion = false;
  cargandoUsuario = false;
  guardando = false;
  error = '';
  formPassword = '';
  form: UsuarioFormData = this.formVacio();

  roles: RolResponse[] = [];
  estadoRoles: EstadoCatalogo = 'idle';
  empleados: EmpleadoListadoResponse[] = [];
  empleadoSeleccionado: EmpleadoListadoResponse | null = null;
  estadoEmpleados: EstadoCatalogo = 'idle';
  busquedaEmpleado = '';
  empleadoPagina = 1;
  empleadoTotalPages = 0;

  private readonly busquedaEmpleado$ = new Subject<string>();
  private rolesSubscription?: Subscription;
  private empleadosSubscription?: Subscription;
  private usuarioSubscription?: Subscription;
  private guardadoSubscription?: Subscription;
  private revisionRoles = 0;
  private revisionEmpleados = 0;
  private revisionUsuario = 0;
  private revisionGuardado = 0;
  private identidadObservada: string | null | undefined;
  private idRolOriginal: number | null = null;

  constructor() {
    this.busquedaEmpleado$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.cargarEmpleados(1));

    effect(() => {
      const identidad = this.identidadActual();
      const tieneCatalogos = this.permisos.puedeConsultar(MODULOS_PERMISO.ROLES)
        && this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS);
      const cambioIdentidad = this.identidadObservada !== undefined
        && this.identidadObservada !== identidad;
      this.identidadObservada = identidad;
      if (!identidad || !tieneCatalogos || cambioIdentidad) {
        this.invalidarDatos(tieneCatalogos
          ? 'La sesión cambió durante la edición.'
          : 'No tienes autorización para consultar los catálogos requeridos.');
      }
    });
  }

  get rolesDisponibles(): RolResponse[] {
    const puedeCambiar = this.permisos.puedeModificar(MODULOS_PERMISO.ROLES);
    const permitidoSinModificar = this.esEdicion
      ? this.idRolOriginal
      : this.session.currentUser()?.idRol ?? null;
    return this.roles.filter(rol =>
      (rol.activo || rol.idRol === this.form.idRol)
      && (puedeCambiar || rol.idRol === permitidoSinModificar));
  }

  get empleadosDisponibles(): EmpleadoListadoResponse[] {
    const porId = new Map(this.empleados.map(empleado => [empleado.idEmpleado, empleado]));
    if (this.empleadoSeleccionado) {
      porId.set(this.empleadoSeleccionado.idEmpleado, this.empleadoSeleccionado);
    }
    return Array.from(porId.values());
  }

  get puedeGuardar(): boolean {
    const permisoOperacion = this.esEdicion
      ? this.permisos.puedeModificar(MODULOS_PERMISO.USUARIOS)
      : this.permisos.puedeCrear(MODULOS_PERMISO.USUARIOS);
    return !!this.identidadActual()
      && permisoOperacion
      && this.permisos.puedeConsultar(MODULOS_PERMISO.ROLES)
      && this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS)
      && this.rolSeleccionable()
      && this.empleadoSeleccionable();
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.esEdicion = Number.isInteger(id) && id > 0;
    this.cargarRoles();
    this.cargarEmpleados(1);
    if (this.esEdicion) this.cargarUsuario(id);
  }

  cargarRoles(): void {
    const identidad = this.identidadActual();
    if (!identidad || !this.permisos.puedeConsultar(MODULOS_PERMISO.ROLES)) {
      this.roles = [];
      this.estadoRoles = 'unauthorized';
      return;
    }
    const revision = ++this.revisionRoles;
    this.rolesSubscription?.unsubscribe();
    this.estadoRoles = 'loading';
    this.rolesSubscription = this.rolesService.listarTodosRoles().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: roles => {
        if (!this.respuestaVigente(revision, this.revisionRoles, identidad,
          MODULOS_PERMISO.ROLES)) return;
        this.roles = [...roles];
        this.estadoRoles = this.roles.some(rol => rol.activo) ? 'ready' : 'empty';
        if (!this.esEdicion && this.form.idRol === null) {
          const idRolSesion = this.session.currentUser()?.idRol ?? null;
          if (this.roles.some(rol => rol.idRol === idRolSesion && rol.activo)) {
            this.form.idRol = idRolSesion;
          }
        }
      },
      error: () => {
        if (!this.respuestaVigente(revision, this.revisionRoles, identidad,
          MODULOS_PERMISO.ROLES)) return;
        this.roles = [];
        this.estadoRoles = 'error';
      },
    });
  }

  programarBusquedaEmpleado(value: string): void {
    this.busquedaEmpleado = value;
    this.busquedaEmpleado$.next(value.trim());
  }

  cargarEmpleados(page: number): void {
    const identidad = this.identidadActual();
    if (!identidad || !this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS)) {
      this.empleados = [];
      this.estadoEmpleados = 'unauthorized';
      return;
    }
    if (page < 1 || (this.empleadoTotalPages > 0 && page > this.empleadoTotalPages)) return;
    const revision = ++this.revisionEmpleados;
    this.empleadosSubscription?.unsubscribe();
    this.estadoEmpleados = 'loading';
    this.empleadosSubscription = this.empleadosService.listar(
      this.busquedaEmpleado.trim() || undefined,
      undefined,
      undefined,
      true,
      page,
      EMPLOYEE_PAGE_SIZE,
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        if (!this.respuestaVigente(revision, this.revisionEmpleados, identidad,
          MODULOS_PERMISO.EMPLEADOS)) return;
        this.empleados = response.items;
        this.empleadoPagina = response.page;
        this.empleadoTotalPages = response.totalPages;
        this.estadoEmpleados = response.items.length > 0 ? 'ready' : 'empty';
        this.sincronizarEmpleadoSeleccionado();
      },
      error: () => {
        if (!this.respuestaVigente(revision, this.revisionEmpleados, identidad,
          MODULOS_PERMISO.EMPLEADOS)) return;
        this.empleados = [];
        this.estadoEmpleados = 'error';
      },
    });
  }

  seleccionarEmpleado(id: number | null): void {
    if (id === null) {
      this.empleadoSeleccionado = null;
      return;
    }
    const encontrado = this.empleadosDisponibles.find(empleado => empleado.idEmpleado === id);
    if (encontrado) this.empleadoSeleccionado = encontrado;
  }

  guardar(): void {
    if (this.guardando || this.cargandoUsuario || !this.puedeGuardar) {
      if (!this.guardando) this.error = 'Revisa la selección y los permisos antes de guardar.';
      return;
    }
    const identidad = this.identidadActual();
    if (!identidad || this.form.idRol === null) return;

    const revision = ++this.revisionGuardado;
    this.guardando = true;
    this.error = '';
    const request$ = this.esEdicion
      ? this.service.actualizar(this.form.idUsuario!, {
          username: this.form.username,
          idRol: this.form.idRol,
          idEmpleado: this.form.idEmpleado,
          activo: this.form.activo,
        } satisfies ActualizarUsuarioRequest)
      : this.service.crear({
          username: this.form.username,
          password: this.formPassword,
          idRol: this.form.idRol,
          idEmpleado: this.form.idEmpleado,
        } satisfies CrearUsuarioRequest);

    this.guardadoSubscription?.unsubscribe();
    this.guardadoSubscription = request$.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (revision === this.revisionGuardado) this.guardando = false;
      }),
    ).subscribe({
      next: () => {
        if (!this.guardadoVigente(revision, identidad)) return;
        void this.router.navigate(['/admin/usuarios']);
      },
      error: (err: HttpErrorResponse) => {
        if (!this.guardadoVigente(revision, identidad)) return;
        this.error = this.apiErrors.messageFor(
          err,
          this.esEdicion ? 'No fue posible actualizar el usuario.' : 'No fue posible crear el usuario.',
        );
      },
    });
  }

  private cargarUsuario(id: number): void {
    const identidad = this.identidadActual();
    if (!identidad || !this.permisos.puedeConsultar(MODULOS_PERMISO.USUARIOS)) return;
    const revision = ++this.revisionUsuario;
    this.cargandoUsuario = true;
    this.usuarioSubscription?.unsubscribe();
    this.usuarioSubscription = this.service.obtener(id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (revision === this.revisionUsuario) this.cargandoUsuario = false;
      }),
    ).subscribe({
      next: user => {
        if (!this.respuestaVigente(revision, this.revisionUsuario, identidad,
          MODULOS_PERMISO.USUARIOS)) return;
        this.form = { ...user, idEmpleado: user.idEmpleado ?? null };
        this.idRolOriginal = user.idRol;
        if (user.idEmpleado != null) this.resolverEmpleadoActual(user.idEmpleado, identidad);
      },
      error: (err: HttpErrorResponse) => {
        if (!this.respuestaVigente(revision, this.revisionUsuario, identidad,
          MODULOS_PERMISO.USUARIOS)) return;
        this.error = this.apiErrors.messageFor(err, 'No fue posible cargar el usuario.');
      },
    });
  }

  private resolverEmpleadoActual(id: number, identidad: string): void {
    const revision = this.revisionEmpleados;
    this.empleadosService.obtener(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: empleado => {
        if (identidad !== this.identidadActual()
          || !this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS)
          || this.form.idEmpleado !== id
          || revision !== this.revisionEmpleados) return;
        this.empleadoSeleccionado = empleado;
      },
      error: () => {
        if (identidad === this.identidadActual() && this.form.idEmpleado === id) {
          this.error = 'El empleado relacionado ya no está disponible para consulta.';
        }
      },
    });
  }

  private sincronizarEmpleadoSeleccionado(): void {
    if (this.form.idEmpleado === null) return;
    const encontrado = this.empleados.find(
      empleado => empleado.idEmpleado === this.form.idEmpleado,
    );
    if (encontrado) this.empleadoSeleccionado = encontrado;
  }

  private rolSeleccionable(): boolean {
    const rol = this.roles.find(item => item.idRol === this.form.idRol);
    if (!rol?.activo) return false;
    if (this.permisos.puedeModificar(MODULOS_PERMISO.ROLES)) return true;
    const permitido = this.esEdicion ? this.idRolOriginal : this.session.currentUser()?.idRol;
    return rol.idRol === permitido;
  }

  private empleadoSeleccionable(): boolean {
    return this.form.idEmpleado === null
      || this.empleadosDisponibles.some(
        empleado => empleado.idEmpleado === this.form.idEmpleado,
      );
  }

  private guardadoVigente(revision: number, identidad: string): boolean {
    const autorizado = this.esEdicion
      ? this.permisos.puedeModificar(MODULOS_PERMISO.USUARIOS)
      : this.permisos.puedeCrear(MODULOS_PERMISO.USUARIOS);
    return revision === this.revisionGuardado
      && identidad === this.identidadActual()
      && autorizado;
  }

  private respuestaVigente(
    revision: number,
    actual: number,
    identidad: string,
    modulo: string,
  ): boolean {
    return revision === actual
      && identidad === this.identidadActual()
      && this.permisos.puedeConsultar(modulo);
  }

  private identidadActual(): string | null {
    const user = this.session.currentUser();
    const token = this.session.token;
    return this.session.isAuthenticated() && user?.idUsuario && token
      ? `${user.idUsuario}:${token}`
      : null;
  }

  private invalidarDatos(message: string): void {
    this.revisionRoles++;
    this.revisionEmpleados++;
    this.revisionUsuario++;
    this.revisionGuardado++;
    this.rolesSubscription?.unsubscribe();
    this.empleadosSubscription?.unsubscribe();
    this.usuarioSubscription?.unsubscribe();
    this.guardadoSubscription?.unsubscribe();
    this.roles = [];
    this.empleados = [];
    this.empleadoSeleccionado = null;
    this.estadoRoles = this.permisos.puedeConsultar(MODULOS_PERMISO.ROLES)
      ? 'idle' : 'unauthorized';
    this.estadoEmpleados = this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS)
      ? 'idle' : 'unauthorized';
    this.cargandoUsuario = false;
    this.guardando = false;
    if (this.identidadObservada !== undefined) this.error = message;
  }

  private formVacio(): UsuarioFormData {
    return { username: '', idRol: null, idEmpleado: null, activo: true };
  }
}
