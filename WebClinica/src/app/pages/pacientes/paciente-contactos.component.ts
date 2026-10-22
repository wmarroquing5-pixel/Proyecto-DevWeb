import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnInit, SimpleChanges, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ContactoEmergenciaRequest,
  ContactoEmergenciaResponse,
} from '../../core/models/contacto-emergencia.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { ContactosEmergenciaService } from '../../core/services/contacto-emergencia.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { ContextoInventario, idInventarioValido } from '../inventario/inventario-ui';
import { Subscription } from 'rxjs';

export type DatosContactoBorrador = Omit<ContactoEmergenciaRequest, 'idPaciente'>;
export interface ContactoBorrador { localId: number; datos: DatosContactoBorrador; }

export function contactoBorradorValido(datos: DatosContactoBorrador): boolean {
  return !!datos.nombres && datos.nombres.length <= 100 && !!datos.apellidos && datos.apellidos.length <= 100 &&
    !!datos.telefono && datos.telefono.length <= 20 && !!datos.direccion && datos.direccion.length <= 150 &&
    (datos.correoElectronico?.length ?? 0) <= 75 && (datos.parentesco?.length ?? 0) <= 50 &&
    (!datos.correoElectronico || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correoElectronico));
}

@Component({
  selector: 'app-paciente-contactos',
  imports: [FormsModule, ConfirmDialogComponent],
  template: `
    <section class="ui-card paciente-contactos mt-4" aria-labelledby="contactos-title">
      <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
        <div>
          <h3 id="contactos-title" class="h5 mb-0">Contactos de emergencia</h3>
        </div>
        @if (permisos.puedeCrear(MODULO)) {
          <button type="button" class="btn btn-outline-primary" (click)="nuevo()" [disabled]="guardando || eliminandoId !== null">Agregar contacto</button>
        }
        @if (idPaciente !== null && permisos.puedeConsultar(MODULO)) {
          <button type="button" class="btn btn-outline-secondary" (click)="cargar()" [disabled]="cargando">Actualizar contactos</button>
        }
      </div>

      @if (error) { <div class="alert alert-danger mt-3" role="alert">{{ error }}</div> }
      @if (aviso) { <div class="alert alert-success mt-3" role="status">{{ aviso }}</div> }
      @if (idPaciente === null && !permisos.puedeCrear(MODULO)) { <p class="text-muted mt-3">No tiene permiso ContactosEmergencia/Crear. Puede guardar al paciente sin contactos.</p> }

      @if (mostrarFormulario) {
        <form class="border rounded p-3 mt-3" (ngSubmit)="guardar()">
          <fieldset [disabled]="guardando">
            <legend class="h6">{{ editandoId === null && editandoLocalId === null ? 'Nuevo contacto' : 'Editar contacto' }}</legend>
            <div class="row g-3">
              <div class="col-md-6"><label for="contacto-nombres" class="form-label">Nombres *</label><input id="contacto-nombres" name="contactoNombres" class="form-control" [(ngModel)]="form.nombres" maxlength="100" required></div>
              <div class="col-md-6"><label for="contacto-apellidos" class="form-label">Apellidos *</label><input id="contacto-apellidos" name="contactoApellidos" class="form-control" [(ngModel)]="form.apellidos" maxlength="100" required></div>
              <div class="col-md-6"><label for="contacto-telefono" class="form-label">Teléfono *</label><input id="contacto-telefono" name="contactoTelefono" class="form-control" [(ngModel)]="form.telefono" maxlength="20" required></div>
              <div class="col-md-6"><label for="contacto-parentesco" class="form-label">Parentesco</label><input id="contacto-parentesco" name="contactoParentesco" class="form-control" [(ngModel)]="form.parentesco" maxlength="50"></div>
              <div class="col-md-6"><label for="contacto-correo" class="form-label">Correo electrónico</label><input id="contacto-correo" name="contactoCorreo" type="email" class="form-control" [(ngModel)]="form.correoElectronico" maxlength="75"></div>
              <div class="col-md-6"><label for="contacto-direccion" class="form-label">Dirección *</label><input id="contacto-direccion" name="contactoDireccion" class="form-control" [(ngModel)]="form.direccion" maxlength="150" required></div>
              <div class="col-12 d-flex gap-2">
                <button type="submit" class="btn btn-success" [disabled]="guardando">{{ guardando ? 'Guardando…' : 'Guardar contacto' }}</button>
                <button type="button" class="btn btn-secondary" (click)="cancelarEdicion()" [disabled]="guardando">Cancelar</button>
              </div>
            </div>
          </fieldset>
        </form>
      }

      <div class="table-responsive ui-table-wrap mt-3">
        <table class="table ui-table table-striped align-middle">
          <thead><tr><th scope="col">Nombre</th><th scope="col">Parentesco</th><th scope="col">Teléfono</th><th scope="col">Dirección</th><th scope="col">Acciones</th></tr></thead>
          <tbody>
            @if (idPaciente === null) {
              @for (borrador of borradores; track borrador.localId) {
                <tr>
                  <td>{{ borrador.datos.nombres }} {{ borrador.datos.apellidos }}</td>
                  <td>{{ borrador.datos.parentesco || '—' }}</td>
                  <td>{{ borrador.datos.telefono }}</td>
                  <td>{{ borrador.datos.direccion }}</td>
                  <td><div class="d-flex gap-2">
                    <button type="button" class="btn btn-sm btn-outline-primary" [attr.aria-label]="'Editar borrador ' + borrador.localId" (click)="editarBorrador(borrador)" [disabled]="!permisos.puedeCrear(MODULO)">Editar</button>
                    <button type="button" class="btn btn-sm btn-outline-danger" [attr.aria-label]="'Quitar borrador ' + borrador.localId" (click)="quitarBorrador(borrador.localId)">Quitar</button>
                  </div></td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="paciente-contactos__empty"><i class="bi bi-people-fill" aria-hidden="true"></i> No hay contactos de emergencia registrados.</td></tr>
              }
            } @else if (cargando) {
              <tr><td colspan="5" class="paciente-contactos__empty" role="status">Cargando contactos…</td></tr>
            } @else {
              @for (contacto of contactos; track contacto.idContacto) {
                <tr>
                  <td>{{ contacto.nombres }} {{ contacto.apellidos }} <span class="badge ms-2" [class.bg-success]="contacto.activo" [class.bg-secondary]="!contacto.activo">{{ contacto.activo ? 'Activo' : 'Retirado' }}</span></td>
                  <td>{{ contacto.parentesco || '—' }}</td>
                  <td>{{ contacto.telefono }}</td>
                  <td>{{ contacto.direccion }}</td>
                  <td><div class="d-flex gap-2">
                    @if (contacto.activo && permisos.puedeModificar(MODULO)) { <button type="button" class="btn btn-sm btn-outline-primary" [attr.aria-label]="'Editar contacto ' + contacto.idContacto" (click)="editar(contacto)" [disabled]="guardando || eliminandoId !== null">Editar</button> }
                    @if (contacto.activo && permisos.puedeEliminar(MODULO)) { <button type="button" class="btn btn-sm btn-outline-danger" [attr.aria-label]="'Retirar contacto ' + contacto.idContacto" (click)="solicitarRetiro(contacto)" [disabled]="guardando || eliminandoId !== null">Retirar</button> }
                  </div></td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="paciente-contactos__empty"><i class="bi bi-people-fill" aria-hidden="true"></i> No hay contactos de emergencia registrados.</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
      @if (idPaciente === null) {
        <p class="small text-muted mt-2 mb-0">Los contactos preparados se guardarán después de crear al paciente.</p>
      } @else if (contactos.length > 0) {
        <div class="d-flex justify-content-between align-items-center">
          <span>Total: {{ total }}</span>
          <div><button type="button" class="btn btn-sm btn-outline-secondary" (click)="cambiarPagina(page - 1)" [disabled]="page <= 1 || cargando">Anterior</button>
            <span class="mx-2">Página {{ page }} de {{ totalPages }}</span>
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="cambiarPagina(page + 1)" [disabled]="page >= totalPages || cargando">Siguiente</button></div>
        </div>
      }
    </section>
    @if (pendienteRetiro) {
      <app-confirm-dialog title="Retirar contacto"
        [description]="'¿Deseas retirar a ' + pendienteRetiro.nombres + ' ' + pendienteRetiro.apellidos + '?'"
        consequence="El contacto quedará inactivo y se conservará vinculado al paciente."
        confirmLabel="Retirar" [busy]="eliminandoId === pendienteRetiro.idContacto"
        (confirmed)="confirmarRetiro()" (cancelled)="cancelarRetiro()" />
    }
  `,
  styles: [`
    .paciente-contactos { padding: 1.4rem; }
    .paciente-contactos h3 { color: var(--ui-heading); font-weight: 700; }
    .paciente-contactos__empty { padding: 1.15rem; color: var(--ui-muted); text-align: center; }
    .paciente-contactos__empty i { margin-right: .6rem; color: #95a7bf; }
    @media (max-width: 575.98px) { .paciente-contactos { padding: 1rem; } }
  `],
})
export class PacienteContactosComponent implements OnInit, OnChanges {
  @Input({ required: true }) idPaciente: number | null = null;
  readonly MODULO = 'ContactosEmergencia';
  readonly permisos = inject(PermisosService);
  private readonly service = inject(ContactosEmergenciaService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly contexto = new ContextoInventario(['Pacientes', this.MODULO]);
  private solicitudesPaciente = new Subscription();
  private clave = this.contexto.clave();
  private identidad = this.clave.split('|')[0];

  contactos: ContactoEmergenciaResponse[] = [];
  page = 1; pageSize = 10; total = 0; totalPages = 0;
  cargando = false; guardando = false; eliminandoId: number | null = null;
  error = ''; aviso = ''; mostrarFormulario = false; editandoId: number | null = null;
  pendienteRetiro: ContactoEmergenciaResponse | null = null;
  form = this.formVacio();
  borradores: ContactoBorrador[] = [];
  editandoLocalId: number | null = null;
  private siguienteLocalId = 1;

  constructor() {
    this.contexto.observar(() => {
      const identidad = this.contexto.clave().split('|')[0];
      this.reiniciar(); this.clave = this.contexto.clave();
      if (identidad !== this.identidad) this.borradores = [];
      this.identidad = identidad;
      if (this.puedeLeer()) this.cargar();
    });
  }

  ngOnInit(): void { this.clave = this.contexto.clave(); if (this.idPaciente !== null) this.cargar(); }
  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['idPaciente']?.firstChange) {
      this.reiniciar(); if (this.idPaciente !== null) { this.borradores = []; this.cargar(); }
    }
  }

  cargar(): void {
    const clave = this.contexto.clave(); const paciente = this.idPaciente; const pagina = this.page;
    this.clave = clave;
    if (paciente === null) return;
    if (!this.puedeLeer()) { this.contactos = []; this.total = this.totalPages = 0; this.error = 'No tiene sesión y permiso ContactosEmergencia/Consultar vigentes.'; return; }
    this.cargando = true; this.error = '';
    this.agregar(this.service.listar(paciente, pagina, this.pageSize).subscribe({
      next: res => {
        if (!this.vigente(clave, paciente, pagina)) return;
        const paginas = Math.ceil(res.totalCount / this.pageSize);
        const esperados = Math.min(this.pageSize, Math.max(0, res.totalCount - (pagina - 1) * this.pageSize));
        if (!Array.isArray(res.items) || res.page !== pagina || res.pageSize !== this.pageSize ||
          !Number.isSafeInteger(res.totalCount) || res.totalCount < 0 || res.totalPages !== paginas ||
          res.items.length !== esperados || res.items.some(c => !idInventarioValido(c.idContacto) || c.idPaciente !== paciente)) {
          this.contactos = []; this.total = this.totalPages = 0; this.cargando = false;
          this.error = 'La API devolvió contactos o paginación contradictorios.'; return;
        }
        this.contactos = res.items; this.total = res.totalCount; this.totalPages = res.totalPages; this.cargando = false;
      },
      error: (err: HttpErrorResponse) => {
        if (!this.vigente(clave, paciente, pagina)) return;
        this.contactos = []; this.total = this.totalPages = 0; this.cargando = false;
        this.error = this.apiErrors.messageFor(err, 'No fue posible cargar los contactos de emergencia.');
      },
    }));
  }

  nuevo(): void {
    if (this.guardando || !this.permisos.puedeCrear(this.MODULO)) return;
    this.editandoId = this.editandoLocalId = null; this.form = this.formVacio(); this.mostrarFormulario = true; this.error = this.aviso = '';
  }

  editarBorrador(borrador: ContactoBorrador): void {
    if (this.idPaciente !== null || !this.permisos.puedeCrear(this.MODULO) || !this.borradores.some(c => c.localId === borrador.localId)) return;
    this.editandoLocalId = borrador.localId;
    this.form = { nombres: borrador.datos.nombres, apellidos: borrador.datos.apellidos,
      telefono: borrador.datos.telefono, direccion: borrador.datos.direccion,
      correoElectronico: borrador.datos.correoElectronico ?? null, parentesco: borrador.datos.parentesco ?? null };
    this.mostrarFormulario = true; this.error = this.aviso = '';
  }

  quitarBorrador(localId: number): void {
    if (this.idPaciente !== null) return;
    this.borradores = this.borradores.filter(c => c.localId !== localId);
    if (this.editandoLocalId === localId) this.cancelarEdicion();
  }

  editar(contacto: ContactoEmergenciaResponse): void {
    if (this.guardando || !this.permisos.puedeModificar(this.MODULO) || !this.propioActivo(contacto)) return;
    this.editandoId = contacto.idContacto;
    this.form = { nombres: contacto.nombres, apellidos: contacto.apellidos, telefono: contacto.telefono,
      direccion: contacto.direccion, correoElectronico: contacto.correoElectronico ?? null, parentesco: contacto.parentesco ?? null };
    this.mostrarFormulario = true; this.error = this.aviso = '';
  }

  guardar(): void {
    if (this.guardando) return;
    const editar = this.editandoId !== null; const permiso = editar ? this.permisos.puedeModificar(this.MODULO) : this.permisos.puedeCrear(this.MODULO);
    const clave = this.clave; const paciente = this.idPaciente; const id = this.editandoId;
    if (!permiso || !this.contexto.vigente(clave) || (paciente !== null && !idInventarioValido(paciente)) ||
      (editar && !this.contactos.some(c => c.idContacto === id && this.propioActivo(c)))) {
      this.error = 'La sesión, el permiso, el paciente o el contacto cambiaron.'; return;
    }
    const normalizar = (v?: string | null) => v?.trim().replace(/\s+/g, ' ') || '';
    const datos: DatosContactoBorrador = { nombres: normalizar(this.form.nombres), apellidos: normalizar(this.form.apellidos),
      telefono: normalizar(this.form.telefono), direccion: normalizar(this.form.direccion),
      correoElectronico: normalizar(this.form.correoElectronico) || null, parentesco: normalizar(this.form.parentesco) || null };
    if (!contactoBorradorValido(datos)) {
      this.error = 'Complete los campos obligatorios y respete sus longitudes máximas.'; return;
    }
    if (paciente === null) {
      const localId = this.editandoLocalId ?? this.siguienteLocalId++;
      const borrador = { localId, datos };
      this.borradores = this.editandoLocalId === null ? [...this.borradores, borrador] :
        this.borradores.map(c => c.localId === localId ? borrador : c);
      this.cancelarEdicion(); this.aviso = 'Contacto preparado para el alta.'; return;
    }
    const dto: ContactoEmergenciaRequest = { ...datos, idPaciente: paciente };
    this.guardando = true; this.error = this.aviso = '';
    const request = editar ? this.service.actualizar(id!, dto) : this.service.crear(dto);
    this.agregar(request.subscribe({
      next: response => {
        if (!this.contexto.vigente(clave) || paciente !== this.idPaciente) return;
        if (!response || !idInventarioValido(response.idContacto) || response.idPaciente !== paciente || !response.activo ||
          (editar && response.idContacto !== id)) {
          this.error = 'La respuesta no confirma el contacto solicitado. Verifique el listado antes de repetir.'; this.guardando = false; return;
        }
        this.guardando = false; this.mostrarFormulario = false; this.editandoId = null; this.form = this.formVacio();
        this.aviso = editar ? 'Contacto actualizado.' : 'Contacto agregado.';
        if (!editar) this.page = Math.max(1, Math.ceil((this.total + 1) / this.pageSize));
        this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        if (!this.contexto.vigente(clave) || paciente !== this.idPaciente) return;
        this.guardando = false;
        this.error = err.status === 0 || err.status >= 500
          ? 'Resultado incierto: verifique los contactos antes de repetir. No se reintentó automáticamente.'
          : this.apiErrors.messageFor(err, 'No fue posible guardar el contacto.');
      },
    }));
  }

  cancelarEdicion(): void { if (!this.guardando) { this.mostrarFormulario = false; this.editandoId = this.editandoLocalId = null; this.form = this.formVacio(); } }
  solicitarRetiro(contacto: ContactoEmergenciaResponse): void {
    if (!this.guardando && this.eliminandoId === null && this.permisos.puedeEliminar(this.MODULO) && this.propioActivo(contacto)) this.pendienteRetiro = contacto;
  }
  cancelarRetiro(): void { if (this.eliminandoId === null) this.pendienteRetiro = null; }
  confirmarRetiro(): void {
    const contacto = this.pendienteRetiro; const clave = this.clave; const paciente = this.idPaciente;
    if (!contacto || this.eliminandoId !== null) return;
    if (!this.contexto.vigente(clave) || !this.permisos.puedeEliminar(this.MODULO) || !this.propioActivo(contacto)) {
      this.pendienteRetiro = null; this.error = 'La sesión, el permiso o el contacto cambiaron.'; return;
    }
    this.eliminandoId = contacto.idContacto; this.error = this.aviso = '';
    this.agregar(this.service.eliminar(contacto.idContacto).subscribe({
      next: () => {
        if (!this.contexto.vigente(clave) || paciente !== this.idPaciente) return;
        this.eliminandoId = null; this.pendienteRetiro = null; this.aviso = 'Contacto retirado.';
        if (this.contactos.length === 1 && this.page > 1) this.page--; this.cargar();
      },
      error: (err: HttpErrorResponse) => {
        if (!this.contexto.vigente(clave) || paciente !== this.idPaciente) return;
        this.eliminandoId = null; this.pendienteRetiro = null;
        this.error = err.status === 0 || err.status >= 500
          ? 'Resultado incierto: verifique el contacto antes de repetir el retiro.'
          : this.apiErrors.messageFor(err, 'No fue posible retirar el contacto.');
      },
    }));
  }

  cambiarPagina(page: number): void { if (Number.isInteger(page) && page > 0 && page <= Math.max(this.totalPages, 1) && !this.cargando) { this.page = page; this.cargar(); } }
  private puedeLeer(): boolean { return this.idPaciente !== null && idInventarioValido(this.idPaciente) && this.contexto.vigente(this.contexto.clave()) && this.permisos.puedeConsultar('Pacientes') && this.permisos.puedeConsultar(this.MODULO); }
  private vigente(clave: string, paciente: number, page: number): boolean { return this.contexto.vigente(clave) && paciente === this.idPaciente && page === this.page; }
  private propioActivo(contacto: ContactoEmergenciaResponse): boolean { return contacto.idPaciente === this.idPaciente && contacto.activo && this.contactos.some(c => c.idContacto === contacto.idContacto && c.idPaciente === this.idPaciente && c.activo); }
  private agregar(solicitud: Subscription): void { this.solicitudesPaciente.add(solicitud); this.contexto.agregar(solicitud); }
  private reiniciar(): void { this.solicitudesPaciente.unsubscribe(); this.solicitudesPaciente = new Subscription(); this.contactos = []; this.total = this.totalPages = 0; this.page = 1; this.cargando = this.guardando = false; this.eliminandoId = null; this.error = this.aviso = ''; this.pendienteRetiro = null; this.cancelarEdicion(); }
  private formVacio() { return { nombres: '', apellidos: '', telefono: '', direccion: '', correoElectronico: null as string | null, parentesco: null as string | null }; }
}
