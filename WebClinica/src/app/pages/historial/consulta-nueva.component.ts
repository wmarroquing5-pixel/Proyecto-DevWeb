import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HistorialService } from '../../core/services/historial.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { ConsultaCreateDto, ConsultaDetalleDto } from '../../core/models/historial.model';
import { Sucursal } from '../../core/models/catalogos.model';

@Component({
  selector: 'app-consulta-nueva',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container mt-4">
      <h2>Nueva Consulta Médica</h2>
      <p class="text-muted">Paciente ID: {{ idPaciente }}</p>

      @if (error) { <div class="alert alert-danger">{{ error }}</div> }

      <form (ngSubmit)="guardar()" class="card p-4 shadow-sm">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Sucursal *</label>
            <select class="form-select" [(ngModel)]="form.idSucursal" name="idSucursal" required>
              <option [ngValue]="null">Seleccione...</option>
              @for (s of sucursales; track s.idSucursal) {
                <option [ngValue]="s.idSucursal">{{ s.nombre }}</option>
              }
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Fecha de Consulta *</label>
            <input type="datetime-local" class="form-control" [(ngModel)]="form.fechaConsulta" name="fechaConsulta" required>
          </div>

          <div class="col-12">
            <label class="form-label">Motivo de Consulta</label>
            <textarea class="form-control" rows="2" [(ngModel)]="form.motivoConsulta" name="motivoConsulta" maxlength="300"></textarea>
          </div>
          <div class="col-12">
            <label class="form-label">Síntomas</label>
            <textarea class="form-control" rows="2" [(ngModel)]="form.sintomas" name="sintomas" maxlength="300"></textarea>
          </div>
          <div class="col-12">
            <label class="form-label">Observaciones</label>
            <textarea class="form-control" rows="2" [(ngModel)]="form.observaciones" name="observaciones" maxlength="300"></textarea>
          </div>

          <div class="col-md-3">
            <label class="form-label">Peso (lb)</label>
            <input type="number" step="0.1" class="form-control" [(ngModel)]="form.pesoLb" name="pesoLb">
          </div>
          <div class="col-md-3">
            <label class="form-label">Altura (cm)</label>
            <input type="number" class="form-control" [(ngModel)]="form.alturaCm" name="alturaCm">
          </div>
          <div class="col-md-3">
            <label class="form-label">Presión Sistólica</label>
            <input type="number" class="form-control" [(ngModel)]="form.presionSistolica" name="presionSistolica">
          </div>
          <div class="col-md-3">
            <label class="form-label">Presión Diastólica</label>
            <input type="number" class="form-control" [(ngModel)]="form.presionDiastolica" name="presionDiastolica">
          </div>
        </div>

        <div class="d-flex gap-2 mt-4">
          <button type="submit" class="btn btn-success" [disabled]="cargando">
            {{ cargando ? 'Guardando...' : 'Guardar Consulta' }}
          </button>
          <a [routerLink]="['/historial', idPaciente]" class="btn btn-secondary">Cancelar</a>
        </div>
      </form>
    </div>
  `
})
export class ConsultaNuevaComponent implements OnInit {
  private service = inject(HistorialService);
  private catalogosService = inject(CatalogosService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  idPaciente!: number;
  cargando = false;
  error = '';
  sucursales: Sucursal[] = [];

  form: ConsultaCreateDto = {
    idPaciente: 0,
    idMedico: null,
    idSucursal: 0,
    idClinica: null,
    fechaConsulta: '',
    motivoConsulta: null,
    sintomas: null,
    observaciones: null,
    pesoLb: null,
    presionDiastolica: null,
    presionSistolica: null,
    alturaCm: null
  };

  ngOnInit() {
    const paramId = this.route.snapshot.paramMap.get('id');
    if (!paramId) { this.error = 'No se especificó un paciente'; return; }
    this.idPaciente = +paramId;
    this.form.idPaciente = this.idPaciente;

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    this.form.fechaConsulta = now.toISOString().slice(0, 16);

    this.catalogosService.getSucursales().subscribe({
      next: (data) => this.sucursales = data,
      error: () => console.error('Error cargando sucursales')
    });
  }

  guardar() {
    this.cargando = true;
    this.error = '';
    this.service.crearConsulta(this.form).subscribe({
      next: (res: ConsultaDetalleDto) => {
        this.router.navigate(['/historial', this.idPaciente, 'consulta', res.idConsulta]);
      },
      error: (err) => {
        this.error = err.error?.message || 'Error al crear la consulta';
        this.cargando = false;
      }
    });
  }
}