import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PacienteService } from '../../core/services/paciente.service';
import { HistorialClinicoService } from '../../core/services/historial-clinico.service';
import { InventarioService } from '../../core/services/inventario.service';
import {
  CatalogoMedico,
  CatalogoSucursal,
  Consulta,
  Evolucion,
  Examen,
  FichaHistorial,
} from '../../core/models/paciente.model';

/**
 * Módulo **Historial clínico del paciente** (ficha por paciente).
 *  i.   Registro de consultas médicas, diagnósticos y tratamientos.
 *  ii.  Exámenes realizados por paciente (resultados y fecha).
 *  iii. Diagnósticos asignados por los médicos (edición/corrección).
 *  iv.  Evolución del paciente (seguimiento médico).
 * Lectura desde GET /api/HistorialClinico/{idPaciente} (FichaHistorial),
 * que agrega Consulta + Diagnostico + Tratamiento + Examen + Evolucion
 * + AsignacionHabitacion según el script SQL.
 */
@Component({
  selector: 'app-paciente-historial',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './paciente-historial.component.html',
  styleUrl: './paciente-historial.component.css',
})
export class PacienteHistorialComponent implements OnInit {
  private svc = inject(PacienteService);
  private hc = inject(HistorialClinicoService);
  private inv = inject(InventarioService);
  private route = inject(ActivatedRoute);

  readonly ficha = signal<FichaHistorial | null>(null);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');

  /** Pestaña activa de la ficha clínica */
  tab: 'resumen' | 'consultas' | 'examenes' | 'tratamientos' | 'evoluciones' = 'resumen';

  /* --- Catálogos para registrar consulta/diagnóstico/tratamiento/examen/evolución --- */
  medicos: CatalogoMedico[] = [];
  sucursales: CatalogoSucursal[] = [];
  medicamentos: { idMedicamento: number; nombre: string; stockTotal: number }[] = [];

  /* --- Modal nueva consulta (inciso i) --- */
  modalConsulta = false;
  guardando = false;
  hoyIso = new Date().toISOString().slice(0, 10);
  formConsulta = this.consultaVacia();

  /* --- Modal diagnóstico / tratamiento (vinculados a una consulta) --- */
  modalClinico: 'diagnostico' | 'tratamiento' | null = null;
  consultaSel: Consulta | null = null;
  formDiagnostico = { descripcion: '' };
  formTratamiento = {
    descripcion: '', indicaciones: '',
    fechaInicio: this.hoyIso, fechaFin: '',
    // Receta rápida: medicamento del inventario (no descuenta stock aquí;
    // la salida real se registra en Inventario → Movimientos).
    medicamentoId: '' as number | '',
  };

  /* --- Modal examen (inciso ii) --- */
  modalExamen = false;
  formExamen = this.examenVacio();

  /* --- Modal evolución (inciso iv) --- */
  modalEvolucion = false;
  formEvolucion = this.evolucionVacia();

  /* --- Edición de diagnóstico asignado (inciso iii) --- */
  editandoDx: number | null = null;
  formEditDx = { descripcion: '' };

  /* --- Captura de resultado de un examen existente (inciso ii) --- */
  editandoExam: number | null = null;
  formEditExam = { resultado: '' };

  readonly totalRegistros = computed(() => {
    const h = this.ficha();
    if (!h) return 0;
    return h.consultas.length + h.tratamientos.length + h.diagnosticos.length +
           h.evoluciones.length + h.examenes.length;
  });

  /** Tratamientos sin fecha de fin o con fecha de fin futura */
  readonly tratamientosVigentes = computed(
    () => (this.ficha()?.tratamientos ?? []).filter(t => !t.fechaFin || t.fechaFin >= this.hoyIso).length,
  );

  iniciales(p: { nombres: string; apellidos: string }): string {
    return `${p.nombres[0] ?? ''}${p.apellidos[0] ?? ''}`.toUpperCase();
  }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.cargar(id);
    this.hc.catalogosMedicos().subscribe(m => (this.medicos = m));
    this.svc.catalogosSucursales().subscribe(s => (this.sucursales = s));
    // Catálogo de medicamentos para la receta rápida del tratamiento (módulo Inventario)
    this.inv.listarMedicamentos().subscribe(lista => {
      this.medicamentos = lista.map(x => ({
        idMedicamento: x.idMedicamento,
        nombre: x.nombre,
        stockTotal: x.lotes.reduce((s, l) => s + l.cantidadDisponible, 0),
      }));
    });
  }

  cargar(id: number): void {
    this.cargando.set(true);
    this.error.set('');
    this.hc.ficha(id).subscribe({
      next: f => this.ficha.set(f),
      error: () => this.error.set('No se pudo cargar el historial del paciente.'),
      complete: () => this.cargando.set(false),
    });
  }

  cambiarTab(t: typeof this.tab): void {
    this.tab = t;
  }

  /* ==================== i. CONSULTAS MÉDICAS ==================== */

  abrirConsulta(): void {
    this.formConsulta = this.consultaVacia();
    this.aviso.set('');
    this.modalConsulta = true;
  }

  guardarConsulta(): void {
    const h = this.ficha();
    const f = this.formConsulta;
    if (!h || !f.idMedico || !f.idSucursal || !f.fechaConsulta) {
      this.aviso.set('Médico, sucursal y fecha de la consulta son obligatorios.');
      return;
    }
    this.guardando = true;
    this.hc.registrarConsulta(h.paciente.idPaciente, {
      idMedico: Number(f.idMedico),
      idSucursal: Number(f.idSucursal),
      fechaConsulta: new Date(f.fechaConsulta).toISOString(),
      motivoConsulta: f.motivoConsulta,
      sintomas: f.sintomas,
      observaciones: f.observaciones,
    }).subscribe({
      next: c => {
        this.modalConsulta = false;
        this.aviso.set(`Consulta #${c.idConsulta} registrada. Ahora puede añadir su diagnóstico o tratamiento.`);
        this.cargar(h.paciente.idPaciente);
      },
      error: () => this.aviso.set('Error al registrar la consulta.'),
      complete: () => (this.guardando = false),
    });
  }

  /* ============ i + iii. DIAGNÓSTICO / TRATAMIENTO ============ */

  abrirDiagnostico(c: Consulta): void {
    this.consultaSel = c;
    this.formDiagnostico = { descripcion: '' };
    this.aviso.set('');
    this.modalClinico = 'diagnostico';
  }

  abrirTratamiento(c: Consulta): void {
    this.consultaSel = c;
    this.formTratamiento = {
      descripcion: '', indicaciones: '',
      fechaInicio: this.hoyIso, fechaFin: '', medicamentoId: '',
    };
    this.aviso.set('');
    this.modalClinico = 'tratamiento';
  }

  cerrarModalClinico(): void {
    this.modalClinico = null;
    this.consultaSel = null;
  }

  /** Pre-rellena la descripción al elegir un medicamento del inventario */
  onMedicamentoSel(): void {
    const med = this.medicamentos.find(m => m.idMedicamento === Number(this.formTratamiento.medicamentoId));
    if (med && !this.formTratamiento.descripcion.trim()) {
      this.formTratamiento.descripcion = `${med.nombre} — indicar dosis y frecuencia`;
    }
  }

  guardarDiagnostico(): void {
    const h = this.ficha();
    const c = this.consultaSel;
    if (!h || !c || !this.formDiagnostico.descripcion.trim()) {
      this.aviso.set('La descripción del diagnóstico es obligatoria (NOT NULL).');
      return;
    }
    this.guardando = true;
    this.hc.registrarDiagnostico(h.paciente.idPaciente, {
      idConsulta: c.idConsulta,
      idMedico: c.idMedico,
      descripcion: this.formDiagnostico.descripcion.trim(),
    }).subscribe({
      next: d => {
        this.cerrarModalClinico();
        this.aviso.set(`Diagnóstico #${d.idDiagnostico} registrado en la consulta #${c.idConsulta}.`);
        this.cargar(h.paciente.idPaciente);
      },
      error: () => this.aviso.set('Error al registrar el diagnóstico.'),
      complete: () => (this.guardando = false),
    });
  }

  /** iii. Corrección de un diagnóstico ya asignado por el médico */
  abrirEdicionDx(d: { idDiagnostico: number; descripcion: string }): void {
    this.editandoDx = d.idDiagnostico;
    this.formEditDx = { descripcion: d.descripcion };
    this.aviso.set('');
  }

  cancelarEdicionDx(): void {
    this.editandoDx = null;
  }

  guardarEdicionDx(): void {
    const h = this.ficha();
    if (!h || this.editandoDx === null) return;
    if (!this.formEditDx.descripcion.trim()) {
      this.aviso.set('El diagnóstico no puede quedar vacío (Descripcion NOT NULL).');
      return;
    }
    this.guardando = true;
    this.hc.actualizarDiagnostico(this.editandoDx, { descripcion: this.formEditDx.descripcion.trim() })
      .subscribe({
        next: () => {
          this.editandoDx = null;
          this.aviso.set('Diagnóstico actualizado correctamente.');
          this.cargar(h.paciente.idPaciente);
        },
        error: () => this.aviso.set('Error al actualizar el diagnóstico.'),
        complete: () => (this.guardando = false),
      });
  }

  guardarTratamiento(): void {
    const h = this.ficha();
    const c = this.consultaSel;
    if (!h || !c || !this.formTratamiento.descripcion.trim()) {
      this.aviso.set('La descripción del tratamiento es obligatoria (NOT NULL).');
      return;
    }
    if (this.formTratamiento.fechaFin && this.formTratamiento.fechaFin < this.formTratamiento.fechaInicio) {
      this.aviso.set('La fecha de fin no puede ser anterior a la fecha de inicio.');
      return;
    }
    this.guardando = true;
    this.hc.registrarTratamiento(h.paciente.idPaciente, {
      idConsulta: c.idConsulta,
      idMedico: c.idMedico,
      descripcion: this.formTratamiento.descripcion.trim(),
      indicaciones: this.formTratamiento.indicaciones.trim(),
      fechaInicio: this.formTratamiento.fechaInicio,
      fechaFin: this.formTratamiento.fechaFin,
    }).subscribe({
      next: t => {
        this.cerrarModalClinico();
        this.aviso.set(`Tratamiento #${t.idTratamiento} vinculado a la consulta #${c.idConsulta}.`);
        this.cargar(h.paciente.idPaciente);
      },
      error: () => this.aviso.set('Error al registrar el tratamiento.'),
      complete: () => (this.guardando = false),
    });
  }

  /* =============== ii. EXÁMENES (resultados y fecha) =============== */

  abrirExamen(): void {
    const h = this.ficha();
    if (!h) return;
    this.formExamen = this.examenVacio();
    this.aviso.set('');
    this.modalExamen = true;
  }

  guardarExamen(): void {
    const h = this.ficha();
    const f = this.formExamen;
    if (!h || !f.nombreExamen.trim() || !f.idMedico || !f.fechaExamen) {
      this.aviso.set('Nombre del examen, médico ordenante y fecha son obligatorios.');
      return;
    }
    this.guardando = true;
    this.hc.registrarExamen({
      idPaciente: h.paciente.idPaciente,
      idConsulta: f.idConsulta ? Number(f.idConsulta) : null,
      idMedico: Number(f.idMedico),
      nombreExamen: f.nombreExamen.trim(),
      fechaExamen: new Date(f.fechaExamen).toISOString(),
      resultado: f.resultado.trim(),
    }).subscribe({
      next: e => {
        this.modalExamen = false;
        this.aviso.set(`Examen «${e.nombreExamen}» registrado (${this.fmtFechaHora(e.fechaExamen)}).`);
        this.cargar(h.paciente.idPaciente);
      },
      error: () => this.aviso.set('Error al registrar el examen.'),
      complete: () => (this.guardando = false),
    });
  }

  /** Captura posterior del resultado de un examen ya realizado */
  abrirResultadoExam(e: Examen): void {
    this.editandoExam = e.idExamen;
    this.formEditExam = { resultado: e.resultado ?? '' };
    this.aviso.set('');
  }

  cancelarResultadoExam(): void {
    this.editandoExam = null;
  }

  guardarResultadoExam(): void {
    const h = this.ficha();
    if (!h || this.editandoExam === null) return;
    this.guardando = true;
    this.hc.actualizarExamen(this.editandoExam, { resultado: this.formEditExam.resultado.trim() })
      .subscribe({
        next: () => {
          this.editandoExam = null;
          this.aviso.set('Resultado del examen capturado.');
          this.cargar(h.paciente.idPaciente);
        },
        error: () => this.aviso.set('Error al guardar el resultado.'),
        complete: () => (this.guardando = false),
      });
  }

  /* ============== iv. EVOLUCIÓN (seguimiento médico) ============== */

  abrirEvolucion(): void {
    const h = this.ficha();
    if (!h) return;
    this.formEvolucion = this.evolucionVacia();
    this.aviso.set('');
    this.modalEvolucion = true;
  }

  guardarEvolucion(): void {
    const h = this.ficha();
    const f = this.formEvolucion;
    if (!h || !f.idMedico || !f.fechaEvolucion || !f.descripcion.trim()) {
      this.aviso.set('Médico, fecha y descripción de la evolución son obligatorios.');
      return;
    }
    this.guardando = true;
    this.hc.registrarEvolucion({
      idPaciente: h.paciente.idPaciente,
      idConsulta: f.idConsulta ? Number(f.idConsulta) : null,
      idMedico: Number(f.idMedico),
      fechaEvolucion: new Date(f.fechaEvolucion).toISOString(),
      descripcion: f.descripcion.trim(),
    }).subscribe({
      next: ev => {
        this.modalEvolucion = false;
        this.aviso.set(`Evolución #${ev.idEvolucion} registrada en el seguimiento del paciente.`);
        this.cargar(h.paciente.idPaciente);
      },
      error: () => this.aviso.set('Error al registrar la evolución.'),
      complete: () => (this.guardando = false),
    });
  }

  /* --------------------------- Helpers --------------------------- */

  diagnosticosDe(idConsulta: number) {
    return (this.ficha()?.diagnosticos ?? []).filter(d => d.idConsulta === idConsulta);
  }

  tratamientosDe(idConsulta: number) {
    return (this.ficha()?.tratamientos ?? []).filter(t => t.idConsulta === idConsulta);
  }

  examenesDe(idConsulta: number) {
    return (this.ficha()?.examenes ?? []).filter(e => e.idConsulta === idConsulta);
  }

  evolucionesDe(idConsulta: number) {
    return (this.ficha()?.evoluciones ?? []).filter(e => e.idConsulta === idConsulta);
  }

  /** Evoluciones NO vinculadas a ninguna consulta (aparecen sueltas en la línea de tiempo) */
  evolucionesSueltas() {
    const h = this.ficha();
    if (!h) return [];
    return h.evoluciones.filter(x => !x.idConsulta || !h.consultas.some(cc => cc.idConsulta === x.idConsulta));
  }

  /** Exámenes NO vinculados a ninguna consulta (aparecen sueltos en la línea de tiempo) */
  examenesSueltos() {
    const h = this.ficha();
    if (!h) return [];
    return h.examenes.filter(x => !x.idConsulta || !h.consultas.some(cc => cc.idConsulta === x.idConsulta));
  }

  /** Exámenes sin resultado capturado aún (para badge "pendiente") */
  examenPendiente(e: Examen): boolean {
    return !e.resultado || !e.resultado.trim();
  }

  vigentes() {
    return (this.ficha()?.tratamientos ?? []).filter(t => !t.fechaFin || t.fechaFin >= this.hoyIso);
  }

  nombreUltimoMedico(): string {
    const c = this.ficha()?.consultas[0];
    return c ? `${c.medicoNombre}${c.especialidad ? ' · ' + c.especialidad : ''}` : '—';
  }

  fmtFechaHora(d: string): string {
    if (!d) return '—';
    const f = new Date(d);
    return f.toLocaleDateString('es-GT') + ' ' +
           f.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  }

  fmtFecha(d: string | null): string {
    return d ? d.slice(0, 10) : '—';
  }

  estadoTratamiento(t: { fechaFin: string | null }): string {
    if (!t.fechaFin) return 'Vigente';
    return t.fechaFin >= this.hoyIso ? 'Vigente' : 'Finalizado';
  }

  private consultaVacia() {
    return {
      idMedico: '' as number | '',
      idSucursal: '' as number | '',
      fechaConsulta: new Date().toISOString().slice(0, 16),
      motivoConsulta: '',
      sintomas: '',
      observaciones: '',
    };
  }

  private examenVacio() {
    return {
      idConsulta: '' as number | '',
      idMedico: '' as number | '',
      nombreExamen: '',
      fechaExamen: new Date().toISOString().slice(0, 16),
      resultado: '',
    };
  }

  private evolucionVacia() {
    return {
      idConsulta: '' as number | '',
      idMedico: '' as number | '',
      fechaEvolucion: new Date().toISOString().slice(0, 16),
      descripcion: '',
    };
  }
}
