import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { RecetaClinicaDetalleDto, TratamientoResponseDto } from '../../core/models/historial.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { HistorialService } from '../../core/services/historial.service';
import { InventarioService } from '../../core/services/inventario.service';
import { PermisosService } from '../../core/services/permisos.service';
import { RECETA_SIMPLE_WRITE_ENABLED, RecetaFormComponent } from './receta-form.component';

describe('RecetaFormComponent', () => {
  let fixture: ComponentFixture<RecetaFormComponent>;
  let crearReceta: jasmine.Spy;
  let crearTratamiento: jasmine.Spy;
  const page = <T>(items: T[]) => ({ items, page: 1, pageSize: 100,
    totalCount: items.length, totalPages: items.length ? 1 : 0 });
  const receta: RecetaClinicaDetalleDto = {
    idReceta: 21, idConsulta: 17, idTratamiento: 30,
    descripcionTratamiento: 'Reposo', indicacionesGenerales: null,
    fechaInicio: '2026-10-23', fechaFin: '2026-10-27', idDiagnostico: 4,
    descripcionDiagnostico: 'Diagnóstico sintético', numeroVersion: 1,
    estado: 'Vigente', idUsuarioPrescriptor: 7,
    fechaPrescripcionUtc: '2026-10-23T10:00:00Z', lineas: [{
      idRecetaLinea: 34, orden: 1, idMedicamento: 3,
      nombreMedicamento: 'Medicamento sintético', presentacion: 'Caja de tabletas',
      cantidadPrescritaUnidades: 10,
    }],
  };
  const tratamiento: TratamientoResponseDto = {
    idTratamiento: 30, idConsulta: 17, idPaciente: 11, idMedico: 7,
    descripcion: 'Reposo', indicaciones: 'Hidratación',
    fechaInicio: '2026-10-23', fechaFin: '2026-10-27', idLote: null, cantidad: null,
  };

  beforeEach(() => {
    crearReceta = jasmine.createSpy('crearReceta').and.returnValue(of(receta));
    crearTratamiento = jasmine.createSpy('crearTratamiento').and.returnValue(of(tratamiento));
    TestBed.configureTestingModule({
      imports: [RecetaFormComponent],
      providers: [
        { provide: RECETA_SIMPLE_WRITE_ENABLED, useValue: true },
        { provide: HistorialService, useValue: {
          crearReceta, crearTratamiento, listarRecetas: () => of(page([])),
          obtenerReceta: () => of(receta),
        } },
        { provide: InventarioService, useValue: {
          listarMedicamentos: () => of(page([{
            idMedicamento: 3, nombre: 'Medicamento sintético',
            presentacion: 'Caja de tabletas', activo: true,
          }, {
            idMedicamento: 4, nombre: 'Segundo medicamento',
            presentacion: null, activo: true,
          }, {
            idMedicamento: 5, nombre: 'Inactivo',
            presentacion: 'Frasco', activo: false,
          }]))
        } },
        { provide: PermisosService, useValue: {
          puedeConsultar: () => true, puedeCrear: () => true,
        } },
        { provide: AuthSessionService, useValue: {
          isAuthenticated: () => true, currentUser: () => ({ idUsuario: 7 }),
          token: 'session-test',
        } },
        { provide: ApiErrorService, useValue: {
          messageFor: (_: unknown, fallback: string) => fallback,
        } },
      ],
    });
    fixture = TestBed.createComponent(RecetaFormComponent);
    fixture.componentRef.setInput('idConsulta', 17);
    fixture.componentRef.setInput('idPaciente', 11);
    fixture.componentRef.setInput('estadoConsulta', 'Abierta');
    fixture.componentRef.setInput('diagnosticos', [{
      idDiagnostico: 4, idConsulta: 17, descripcion: 'Diagnóstico sintético',
      fechaRegistro: '2026-10-23T10:00:00Z',
    } as never]);
    fixture.detectChanges();
  });

  function completar(): RecetaFormComponent {
    const component = fixture.componentInstance;
    component.agregarMedicamento();
    component.form.patchValue({ idDiagnostico: 4,
      descripcionTratamiento: 'Reposo', fechaInicio: '2026-10-23', fechaFin: '2026-10-27' });
    component.lineas.at(0).patchValue({ idMedicamento: 3,
      cantidadPrescritaUnidades: 10 });
    component.aceptarMedicamento(0);
    fixture.detectChanges();
    return component;
  }

  function tarjetaReceta(): HTMLElement {
    const cards = fixture.nativeElement.querySelectorAll('.receta-form section.card') as NodeListOf<HTMLElement>;
    return Array.from(cards).find(card => card.querySelector('h4')?.textContent?.includes('Receta médica'))!;
  }

  it('acepta localmente una línea válida y ofrece Editar sin enviar solicitudes', () => {
    const component = fixture.componentInstance;
    component.agregarMedicamento();
    component.lineas.at(0).patchValue({ idMedicamento: 3, cantidadPrescritaUnidades: 10 });
    fixture.detectChanges();
    const aceptar = fixture.nativeElement.querySelector('[aria-label="Aceptar medicamento 1"]') as HTMLButtonElement;
    expect(aceptar).not.toBeNull();
    aceptar.click();
    fixture.detectChanges();
    expect(component.lineaAceptada(component.lineas.at(0))).toBeTrue();
    expect(component.lineas.at(0).disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Aceptado');
    expect(fixture.nativeElement.querySelector('[aria-label="Editar medicamento 1"]')).not.toBeNull();
    expect(crearReceta).not.toHaveBeenCalled();
    expect(crearTratamiento).not.toHaveBeenCalled();
  });

  it('rechaza cantidades vacías, cero, negativas y decimales al aceptar', () => {
    const component = fixture.componentInstance;
    component.agregarMedicamento();
    const linea = component.lineas.at(0);
    linea.controls.idMedicamento.setValue(3);
    for (const cantidad of [null, 0, -1, 1.5]) {
      linea.controls.cantidadPrescritaUnidades.setValue(cantidad);
      component.aceptarMedicamento(0);
      expect(component.lineaAceptada(linea)).withContext(`Cantidad ${cantidad}`).toBeFalse();
      expect(component.errorAceptacion(linea)).toContain('entera mayor que cero');
    }
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('rechaza medicamentos ausentes, inactivos y duplicados al aceptar', () => {
    const component = fixture.componentInstance;
    component.agregarMedicamento();
    const linea = component.lineas.at(0);
    linea.controls.cantidadPrescritaUnidades.setValue(2);
    for (const id of [null, 999, 5]) {
      linea.controls.idMedicamento.setValue(id);
      component.aceptarMedicamento(0);
      expect(component.lineaAceptada(linea)).toBeFalse();
      expect(component.errorAceptacion(linea)).toContain('activo');
    }
    linea.controls.idMedicamento.setValue(3);
    component.aceptarMedicamento(0);
    component.agregarMedicamento();
    component.lineas.at(1).patchValue({ idMedicamento: 3, cantidadPrescritaUnidades: 1 });
    component.aceptarMedicamento(1);
    expect(component.lineaAceptada(component.lineas.at(1))).toBeFalse();
    expect(component.errorAceptacion(component.lineas.at(1))).toContain('una sola vez');
    expect(component.lineaAceptada(linea)).toBeTrue();
  });

  it('Editar retira la aceptación y exige aceptar nuevamente tras cambiar la cantidad', () => {
    const component = completar();
    const linea = component.lineas.at(0);
    component.editarMedicamento(0);
    expect(linea.enabled).toBeTrue();
    expect(component.lineaAceptada(linea)).toBeFalse();
    linea.controls.cantidadPrescritaUnidades.setValue(11);
    component.solicitarConfirmacion();
    expect(component.error).toContain('Pulse Aceptar');
    expect(component.confirmacionAbierta).toBeFalse();
    component.aceptarMedicamento(0);
    expect(component.lineaAceptada(linea)).toBeTrue();
    linea.controls.cantidadPrescritaUnidades.setValue(12);
    expect(component.lineaAceptada(linea)).toBeFalse();
    expect(linea.enabled).toBeTrue();
    component.solicitarConfirmacion();
    expect(component.error).toContain('Pulse Aceptar');
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('cierra una confirmación pendiente si se edita una línea y no envía el cuerpo anterior', () => {
    const component = completar();
    component.solicitarConfirmacion();
    expect(component.confirmacionAbierta).toBeTrue();
    component.editarMedicamento(0);
    component.lineas.at(0).controls.cantidadPrescritaUnidades.setValue(12);
    expect(component.confirmacionAbierta).toBeFalse();
    component.confirmar();
    expect(crearReceta).not.toHaveBeenCalled();
    component.aceptarMedicamento(0);
    component.solicitarConfirmacion();
    component.confirmar();
    expect(crearReceta.calls.mostRecent().args[0].lineas[0].cantidadPrescritaUnidades).toBe(12);
  });

  it('mantiene la aceptación independiente de cada línea y la numeración al eliminar una', () => {
    const component = completar();
    component.agregarMedicamento();
    component.lineas.at(1).patchValue({ idMedicamento: 4, cantidadPrescritaUnidades: 2 });
    expect(component.lineaAceptada(component.lineas.at(0))).toBeTrue();
    expect(component.lineaAceptada(component.lineas.at(1))).toBeFalse();
    component.solicitarConfirmacion();
    expect(component.error).toContain('Pulse Aceptar');
    component.aceptarMedicamento(1);
    expect(component.lineaAceptada(component.lineas.at(1))).toBeTrue();
    component.quitarMedicamento(0);
    component.confirmarEliminacion();
    fixture.detectChanges();
    expect(component.lineas.length).toBe(1);
    expect(component.lineaAceptada(component.lineas.at(0))).toBeTrue();
    expect(fixture.nativeElement.querySelector('.receta-medicamento legend').textContent).toContain('Medicamento 1');
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('presenta la presentación en solo lectura sin convertir cantidades', () => {
    const component = completar();
    const presentacion = fixture.nativeElement.querySelector('#receta-presentacion-0') as HTMLInputElement;
    expect(presentacion.value).toBe('Caja de tabletas');
    expect(presentacion.readOnly).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('La presentación es solo informativa');
    component.solicitarConfirmacion();
    expect(component.confirmacionAbierta).toBeTrue();
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('selecciona el único diagnóstico y deshabilita las acciones durante el envío', () => {
    const component = fixture.componentInstance;
    expect(component.form.controls.idDiagnostico.value).toBe(4);
    expect((fixture.nativeElement.querySelector('#receta-diag-4') as HTMLInputElement).checked).toBeTrue();
    component.agregarMedicamento();
    component.guardando = true;
    fixture.detectChanges();
    const actions = Array.from(fixture.nativeElement.querySelectorAll('.receta-form button')) as HTMLButtonElement[];
    expect(actions.find(button => button.textContent?.includes('Cancelar'))?.disabled).toBeTrue();
    expect(actions.find(button => button.textContent?.includes('Procesando'))?.disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Procesando tratamiento y receta');
  });

  it('muestra estado vacío cuando la consulta no tiene diagnósticos', () => {
    fixture.componentRef.setInput('diagnosticos', []);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-ui-state')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Sin diagnósticos registrados');
    expect(fixture.componentInstance.form.controls.idDiagnostico.value).toBeNull();
  });

  it('mantiene la tarjeta y el botón en su encabezado aun sin medicamentos', () => {
    const component = fixture.componentInstance;
    expect(component.lineas.length).toBe(0);
    const card = tarjetaReceta();
    expect(card).toBeTruthy();
    expect(card.querySelector('[formArrayName="lineas"]')).toBeNull();
    expect(card.textContent).toContain('guardar el tratamiento sin medicamentos');
    expect(card.textContent).not.toContain('Guardar tratamiento y receta');
    expect(card.textContent).not.toContain('La cantidad y la unidad de entrega');
    const add = card.querySelector('.card-header button') as HTMLButtonElement;
    expect(add.textContent).toContain('Agregar medicamento');
    expect(add.querySelector('.bi-plus-lg')).not.toBeNull();
    expect(card.parentElement?.nextElementSibling?.textContent).toContain('Recetas de la consulta');
    add.click();
    fixture.detectChanges();
    expect(component.lineas.length).toBe(1);
    expect(tarjetaReceta()).toBe(card);
    expect(card.textContent).toContain('Medicamento 1');
    expect((card.querySelector('button[type=submit]') as HTMLButtonElement).textContent?.trim()).toBe('Guardar');
    expect(card.textContent).toContain('Aceptar');
    expect((card.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBeFalse();
    component.agregarMedicamento();
    fixture.detectChanges();
    expect(component.lineas.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Medicamento 2');
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('elimina una línea vacía sin diálogo y conserva la tarjeta al eliminar la última', () => {
    const component = fixture.componentInstance;
    component.agregarMedicamento();
    fixture.detectChanges();
    const remove = fixture.nativeElement.querySelector('[title="Eliminar medicamento"]') as HTMLButtonElement;
    expect(remove.textContent).toContain('Eliminar medicamento');
    expect(remove.querySelector('.bi-trash')).not.toBeNull();
    expect(remove.getAttribute('aria-label')).toBe('Eliminar medicamento 1');
    const acciones = remove.closest('.receta-acciones-linea') as HTMLElement;
    expect(acciones).not.toBeNull();
    expect(acciones.parentElement?.querySelectorAll('.form-label').length).toBe(3);
    remove.click();
    fixture.detectChanges();
    expect(component.medicamentoPendienteEliminar).toBeNull();
    expect(component.lineas.length).toBe(0);
    expect(tarjetaReceta().querySelector('[formArrayName="lineas"]')).toBeNull();
    expect(tarjetaReceta().querySelector('.card-header button')).not.toBeNull();
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('pide confirmación antes de eliminar el último medicamento con datos', () => {
    const component = fixture.componentInstance;
    component.agregarMedicamento();
    component.lineas.at(0).controls.idMedicamento.setValue(3);
    component.quitarMedicamento(0);
    fixture.detectChanges();
    expect(component.lineas.length).toBe(1);
    expect(component.medicamentoPendienteEliminar).toBe(0);
    const dialog = fixture.nativeElement.querySelector('app-confirm-dialog') as HTMLElement;
    expect(dialog.textContent).toContain('Conservar');
    expect(dialog.textContent).toContain('Eliminar medicamento');
    component.confirmarEliminacion();
    fixture.detectChanges();
    expect(component.lineas.length).toBe(0);
    expect(tarjetaReceta().querySelector('[formArrayName="lineas"]')).toBeNull();
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('confirma el borrado de una línea con datos y conserva las otras al renumerar', () => {
    const component = fixture.componentInstance;
    component.agregarMedicamento(); component.agregarMedicamento(); component.agregarMedicamento();
    component.lineas.at(0).controls.idMedicamento.setValue(3);
    component.lineas.at(1).controls.idMedicamento.setValue(4);
    component.lineas.at(2).controls.idMedicamento.setValue(5);
    fixture.detectChanges();
    component.quitarMedicamento(1);
    fixture.detectChanges();
    expect(component.lineas.length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Se eliminarán los datos ingresados para este medicamento.');
    expect(fixture.nativeElement.textContent).toContain('Conservar');
    component.confirmarEliminacion();
    fixture.detectChanges();
    expect(component.lineas.length).toBe(2);
    expect(component.lineas.at(0).controls.idMedicamento.value).toBe(3);
    expect(component.lineas.at(1).controls.idMedicamento.value).toBe(5);
    expect(fixture.nativeElement.textContent).toContain('Medicamento 2');
    expect(fixture.nativeElement.textContent).not.toContain('Medicamento 3');
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('Cancelar descarta solo la receta tras confirmar y conserva el tratamiento', () => {
    const component = fixture.componentInstance;
    component.form.patchValue({ descripcionTratamiento: 'Reposo', fechaInicio: '2026-10-23' });
    component.agregarMedicamento();
    component.lineas.at(0).controls.idMedicamento.setValue(3);
    fixture.detectChanges();
    component.cancelar();
    fixture.detectChanges();
    expect(component.cancelacionPendiente).toBeTrue();
    expect(component.lineas.length).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Descartar receta');
    component.confirmarCancelacion();
    fixture.detectChanges();
    expect(component.lineas.length).toBe(0);
    expect(component.form.controls.descripcionTratamiento.value).toBe('Reposo');
    expect(component.form.controls.fechaInicio.value).toBe('2026-10-23');
    expect(component.form.controls.idDiagnostico.value).toBe(4);
    expect(tarjetaReceta().querySelector('[formArrayName="lineas"]')).toBeNull();
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('Conservar mantiene la receta y Cancelar descarta líneas vacías sin diálogo', () => {
    const component = fixture.componentInstance;
    component.agregarMedicamento();
    component.lineas.at(0).controls.idMedicamento.setValue(3);
    component.cancelar();
    fixture.detectChanges();
    expect(component.cancelacionPendiente).toBeTrue();
    (fixture.nativeElement.querySelector('app-confirm-dialog button.btn-secondary') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.cancelacionPendiente).toBeFalse();
    expect(component.lineas.at(0).controls.idMedicamento.value).toBe(3);
    component.lineas.at(0).controls.idMedicamento.setValue(null);
    component.cancelar();
    fixture.detectChanges();
    expect(component.cancelacionPendiente).toBeFalse();
    expect(component.lineas.length).toBe(0);
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('mantiene el botón accesible y muestra validaciones al intentar guardar', () => {
    const component = completar();
    const confirm = fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement;
    expect(confirm.disabled).toBeFalse();
    component.lineas.at(0).controls.cantidadPrescritaUnidades.setValue(null);
    component.solicitarConfirmacion();
    expect(component.error).toContain('Revise los campos');
    component.lineas.at(0).controls.cantidadPrescritaUnidades.setValue(10);
    fixture.detectChanges();
    expect(confirm.disabled).toBeFalse();
  });

  it('confirma una cantidad directa con clave de operación y sin selección de lote', () => {
    const component = completar();
    expect(component.form.valid).withContext(JSON.stringify(component.form.getRawValue())).toBeTrue();
    component.solicitarConfirmacion();
    expect(component.confirmacionAbierta).withContext(component.error).toBeTrue();
    component.confirmar();
    expect(crearReceta).toHaveBeenCalledTimes(1);
    const solicitud = crearReceta.calls.mostRecent().args[0];
    expect(solicitud.idConsulta).toBe(17);
    expect(solicitud.idDiagnostico).toBe(4);
    expect(solicitud.descripcionTratamiento).toBe('Reposo');
    expect(solicitud.fechaInicio).toBe('2026-10-23');
    expect(solicitud.fechaFin).toBe('2026-10-27');
    expect(solicitud.claveOperacion).toMatch(/^[0-9a-f-]{36}$/);
    expect(solicitud.lineas[0].cantidadPrescritaUnidades).toBe(10);
    expect(Object.keys(solicitud.lineas[0]).sort()).toEqual([
      'cantidadPrescritaUnidades', 'idMedicamento']);
    expect(solicitud.lineas[0].idLote).toBeUndefined();
    expect(component.aviso).toContain('receta confirmados');
  });

  it('calcula días inclusivos y no muestra los campos clínicos retirados', () => {
    const component = completar();
    expect(component.duracionCalculada).toBe(5);
    component.form.controls.fechaFin.setValue('2026-10-23');
    fixture.detectChanges();
    expect(component.duracionCalculada).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('1 día de tratamiento');
    for (const id of ['#receta-dosis-0', '#receta-unidad-0', '#receta-via-0', '#receta-frecuencia-0',
      '#receta-entrega-0', '#receta-destino-0'])
      expect(fixture.nativeElement.querySelector(id)).toBeNull();
  });

  it('exige cantidad positiva y conserva la validación de fecha final del tratamiento', () => {
    const component = completar();
    component.lineas.at(0).controls.cantidadPrescritaUnidades.setValue(0);
    component.solicitarConfirmacion();
    fixture.detectChanges();
    expect(component.lineas.at(0).controls.cantidadPrescritaUnidades.touched).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('La cantidad debe ser mayor que cero');
    expect(crearReceta).not.toHaveBeenCalled();
    component.lineas.at(0).controls.cantidadPrescritaUnidades.setValue(10);
    component.form.controls.fechaFin.setValue('');
    component.solicitarConfirmacion();
    expect(component.error).toContain('Revise los campos');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Seleccione la fecha de finalización.');
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('reintenta con la misma clave y cuerpo tras una respuesta de red incierta', () => {
    const component = completar();
    expect(component.form.valid).toBeTrue();
    crearReceta.and.returnValues(
      throwError(() => new HttpErrorResponse({ status: 0 })), of(receta));
    component.solicitarConfirmacion();
    component.confirmar();
    expect(component.resultadoIncierto).toBeTrue();
    component.solicitarConfirmacion();
    component.confirmar();
    expect(crearReceta).toHaveBeenCalledTimes(2);
    expect(crearReceta.calls.argsFor(1)[0]).toEqual(crearReceta.calls.argsFor(0)[0]);
  });

  it('envía varias líneas simplificadas y muestra la presentación faltante sin inventarla', () => {
    const component = completar();
    component.agregarMedicamento();
    component.lineas.at(1).patchValue({ idMedicamento: 4, cantidadPrescritaUnidades: 2 });
    component.aceptarMedicamento(1);
    crearReceta.and.returnValue(of({ ...receta, lineas: [receta.lineas[0], {
      idRecetaLinea: 35, orden: 2, idMedicamento: 4, nombreMedicamento: 'Segundo medicamento',
      presentacion: 'No registrada', cantidadPrescritaUnidades: 2 }] }));
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('#receta-presentacion-1') as HTMLInputElement).value).toBe('No registrada');
    component.solicitarConfirmacion();
    component.confirmar();
    const lineas = crearReceta.calls.mostRecent().args[0].lineas;
    expect(lineas).toEqual([
      { idMedicamento: 3, cantidadPrescritaUnidades: 10 },
      { idMedicamento: 4, cantidadPrescritaUnidades: 2 },
    ]);
    expect(component.aviso).toContain('receta confirmados');
  });

  it('no da por guardada una receta si la respuesta cambia la cantidad', () => {
    const component = completar();
    crearReceta.and.returnValue(of({ ...receta, lineas: [{ ...receta.lineas[0], cantidadPrescritaUnidades: 9 }] }));
    component.solicitarConfirmacion();
    component.confirmar();
    expect(component.resultadoIncierto).toBeTrue();
    expect(component.error).toContain('inconsistente');
    expect(component.aviso).toBe('');
  });

  it('rechaza cantidades negativas y medicamentos inexistentes o inactivos', () => {
    const component = completar();
    component.lineas.at(0).controls.cantidadPrescritaUnidades.setValue(-1);
    component.solicitarConfirmacion();
    fixture.detectChanges();
    expect(component.confirmacionAbierta).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('La cantidad debe ser mayor que cero');
    component.lineas.at(0).patchValue({ idMedicamento: 999, cantidadPrescritaUnidades: 10 });
    component.solicitarConfirmacion();
    expect(component.confirmacionAbierta).toBeFalse();
    component.lineas.at(0).controls.idMedicamento.setValue(5);
    component.solicitarConfirmacion();
    expect(component.confirmacionAbierta).toBeFalse();
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('rechaza medicamentos duplicados y conserva el permiso Historial/Crear', () => {
    const component = completar();
    component.agregarMedicamento();
    component.lineas.at(1).patchValue({ idMedicamento: 3, cantidadPrescritaUnidades: 2 });
    component.solicitarConfirmacion();
    expect(component.error).toContain('una sola vez');
    component.lineas.at(1).controls.idMedicamento.setValue(4);
    spyOn(TestBed.inject(PermisosService), 'puedeCrear').and.returnValue(false);
    component.solicitarConfirmacion();
    expect(component.error).toContain('acceso');
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('muestra un error 400 en español sin presentar el mensaje genérico request', () => {
    const component = completar();
    crearReceta.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: {
      errors: { request: ['The request field is required.'],
        '$.lineas[0].cantidadPrescritaUnidades': ['The JSON value could not be converted.'] }
    } })));
    component.solicitarConfirmacion();
    component.confirmar();
    fixture.detectChanges();
    expect(component.error).toContain('dato inválido');
    expect(fixture.nativeElement.textContent).not.toContain('The request field is required');
  });

  it('un conflicto 409 no envía otra solicitud automáticamente', () => {
    const component = completar();
    crearReceta.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    component.solicitarConfirmacion();
    component.confirmar();
    expect(crearReceta).toHaveBeenCalledTimes(1);
    expect(component.resultadoIncierto).toBeFalse();
    expect(component.error).toContain('conflicto');
  });

  it('un 503 conserva el cuerpo y la clave hasta un reintento manual', () => {
    const component = completar();
    crearReceta.and.returnValues(throwError(() => new HttpErrorResponse({ status: 503 })), of(receta));
    component.solicitarConfirmacion();
    component.confirmar();
    expect(crearReceta).toHaveBeenCalledTimes(1);
    expect(component.resultadoIncierto).toBeTrue();
    expect(component.lineas.at(0).disabled).toBeTrue();
    component.solicitarConfirmacion();
    component.confirmar();
    expect(crearReceta).toHaveBeenCalledTimes(2);
    expect(crearReceta.calls.argsFor(1)[0]).toEqual(crearReceta.calls.argsFor(0)[0]);
  });

  it('impide doble envío mientras la confirmación está pendiente', () => {
    const component = completar();
    const pending = new Subject<RecetaClinicaDetalleDto>();
    crearReceta.and.returnValue(pending.asObservable());
    component.solicitarConfirmacion();
    component.confirmar();
    component.confirmar();
    expect(crearReceta).toHaveBeenCalledTimes(1);
    pending.next(receta);
    pending.complete();
    expect(component.aviso).toContain('receta confirmados');
  });

  it('mantiene columnas apilables en móvil y el botón de eliminación accesible', () => {
    completar();
    const fieldset = fixture.nativeElement.querySelector('.receta-medicamento') as HTMLElement;
    expect(fieldset.querySelectorAll('.row > .col-12').length).toBe(3);
    const button = fieldset.querySelector('[title="Eliminar medicamento"]') as HTMLButtonElement;
    expect(button.title).toBe('Eliminar medicamento');
    expect(button.getAttribute('aria-label')).toBe('Eliminar medicamento 1');
    expect(fieldset.textContent).not.toContain('Unidad de entrega');
    expect(fieldset.textContent).not.toContain('Destino');
  });

  it('guarda solo tratamiento con indicaciones y fechas sin crear receta ni elegir lote', () => {
    const component = fixture.componentInstance;
    const emitido = spyOn(component.tratamientoRegistrado, 'emit');
    component.form.patchValue({ descripcionTratamiento: ' Reposo ',
      indicacionesGenerales: ' Hidratación ', fechaInicio: '2026-10-23', fechaFin: '2026-10-27' });
    fixture.detectChanges();
    const boton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (item: HTMLButtonElement) => item.textContent?.trim() === 'Guardar tratamiento') as HTMLButtonElement;
    expect(boton.disabled).toBeFalse();
    boton.click();
    expect(crearTratamiento).toHaveBeenCalledOnceWith({
      idConsulta: 17, descripcion: 'Reposo', indicaciones: 'Hidratación',
      fechaInicio: '2026-10-23', fechaFin: '2026-10-27', idLote: null, cantidad: null,
    });
    expect(emitido).toHaveBeenCalledOnceWith(tratamiento);
    expect(crearReceta).not.toHaveBeenCalled();
    expect(component.avisoTratamiento).toContain('Tratamiento guardado');
  });

  it('admite tratamiento sin diagnóstico y fecha final opcional según el DTO independiente', () => {
    const component = fixture.componentInstance;
    component.form.controls.idDiagnostico.setValue(null);
    component.form.patchValue({ descripcionTratamiento: 'Reposo', fechaInicio: '2026-10-23', fechaFin: '' });
    crearTratamiento.and.returnValue(of({ ...tratamiento, indicaciones: null, fechaFin: null }));
    component.guardarSoloTratamiento();
    expect(crearTratamiento.calls.mostRecent().args[0]).toEqual({
      idConsulta: 17, descripcion: 'Reposo', indicaciones: null,
      fechaInicio: '2026-10-23', fechaFin: null, idLote: null, cantidad: null,
    });
  });

  it('rechaza tratamiento inválido o fechas invertidas sin enviar POST', () => {
    const component = fixture.componentInstance;
    component.form.patchValue({ descripcionTratamiento: ' ', fechaInicio: '2026-10-23' });
    component.guardarSoloTratamiento();
    expect(component.errorTratamiento).toContain('Revise');
    component.form.patchValue({ descripcionTratamiento: 'Reposo', fechaFin: '2026-10-22' });
    component.guardarSoloTratamiento();
    expect(component.errorTratamiento).toContain('fechas');
    expect(crearTratamiento).not.toHaveBeenCalled();
  });

  it('no guarda solo tratamiento mientras haya medicamentos en la receta', () => {
    const component = completar();
    component.guardarSoloTratamiento();
    expect(component.errorTratamiento).toContain('Retire los medicamentos');
    fixture.detectChanges();
    const boton = [...fixture.nativeElement.querySelectorAll('button')].find(
      (item: HTMLButtonElement) => item.textContent?.trim() === 'Guardar tratamiento') as HTMLButtonElement;
    expect(boton.disabled).toBeTrue();
    expect(crearTratamiento).not.toHaveBeenCalled();
  });

  it('impide doble POST de tratamiento y conserva datos ante error recuperable', () => {
    const component = fixture.componentInstance;
    const pendiente = new Subject<TratamientoResponseDto>();
    crearTratamiento.and.returnValue(pendiente);
    component.form.patchValue({ descripcionTratamiento: 'Reposo', fechaInicio: '2026-10-23' });
    component.guardarSoloTratamiento(); component.guardarSoloTratamiento();
    expect(crearTratamiento).toHaveBeenCalledTimes(1);
    pendiente.error(new HttpErrorResponse({ status: 400, error: { detail: 'Dato inválido.' } }));
    expect(component.tratamientoIncierto).toBeFalse();
    expect(component.form.controls.descripcionTratamiento.value).toBe('Reposo');
    expect(component.form.controls.fechaInicio.value).toBe('2026-10-23');
  });

  it('bloquea otro POST de tratamiento tras resultado incierto sin reintentar automáticamente', () => {
    const component = fixture.componentInstance;
    crearTratamiento.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    component.form.patchValue({ descripcionTratamiento: 'Reposo', fechaInicio: '2026-10-23' });
    component.guardarSoloTratamiento(); component.guardarSoloTratamiento();
    expect(crearTratamiento).toHaveBeenCalledTimes(1);
    expect(component.tratamientoIncierto).toBeTrue();
    expect(component.form.controls.descripcionTratamiento.value).toBe('Reposo');
    expect(component.errorTratamiento).toContain('Revise el listado');
  });

  it('explica el 503 del bloqueo de receta sin atribuirle un resultado incierto', () => {
    const component = completar();
    crearReceta.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503,
      error: { title: 'Confirmación de recetas no disponible' } })));
    component.solicitarConfirmacion(); component.confirmar();
    expect(component.resultadoIncierto).toBeFalse();
    expect(component.error).toContain('bloqueada en el servidor');
    expect(component.form.controls.descripcionTratamiento.value).toBe('Reposo');
  });
});

describe('RecetaFormComponent con escritura de recetas deshabilitada', () => {
  it('bloquea la confirmación por defecto incluso si el formulario está completo', () => {
    const crearReceta = jasmine.createSpy('crearReceta');
    const crearTratamiento = jasmine.createSpy('crearTratamiento').and.returnValue(of({
      idTratamiento: 30, idConsulta: 17, idPaciente: 11, idMedico: 7,
      descripcion: 'Reposo', indicaciones: null, fechaInicio: '2026-10-23',
      fechaFin: '2026-10-27', idLote: null, cantidad: null,
    }));
    TestBed.configureTestingModule({
      imports: [RecetaFormComponent],
      providers: [
        { provide: HistorialService, useValue: { crearReceta, crearTratamiento, listarRecetas: () => of({
          items: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 0 }) } },
        { provide: InventarioService, useValue: { listarMedicamentos: () => of({
          items: [{ idMedicamento: 3, nombre: 'Prueba', presentacion: null, activo: true }],
          page: 1, pageSize: 100, totalCount: 1, totalPages: 1 }) } },
        { provide: PermisosService, useValue: { puedeConsultar: () => true, puedeCrear: () => true } },
        { provide: AuthSessionService, useValue: { isAuthenticated: () => true,
          currentUser: () => ({ idUsuario: 7 }), token: 'session-test' } },
        { provide: ApiErrorService, useValue: { messageFor: (_: unknown, fallback: string) => fallback } },
      ]
    });
    const fixture = TestBed.createComponent(RecetaFormComponent);
    fixture.componentRef.setInput('idConsulta', 17);
    fixture.componentRef.setInput('idPaciente', 11);
    fixture.componentRef.setInput('estadoConsulta', 'Abierta');
    fixture.componentRef.setInput('diagnosticos', [{ idDiagnostico: 4,
      idConsulta: 17, descripcion: 'Diagnóstico sintético', fechaRegistro: '2026-10-23T10:00:00Z' } as never]);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({ descripcionTratamiento: 'Reposo',
      fechaInicio: '2026-10-23', fechaFin: '2026-10-27' });
    component.agregarMedicamento();
    component.lineas.at(0).patchValue({ idMedicamento: 3, cantidadPrescritaUnidades: 10 });
    fixture.detectChanges();
    expect(component.escrituraAisladaHabilitada).toBeFalse();
    expect((fixture.nativeElement.querySelector('button[type=submit]') as HTMLButtonElement).disabled).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('pendiente de autorización operativa');
    component.solicitarConfirmacion();
    component.confirmar();
    expect(crearReceta).not.toHaveBeenCalled();
    component.lineas.clear();
    component.guardarSoloTratamiento();
    expect(crearTratamiento).toHaveBeenCalledTimes(1);
    expect(crearReceta).not.toHaveBeenCalled();
  });
});
