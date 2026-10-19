import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HabitacionesService } from '../../core/services/habitaciones.service';
import { HabitacionResponse, ESTADOS_HABITACION } from '../../core/models/habitacion.model';
import { AsignarPacienteModalComponent } from './asignar-paciente-modal.component';
import { RegistrarEgresoModalComponent } from './registrar-egreso-modal.component';
import { CrearHabitacionModalComponent } from './crear-habitacion-modal.component';

@Component({
  selector: 'app-habitaciones-board',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AsignarPacienteModalComponent,
    RegistrarEgresoModalComponent,
    CrearHabitacionModalComponent
  ],
  template: `
    <div class="container-fluid mt-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2><i class="fa fa-bed"></i> Tablero de Habitaciones</h2>
        <button class="btn btn-primary" (click)="mostrarModalCrear = true">
          <i class="fa fa-plus"></i> Nueva Habitación
        </button>
      </div>

      <!-- Leyenda de estados -->
      <div class="d-flex gap-3 mb-4 flex-wrap">
        <span class="badge bg-success p-2">Libre</span>
        <span class="badge bg-danger p-2">Ocupada</span>
        <span class="badge bg-warning text-dark p-2">En limpieza</span>
      </div>

      @if (cargando) {
        <div class="text-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>
      } @else if (habitaciones.length === 0) {
        <div class="alert alert-info text-center">No hay habitaciones registradas.</div>
      } @else {
        <div class="row g-3">
          @for (hab of habitaciones; track hab.idHabitacion) {
            <div class="col-md-3 col-sm-6">
              <div class="card h-100 shadow-sm" [ngClass]="getCardClass(hab.estado)">
                <div class="card-body">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <h5 class="card-title mb-0">Hab. {{ hab.numeroHabitacion }}</h5>
                    <span class="badge" [ngClass]="getBadgeClass(hab.estado)">
                      {{ hab.estado }}
                    </span>
                  </div>
                  <p class="card-text text-muted small mb-1">
                    <i class="fa fa-tag"></i> {{ hab.tipoHabitacion || 'Sin tipo' }}
                  </p>
                  <p class="card-text text-muted small">
                    <i class="fa fa-building"></i> Sucursal: {{ hab.idSucursal }}
                  </p>
                </div>
                <div class="card-footer bg-transparent border-0 d-flex gap-1 flex-wrap">
                  @if (hab.estado === ESTADOS_HABITACION.LIBRE && hab.activa) {
                    <button class="btn btn-sm btn-success flex-fill" (click)="abrirModalAsignar(hab)">
                      <i class="fa fa-user-plus"></i> Asignar
                    </button>
                  } @else if (hab.estado === ESTADOS_HABITACION.OCUPADA) {
                    <button class="btn btn-sm btn-warning flex-fill" (click)="abrirModalEgreso(hab)">
                      <i class="fa fa-sign-out"></i> Egreso
                    </button>
                  } @else if (hab.estado === ESTADOS_HABITACION.EN_LIMPIEZA) {
                    <button class="btn btn-sm btn-success flex-fill" (click)="cambiarEstado(hab, 'Libre')">
                      <i class="fa fa-check"></i> Libre
                    </button>
                  }
                  <button class="btn btn-sm btn-outline-secondary" (click)="verDetalles(hab)">
                    <i class="fa fa-eye"></i>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Modal Asignar Paciente -->
    @if (habitacionSeleccionada) {
      <app-asignar-paciente-modal
        [habitacion]="habitacionSeleccionada"
        (cerrar)="habitacionSeleccionada = null"
        (asignado)="onAsignacionExitosa()">
      </app-asignar-paciente-modal>
    }

    <!-- Modal Registrar Egreso -->
    @if (habitacionParaEgreso) {
      <app-registrar-egreso-modal
        [habitacion]="habitacionParaEgreso"
        (cerrar)="habitacionParaEgreso = null"
        (egresado)="onEgresoExitoso()">
      </app-registrar-egreso-modal>
    }

    <!-- Modal Crear Habitación -->
    @if (mostrarModalCrear) {
      <app-crear-habitacion-modal
        (cerrar)="mostrarModalCrear = false"
        (creada)="onHabitacionCreada()">
      </app-crear-habitacion-modal>
    }
  `,
  styles: [`
    .card { transition: all 0.3s ease; cursor: pointer; }
    .card:hover { transform: translateY(-3px); }
    .bg-libre { border-left: 5px solid #198754; }
    .bg-ocupada { border-left: 5px solid #dc3545; }
    .bg-limpieza { border-left: 5px solid #ffc107; }
  `]
})
export class HabitacionesBoardComponent implements OnInit {
  private service = inject(HabitacionesService);

  habitaciones: HabitacionResponse[] = [];
  cargando = false;
  habitacionSeleccionada: HabitacionResponse | null = null;
  habitacionParaEgreso: HabitacionResponse | null = null;
  mostrarModalCrear = false;

  ESTADOS_HABITACION = ESTADOS_HABITACION;

  ngOnInit() {
    this.cargar();
    // Suscribirse a actualizaciones en tiempo real
    this.service.habitaciones$.subscribe(habs => {
      if (habs.length > 0) this.habitaciones = habs;
    });
  }

  cargar() {
    this.cargando = true;
    this.service.cargarHabitaciones().subscribe({
      next: (res) => {
        this.habitaciones = res.items;
        this.cargando = false;
      },
      error: () => { this.cargando = false; }
    });
  }

  getCardClass(estado: string): string {
    const map: Record<string, string> = {
      'Libre': 'bg-libre',
      'Ocupada': 'bg-ocupada',
      'En limpieza': 'bg-limpieza'
    };
    return map[estado] || '';
  }

  getBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      'Libre': 'bg-success',
      'Ocupada': 'bg-danger',
      'En limpieza': 'bg-warning text-dark'
    };
    return map[estado] || 'bg-info';
  }

  abrirModalAsignar(hab: HabitacionResponse) {
    this.habitacionSeleccionada = hab;
  }

  abrirModalEgreso(hab: HabitacionResponse) {
    this.habitacionParaEgreso = hab;
  }

  cambiarEstado(hab: HabitacionResponse, nuevoEstado: string) {
    if (confirm(`¿Cambiar estado de Habitación ${hab.numeroHabitacion} a "${nuevoEstado}"?`)) {
      this.service.actualizarHabitacion(hab.idHabitacion, {
        idSucursal: hab.idSucursal,
        numeroHabitacion: hab.numeroHabitacion,
        tipoHabitacion: hab.tipoHabitacion,
        estado: nuevoEstado
      }).subscribe({
        next: () => this.cargar(),
        error: () => alert('Error al cambiar el estado')
      });
    }
  }

  onAsignacionExitosa() {
    this.habitacionSeleccionada = null;
    this.cargar();
  }

  onEgresoExitoso() {
    this.habitacionParaEgreso = null;
    this.cargar();
  }

  onHabitacionCreada() {
    this.mostrarModalCrear = false;
    this.cargar();
  }

  verDetalles(hab: HabitacionResponse) {
    alert(`Detalles de Habitación ${hab.numeroHabitacion}\nTipo: ${hab.tipoHabitacion}\nEstado: ${hab.estado}\nSucursal: ${hab.idSucursal}`);
  }
}