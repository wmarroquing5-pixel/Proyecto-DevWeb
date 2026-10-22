import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges, effect, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, Subscription, finalize, forkJoin, map, of, switchMap } from 'rxjs';
import { TratamientoCreateDto, TratamientoResponseDto } from '../../core/models/historial.model';
import { LoteMedicamentoResponse, MedicamentoResponse } from '../../core/models/inventario.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { HistorialService } from '../../core/services/historial.service';
import { InventarioService } from '../../core/services/inventario.service';
import { PermisosService } from '../../core/services/permisos.service';

@Component({
  selector: 'app-tratamiento-form',
  imports: [FormsModule],
  template: `
    <form (ngSubmit)="guardar()" class="row g-2 mb-3" #form="ngForm">
      <div class="col-md-6">
        <label for="trat-descripcion" class="form-label">Descripción del tratamiento *</label>
        <textarea id="trat-descripcion" class="form-control" [(ngModel)]="descripcion" name="descripcion"
          required maxlength="300" [disabled]="guardando"></textarea>
      </div>
      <div class="col-md-3">
        <label for="trat-inicio" class="form-label">Fecha de inicio *</label>
        <input id="trat-inicio" type="date" class="form-control" [(ngModel)]="fechaInicio" name="fechaInicio"
          required [disabled]="guardando">
      </div>
      <div class="col-12 form-check ms-2">
        <input id="trat-farmaco" type="checkbox" class="form-check-input" name="farmacologico"
          [ngModel]="farmacologico" (ngModelChange)="cambiarTipo($event)" [disabled]="guardando">
        <label for="trat-farmaco" class="form-check-label">Asociar medicamento de inventario</label>
      </div>
      @if (farmacologico) {
        <div class="col-md-9">
          <label for="trat-lote" class="form-label">Lote *</label>
          <select id="trat-lote" class="form-select" name="idLote" [ngModel]="seleccion?.idLote ?? null"
            (ngModelChange)="seleccionarLote($event)" [disabled]="cargandoLotes || guardando" required>
            <option [ngValue]="null">Selecciona un lote vigente con existencia</option>
            @if (seleccion && !lotes.some(esSeleccion)) {
              <option [ngValue]="seleccion.idLote">{{ describirLote(seleccion) }}</option>
            }
            @for (lote of lotes; track lote.idLote) {
              <option [ngValue]="lote.idLote" [disabled]="!loteElegible(lote)">{{ describirLote(lote) }}</option>
            }
          </select>
          <div class="d-flex gap-2 align-items-center mt-2">
            <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cargarLotes(pagina - 1)"
              [disabled]="pagina <= 1 || cargandoLotes || guardando">Anterior</button>
            <span role="status">Página {{ pagina }} de {{ totalPaginas || 1 }}</span>
            <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cargarLotes(pagina + 1)"
              [disabled]="pagina >= totalPaginas || cargandoLotes || guardando">Siguiente</button>
            <button type="button" class="btn btn-link btn-sm" (click)="cargarLotes(pagina)"
              [disabled]="cargandoLotes || guardando">Actualizar lotes</button>
          </div>
          @if (cargandoLotes) { <p role="status">Consultando lotes…</p> }
          @if (!cargandoLotes && !errorLotes && !lotes.length) { <p>No hay lotes en esta página.</p> }
          @if (errorLotes) { <p class="text-danger" role="alert">{{ errorLotes }}</p> }
        </div>
        <div class="col-md-3">
          <label for="trat-cantidad" class="form-label">Cantidad indicada *</label>
          <input id="trat-cantidad" type="number" class="form-control" name="cantidad" [(ngModel)]="cantidad"
            min="1" max="32767" step="1" required [disabled]="guardando">
        </div>
      }
      <div class="col-12 small text-muted">Registrar el tratamiento no descuenta inventario. El consumo se confirma después, por separado.</div>
      @if (error) { <div class="col-12"><div class="alert alert-danger" role="alert">{{ error }}</div></div> }
      <div class="col-12">
        <button type="submit" class="btn btn-primary" [disabled]="guardando || form.invalid">
          {{ guardando ? 'Registrando…' : 'Agregar tratamiento' }}
        </button>
      </div>
    </form>
  `,
})
export class TratamientoFormComponent implements OnChanges, OnDestroy {
  private readonly inventario = inject(InventarioService);
  private readonly historial = inject(HistorialService);
  private readonly session = inject(AuthSessionService);
  private readonly permisos = inject(PermisosService);
  private readonly errors = inject(ApiErrorService);
  @Input({ required: true }) idConsulta = 0;
  @Input({ required: true }) idPaciente = 0;
  @Input() revisionStock = 0;
  @Output() readonly registrado = new EventEmitter<TratamientoResponseDto>();
  descripcion = '';
  fechaInicio = '';
  farmacologico = false;
  cantidad: number | null = null;
  seleccion: LoteMedicamentoResponse | null = null;
  lotes: LoteMedicamentoResponse[] = [];
  medicamentos = new Map<number, MedicamentoResponse>();
  pagina = 1;
  totalPaginas = 0;
  cargandoLotes = false;
  guardando = false;
  error = '';
  errorLotes = '';
  readonly esSeleccion = (lote: LoteMedicamentoResponse) => lote.idLote === this.seleccion?.idLote;
  private revision = 0;
  private revisionPagina = 0;
  private lista?: Subscription;
  private escritura?: Subscription;
  private identidadObservada: string | null | undefined;

  constructor() {
    effect(() => {
      const identidad = this.identidadActual();
      const consultarLotes = this.permisos.puedeConsultar(MODULOS_PERMISO.LOTES_MEDICAMENTO);
      const consultarMedicamentos = this.permisos.puedeConsultar(MODULOS_PERMISO.MEDICAMENTOS);
      const cambio = this.identidadObservada !== undefined && identidad !== this.identidadObservada;
      this.identidadObservada = identidad;
      if (!identidad || cambio || !this.permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL)) this.reiniciar();
      if (this.farmacologico && !consultarLotes) {
        this.lista?.unsubscribe(); this.lotes = []; this.seleccion = null;
        this.errorLotes = 'No tienes permiso para consultar lotes.';
      }
      if (!consultarMedicamentos) this.medicamentos.clear();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['idConsulta'] || changes['idPaciente']) this.reiniciar();
    else if (changes['revisionStock'] && this.farmacologico) this.cargarLotes(this.pagina);
  }

  cambiarTipo(value: boolean): void {
    if (this.guardando) return;
    this.farmacologico = value;
    this.seleccion = null; this.cantidad = null; this.error = '';
    this.revisionPagina++; this.lista?.unsubscribe(); this.cargandoLotes = false;
    this.lotes = []; this.errorLotes = '';
    if (value) this.cargarLotes(1);
  }

  cargarLotes(page: number): void {
    const identidad = this.identidadActual();
    if (!this.farmacologico || this.guardando || !identidad || !this.permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL)) return;
    if (!this.permisos.puedeConsultar(MODULOS_PERMISO.LOTES_MEDICAMENTO)) {
      this.errorLotes = 'No tienes permiso para consultar lotes.'; return;
    }
    if (!Number.isInteger(page) || page < 1 || (page > 1 && page > this.totalPaginas)) return;
    const revision = ++this.revisionPagina;
    this.lista?.unsubscribe(); this.cargandoLotes = true; this.errorLotes = '';
    this.lista = this.inventario.listarLotes(page, 20).pipe(
      switchMap(response => {
        if (response.page !== page || response.pageSize !== 20
          || !Number.isSafeInteger(response.totalCount) || response.totalCount < 0
          || response.totalPages !== Math.ceil(response.totalCount / 20)
          || response.items.length !== Math.min(20, Math.max(0, response.totalCount - (page - 1) * 20))
          || new Set(response.items.map(l => l.idLote)).size !== response.items.length) {
          throw new Error('La página de lotes es inconsistente. Actualiza el listado.');
        }
        const ids = [...new Set(response.items.map(l => l.idMedicamento))];
        const nombres = this.permisos.puedeConsultar(MODULOS_PERMISO.MEDICAMENTOS) && ids.length
          ? forkJoin(ids.map(id => this.inventario.obtenerMedicamento(id))) : of([]);
        return nombres.pipe(map(medicamentos => ({ response, medicamentos })));
      }),
      finalize(() => { if (revision === this.revisionPagina) this.cargandoLotes = false; }),
    ).subscribe({
      next: ({ response, medicamentos }) => {
        if (revision !== this.revisionPagina || identidad !== this.identidadActual()
          || !this.permisos.puedeConsultar(MODULOS_PERMISO.LOTES_MEDICAMENTO)) return;
        this.lotes = response.items; this.pagina = page; this.totalPaginas = response.totalPages;
        if (this.permisos.puedeConsultar(MODULOS_PERMISO.MEDICAMENTOS))
          for (const medicamento of medicamentos) this.medicamentos.set(medicamento.idMedicamento, medicamento);
        const actual = this.lotes.find(l => l.idLote === this.seleccion?.idLote);
        if (actual) this.seleccion = actual;
      },
      error: (e: unknown) => {
        if (revision !== this.revisionPagina || identidad !== this.identidadActual()) return;
        this.lotes = [];
        this.errorLotes = this.mensaje(e, 'No fue posible consultar los lotes o sus medicamentos.');
      },
    });
  }

  seleccionarLote(id: number | null): void {
    if (this.guardando) return;
    const lote = this.lotes.find(l => l.idLote === id);
    this.seleccion = lote && this.loteElegible(lote) ? lote : null;
    this.error = id !== null && !this.seleccion ? 'Selecciona un lote vigente con existencia.' : '';
  }

  loteElegible(lote: LoteMedicamentoResponse): boolean {
    const hoy = new Date().toISOString().slice(0, 10); // El servidor utiliza DateOnly UTC.
    return lote.cantidadDisponible > 0 && this.fechaValida(lote.fechaIngreso)
      && this.fechaValida(lote.fechaVencimiento) && lote.fechaIngreso <= hoy && lote.fechaVencimiento > hoy
      && this.medicamentos.get(lote.idMedicamento)?.activo !== false;
  }

  describirLote(lote: LoteMedicamentoResponse): string {
    const medicamento = this.medicamentos.get(lote.idMedicamento);
    return `${lote.numeroLote} (#${lote.idLote}) · ${medicamento ? medicamento.codigo + ' — ' + medicamento.nombre : 'Medicamento #' + lote.idMedicamento} · Vence ${lote.fechaVencimiento} · Disponible: ${lote.cantidadDisponible}`;
  }

  guardar(): void {
    const identidad = this.identidadActual();
    if (this.guardando || !identidad || !this.permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL)) return;
    this.error = '';
    if (!Number.isSafeInteger(this.idConsulta) || this.idConsulta <= 0
      || !Number.isSafeInteger(this.idPaciente) || this.idPaciente <= 0 || !this.descripcion.trim()
      || this.descripcion.trim().length > 300 || !this.fechaValida(this.fechaInicio)) {
      this.error = 'Indica una descripción de hasta 300 caracteres y una fecha válida.'; return;
    }
    if (this.farmacologico && (!this.seleccion || !this.loteElegible(this.seleccion)
      || !this.permisos.puedeConsultar(MODULOS_PERMISO.LOTES_MEDICAMENTO))) {
      this.error = 'Selecciona un lote vigente con existencia y permiso de consulta.'; return;
    }
    if (this.farmacologico && (!Number.isInteger(this.cantidad) || this.cantidad === null
      || this.cantidad < 1 || this.cantidad > 32767)) {
      this.error = 'La cantidad indicada debe ser un entero entre 1 y 32767.'; return;
    }
    const body: TratamientoCreateDto = { idConsulta: this.idConsulta, descripcion: this.descripcion.trim(),
      fechaInicio: this.fechaInicio, fechaFin: null, indicaciones: null,
      idLote: this.farmacologico ? this.seleccion!.idLote : null,
      cantidad: this.farmacologico ? this.cantidad : null };
    const paciente = this.idPaciente;
    const medicamentoSeleccionado = this.seleccion?.idMedicamento;
    const revision = ++this.revision;
    const vigente = () => revision === this.revision && identidad === this.identidadActual()
      && body.idConsulta === this.idConsulta && paciente === this.idPaciente
      && this.permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL);
    this.guardando = true;
    const lote$: Observable<LoteMedicamentoResponse | null> = body.idLote ? this.inventario.obtenerLote(body.idLote) : of(null);
    let enviado = false;
    this.escritura = lote$.pipe(
      switchMap(lote => {
        if (!vigente()) return of(null);
        if (body.idLote && (!lote || lote.idLote !== body.idLote
          || lote.idMedicamento !== medicamentoSeleccionado || !this.loteElegible(lote)
          || !this.permisos.puedeConsultar(MODULOS_PERMISO.LOTES_MEDICAMENTO))) {
          throw new Error('El lote ya no está disponible o vigente. Actualiza el listado.');
        }
        enviado = true;
        return this.historial.crearTratamiento(body);
      }),
      finalize(() => { if (revision === this.revision) this.guardando = false; }),
    ).subscribe({
      next: response => {
        if (!vigente()) return;
        if (!response || !Number.isSafeInteger(response.idTratamiento) || response.idTratamiento <= 0
          || response.idConsulta !== body.idConsulta || response.idPaciente !== paciente
          || response.idLote !== body.idLote || response.cantidad !== body.cantidad) {
          this.error = 'La confirmación es inconsistente. Verifica el historial antes de repetir el registro.'; return;
        }
        this.descripcion = ''; this.fechaInicio = ''; this.cantidad = null; this.seleccion = null;
        this.registrado.emit(response);
      },
      error: (e: unknown) => {
        if (!vigente()) return;
        this.error = enviado && e instanceof HttpErrorResponse && (e.status === 0 || e.status >= 500)
          ? 'Resultado incierto: verifica el historial antes de repetir el registro. No se reintentó automáticamente.'
          : this.mensaje(e, 'No fue posible registrar el tratamiento.');
      },
    });
  }

  ngOnDestroy(): void { this.reiniciar(); }

  private reiniciar(): void {
    this.revision++; this.revisionPagina++; this.lista?.unsubscribe(); this.escritura?.unsubscribe();
    this.guardando = false; this.cargandoLotes = false; this.error = ''; this.errorLotes = '';
    this.descripcion = ''; this.fechaInicio = ''; this.cantidad = null; this.seleccion = null;
    this.farmacologico = false; this.lotes = []; this.medicamentos.clear(); this.pagina = 1; this.totalPaginas = 0;
  }

  private identidadActual(): string | null {
    const id = this.session.currentUser()?.idUsuario; const token = this.session.token;
    return this.session.isAuthenticated() && id && token ? `${id}:${token}` : null;
  }

  private fechaValida(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
      && new Date(value).toISOString().slice(0, 10) === value;
  }

  private mensaje(e: unknown, fallback: string): string {
    return e instanceof HttpErrorResponse ? this.errors.messageFor(e, e.status === 401
      ? 'La sesión expiró. Inicia sesión nuevamente.' : fallback) : e instanceof Error ? e.message : fallback;
  }
}
