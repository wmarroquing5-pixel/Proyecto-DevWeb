import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HistorialService } from '../../core/services/historial.service';
import {
  ConsultaDetalleDto,
  DiagnosticoResponse, CrearDiagnosticoRequest,
  HistorialMedicoResponseDto, HistorialMedicoCreateDto,
  TratamientoResponseDto, TratamientoCreateDto,
  ExamenResponseDto, ExamenCreateDto
} from '../../core/models/historial.model';

@Component({
  selector: 'app-consulta-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container mt-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2>Detalle de Consulta #{{ idConsulta }}</h2>
        <a [routerLink]="['/historial', idPaciente]" class="btn btn-secondary">
          <i class="fa fa-arrow-left"></i> Volver
        </a>
      </div>

      @if (cargando) {
        <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
      } @else if (error) {
        <div class="alert alert-danger">{{ error }}</div>
      } @else if (consulta) {
        <!-- Info general -->
        <div class="card mb-4">
          <div class="card-body">
            <div class="row">
              <div class="col-md-3"><strong>Fecha:</strong><br>{{ consulta.fechaConsulta | date:'dd/MM/yyyy HH:mm' }}</div>
              <div class="col-md-3"><strong>Médico:</strong><br>{{ consulta.idMedico }}</div>
              <div class="col-md-3"><strong>Sucursal:</strong><br>{{ consulta.idSucursal }}</div>
              <div class="col-md-3"><strong>Paciente:</strong><br>{{ idPaciente }}</div>
            </div>
            @if (consulta.motivoConsulta) { <p class="mt-3"><strong>Motivo:</strong> {{ consulta.motivoConsulta }}</p> }
            @if (consulta.sintomas) { <p><strong>Síntomas:</strong> {{ consulta.sintomas }}</p> }
            @if (consulta.observaciones) { <p><strong>Observaciones:</strong> {{ consulta.observaciones }}</p> }
            <div class="row mt-3">
              @if (consulta.pesoLb) { <div class="col"><strong>Peso:</strong> {{ consulta.pesoLb }} lb</div> }
              @if (consulta.alturaCm) { <div class="col"><strong>Altura:</strong> {{ consulta.alturaCm }} cm</div> }
              @if (consulta.presionSistolica) { <div class="col"><strong>PA:</strong> {{ consulta.presionSistolica }}/{{ consulta.presionDiastolica }}</div> }
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <ul class="nav nav-tabs">
          <li class="nav-item"><button class="nav-link" [class.active]="tab==='diagnosticos'" (click)="tab='diagnosticos'">Diagnósticos</button></li>
          <li class="nav-item"><button class="nav-link" [class.active]="tab==='tratamientos'" (click)="tab='tratamientos'">Tratamientos</button></li>
          <li class="nav-item"><button class="nav-link" [class.active]="tab==='examenes'" (click)="tab='examenes'">Exámenes</button></li>
          <li class="nav-item"><button class="nav-link" [class.active]="tab==='evoluciones'" (click)="tab='evoluciones'">Evoluciones</button></li>
        </ul>

        <!-- DIAGNÓSTICOS -->
        @if (tab === 'diagnosticos') {
          <div class="card p-3 mt-3">
            <h4>Diagnósticos</h4>
            <form (ngSubmit)="agregarDiagnostico()" class="row g-2 mb-3">
              <div class="col-md-9">
                <textarea class="form-control" [(ngModel)]="nuevoDiag.descripcion" name="descripcion" placeholder="Descripción del diagnóstico" required></textarea>
              </div>
              <div class="col-md-3">
                <button type="submit" class="btn btn-primary w-100" [disabled]="!nuevoDiag.descripcion">Agregar</button>
              </div>
            </form>
            @for (d of diagnosticos; track d.idDiagnostico) {
              <div class="border-bottom py-2">
                <strong>#{{ d.idDiagnostico }}</strong> - {{ d.descripcion }}
                <small class="text-muted ms-2">{{ d.fechaRegistro | date:'dd/MM/yyyy HH:mm' }}</small>
              </div>
            }
          </div>
        }

        <!-- TRATAMIENTOS -->
        @if (tab === 'tratamientos') {
          <div class="card p-3 mt-3">
            <h4>Tratamientos</h4>
            <form (ngSubmit)="agregarTratamiento()" class="row g-2 mb-3">
              <div class="col-md-6"><textarea class="form-control" [(ngModel)]="nuevoTrat.descripcion" name="descripcion" placeholder="Descripción" required></textarea></div>
              <div class="col-md-3"><input type="date" class="form-control" [(ngModel)]="nuevoTrat.fechaInicio" name="fechaInicio" required></div>
              <div class="col-md-3"><button type="submit" class="btn btn-primary w-100">Agregar</button></div>
            </form>
            @for (t of tratamientos; track t.idTratamiento) {
              <div class="border-bottom py-2">
                <strong>#{{ t.idTratamiento }}</strong> - {{ t.descripcion }}
                <small class="text-muted ms-2">({{ t.fechaInicio }} {{ t.fechaFin ? 'hasta ' + t.fechaFin : '' }})</small>
              </div>
            }
          </div>
        }

        <!-- EXÁMENES -->
        @if (tab === 'examenes') {
          <div class="card p-3 mt-3">
            <h4>Exámenes</h4>
            <form (ngSubmit)="agregarExamen()" class="row g-2 mb-3">
              <div class="col-md-6"><input type="text" class="form-control" [(ngModel)]="nuevoExamen.nombreExamen" name="nombreExamen" placeholder="Nombre del examen" required></div>
              <div class="col-md-3"><input type="datetime-local" class="form-control" [(ngModel)]="nuevoExamen.fechaExamen" name="fechaExamen" required></div>
              <div class="col-md-3"><button type="submit" class="btn btn-primary w-100">Agregar</button></div>
            </form>
            @for (e of examenes; track e.idExamen) {
              <div class="border-bottom py-2">
                <strong>#{{ e.idExamen }}</strong> - {{ e.nombreExamen }}
                <small class="text-muted ms-2">{{ e.fechaExamen | date:'dd/MM/yyyy HH:mm' }}</small>
                @if (e.prioridad) { <span class="badge ms-2" [class.bg-danger]="e.prioridad==='Alta'" [class.bg-warning]="e.prioridad==='Media'" [class.bg-success]="e.prioridad==='Baja'">{{ e.prioridad }}</span> }
              </div>
            }
          </div>
        }

        <!-- EVOLUCIONES -->
        @if (tab === 'evoluciones') {
          <div class="card p-3 mt-3">
            <h4>Evoluciones</h4>
            @if (diagnosticos.length === 0) {
              <div class="alert alert-warning">Debes crear al menos un diagnóstico antes de agregar evoluciones.</div>
            } @else {
              <form (ngSubmit)="agregarEvolucion()" class="row g-2 mb-3">
                <div class="col-md-4">
                  <select class="form-select" [(ngModel)]="nuevaEvol.idDiagnostico" name="idDiagnostico" required>
                    <option [ngValue]="null">Seleccione diagnóstico...</option>
                    @for (d of diagnosticos; track d.idDiagnostico) {
                      <option [ngValue]="d.idDiagnostico">#{{ d.idDiagnostico }} - {{ d.descripcion | slice:0:50 }}</option>
                    }
                  </select>
                </div>
                <div class="col-md-6"><textarea class="form-control" [(ngModel)]="nuevaEvol.descripcion" name="descripcion" placeholder="Descripción de la evolución" required></textarea></div>
                <div class="col-md-2"><button type="submit" class="btn btn-primary w-100">Agregar</button></div>
              </form>
            }
            @for (h of evoluciones; track h.idHistorial) {
              <div class="border-bottom py-2">
                <strong>#{{ h.idHistorial }}</strong> - {{ h.descripcion }}
                <small class="text-muted ms-2">{{ h.fechaEvolucion | date:'dd/MM/yyyy HH:mm' }}</small>
              </div>
            }
          </div>
        }
      }
    </div>
  `
})
export class ConsultaDetalleComponent implements OnInit {
  private service = inject(HistorialService);
  private route = inject(ActivatedRoute);

  idPaciente!: number;
  idConsulta!: number;
  consulta: ConsultaDetalleDto | null = null;
  cargando = false;
  error = '';
  tab: 'diagnosticos' | 'tratamientos' | 'examenes' | 'evoluciones' = 'diagnosticos';

  diagnosticos: DiagnosticoResponse[] = [];
  tratamientos: TratamientoResponseDto[] = [];
  examenes: ExamenResponseDto[] = [];
  evoluciones: HistorialMedicoResponseDto[] = [];

  nuevoDiag: CrearDiagnosticoRequest = { idConsulta: 0, idMedico: null, descripcion: '' };
  nuevoTrat: TratamientoCreateDto = { idConsulta: 0, descripcion: '', indicaciones: null, fechaInicio: '', fechaFin: null, idLote: null, cantidad: null };
  nuevoExamen: ExamenCreateDto = { idConsulta: null, idDiagnostico: null, idTurno: null, nombreExamen: '', fechaExamen: '', fechaResultado: null, prioridad: null };
  nuevaEvol: HistorialMedicoCreateDto = { idPaciente: 0, idConsulta: 0, idDiagnostico: null, descripcion: '' };

  ngOnInit() {
    this.idPaciente = +this.route.snapshot.paramMap.get('id')!;
    this.idConsulta = +this.route.snapshot.paramMap.get('idConsulta')!;
    this.nuevoDiag.idConsulta = this.idConsulta;
    this.nuevoTrat.idConsulta = this.idConsulta;
    this.nuevoExamen.idConsulta = this.idConsulta;
    this.nuevaEvol.idPaciente = this.idPaciente;
    this.nuevaEvol.idConsulta = this.idConsulta;
    this.cargarTodo();
  }

  cargarTodo() {
    this.cargando = true;
    this.service.obtenerConsulta(this.idConsulta).subscribe({
      next: (c) => {
        this.consulta = c;
        this.cargarSecciones();
      },
      error: () => { this.error = 'No se pudo cargar la consulta'; this.cargando = false; }
    });
  }

  cargarSecciones() {
    this.service.listarDiagnosticos({ idConsulta: this.idConsulta, page: 1, pageSize: 100 }).subscribe(r => this.diagnosticos = r.items);
    this.service.listarTratamientos({ idConsulta: this.idConsulta, page: 1, pageSize: 100 }).subscribe(r => this.tratamientos = r.items);
    this.service.listarExamenes({ idConsulta: this.idConsulta, page: 1, pageSize: 100 }).subscribe(r => this.examenes = r.items);
    this.service.listarHistorial({ idConsulta: this.idConsulta, page: 1, pageSize: 100 }).subscribe(r => {
      this.evoluciones = r.items;
      this.cargando = false;
    });
  }

  agregarDiagnostico() {
    this.service.crearDiagnostico(this.nuevoDiag).subscribe({
      next: () => { this.nuevoDiag.descripcion = ''; this.cargarSecciones(); },
      error: (e) => alert(e.error?.message || 'Error al crear diagnóstico')
    });
  }

  agregarTratamiento() {
    this.service.crearTratamiento(this.nuevoTrat).subscribe({
      next: () => { this.nuevoTrat.descripcion = ''; this.nuevoTrat.fechaInicio = ''; this.cargarSecciones(); },
      error: (e) => alert(e.error?.message || 'Error al crear tratamiento')
    });
  }

  agregarExamen() {
    this.service.crearExamen(this.nuevoExamen).subscribe({
      next: () => { this.nuevoExamen.nombreExamen = ''; this.nuevoExamen.fechaExamen = ''; this.cargarSecciones(); },
      error: (e) => alert(e.error?.message || 'Error al crear examen')
    });
  }

  agregarEvolucion() {
    this.service.crearEvolucion(this.nuevaEvol).subscribe({
      next: () => { this.nuevaEvol.descripcion = ''; this.nuevaEvol.idDiagnostico = null; this.cargarSecciones(); },
      error: (e) => alert(e.error?.message || 'Error al crear evolución')
    });
  }
}