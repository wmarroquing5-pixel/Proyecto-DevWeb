import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { forkJoin, map, Subscription, switchMap } from 'rxjs';
import { ContactoEmergenciaResponse } from '../../core/models/contacto-emergencia.model';
import { ConsultaListadoDto, DiagnosticoResponse, ExamenResponseDto, HistorialMedicoResponseDto, TratamientoResponseDto } from '../../core/models/historial.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PacienteResponse } from '../../core/models/paciente.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { ContactosEmergenciaService } from '../../core/services/contacto-emergencia.service';
import { HistorialService } from '../../core/services/historial.service';
import { PacientesService } from '../../core/services/paciente.service';
import { PermisosService } from '../../core/services/permisos.service';
import { UiStateComponent } from '../../shared/components/ui-state.component';
import { cargarCatalogoInventario, ContextoInventario, fechaInventarioValida, idInventarioValido } from '../inventario/inventario-ui';

interface ResumenClinico {
  consulta: ConsultaListadoDto;
  diagnosticos: DiagnosticoResponse[];
  tratamientos: TratamientoResponseDto[];
  examenes: ExamenResponseDto[];
  evoluciones: HistorialMedicoResponseDto[];
}

@Component({
  selector: 'app-paciente-ficha',
  imports: [CommonModule, RouterModule, UiStateComponent],
  template: `
    <div class="page-shell">
      <header class="page-header">
        <div><h1>Ficha Médica del Paciente</h1><p class="page-header__subtitle">Consulta de información guardada, sin cambios de datos.</p></div>
        <a routerLink="/pacientes" class="btn btn-secondary">Volver al listado</a>
      </header>

      @if (cargandoPaciente) { <app-ui-state kind="loading" title="Cargando ficha del paciente…" /> }
      @else if (errorPaciente) { <app-ui-state kind="error" title="No fue posible mostrar la ficha" [description]="errorPaciente" /> }
      @else if (paciente) {
        <section class="ui-card mb-4" aria-labelledby="ficha-encabezado">
          <div class="d-flex flex-wrap gap-4 align-items-center">
            @if (fotoUrl) { <img [src]="fotoUrl" [alt]="'Fotografía de ' + paciente.nombres + ' ' + paciente.apellidos" class="img-thumbnail" style="max-width: 160px; max-height: 160px; object-fit: contain"> }
            <div><h2 id="ficha-encabezado" class="h4">{{ paciente.nombres }} {{ paciente.apellidos }}</h2>
              <p class="mb-1">Identificador interno: {{ paciente.idPaciente }}</p>
              <span class="badge" [class.bg-success]="paciente.activo" [class.bg-secondary]="!paciente.activo">{{ paciente.activo ? 'Activo' : 'Inactivo' }}</span>
              @if (cargandoFoto) { <p role="status" class="mb-0">Cargando fotografía…</p> }
              @if (errorFoto) { <p role="status" class="text-muted mb-0">{{ errorFoto }}</p> }
            </div>
          </div>
        </section>

        <section class="ui-card mb-4" aria-labelledby="ficha-generales">
          <h2 id="ficha-generales" class="h5">Datos generales</h2>
          <dl class="row mb-0">
            <dt class="col-sm-4">Nombres</dt><dd class="col-sm-8">{{ paciente.nombres }}</dd>
            <dt class="col-sm-4">Apellidos</dt><dd class="col-sm-8">{{ paciente.apellidos }}</dd>
            <dt class="col-sm-4">DPI</dt><dd class="col-sm-8">{{ dato(paciente.dpi) }}</dd>
            <dt class="col-sm-4">Fecha de nacimiento</dt><dd class="col-sm-8">{{ paciente.fechaNacimiento }}</dd>
            <dt class="col-sm-4">Edad</dt><dd class="col-sm-8">{{ edad === null ? 'No disponible' : edad + ' años' }}</dd>
            <dt class="col-sm-4">Género</dt><dd class="col-sm-8">{{ dato(paciente.genero) }}</dd>
            <dt class="col-sm-4">Tipo de sangre</dt><dd class="col-sm-8">{{ dato(paciente.tipoSangre) }}</dd>
            <dt class="col-sm-4">Teléfono</dt><dd class="col-sm-8">{{ dato(paciente.telefono) }}</dd>
            <dt class="col-sm-4">Correo electrónico</dt><dd class="col-sm-8">{{ dato(paciente.correo) }}</dd>
            <dt class="col-sm-4">NIT</dt><dd class="col-sm-8">{{ dato(paciente.nit) }}</dd>
            <dt class="col-sm-4">Nombre de facturación</dt><dd class="col-sm-8">{{ dato(paciente.nombreFacturacion) }}</dd>
            <dt class="col-sm-4">Dirección</dt><dd class="col-sm-8">{{ dato(paciente.direccion) }}</dd>
          </dl>
        </section>

        <section class="ui-card mb-4" aria-labelledby="ficha-contactos">
          <h2 id="ficha-contactos" class="h5">Contactos de emergencia</h2>
          @if (!permisos.puedeConsultar(MODULOS_PERMISO.CONTACTOS_EMERGENCIA)) { <p>Sin permiso ContactosEmergencia/Consultar.</p> }
          @else if (cargandoContactos) { <app-ui-state kind="loading" title="Cargando contactos…" [compact]="true" /> }
          @else if (errorContactos) { <app-ui-state kind="error" title="No fue posible cargar los contactos" [description]="errorContactos" [compact]="true" /> }
          @else if (contactos.length === 0) { <app-ui-state kind="empty" title="Sin contactos de emergencia registrados" [compact]="true" /> }
          @else {
            <div class="table-responsive"><table class="table table-striped align-middle">
              <thead><tr><th scope="col">Nombre</th><th scope="col">Parentesco</th><th scope="col">Teléfono</th><th scope="col">Dirección</th><th scope="col">Estado</th></tr></thead>
              <tbody>@for (contacto of contactos; track contacto.idContacto) {
                <tr><td>{{ contacto.nombres }} {{ contacto.apellidos }}</td><td>{{ dato(contacto.parentesco) }}</td>
                  <td>{{ contacto.telefono }}</td><td>{{ contacto.direccion }}</td><td>{{ contacto.activo ? 'Activo' : 'Retirado' }}</td></tr>
              }</tbody>
            </table></div>
            <nav aria-label="Páginas de contactos" class="d-flex justify-content-between align-items-center">
              <span>Total: {{ totalContactos }} · Página {{ paginaContactos }} de {{ paginasContactos }}</span>
              <div class="d-flex gap-2"><button type="button" class="btn btn-outline-secondary btn-sm" (click)="cambiarPaginaContactos(paginaContactos - 1)" [disabled]="paginaContactos <= 1">Anterior</button>
                <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cambiarPaginaContactos(paginaContactos + 1)" [disabled]="paginaContactos >= paginasContactos">Siguiente</button></div>
            </nav>
          }
        </section>

        <section class="ui-card mb-4" aria-labelledby="ficha-historial">
          <div class="d-flex flex-wrap justify-content-between gap-2"><h2 id="ficha-historial" class="h5">Historial clínico</h2>
            @if (permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS)) { <a [routerLink]="['/historial', paciente.idPaciente]" class="btn btn-outline-primary btn-sm">Abrir historial clínico</a> }
          </div>
          @if (!permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS)) { <p>Sin permiso Consultas/Consultar. No se muestra información clínica.</p> }
          @else if (cargandoConsultas) { <app-ui-state kind="loading" title="Cargando consultas…" [compact]="true" /> }
          @else if (errorConsultas) { <app-ui-state kind="error" title="No fue posible cargar las consultas" [description]="errorConsultas" [compact]="true" /> }
          @else if (consultas.length === 0) { <app-ui-state kind="empty" title="Sin consultas registradas" [compact]="true" /> }
          @else {
            <div class="table-responsive"><table class="table table-striped align-middle">
              <thead><tr><th scope="col">Fecha</th><th scope="col">Consulta</th><th scope="col">Médico</th><th scope="col">Acciones de lectura</th></tr></thead>
              <tbody>@for (consulta of consultas; track consulta.idConsulta) {
                <tr><td>{{ consulta.fechaConsulta | date:'dd/MM/yyyy HH:mm' }}</td><td>ID {{ consulta.idConsulta }}</td><td>ID {{ consulta.idMedico }}</td>
                  <td class="d-flex gap-2 flex-wrap">
                    @if (permisos.puedeConsultar(MODULOS_PERMISO.HISTORIAL)) {
                      <button type="button" class="btn btn-outline-info btn-sm" (click)="verResumen(consulta)">Ver resumen clínico</button>
                      <a [routerLink]="['/historial', paciente.idPaciente, 'consulta', consulta.idConsulta]" class="btn btn-outline-secondary btn-sm">Abrir detalle existente</a>
                    } @else { <span>Sin permiso Historial/Consultar</span> }
                  </td></tr>
              }</tbody>
            </table></div>
            <nav aria-label="Páginas de consultas" class="d-flex justify-content-between align-items-center">
              <span>Total: {{ totalConsultas }} · Página {{ paginaConsultas }} de {{ paginasConsultas }}</span>
              <div class="d-flex gap-2"><button type="button" class="btn btn-outline-secondary btn-sm" (click)="cambiarPaginaConsultas(paginaConsultas - 1)" [disabled]="paginaConsultas <= 1">Anterior</button>
                <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cambiarPaginaConsultas(paginaConsultas + 1)" [disabled]="paginaConsultas >= paginasConsultas">Siguiente</button></div>
            </nav>
          }
          @if (cargandoResumen) { <app-ui-state kind="loading" title="Cargando resumen clínico…" [compact]="true" /> }
          @else if (errorResumen) { <app-ui-state kind="error" title="No fue posible cargar el resumen clínico" [description]="errorResumen" [compact]="true" /> }
          @else if (resumen) {
            <section class="mt-4" aria-labelledby="ficha-resumen"><h3 id="ficha-resumen" class="h6">Resumen de consulta ID {{ resumen.consulta.idConsulta }}</h3>
              <h4 class="h6">Diagnósticos</h4><ul>@for (item of resumen.diagnosticos; track item.idDiagnostico) { <li>{{ item.descripcion }}</li> } @empty { <li>Sin diagnósticos registrados.</li> }</ul>
              <h4 class="h6">Tratamientos</h4><ul>@for (item of resumen.tratamientos; track item.idTratamiento) { <li>{{ item.descripcion }}
                @if (item.indicaciones) { — {{ item.indicaciones }} }</li> } @empty { <li>Sin tratamientos registrados.</li> }</ul>
              <h4 class="h6">Exámenes</h4><ul>@for (item of resumen.examenes; track item.idExamen) { <li>{{ item.nombreExamen }} · Fecha de examen: {{ item.fechaExamen | date:'dd/MM/yyyy' }}
                @if (item.fechaResultado) { · Fecha de resultado: {{ item.fechaResultado }} }</li> } @empty { <li>Sin exámenes asociados.</li> }</ul>
              <p class="small text-muted">El contrato de exámenes no proporciona contenido de resultados; una fecha de resultado no confirma un informe clínico.</p>
              <h4 class="h6">Evolución</h4><ul>@for (item of resumen.evoluciones; track item.idHistorial) { <li>{{ item.descripcion }} · {{ item.fechaHistorial | date:'dd/MM/yyyy HH:mm' }}</li> } @empty { <li>Sin evoluciones registradas.</li> }</ul>
            </section>
          }
        </section>
      }
    </div>
  `,
})
export class PacienteFichaComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly pacientesService = inject(PacientesService);
  private readonly contactosService = inject(ContactosEmergenciaService);
  private readonly historialService = inject(HistorialService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;
  private readonly contexto = new ContextoInventario(['Pacientes', 'ContactosEmergencia', 'Consultas', 'Historial']);
  private solicitudes = new Subscription();
  private solicitudResumen?: Subscription;
  private revision = 0;
  private revisionResumen = 0;
  private rutaId: string | null = null;
  private urlObjeto: string | null = null;

  paciente: PacienteResponse | null = null;
  cargandoPaciente = false; errorPaciente = '';
  fotoUrl: string | null = null; cargandoFoto = false; errorFoto = '';
  contactos: ContactoEmergenciaResponse[] = [];
  paginaContactos = 1; paginasContactos = 0; totalContactos = 0; cargandoContactos = false; errorContactos = '';
  consultas: ConsultaListadoDto[] = [];
  paginaConsultas = 1; paginasConsultas = 0; totalConsultas = 0; cargandoConsultas = false; errorConsultas = '';
  resumen: ResumenClinico | null = null; cargandoResumen = false; errorResumen = '';

  constructor() {
    this.contexto.observar(() => this.cargarFicha());
    this.destroyRef.onDestroy(() => { this.solicitudes.unsubscribe(); this.revocarFoto(); });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.rutaId = params.get('id'); this.cargarFicha();
    });
  }

  get edad(): number | null {
    const valor = this.paciente?.fechaNacimiento;
    if (!valor || !fechaInventarioValida(valor)) return null;
    const hoy = new Date(); const [anio, mes, dia] = valor.split('-').map(Number);
    let edad = hoy.getFullYear() - anio;
    if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)) edad--;
    return edad >= 0 && edad <= 130 ? edad : null;
  }

  dato(valor?: string | null): string { return valor?.trim() || 'No registrado'; }

  cargarFicha(): void {
    this.solicitudResumen?.unsubscribe(); this.solicitudResumen = undefined;
    this.solicitudes.unsubscribe(); this.solicitudes = new Subscription();
    const revision = ++this.revision; ++this.revisionResumen;
    this.paciente = null; this.cargandoPaciente = false; this.errorPaciente = '';
    this.revocarFoto(); this.cargandoFoto = false; this.errorFoto = '';
    this.contactos = []; this.paginaContactos = 1; this.paginasContactos = this.totalContactos = 0; this.cargandoContactos = false; this.errorContactos = '';
    this.consultas = []; this.paginaConsultas = 1; this.paginasConsultas = this.totalConsultas = 0; this.cargandoConsultas = false; this.errorConsultas = '';
    this.resumen = null; this.cargandoResumen = false; this.errorResumen = '';
    const ruta = this.rutaId;
    if (!ruta || !/^[1-9]\d*$/.test(ruta) || !idInventarioValido(Number(ruta))) {
      this.errorPaciente = 'Identificador de paciente inválido.'; return;
    }
    const id = Number(ruta); const clave = this.contexto.clave();
    if (!this.contexto.vigente(clave) || !this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES)) {
      this.errorPaciente = 'No tiene sesión y permiso Pacientes/Consultar vigentes.'; return;
    }
    this.cargandoPaciente = true;
    this.agregar(this.pacientesService.obtener(id).subscribe({
      next: paciente => {
        if (!this.vigente(revision, clave, id)) return;
        if (!paciente || paciente.idPaciente !== id || !paciente.nombres?.trim() || !paciente.apellidos?.trim()) {
          this.errorPaciente = 'La API devolvió un paciente contradictorio.'; this.cargandoPaciente = false; return;
        }
        this.paciente = paciente; this.cargandoPaciente = false;
        if (paciente.urlFoto) this.cargarFoto(id, revision, clave);
        if (this.permisos.puedeConsultar(MODULOS_PERMISO.CONTACTOS_EMERGENCIA)) this.cargarContactos();
        if (this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS)) this.cargarConsultas();
      },
      error: (err: HttpErrorResponse) => {
        if (!this.vigente(revision, clave, id)) return;
        this.cargandoPaciente = false;
        this.errorPaciente = err.status === 404 ? 'Paciente no encontrado.' :
          this.apiErrors.messageFor(err, 'No fue posible consultar el paciente.');
      },
    }));
  }

  private cargarFoto(id: number, revision: number, clave: string): void {
    this.cargandoFoto = true;
    this.agregar(this.pacientesService.obtenerFoto(id).subscribe({
      next: blob => {
        if (!this.vigente(revision, clave, id)) return;
        this.cargandoFoto = false;
        if (!blob || blob.size <= 0 || !['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
          this.errorFoto = 'La fotografía protegida no tiene un formato válido.'; return;
        }
        this.revocarFoto(); this.urlObjeto = URL.createObjectURL(blob); this.fotoUrl = this.urlObjeto;
      },
      error: (err: HttpErrorResponse) => {
        if (!this.vigente(revision, clave, id)) return;
        this.cargandoFoto = false;
        this.errorFoto = err.status === 404 ? 'Sin fotografía registrada.' : this.apiErrors.messageFor(err, 'No fue posible cargar la fotografía protegida.');
      },
    }));
  }

  cargarContactos(): void {
    const id = this.paciente?.idPaciente; const revision = this.revision; const clave = this.contexto.clave();
    const pagina = this.paginaContactos;
    if (!id || !this.vigente(revision, clave, id) || !this.permisos.puedeConsultar(MODULOS_PERMISO.CONTACTOS_EMERGENCIA)) return;
    this.cargandoContactos = true; this.errorContactos = '';
    this.agregar(this.contactosService.listar(id, pagina, 10).subscribe({
      next: res => {
        if (!this.vigente(revision, clave, id) || pagina !== this.paginaContactos) return;
        const paginas = Math.ceil(res.totalCount / 10);
        const esperados = Math.min(10, Math.max(0, res.totalCount - (pagina - 1) * 10));
        if (!Array.isArray(res.items) || res.page !== pagina || res.pageSize !== 10 ||
          !Number.isSafeInteger(res.totalCount) || res.totalCount < 0 || res.totalPages !== paginas || res.items.length !== esperados ||
          res.items.some(c => !idInventarioValido(c.idContacto) || c.idPaciente !== id)) {
          this.contactos = []; this.errorContactos = 'La API devolvió contactos o paginación contradictorios.';
        } else { this.contactos = res.items; this.totalContactos = res.totalCount; this.paginasContactos = paginas; }
        this.cargandoContactos = false;
      },
      error: (err: HttpErrorResponse) => {
        if (!this.vigente(revision, clave, id) || pagina !== this.paginaContactos) return;
        this.contactos = []; this.cargandoContactos = false;
        this.errorContactos = this.apiErrors.messageFor(err, 'No fue posible cargar los contactos.');
      },
    }));
  }

  cambiarPaginaContactos(pagina: number): void {
    if (Number.isInteger(pagina) && pagina > 0 && pagina <= this.paginasContactos && !this.cargandoContactos) {
      this.paginaContactos = pagina; this.cargarContactos();
    }
  }

  cargarConsultas(): void {
    const id = this.paciente?.idPaciente; const revision = this.revision; const clave = this.contexto.clave();
    const pagina = this.paginaConsultas;
    if (!id || !this.vigente(revision, clave, id) || !this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS)) return;
    this.solicitudResumen?.unsubscribe(); this.solicitudResumen = undefined;
    this.cargandoConsultas = true; this.errorConsultas = ''; this.resumen = null; this.cargandoResumen = false; this.errorResumen = ''; ++this.revisionResumen;
    this.agregar(this.historialService.listarConsultas({ idPaciente: id, idMedico: null, idSucursal: null, idClinica: null,
      desde: null, hasta: null, page: pagina, pageSize: 10 }).subscribe({
      next: res => {
        if (!this.vigente(revision, clave, id) || pagina !== this.paginaConsultas) return;
        const paginas = Math.ceil(res.totalCount / 10);
        const esperados = Math.min(10, Math.max(0, res.totalCount - (pagina - 1) * 10));
        if (!Array.isArray(res.items) || res.page !== pagina || res.pageSize !== 10 ||
          !Number.isSafeInteger(res.totalCount) || res.totalCount < 0 || res.totalPages !== paginas || res.items.length !== esperados ||
          res.items.some(c => !idInventarioValido(c.idConsulta) || c.idPaciente !== id)) {
          this.consultas = []; this.errorConsultas = 'La API devolvió consultas o paginación contradictorias.';
        } else { this.consultas = res.items; this.totalConsultas = res.totalCount; this.paginasConsultas = paginas; }
        this.cargandoConsultas = false;
      },
      error: (err: HttpErrorResponse) => {
        if (!this.vigente(revision, clave, id) || pagina !== this.paginaConsultas) return;
        this.consultas = []; this.cargandoConsultas = false;
        this.errorConsultas = this.apiErrors.messageFor(err, 'No fue posible cargar las consultas.');
      },
    }));
  }

  cambiarPaginaConsultas(pagina: number): void {
    if (Number.isInteger(pagina) && pagina > 0 && pagina <= this.paginasConsultas && !this.cargandoConsultas) {
      this.paginaConsultas = pagina; this.cargarConsultas();
    }
  }

  verResumen(consulta: ConsultaListadoDto): void {
    const id = this.paciente?.idPaciente; const revision = this.revision; const clave = this.contexto.clave();
    if (!id || !this.vigente(revision, clave, id) || !this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS) ||
      !this.permisos.puedeConsultar(MODULOS_PERMISO.HISTORIAL) ||
      !this.consultas.some(c => c.idConsulta === consulta.idConsulta && c.idPaciente === id)) return;
    this.solicitudResumen?.unsubscribe();
    const idConsulta = consulta.idConsulta; const revisionResumen = ++this.revisionResumen;
    this.resumen = null; this.errorResumen = ''; this.cargandoResumen = true;
    const diagnosticos$ = cargarCatalogoInventario(
      (page, pageSize) => this.historialService.listarDiagnosticos({ idConsulta, page, pageSize }), d => d.idDiagnostico);
    const tratamientos$ = cargarCatalogoInventario(
      (page, pageSize) => this.historialService.listarTratamientos({ idConsulta, page, pageSize }), t => t.idTratamiento);
    const evoluciones$ = cargarCatalogoInventario(
      (page, pageSize) => this.historialService.listarHistorial({ idConsulta, page, pageSize }), e => e.idHistorial ?? 0);
    const examenesDe = (filtro: { idConsulta?: number; idDiagnostico?: number }) => cargarCatalogoInventario(
      (page: number, pageSize: number) => this.historialService.listarExamenes({ ...filtro, page, pageSize }), e => e.idExamen);
    const lectura = forkJoin({ diagnosticos: diagnosticos$, tratamientos: tratamientos$, evoluciones: evoluciones$ }).pipe(
      switchMap(datos => forkJoin([examenesDe({ idConsulta }),
        ...datos.diagnosticos.map(d => examenesDe({ idDiagnostico: d.idDiagnostico }))]).pipe(
          map(paginas => ({ ...datos, examenes: [...new Map(paginas.flat().map(e => [e.idExamen, e])).values()] })))),
    );
    this.solicitudResumen = lectura.subscribe({
      next: datos => {
        if (!this.vigente(revision, clave, id) || revisionResumen !== this.revisionResumen ||
          !this.consultas.some(c => c.idConsulta === idConsulta && c.idPaciente === id)) return;
        const idsDiagnosticos = new Set(datos.diagnosticos.map(d => d.idDiagnostico));
        if (datos.diagnosticos.some(d => d.idConsulta !== idConsulta) ||
          datos.tratamientos.some(t => t.idConsulta !== idConsulta || t.idPaciente !== id) ||
          datos.evoluciones.some(e => e.idConsulta !== idConsulta || e.idPaciente !== id) ||
          datos.examenes.some(e => e.idPaciente !== id ||
            (e.idConsulta !== null && e.idConsulta !== idConsulta) ||
            (e.idDiagnostico !== null && !idsDiagnosticos.has(e.idDiagnostico)) ||
            (e.idConsulta === null && e.idDiagnostico === null))) {
          this.errorResumen = 'La API devolvió información clínica ajena o contradictoria.';
        } else this.resumen = { consulta, ...datos };
        this.cargandoResumen = false;
      },
      error: (err: unknown) => {
        if (!this.vigente(revision, clave, id) || revisionResumen !== this.revisionResumen) return;
        this.cargandoResumen = false;
        this.errorResumen = err instanceof HttpErrorResponse ?
          this.apiErrors.messageFor(err, 'No fue posible cargar el resumen clínico.') :
          'La API devolvió paginación clínica contradictoria.';
      },
    });
    this.agregar(this.solicitudResumen);
  }

  private agregar(solicitud: Subscription): void { this.solicitudes.add(solicitud); this.contexto.agregar(solicitud); }
  private vigente(revision: number, clave: string, id: number): boolean {
    return revision === this.revision && this.contexto.vigente(clave) &&
      this.rutaId === String(id) && this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES);
  }
  private revocarFoto(): void { if (this.urlObjeto) URL.revokeObjectURL(this.urlObjeto); this.urlObjeto = this.fotoUrl = null; }
}
