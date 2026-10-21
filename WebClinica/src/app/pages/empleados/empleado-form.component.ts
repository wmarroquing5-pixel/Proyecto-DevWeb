import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { Especialidad, Sucursal, Turno } from '../../core/models/catalogos.model';
import {
  ActualizarEmpleadoRequest,
  CrearEmpleadoRequest,
  EmpleadoDetalleResponse,
} from '../../core/models/empleado.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { PermisosService } from '../../core/services/permisos.service';
import { UiStateComponent } from '../../shared/components/ui-state.component';

type EstadoCatalogo = 'idle' | 'loading' | 'ready' | 'empty' | 'error' | 'unauthorized';

interface EmpleadoFormData {
  idEmpleado?: number;
  idSucursal: number | null;
  idEspecialidad: number | null;
  nombres: string;
  apellidos: string;
  dpi: string;
  tipoEmpleado: string;
  fechaIngreso: string | null;
  tipoSangre: string | null;
  idTurno: number | null;
  direccion: string;
  telefono: string;
  correoElectronico: string;
  activo?: boolean;
}

@Component({
    selector: 'app-empleado-form',
    imports: [CommonModule, RouterModule, FormsModule, UiStateComponent],
    template: `
    <div class="page-shell">
      <header class="page-header">
        <div>
          <h1>{{ esEdicion ? 'Editar empleado' : 'Nuevo empleado' }}</h1>
          <p class="page-header__subtitle">Registra los datos personales y selecciona sus relaciones laborales.</p>
        </div>
      </header>

      @if (error) { <div class="alert alert-danger" role="alert">{{ error }}</div> }

      <form #empleadoForm="ngForm" (ngSubmit)="guardar()" class="ui-card ui-form" novalidate>
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label required" for="empleado-nombres">Nombres</label>
            <input id="empleado-nombres" type="text" class="form-control"
                   [(ngModel)]="form.nombres" name="nombres" required maxlength="100">
          </div>
          <div class="col-md-6">
            <label class="form-label required" for="empleado-apellidos">Apellidos</label>
            <input id="empleado-apellidos" type="text" class="form-control"
                   [(ngModel)]="form.apellidos" name="apellidos" required maxlength="100">
          </div>
          <div class="col-md-6">
            <label class="form-label required" for="empleado-dpi">DPI</label>
            <input id="empleado-dpi" type="text" class="form-control"
                   [(ngModel)]="form.dpi" name="dpi" required maxlength="20">
          </div>
          <div class="col-md-6">
            <label class="form-label required" for="empleado-tipo">Tipo de empleado</label>
            <select id="empleado-tipo" class="form-select"
                    [(ngModel)]="form.tipoEmpleado" name="tipoEmpleado" required>
              <option value="">Selecciona un tipo</option>
              <option value="Medico">Médico</option>
              <option value="Enfermera">Enfermera</option>
              <option value="Administrativo">Administrativo</option>
            </select>
          </div>

          <div class="col-md-6">
            <label class="form-label" for="empleado-telefono">Teléfono</label>
            <input id="empleado-telefono" type="tel" class="form-control"
                   [(ngModel)]="form.telefono" name="telefono" maxlength="12">
          </div>
          <div class="col-md-6">
            <label class="form-label" for="empleado-correo">Correo electrónico</label>
            <input id="empleado-correo" type="email" class="form-control"
                   [(ngModel)]="form.correoElectronico" name="correoElectronico" maxlength="150">
          </div>
          <div class="col-12">
            <label class="form-label" for="empleado-direccion">Dirección</label>
            <input id="empleado-direccion" type="text" class="form-control"
                   [(ngModel)]="form.direccion" name="direccion" maxlength="150">
          </div>

          <div class="col-md-4">
            <label class="form-label required" for="empleado-sucursal">Sucursal</label>
            <select id="empleado-sucursal" class="form-select"
                    [(ngModel)]="form.idSucursal" name="idSucursal" required
                    [disabled]="estadoSucursales !== 'ready' && estadoSucursales !== 'empty'">
              <option [ngValue]="null">Selecciona una sucursal</option>
              @for (sucursal of sucursalesDisponibles; track sucursal.idSucursal) {
                <option [ngValue]="sucursal.idSucursal">
                  {{ sucursal.nombre }}{{ sucursal.activa ? '' : ' (inactiva, relación actual)' }}
                </option>
              }
            </select>
            <ng-container *ngTemplateOutlet="catalogState; context: {
              estado: estadoSucursales, loading: 'Cargando sucursales…', empty: 'No hay sucursales activas',
              error: 'No fue posible cargar las sucursales', denied: 'No tienes permiso para consultar sucursales', retry: cargarSucursales
            }" />
          </div>

          <div class="col-md-4">
            <label class="form-label" for="empleado-especialidad">Especialidad (opcional)</label>
            <select id="empleado-especialidad" class="form-select"
                    [(ngModel)]="form.idEspecialidad" name="idEspecialidad"
                    [disabled]="estadoEspecialidades === 'loading' || estadoEspecialidades === 'error' || estadoEspecialidades === 'unauthorized'">
              <option [ngValue]="null">Sin especialidad</option>
              @for (especialidad of especialidadesDisponibles; track especialidad.idEspecialidad) {
                <option [ngValue]="especialidad.idEspecialidad">
                  {{ especialidad.nombre }}{{ especialidad.activa ? '' : ' (inactiva, relación actual)' }}
                </option>
              }
            </select>
            <ng-container *ngTemplateOutlet="catalogState; context: {
              estado: estadoEspecialidades, loading: 'Cargando especialidades…', empty: 'No hay especialidades activas',
              error: 'No fue posible cargar las especialidades', denied: 'No tienes permiso para consultar especialidades', retry: cargarEspecialidades
            }" />
          </div>

          <div class="col-md-4">
            <label class="form-label" for="empleado-turno">Turno (opcional)</label>
            <select id="empleado-turno" class="form-select"
                    [(ngModel)]="form.idTurno" name="idTurno"
                    [disabled]="estadoTurnos === 'loading' || estadoTurnos === 'error' || estadoTurnos === 'unauthorized'">
              <option [ngValue]="null">Sin turno</option>
              @for (turno of turnosDisponibles; track turno.idTurno) {
                <option [ngValue]="turno.idTurno">
                  {{ turno.nombre }} ({{ turno.jornada }}){{ turno.activo ? '' : ' — inactivo, relación actual' }}
                </option>
              }
            </select>
            <ng-container *ngTemplateOutlet="catalogState; context: {
              estado: estadoTurnos, loading: 'Cargando turnos…', empty: 'No hay turnos activos',
              error: 'No fue posible cargar los turnos', denied: 'No tienes permiso para consultar turnos', retry: cargarTurnos
            }" />
          </div>

          <div class="col-md-4">
            <label class="form-label" for="empleado-fecha-ingreso">Fecha de ingreso</label>
            <input id="empleado-fecha-ingreso" type="date" class="form-control"
                   [(ngModel)]="form.fechaIngreso" name="fechaIngreso">
          </div>
          <div class="col-md-4">
            <label class="form-label" for="empleado-tipo-sangre">Tipo de sangre</label>
            <select id="empleado-tipo-sangre" class="form-select"
                    [(ngModel)]="form.tipoSangre" name="tipoSangre">
              <option [ngValue]="null">Sin especificar</option>
              @for (tipo of tiposSangre; track tipo) { <option [value]="tipo">{{ tipo }}</option> }
            </select>
          </div>
        </div>

        <div class="ui-form__actions">
          <button type="submit" class="btn btn-success"
                  [disabled]="guardando || cargandoEmpleado || empleadoForm.invalid || !puedeGuardar">
            <i class="bi bi-check-lg" aria-hidden="true"></i>
            {{ guardando ? 'Guardando…' : 'Guardar' }}
          </button>
          <a routerLink="/admin/empleados" class="btn btn-outline-secondary">
            <i class="bi bi-x-lg" aria-hidden="true"></i> Cancelar
          </a>
        </div>
      </form>

      <ng-template #catalogState let-estado="estado" let-loading="loading" let-empty="empty"
                   let-errorMessage="error" let-denied="denied" let-retry="retry">
        @if (estado === 'loading') {
          <app-ui-state kind="loading" [title]="loading" [compact]="true" />
        } @else if (estado === 'empty') {
          <app-ui-state kind="empty" [title]="empty" [compact]="true" />
        } @else if (estado === 'error') {
          <app-ui-state kind="error" [title]="errorMessage" [retryable]="true" [compact]="true"
                        (retry)="retry()" />
        } @else if (estado === 'unauthorized') {
          <app-ui-state kind="error" [title]="denied" [compact]="true" />
        }
      </ng-template>
    </div>
  `
})
export class EmpleadoFormComponent implements OnInit {
  private readonly empleadosService = inject(EmpleadosService);
  private readonly catalogosService = inject(CatalogosService);
  private readonly session = inject(AuthSessionService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly permisos = inject(PermisosService);

  readonly tiposSangre = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
  esEdicion = false;
  cargandoEmpleado = false;
  guardando = false;
  error = '';
  form: EmpleadoFormData = this.formVacio();

  sucursales: Sucursal[] = [];
  especialidades: Especialidad[] = [];
  turnos: Turno[] = [];
  estadoSucursales: EstadoCatalogo = 'idle';
  estadoEspecialidades: EstadoCatalogo = 'idle';
  estadoTurnos: EstadoCatalogo = 'idle';

  private sucursalesSubscription?: Subscription;
  private especialidadesSubscription?: Subscription;
  private turnosSubscription?: Subscription;
  private empleadoSubscription?: Subscription;
  private guardadoSubscription?: Subscription;
  private revisionSucursales = 0;
  private revisionEspecialidades = 0;
  private revisionTurnos = 0;
  private revisionEmpleado = 0;
  private revisionGuardado = 0;
  private identidadObservada: string | null | undefined;
  private relacionesOriginales = {
    idSucursal: null as number | null,
    idEspecialidad: null as number | null,
    idTurno: null as number | null,
  };

  constructor() {
    effect(() => {
      const identidad = this.identidadActual();
      const tieneCatalogos = this.tienePermisosCatalogo();
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

  get sucursalesDisponibles(): Sucursal[] {
    return this.sucursales.filter(item => item.activa
      || item.idSucursal === this.relacionesOriginales.idSucursal);
  }

  get especialidadesDisponibles(): Especialidad[] {
    return this.especialidades.filter(item => item.activa
      || item.idEspecialidad === this.relacionesOriginales.idEspecialidad);
  }

  get turnosDisponibles(): Turno[] {
    return this.turnos.filter(item => item.activo
      || item.idTurno === this.relacionesOriginales.idTurno);
  }

  get puedeGuardar(): boolean {
    const operacion = this.esEdicion
      ? this.permisos.puedeModificar(MODULOS_PERMISO.EMPLEADOS)
      : this.permisos.puedeCrear(MODULOS_PERMISO.EMPLEADOS);
    return !!this.identidadActual()
      && operacion
      && this.tienePermisosCatalogo()
      && this.relacionesValidas();
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.esEdicion = Number.isInteger(id) && id > 0;
    this.cargarCatalogos();
    if (this.esEdicion) this.cargarEmpleado(id);
  }

  cargarCatalogos(): void {
    this.cargarSucursales();
    this.cargarEspecialidades();
    this.cargarTurnos();
  }

  readonly cargarSucursales = (): void => {
    const identidad = this.identidadActual();
    if (!identidad || !this.permisos.puedeConsultar(MODULOS_PERMISO.SUCURSALES)) {
      this.sucursales = [];
      this.estadoSucursales = 'unauthorized';
      return;
    }
    const revision = ++this.revisionSucursales;
    this.sucursalesSubscription?.unsubscribe();
    this.estadoSucursales = 'loading';
    this.sucursalesSubscription = this.catalogosService.getSucursales().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: data => {
        if (!this.respuestaCatalogoVigente(revision, this.revisionSucursales,
          identidad, MODULOS_PERMISO.SUCURSALES)) return;
        this.sucursales = data;
        this.estadoSucursales = this.sucursalesDisponibles.length ? 'ready' : 'empty';
      },
      error: () => {
        if (!this.respuestaCatalogoVigente(revision, this.revisionSucursales,
          identidad, MODULOS_PERMISO.SUCURSALES)) return;
        this.sucursales = [];
        this.estadoSucursales = 'error';
      },
    });
  };

  readonly cargarEspecialidades = (): void => {
    const identidad = this.identidadActual();
    if (!identidad || !this.permisos.puedeConsultar(MODULOS_PERMISO.ESPECIALIDADES)) {
      this.especialidades = [];
      this.estadoEspecialidades = 'unauthorized';
      return;
    }
    const revision = ++this.revisionEspecialidades;
    this.especialidadesSubscription?.unsubscribe();
    this.estadoEspecialidades = 'loading';
    this.especialidadesSubscription = this.catalogosService.getEspecialidades().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: data => {
        if (!this.respuestaCatalogoVigente(revision, this.revisionEspecialidades,
          identidad, MODULOS_PERMISO.ESPECIALIDADES)) return;
        this.especialidades = data;
        this.estadoEspecialidades = this.especialidadesDisponibles.length ? 'ready' : 'empty';
      },
      error: () => {
        if (!this.respuestaCatalogoVigente(revision, this.revisionEspecialidades,
          identidad, MODULOS_PERMISO.ESPECIALIDADES)) return;
        this.especialidades = [];
        this.estadoEspecialidades = 'error';
      },
    });
  };

  readonly cargarTurnos = (): void => {
    const identidad = this.identidadActual();
    if (!identidad || !this.permisos.puedeConsultar(MODULOS_PERMISO.TURNOS)) {
      this.turnos = [];
      this.estadoTurnos = 'unauthorized';
      return;
    }
    const revision = ++this.revisionTurnos;
    this.turnosSubscription?.unsubscribe();
    this.estadoTurnos = 'loading';
    this.turnosSubscription = this.catalogosService.getTurnos().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: data => {
        if (!this.respuestaCatalogoVigente(revision, this.revisionTurnos,
          identidad, MODULOS_PERMISO.TURNOS)) return;
        this.turnos = data;
        this.estadoTurnos = this.turnosDisponibles.length ? 'ready' : 'empty';
      },
      error: () => {
        if (!this.respuestaCatalogoVigente(revision, this.revisionTurnos,
          identidad, MODULOS_PERMISO.TURNOS)) return;
        this.turnos = [];
        this.estadoTurnos = 'error';
      },
    });
  };

  guardar(): void {
    if (this.guardando || this.cargandoEmpleado || !this.puedeGuardar) {
      if (!this.guardando) this.error = 'Revisa las relaciones y los permisos antes de guardar.';
      return;
    }
    const identidad = this.identidadActual();
    if (!identidad || this.form.idSucursal === null) return;
    const request: CrearEmpleadoRequest | ActualizarEmpleadoRequest = {
      idSucursal: this.form.idSucursal,
      idEspecialidad: this.form.idEspecialidad,
      nombres: this.form.nombres,
      apellidos: this.form.apellidos,
      dpi: this.form.dpi,
      tipoEmpleado: this.form.tipoEmpleado,
      fechaIngreso: this.form.fechaIngreso,
      tipoSangre: this.form.tipoSangre,
      idTurno: this.form.idTurno,
      direccion: this.form.direccion,
      telefono: this.form.telefono,
      correoElectronico: this.form.correoElectronico,
    };
    const revision = ++this.revisionGuardado;
    this.guardando = true;
    this.error = '';
    const request$ = this.esEdicion
      ? this.empleadosService.actualizar(this.form.idEmpleado!, request)
      : this.empleadosService.crear(request);
    this.guardadoSubscription?.unsubscribe();
    this.guardadoSubscription = request$.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (revision === this.revisionGuardado) this.guardando = false;
      }),
    ).subscribe({
      next: () => {
        if (!this.guardadoVigente(revision, identidad)) return;
        void this.router.navigate(['/admin/empleados']);
      },
      error: (err: HttpErrorResponse) => {
        if (!this.guardadoVigente(revision, identidad)) return;
        this.error = this.apiErrors.messageFor(
          err,
          this.esEdicion ? 'No fue posible actualizar el empleado.' : 'No fue posible crear el empleado.',
        );
      },
    });
  }

  private cargarEmpleado(id: number): void {
    const identidad = this.identidadActual();
    if (!identidad || !this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS)) return;
    const revision = ++this.revisionEmpleado;
    this.cargandoEmpleado = true;
    this.empleadoSubscription?.unsubscribe();
    this.empleadoSubscription = this.empleadosService.obtener(id).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (revision === this.revisionEmpleado) this.cargandoEmpleado = false;
      }),
    ).subscribe({
      next: (empleado: EmpleadoDetalleResponse) => {
        if (!this.respuestaCatalogoVigente(revision, this.revisionEmpleado,
          identidad, MODULOS_PERMISO.EMPLEADOS)) return;
        this.form = {
          ...empleado,
          idEspecialidad: empleado.idEspecialidad ?? null,
          idTurno: empleado.idTurno ?? null,
          fechaIngreso: empleado.fechaIngreso ?? null,
          tipoSangre: empleado.tipoSangre ?? null,
          direccion: empleado.direccion ?? '',
          telefono: empleado.telefono ?? '',
          correoElectronico: empleado.correoElectronico ?? '',
        };
        this.relacionesOriginales = {
          idSucursal: empleado.idSucursal,
          idEspecialidad: empleado.idEspecialidad ?? null,
          idTurno: empleado.idTurno ?? null,
        };
        this.actualizarEstadosCatalogo();
      },
      error: (err: HttpErrorResponse) => {
        if (!this.respuestaCatalogoVigente(revision, this.revisionEmpleado,
          identidad, MODULOS_PERMISO.EMPLEADOS)) return;
        this.error = this.apiErrors.messageFor(err, 'No fue posible cargar el empleado.');
      },
    });
  }

  private actualizarEstadosCatalogo(): void {
    if (this.estadoSucursales === 'empty' && this.sucursalesDisponibles.length) {
      this.estadoSucursales = 'ready';
    }
    if (this.estadoEspecialidades === 'empty' && this.especialidadesDisponibles.length) {
      this.estadoEspecialidades = 'ready';
    }
    if (this.estadoTurnos === 'empty' && this.turnosDisponibles.length) {
      this.estadoTurnos = 'ready';
    }
  }

  private relacionesValidas(): boolean {
    const sucursalValida = this.form.idSucursal !== null
      && this.sucursalesDisponibles.some(item => item.idSucursal === this.form.idSucursal);
    const especialidadValida = this.form.idEspecialidad === null
      || this.especialidadesDisponibles.some(
        item => item.idEspecialidad === this.form.idEspecialidad,
      );
    const turnoValido = this.form.idTurno === null
      || this.turnosDisponibles.some(item => item.idTurno === this.form.idTurno);
    return sucursalValida && especialidadValida && turnoValido;
  }

  private tienePermisosCatalogo(): boolean {
    return this.permisos.puedeConsultar(MODULOS_PERMISO.SUCURSALES)
      && this.permisos.puedeConsultar(MODULOS_PERMISO.ESPECIALIDADES)
      && this.permisos.puedeConsultar(MODULOS_PERMISO.TURNOS);
  }

  private guardadoVigente(revision: number, identidad: string): boolean {
    const autorizado = this.esEdicion
      ? this.permisos.puedeModificar(MODULOS_PERMISO.EMPLEADOS)
      : this.permisos.puedeCrear(MODULOS_PERMISO.EMPLEADOS);
    return revision === this.revisionGuardado
      && identidad === this.identidadActual()
      && autorizado
      && this.tienePermisosCatalogo();
  }

  private respuestaCatalogoVigente(
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
    const userId = this.session.currentUser()?.idUsuario;
    const token = this.session.token;
    return this.session.isAuthenticated() && userId && token ? `${userId}:${token}` : null;
  }

  private invalidarDatos(message: string): void {
    this.revisionSucursales++;
    this.revisionEspecialidades++;
    this.revisionTurnos++;
    this.revisionEmpleado++;
    this.revisionGuardado++;
    this.sucursalesSubscription?.unsubscribe();
    this.especialidadesSubscription?.unsubscribe();
    this.turnosSubscription?.unsubscribe();
    this.empleadoSubscription?.unsubscribe();
    this.guardadoSubscription?.unsubscribe();
    this.sucursales = [];
    this.especialidades = [];
    this.turnos = [];
    this.estadoSucursales = this.permisos.puedeConsultar(MODULOS_PERMISO.SUCURSALES)
      ? 'idle' : 'unauthorized';
    this.estadoEspecialidades = this.permisos.puedeConsultar(MODULOS_PERMISO.ESPECIALIDADES)
      ? 'idle' : 'unauthorized';
    this.estadoTurnos = this.permisos.puedeConsultar(MODULOS_PERMISO.TURNOS)
      ? 'idle' : 'unauthorized';
    this.cargandoEmpleado = false;
    this.guardando = false;
    if (this.identidadObservada !== undefined) this.error = message;
  }

  private formVacio(): EmpleadoFormData {
    return {
      idSucursal: null,
      idEspecialidad: null,
      nombres: '',
      apellidos: '',
      dpi: '',
      tipoEmpleado: '',
      fechaIngreso: null,
      tipoSangre: null,
      idTurno: null,
      direccion: '',
      telefono: '',
      correoElectronico: '',
    };
  }
}
