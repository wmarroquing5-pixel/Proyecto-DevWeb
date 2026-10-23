import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { RecetaClinicaDetalleDto } from '../../core/models/historial.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { HistorialService } from '../../core/services/historial.service';
import { InventarioService } from '../../core/services/inventario.service';
import { PermisosService } from '../../core/services/permisos.service';
import { RecetaFormComponent } from './receta-form.component';

describe('RecetaFormComponent', () => {
  let fixture: ComponentFixture<RecetaFormComponent>;
  let crearReceta: jasmine.Spy;
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
      nombreMedicamento: 'Medicamento sintético', destinoMedicamento: 'Clinica',
      duracionDias: 5, cantidadPrescritaUnidades: 10,
      unidadInventario: 'tableta',
    }],
  };

  beforeEach(() => {
    crearReceta = jasmine.createSpy('crearReceta').and.returnValue(of(receta));
    TestBed.configureTestingModule({
      imports: [RecetaFormComponent],
      providers: [
        { provide: HistorialService, useValue: {
          crearReceta, listarRecetas: () => of(page([])),
          obtenerReceta: () => of(receta),
        } },
        { provide: InventarioService, useValue: {
          listarMedicamentos: () => of(page([{
            idMedicamento: 3, nombre: 'Medicamento sintético',
            presentacion: 'Caja de tabletas', activo: true,
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
      cantidadPrescritaUnidades: 10, destinoMedicamento: 'Clinica' });
    fixture.detectChanges();
    return component;
  }

  function tarjetaReceta(): HTMLElement {
    const cards = fixture.nativeElement.querySelectorAll('.receta-form section.card') as NodeListOf<HTMLElement>;
    return Array.from(cards).find(card => card.querySelector('h4')?.textContent?.includes('Receta médica'))!;
  }

  it('exige unidad de entrega y presenta la presentación sin convertir cantidades', () => {
    const component = completar();
    const presentacion = fixture.nativeElement.querySelector('#receta-presentacion-0') as HTMLInputElement;
    expect(presentacion.value).toBe('Caja de tabletas');
    expect(presentacion.readOnly).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('La cantidad y la unidad de entrega deben indicarse directamente');
    component.solicitarConfirmacion();
    expect(component.confirmacionAbierta).toBeFalse();
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
    expect(card.textContent).toContain('idempotencia persistentes aún no aprobadas');
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
    expect(card.textContent).toContain('Guardar tratamiento y receta');
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
    const indicaciones = remove.closest('.indicaciones-heading') as HTMLElement;
    expect(indicaciones.querySelector('label')?.textContent).toContain('Destino');
    expect(indicaciones.nextElementSibling?.tagName).toBe('SELECT');
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
    component.lineas.at(0).controls.unidadInventario.setValue('tableta');
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
    component.lineas.at(0).controls.unidadInventario.setValue('primero');
    component.lineas.at(1).controls.unidadInventario.setValue('segundo');
    component.lineas.at(2).controls.unidadInventario.setValue('tercero');
    fixture.detectChanges();
    component.quitarMedicamento(1);
    fixture.detectChanges();
    expect(component.lineas.length).toBe(3);
    expect(fixture.nativeElement.textContent).toContain('Se eliminarán los datos ingresados para este medicamento.');
    expect(fixture.nativeElement.textContent).toContain('Conservar');
    component.confirmarEliminacion();
    fixture.detectChanges();
    expect(component.lineas.length).toBe(2);
    expect(component.lineas.at(0).controls.unidadInventario.value).toBe('primero');
    expect(component.lineas.at(1).controls.unidadInventario.value).toBe('tercero');
    expect(fixture.nativeElement.textContent).toContain('Medicamento 2');
    expect(fixture.nativeElement.textContent).not.toContain('Medicamento 3');
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('Cancelar descarta solo la receta tras confirmar y conserva el tratamiento', () => {
    const component = fixture.componentInstance;
    component.form.patchValue({ descripcionTratamiento: 'Reposo', fechaInicio: '2026-10-23' });
    component.agregarMedicamento();
    component.lineas.at(0).controls.unidadInventario.setValue('con datos');
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
    component.lineas.at(0).controls.unidadInventario.setValue('conservar');
    component.cancelar();
    fixture.detectChanges();
    expect(component.cancelacionPendiente).toBeTrue();
    (fixture.nativeElement.querySelector('app-confirm-dialog button.btn-secondary') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.cancelacionPendiente).toBeFalse();
    expect(component.lineas.at(0).controls.unidadInventario.value).toBe('conservar');
    component.lineas.at(0).controls.unidadInventario.setValue('');
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
    component.solicitarConfirmacion();
    expect(component.error).toContain('Revise los campos');
    component.lineas.at(0).controls.unidadInventario.setValue('tableta');
    fixture.detectChanges();
    expect(confirm.disabled).toBeFalse();
  });

  it('confirma una cantidad directa con clave de operación y sin selección de lote', () => {
    const component = completar();
    component.lineas.at(0).patchValue({ unidadInventario: 'tableta' });
    expect(component.form.valid).withContext(JSON.stringify(component.form.getRawValue())).toBeTrue();
    component.solicitarConfirmacion();
    expect(component.confirmacionAbierta).withContext(component.error).toBeTrue();
    component.confirmar();
    expect(crearReceta).toHaveBeenCalledTimes(1);
    const solicitud = crearReceta.calls.mostRecent().args[0];
    expect(solicitud.idConsulta).toBe(17);
    expect(solicitud.idDiagnostico).toBe(4);
    expect(solicitud.claveOperacion).toMatch(/^[0-9a-f-]{36}$/);
    expect(solicitud.lineas[0].cantidadPrescritaUnidades).toBe(10);
    expect(solicitud.lineas[0].unidadInventario).toBe('tableta');
    expect(solicitud.lineas[0].destinoMedicamento).toBe('Clinica');
    expect(Object.keys(solicitud.lineas[0]).sort()).toEqual([
      'cantidadPrescritaUnidades', 'destinoMedicamento', 'idMedicamento', 'unidadInventario']);
    expect(solicitud.lineas[0].idLote).toBeUndefined();
    expect(component.aviso).toContain('receta confirmados');
  });

  it('calcula días inclusivos y no muestra los campos clínicos retirados', () => {
    const component = completar();
    expect(component.duracionCalculada).toBe(5);
    component.form.controls.fechaFin.setValue('2026-10-23');
    fixture.detectChanges();
    expect(component.duracionCalculada).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('1 días de consumo');
    for (const id of ['#receta-dosis-0', '#receta-unidad-0', '#receta-via-0', '#receta-frecuencia-0'])
      expect(fixture.nativeElement.querySelector(id)).toBeNull();
  });

  it('exige destino y fecha final sin enviar una solicitud incompleta', () => {
    const component = completar();
    component.lineas.at(0).controls.unidadInventario.setValue('tableta');
    component.lineas.at(0).controls.destinoMedicamento.setValue('');
    component.solicitarConfirmacion();
    fixture.detectChanges();
    expect(component.lineas.at(0).controls.destinoMedicamento.touched).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Seleccione un destino válido');
    expect(crearReceta).not.toHaveBeenCalled();
    component.lineas.at(0).controls.destinoMedicamento.setValue('CompraExterna');
    component.form.controls.fechaFin.setValue('');
    component.solicitarConfirmacion();
    expect(component.error).toContain('Revise los campos');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Seleccione la fecha de finalización.');
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('reintenta con la misma clave y cuerpo tras una respuesta de red incierta', () => {
    const component = completar();
    component.lineas.at(0).patchValue({ unidadInventario: 'tableta' });
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

  it('envía CompraExterna como cadena y conserva cantidad y unidad independientes', () => {
    const component = completar();
    component.lineas.at(0).patchValue({ unidadInventario: 'frasco', destinoMedicamento: 'CompraExterna' });
    crearReceta.and.returnValue(of({ ...receta, lineas: [{ ...receta.lineas[0],
      unidadInventario: 'frasco', destinoMedicamento: 'CompraExterna' }] }));
    component.solicitarConfirmacion();
    component.confirmar();
    const linea = crearReceta.calls.mostRecent().args[0].lineas[0];
    expect(linea.destinoMedicamento).toBe('CompraExterna');
    expect(typeof linea.destinoMedicamento).toBe('string');
    expect(linea.cantidadPrescritaUnidades).toBe(10);
    expect(linea.unidadInventario).toBe('frasco');
    expect(component.aviso).toContain('receta confirmados');
  });

  it('no da por guardada una receta si la respuesta cambia el destino', () => {
    const component = completar();
    component.lineas.at(0).patchValue({ unidadInventario: 'tableta', destinoMedicamento: 'CompraExterna' });
    component.solicitarConfirmacion();
    component.confirmar();
    expect(component.resultadoIncierto).toBeTrue();
    expect(component.error).toContain('inconsistente');
    expect(component.aviso).toBe('');
  });

  it('rechaza una cantidad escrita como unidad de entrega', () => {
    const component = completar();
    component.lineas.at(0).controls.unidadInventario.setValue('10');
    component.solicitarConfirmacion();
    fixture.detectChanges();
    expect(component.confirmacionAbierta).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('no solo una cantidad');
    expect(crearReceta).not.toHaveBeenCalled();
  });

  it('muestra el error específico del destino junto al selector y omite el mensaje request', () => {
    const component = completar();
    component.lineas.at(0).controls.unidadInventario.setValue('tableta');
    crearReceta.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: {
      errors: { request: ['The request field is required.'],
        '$.lineas[0].destinoMedicamento': ['The JSON value could not be converted.'] }
    } })));
    component.solicitarConfirmacion();
    component.confirmar();
    fixture.detectChanges();
    expect(component.errorDestinoIndice).toBe(0);
    expect(component.error).toContain('El destino del medicamento no es válido');
    expect(fixture.nativeElement.textContent).toContain('Seleccione un destino válido');
    expect(fixture.nativeElement.textContent).not.toContain('The request field is required');
  });
});
