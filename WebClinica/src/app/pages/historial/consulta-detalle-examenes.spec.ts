import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { ConsultaDetalleDto, DiagnosticoResponse, ExamenResponseDto, PagedResponse } from '../../core/models/historial.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { HistorialService } from '../../core/services/historial.service';
import { InventarioService } from '../../core/services/inventario.service';
import { PacientesService } from '../../core/services/paciente.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ActivatedRoute } from '@angular/router';
import { ConsultaDetalleComponent } from './consulta-detalle.component';

describe('ConsultaDetalleComponent: Exámenes', () => {
  const consultation: ConsultaDetalleDto = {
    idConsulta: 17, idPaciente: 11, idMedico: 7, idSucursal: 3, idClinica: null,
    fechaConsulta: '2026-10-22T10:00:00Z', motivoConsulta: 'Control',
    sintomas: null, observaciones: null, pesoLb: null, alturaCm: null,
    presionSistolica: null, presionDiastolica: null,
  };
  const exam: ExamenResponseDto = {
    idExamen: 8, idConsulta: 17, idPaciente: 11, idMedico: 7,
    idDiagnostico: null, idTurno: null, nombreExamen: 'Hemograma',
    fechaExamen: '2026-10-22T11:00:00', fechaResultado: null, prioridad: 'Media',
  };
  let fixture: ComponentFixture<ConsultaDetalleComponent>;
  let create: jasmine.Spy;
  let list: jasmine.Spy;
  let listFiles: jasmine.Spy;
  let uploadFiles: jasmine.Spy;
  let createDiagnosis: jasmine.Spy;
  let createDiagnosisWithExam: jasmine.Spy;
  let listDiagnoses: jasmine.Spy;
  let modify = signal(false);

  function page<T>(items: T[]): PagedResponse<T> {
    return { items, page: 1, pageSize: 100, totalCount: items.length,
      totalPages: items.length ? 1 : 0 };
  }

  beforeEach(() => {
    modify = signal(false);
    create = jasmine.createSpy('crearExamen').and.returnValue(of(exam));
    list = jasmine.createSpy('listarExamenes').and.returnValue(of(page([exam])));
    listFiles = jasmine.createSpy('listarArchivosExamen').and.returnValue(of([{
      archivoId: 'a'.repeat(32), nombreOriginal: 'informe.pdf', tipoContenido: 'application/pdf',
      tamanoBytes: 1024, fechaCargaUtc: '2026-10-22T12:00:00Z', idUsuarioCarga: 7,
    }]));
    uploadFiles = jasmine.createSpy('adjuntarArchivosExamen');
    createDiagnosis = jasmine.createSpy('crearDiagnostico');
    createDiagnosisWithExam = jasmine.createSpy('crearDiagnosticoConExamen');
    listDiagnoses = jasmine.createSpy('listarDiagnosticos').and.returnValue(of(page([])));
    TestBed.configureTestingModule({
      imports: [ConsultaDetalleComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: {
          get: (key: string) => key === 'id' ? '11' : '17',
        } } } },
        { provide: AuthSessionService, useValue: {
          isAuthenticated: () => true, currentUser: () => ({ idUsuario: 7, idRol: 1 }),
          token: 'test-session',
        } },
        { provide: PermisosService, useValue: {
          puedeConsultar: () => true, puedeCrear: () => true,
          puedeModificar: () => modify(), puedeEliminar: () => false,
        } },
        { provide: ApiErrorService, useValue: { messageFor: (_: unknown, fallback: string) => fallback } },
        { provide: InventarioService, useValue: {} },
        { provide: PacientesService, useValue: { obtener: () => of({ idPaciente: 11, nombres: 'Ana', apellidos: 'López' }) } },
        { provide: EmpleadosService, useValue: { obtener: () => of({ idEmpleado: 7, nombres: 'Luis', apellidos: 'Pérez' }) } },
        { provide: CatalogosService, useValue: { obtenerSucursal: () => of({ idSucursal: 3, nombre: 'Centro' }), obtenerClinica: () => of(null) } },
        { provide: HistorialService, useValue: {
          obtenerConsulta: () => of(consultation), listarDiagnosticos: listDiagnoses,
          listarTratamientos: () => of(page([])), listarExamenes: list,
          listarHistorial: () => of(page([])), crearExamen: create,
          crearDiagnostico: createDiagnosis, listarArchivosExamen: listFiles,
          crearDiagnosticoConExamen: createDiagnosisWithExam,
          adjuntarArchivosExamen: uploadFiles,
        } },
      ],
    });
  });

  function render(): ConsultaDetalleComponent {
    fixture = TestBed.createComponent(ConsultaDetalleComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.tab = 'examenes';
    fixture.detectChanges();
    return component;
  }

  it('usa la fecha de carga del archivo y ofrece solo Ver archivos cuando hay resultado', () => {
    modify.set(true);
    const component = render();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Hemograma');
    expect(text).toContain('Media');
    expect(component.fechaPrimeraCargaExamen[8]).toBe('2026-10-22T12:00:00.000Z');
    expect(text).toContain(component.fechaCargaResultado(8));
    expect(text).toContain('Ver detalle');
    expect(text).toContain('Ver archivos');
    expect(text).not.toContain('Adjuntar resultados');
    expect(component.formatearFechaResultado('2026-10-22')).toBe('22/10/2026');
  });

  it('conserva la primera fecha válida aunque R2 devuelva varios archivos fuera de orden', () => {
    listFiles.and.returnValue(of([
      { archivoId: 'b'.repeat(32), nombreOriginal: 'nuevo.pdf', tipoContenido: 'application/pdf',
        tamanoBytes: 200, fechaCargaUtc: '2026-10-22T15:00:00Z', idUsuarioCarga: 7 },
      { archivoId: 'a'.repeat(32), nombreOriginal: 'primero.pdf', tipoContenido: 'application/pdf',
        tamanoBytes: 100, fechaCargaUtc: '2026-10-22T12:00:00Z', idUsuarioCarga: 7 },
    ]));
    modify.set(true);
    const component = render();
    const root = fixture.nativeElement as HTMLElement;
    expect(component.cantidadArchivosExamen[8]).toBe(2);
    expect(component.fechaPrimeraCargaExamen[8]).toBe('2026-10-22T12:00:00.000Z');
    expect(root.textContent).toContain('Ver archivos');
    expect(root.textContent).not.toContain('Adjuntar resultados');
  });

  it('bloquea la carga si falla la consulta de adjuntos y recupera el estado al releer', () => {
    listFiles.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    modify.set(true);
    const component = render();
    const root = fixture.nativeElement as HTMLElement;
    expect(component.fechaCargaResultado(8)).toBe('No se pudieron consultar los resultados');
    expect(root.textContent).not.toContain('Adjuntar resultados');
    component.seleccionarExamen(exam, 'adjuntar');
    expect(component.modoExamen).toBe('cerrado');
    listFiles.and.returnValue(of([]));
    component.cargarSecciones(); fixture.detectChanges();
    expect(component.fechaCargaResultado(8)).toBe('Pendiente');
    expect(root.textContent).toContain('Adjuntar resultados');
  });

  it('tras la primera carga oculta Adjuntar y muestra Ver archivos sin usar FechaResultado', () => {
    listFiles.and.returnValue(of([]));
    modify.set(true);
    const component = render();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Adjuntar resultados');
    expect(root.textContent).not.toContain('Ver archivos');
    component.actualizarCantidadArchivos({ examId: 8, count: 1,
      firstUploadedAt: '2026-10-22T12:00:00.000Z' });
    fixture.detectChanges();
    expect(root.textContent).not.toContain('Adjuntar resultados');
    expect(root.textContent).toContain('Ver archivos');
    expect(component.fechaPrimeraCargaExamen[8]).toBe('2026-10-22T12:00:00.000Z');
    component.seleccionarExamen(exam, 'adjuntar');
    expect(component.modoExamen).toBe('cerrado');
  });

  it('invalida una lectura previa vacía cuando falla la actualización de adjuntos', () => {
    listFiles.and.returnValue(of([]));
    modify.set(true);
    const component = render();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Adjuntar resultados');
    component.actualizarCantidadArchivos({ examId: 8, count: null });
    fixture.detectChanges();
    expect(component.fechaCargaResultado(8)).toBe('No se pudieron consultar los resultados');
    expect(root.textContent).not.toContain('Adjuntar resultados');
    component.seleccionarExamen(exam, 'adjuntar');
    expect(component.modoExamen).toBe('cerrado');
  });

  it('valida nombre, fecha y prioridad antes de registrar y conserva asociación con consulta', () => {
    const component = render();
    component.agregarExamen();
    expect(create).not.toHaveBeenCalled();
    component.nuevoExamen.nombreExamen = '  Hemograma  ';
    component.nuevoExamen.fechaExamen = '2026-10-22T11:00';
    component.nuevoExamen.prioridad = 'Urgente';
    component.agregarExamen();
    expect(create).not.toHaveBeenCalled();
    component.nuevoExamen.prioridad = 'Media';
    component.agregarExamen();
    expect(create).toHaveBeenCalledWith(jasmine.objectContaining({
      idConsulta: 17, nombreExamen: 'Hemograma', prioridad: 'Media',
      idDiagnostico: null, idTurno: null, fechaResultado: null,
    }));
    expect(component.avisoCrearExamen).toContain('Examen registrado');
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('impide duplicar la escritura mientras está pendiente y presenta errores HTTP', () => {
    const pending = new Subject<ExamenResponseDto>();
    create.and.returnValue(pending);
    const component = render();
    component.nuevoExamen.nombreExamen = 'Hemograma';
    component.nuevoExamen.fechaExamen = '2026-10-22T11:00';
    component.agregarExamen();
    component.agregarExamen();
    expect(create).toHaveBeenCalledTimes(1);
    pending.error(new HttpErrorResponse({ status: 503 }));
    expect(component.guardandoExamen).toBeFalse();
    expect(component.errorCrearExamen).toContain('No se pudo registrar');
  });

  it('no acepta una respuesta que atribuye el examen a otro paciente', () => {
    create.and.returnValue(of({ ...exam, idPaciente: 12 }));
    const component = render();
    component.nuevoExamen.nombreExamen = 'Hemograma';
    component.nuevoExamen.fechaExamen = '2026-10-22T11:00';
    component.agregarExamen();
    expect(component.errorCrearExamen).toContain('no corresponde');
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('abre Ver detalle y Ver archivos como vistas de lectura independientes y permite cerrar', async () => {
    const component = render();
    const root = fixture.nativeElement as HTMLElement;
    const action = (name: string) => Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === name)!;
    action('Ver detalle').click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.modoExamen).toBe('detalle');
    expect(root.textContent).toContain('Cantidad de archivos adjuntos: 1');
    expect(root.textContent).toContain('Fecha del examen');
    expect(root.querySelector('app-exam-results input[type=file]')).toBeNull();
    action('Ver archivos').click();
    fixture.detectChanges();
    expect(component.modoExamen).toBe('archivos');
    expect(root.textContent).not.toContain('Cantidad de archivos adjuntos:');
    expect(root.textContent).toContain('informe.pdf');
    expect(root.querySelector('app-exam-results input[type=file]')).toBeNull();
    action('Cerrar').click();
    fixture.detectChanges();
    expect(component.modoExamen).toBe('cerrado');
    expect(root.querySelector('app-exam-results')).toBeNull();
  });

  it('reserva Adjuntar resultados al permiso Modificar y Cancelar cierra la carga', async () => {
    listFiles.and.returnValue(of([]));
    const component = render();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).not.toContain('Adjuntar resultados');
    component.seleccionarExamen(exam, 'adjuntar');
    expect(component.modoExamen).toBe('cerrado');
    modify.set(true);
    fixture.detectChanges();
    expect(component.fechaCargaResultado(8)).toBe('Pendiente');
    const attach = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'Adjuntar resultados')!;
    attach.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(component.modoExamen).toBe('adjuntar');
    expect(root.querySelector('app-exam-results input[type=file]')).not.toBeNull();
    expect(root.textContent).toContain('Subir archivos');
    const cancel = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'Cancelar')!;
    cancel.click();
    fixture.detectChanges();
    expect(component.modoExamen).toBe('cerrado');
    expect(root.querySelector('app-exam-results')).toBeNull();
  });

  it('Diagnóstico distingue una consulta sin exámenes y conserva el registro', () => {
    list.and.returnValue(of(page([])));
    const component = render();
    component.tab = 'diagnosticos';
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('No hay exámenes asociados a esta consulta');
    expect(root.textContent).toContain('Registro de diagnóstico');
    expect(root.textContent).toContain('Diagnósticos registrados');
    expect(root.querySelector('app-exam-results')).toBeNull();
    const selector = root.querySelector<HTMLSelectElement>('#examen-diagnostico')!;
    expect(selector.options.length).toBe(1);
    expect(selector.options[0].textContent).toContain('Sin examen relacionado');
  });

  it('registra un diagnóstico general sin enviar IdExamen', () => {
    const diagnosis: DiagnosticoResponse = { idDiagnostico: 31, idConsulta: 17, idMedico: 7,
      descripcion: 'Control', fechaRegistro: '2026-10-22T12:00:00Z' };
    createDiagnosis.and.returnValue(of(diagnosis));
    const component = render();
    component.tab = 'diagnosticos'; fixture.detectChanges();
    expect(component.idExamenDiagnostico).toBeNull();
    component.nuevoDiag.descripcion = 'Control';
    component.agregarDiagnostico();
    expect(createDiagnosis).toHaveBeenCalledWith({ idConsulta: 17, idMedico: null, descripcion: 'Control' });
    expect(createDiagnosisWithExam).not.toHaveBeenCalled();
  });

  it('permite cambiar o limpiar la selección y usa el IdExamen real para vincular', () => {
    const other = { ...exam, idExamen: 9, nombreExamen: 'Hemograma',
      fechaExamen: '2026-10-23T11:00:00' };
    const diagnosis: DiagnosticoResponse = { idDiagnostico: 31, idConsulta: 17, idMedico: 7,
      descripcion: 'Hallazgo', fechaRegistro: '2026-10-22T12:00:00Z' };
    list.and.returnValues(of(page([exam, other])), of(page([exam, { ...other, idDiagnostico: 31 }])));
    listDiagnoses.and.returnValues(of(page([])), of(page([diagnosis])));
    createDiagnosisWithExam.and.returnValue(of(diagnosis));
    modify.set(true);
    const component = render();
    component.tab = 'diagnosticos'; fixture.detectChanges();
    const selector = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('#examen-diagnostico')!;
    expect(selector.options.length).toBe(3);
    expect(selector.options[1].textContent).toContain('22/10/2026');
    expect(selector.options[2].textContent).toContain('23/10/2026');
    component.idExamenDiagnostico = 8;
    component.idExamenDiagnostico = null;
    expect(component.idExamenDiagnostico).toBeNull();
    component.idExamenDiagnostico = 9;
    component.nuevoDiag.descripcion = 'Hallazgo';
    component.agregarDiagnostico(); fixture.detectChanges();
    expect(createDiagnosisWithExam).toHaveBeenCalledWith({
      idConsulta: 17, idMedico: null, descripcion: 'Hallazgo', idExamen: 9,
    });
    expect(createDiagnosis).not.toHaveBeenCalled();
    expect(component.idExamenDiagnostico).toBeNull();
    expect(component.examenes.find(item => item.idExamen === 9)?.idDiagnostico).toBe(31);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Hallazgo');
  });

  it('rechaza examen ajeno, ya asociado o sin permiso de modificación', () => {
    const component = render();
    component.idExamenDiagnostico = 99;
    component.nuevoDiag.descripcion = 'Hallazgo';
    component.agregarDiagnostico();
    expect(createDiagnosisWithExam).not.toHaveBeenCalled();
    modify.set(true);
    component.idExamenDiagnostico = 8;
    component.examenes = [{ ...exam, idDiagnostico: 12 }];
    component.agregarDiagnostico();
    expect(createDiagnosisWithExam).not.toHaveBeenCalled();
    component.examenes = [{ ...exam, idConsulta: 18 }];
    component.agregarDiagnostico();
    expect(createDiagnosisWithExam).not.toHaveBeenCalled();
  });

  it('Diagnóstico abre resultados pendientes en modo lectura y no ofrece cargas', async () => {
    listFiles.and.returnValue(of([]));
    const component = render();
    component.tab = 'diagnosticos';
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(list).toHaveBeenCalledWith(jasmine.objectContaining({ idConsulta: 17 }));
    expect(root.textContent).toContain('Pendiente');
    expect(root.textContent).toContain('0 archivo(s)');
    component.verResultadosDiagnostico(exam);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const results = root.querySelector('app-exam-results')!;
    expect(results.textContent).toContain('no hay archivos de resultado adjuntos');
    expect(results.querySelector('input[type=file]')).toBeNull();
    expect(results.textContent).not.toContain('Subir archivos');
    expect(results.textContent).not.toContain('Eliminar');
    expect(root.textContent).toContain('0 archivo(s)');
    expect(uploadFiles).not.toHaveBeenCalled();
  });

  it('Diagnóstico muestra varios documentos y permite cerrar solo el visor', async () => {
    const second = { archivoId: 'b'.repeat(32), nombreOriginal: 'imagen.png',
      tipoContenido: 'image/png', tamanoBytes: 2048,
      fechaCargaUtc: '2026-10-22T13:00:00Z', idUsuarioCarga: 7 };
    listFiles.and.returnValue(of([
      { archivoId: 'a'.repeat(32), nombreOriginal: 'informe.pdf', tipoContenido: 'application/pdf',
        tamanoBytes: 1024, fechaCargaUtc: '2026-10-22T12:00:00Z', idUsuarioCarga: 7 },
      second,
    ]));
    const component = render();
    component.tab = 'diagnosticos';
    fixture.detectChanges();
    component.verResultadosDiagnostico(exam);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const results = root.querySelector('app-exam-results')!;
    expect(results.textContent).toContain('informe.pdf');
    expect(results.textContent).toContain('imagen.png');
    expect(results.textContent).toContain('Ver');
    expect(results.textContent).toContain('Descargar');
    expect(results.querySelector('input[type=file]')).toBeNull();
    expect(root.textContent).toContain('2 archivo(s)');
    expect(root.textContent).toContain(component.fechaCargaResultado(8));
    Array.from(root.querySelectorAll('button')).find(button => button.textContent?.trim() === 'Cerrar resultados')!.click();
    fixture.detectChanges();
    expect(root.querySelector('app-exam-results')).toBeNull();
    expect(root.textContent).toContain('Diagnósticos registrados');
  });

  it('Diagnóstico usa la primera carga R2 aunque FechaResultado SQL sea distinta', () => {
    list.and.returnValue(of(page([{ ...exam, fechaResultado: '2026-10-25' }])));
    listFiles.and.returnValue(of([
      { archivoId: 'b'.repeat(32), nombreOriginal: 'nuevo.pdf', tipoContenido: 'application/pdf',
        tamanoBytes: 200, fechaCargaUtc: '2026-10-24T15:00:00Z', idUsuarioCarga: 7 },
      { archivoId: 'a'.repeat(32), nombreOriginal: 'primero.pdf', tipoContenido: 'application/pdf',
        tamanoBytes: 100, fechaCargaUtc: '2026-10-22T12:00:00Z', idUsuarioCarga: 7 },
    ]));
    const component = render();
    component.tab = 'diagnosticos'; fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(component.fechaPrimeraCargaExamen[8]).toBe('2026-10-22T12:00:00.000Z');
    expect(text).toContain(component.fechaCargaResultado(8));
    expect(text).not.toContain('25/10/2026');
  });

  it('muestra Fecha no disponible si hay archivo pero su fecha no es utilizable', () => {
    listFiles.and.returnValue(of([{ archivoId: 'a'.repeat(32), nombreOriginal: 'informe.pdf',
      tipoContenido: 'application/pdf', tamanoBytes: 100,
      fechaCargaUtc: 'fecha-inválida', idUsuarioCarga: 7 }]));
    const component = render();
    component.tab = 'diagnosticos'; fixture.detectChanges();
    expect(component.cantidadArchivosExamen[8]).toBe(1);
    expect(component.fechaCargaResultado(8)).toBe('Fecha no disponible');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Fecha no disponible');
  });

  it('permite reintentar los metadatos tras un error sin habilitar una carga incierta', () => {
    listFiles.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    modify.set(true);
    const component = render();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('No se pudieron consultar los resultados');
    expect(root.textContent).not.toContain('Adjuntar resultados');
    listFiles.and.returnValue(of([]));
    const retry = Array.from(root.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'Reintentar');
    expect(retry).toBeTruthy();
    retry!.click(); fixture.detectChanges();
    expect(listFiles).toHaveBeenCalledTimes(2);
    expect(root.textContent).toContain('Adjuntar resultados');
  });

  it('Diagnóstico rechaza resultados de otra consulta y presenta errores de almacenamiento', () => {
    listFiles.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    const component = render();
    component.tab = 'diagnosticos';
    fixture.detectChanges();
    component.verResultadosDiagnostico({ ...exam, idConsulta: 18 });
    fixture.detectChanges();
    expect(component.examenDiagnosticoSeleccionado).toBeNull();
    expect(listFiles).toHaveBeenCalledTimes(1); // Consulta previa del estado de adjuntos del examen propio.
    component.verResultadosDiagnostico(exam);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No se pudieron consultar los resultados');
    expect((fixture.nativeElement as HTMLElement).querySelector('app-exam-results input[type=file]')).toBeNull();
  });

  it('oculta el registro de diagnóstico en una consulta cerrada y bloquea el POST', () => {
    const component = render();
    component.consulta = { ...consultation, estadoConsulta: 'Cerrada' };
    component.tab = 'diagnosticos';
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('La consulta está cerrada');
    expect(root.querySelector('#descripcion-diagnostico')).toBeNull();
    component.nuevoDiag.descripcion = 'Diagnóstico nuevo';
    component.agregarDiagnostico();
    expect(createDiagnosis).not.toHaveBeenCalled();
  });

  it('numera diagnósticos de esta consulta por IdDiagnostico y conserva el orden al recargar y cambiar de pestaña', () => {
    const first: DiagnosticoResponse = { idDiagnostico: 10, idConsulta: 17, idMedico: 7,
      descripcion: 'Fractura', fechaRegistro: '2026-10-22T12:00:00' };
    const second: DiagnosticoResponse = { idDiagnostico: 20, idConsulta: 17, idMedico: 7,
      descripcion: 'Hipertensión', fechaRegistro: '2026-10-22T13:00:00' };
    listDiagnoses.and.returnValue(of(page([second, first])));
    list.and.returnValue(of(page([{ ...exam, idDiagnostico: 10, nombreExamen: 'Rayos X brazo' }])));
    const component = render();
    component.tab = 'diagnosticos';
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const tableRows = () => Array.from(root.querySelectorAll('#panel-diagnosticos section[aria-labelledby="diag-registrados"] tbody tr'));
    expect(tableRows().length).toBe(2);
    expect(tableRows()[0].textContent).toContain('1');
    expect(tableRows()[0].textContent).toContain('Fractura');
    expect(tableRows()[0].textContent).toContain('Rayos X brazo');
    expect(tableRows()[1].textContent).toContain('2');
    expect(tableRows()[1].textContent).toContain('Hipertensión');
    expect(tableRows()[1].textContent).toContain('Sin examen relacionado');
    component.tab = 'tratamientos'; fixture.detectChanges();
    component.tab = 'diagnosticos'; fixture.detectChanges();
    expect(tableRows()[0].textContent).toContain('Fractura');
    component.cargarSecciones(); fixture.detectChanges();
    expect(tableRows()[0].textContent).toContain('Fractura');
    expect(tableRows()[1].textContent).toContain('Hipertensión');
    expect(listDiagnoses).toHaveBeenCalledWith(jasmine.objectContaining({ idConsulta: 17 }));
  });

  it('muestra varios exámenes que comparten el mismo IdDiagnostico', () => {
    const diagnosis: DiagnosticoResponse = { idDiagnostico: 10, idConsulta: 17, idMedico: 7,
      descripcion: 'Fractura', fechaRegistro: '2026-10-22T12:00:00Z' };
    listDiagnoses.and.returnValue(of(page([diagnosis])));
    list.and.returnValue(of(page([
      { ...exam, idDiagnostico: 10, nombreExamen: 'Rayos X brazo' },
      { ...exam, idExamen: 9, idDiagnostico: 10, nombreExamen: 'Rayos X antebrazo' },
    ])));
    const component = render();
    component.tab = 'diagnosticos'; fixture.detectChanges();
    const row = (fixture.nativeElement as HTMLElement)
      .querySelector('section[aria-labelledby="diag-registrados"] tbody tr')!;
    expect(row.textContent).toContain('Rayos X brazo');
    expect(row.textContent).toContain('Rayos X antebrazo');
  });

  it('Ver detalle conserva el Id real, sin usar el correlativo como identificador', () => {
    const diagnosis: DiagnosticoResponse = { idDiagnostico: 37, idConsulta: 17, idMedico: 7,
      descripcion: 'Fractura', fechaRegistro: '2026-10-22T12:00:00' };
    listDiagnoses.and.returnValue(of(page([diagnosis])));
    const component = render();
    component.tab = 'diagnosticos'; fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const button = Array.from(root.querySelectorAll('button')).find(item => item.textContent?.trim() === 'Ver detalle')!;
    button.click(); fixture.detectChanges();
    expect(component.diagnosticoDetalleId).toBe(37);
    expect(root.textContent).toContain('Cerrar detalle');
    component.verDetalleDiagnostico({ ...diagnosis, idConsulta: 18 });
    expect(component.diagnosticoDetalleId).toBe(37);
    component.verDetalleDiagnostico(diagnosis); fixture.detectChanges();
    expect(component.diagnosticoDetalleId).toBeNull();
  });

  it('renumera después de confirmar un diagnóstico nuevo y releer la consulta', () => {
    const first: DiagnosticoResponse = { idDiagnostico: 10, idConsulta: 17, idMedico: 7,
      descripcion: 'Fractura', fechaRegistro: '2026-10-22T12:00:00' };
    const added: DiagnosticoResponse = { idDiagnostico: 42, idConsulta: 17, idMedico: 7,
      descripcion: 'Hipertensión', fechaRegistro: '2026-10-22T13:00:00' };
    listDiagnoses.and.returnValues(of(page([first])), of(page([added, first])));
    createDiagnosis.and.returnValue(of(added));
    const component = render();
    component.tab = 'diagnosticos'; fixture.detectChanges();
    component.nuevoDiag.descripcion = 'Hipertensión';
    component.agregarDiagnostico(); fixture.detectChanges();
    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLTableRowElement>('section[aria-labelledby="diag-registrados"] tbody tr');
    expect(createDiagnosis).toHaveBeenCalledWith(jasmine.objectContaining({ idConsulta: 17, descripcion: 'Hipertensión' }));
    expect(rows.length).toBe(2);
    expect(rows[0].cells[0].textContent?.trim()).toBe('1');
    expect(rows[0].textContent).toContain('Fractura');
    expect(rows[1].cells[0].textContent?.trim()).toBe('2');
    expect(rows[1].textContent).toContain('Hipertensión');
  });

  it('rechaza la lista de diagnósticos atribuida a otra consulta', () => {
    listDiagnoses.and.returnValue(of(page([{ idDiagnostico: 10, idConsulta: 18,
      idMedico: 7, descripcion: 'Ajeno', fechaRegistro: '2026-10-22T12:00:00' }])));
    const component = render();
    component.tab = 'diagnosticos'; fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(component.diagnosticos).toEqual([]);
    expect(root.textContent).not.toContain('Ajeno');
    expect(root.textContent).toContain('registros clínicos duplicados o de otra consulta');
  });
});
