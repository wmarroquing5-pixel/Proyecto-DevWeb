import { HttpErrorResponse, HttpEvent, HttpEventType, HttpResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ExamResultFileDto, ExamenResponseDto } from '../../core/models/historial.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { HistorialService } from '../../core/services/historial.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ExamResultsComponent, ExamResultsMode } from './exam-results.component';

describe('ExamResultsComponent', () => {
  const exam: ExamenResponseDto = {
    idExamen: 8, idConsulta: 17, idPaciente: 11, idMedico: 7,
    idDiagnostico: null, idTurno: null, nombreExamen: 'Hemograma',
    fechaExamen: '2026-10-22T10:00:00', fechaResultado: null, prioridad: 'Media',
  };
  const stored: ExamResultFileDto = {
    archivoId: 'a'.repeat(32), nombreOriginal: 'informe.pdf', tipoContenido: 'application/pdf',
    tamanoBytes: 4, fechaCargaUtc: '2026-10-22T10:00:00Z', idUsuarioCarga: 7,
  };
  let fixture: ComponentFixture<ExamResultsComponent>;
  let read = signal(true);
  let modify = signal(true);
  let remove = signal(true);
  let authenticated = signal(true);
  let list: jasmine.Spy<(id: number) => Observable<ExamResultFileDto[]>>;
  let upload: jasmine.Spy<(id: number, files: readonly File[]) => Observable<HttpEvent<ExamResultFileDto[]>>>;
  let get: jasmine.Spy;
  let deleteFile: jasmine.Spy;

  beforeEach(() => {
    read = signal(true); modify = signal(true); remove = signal(true); authenticated = signal(true);
    list = jasmine.createSpy('listarArchivosExamen').and.returnValue(of([]));
    upload = jasmine.createSpy('adjuntarArchivosExamen').and.returnValue(of(new HttpResponse({ body: [stored] })));
    get = jasmine.createSpy('descargarArchivoExamen').and.returnValue(
      of(new Blob(['file'], { type: 'application/pdf' })));
    deleteFile = jasmine.createSpy('eliminarArchivoExamen').and.returnValue(of(void 0));
    TestBed.configureTestingModule({
      imports: [ExamResultsComponent],
      providers: [
        { provide: HistorialService, useValue: {
          listarArchivosExamen: list, adjuntarArchivosExamen: upload,
          descargarArchivoExamen: get, eliminarArchivoExamen: deleteFile,
        } },
        { provide: AuthSessionService, useValue: {
          isAuthenticated: () => authenticated(),
          currentUser: () => ({ idUsuario: 7, idRol: 1 }),
          token: 'test-session',
        } },
        { provide: PermisosService, useValue: {
          puedeConsultar: () => read(), puedeModificar: () => modify(),
          puedeEliminar: () => remove(),
        } },
        { provide: ApiErrorService, useValue: { messageFor: (_: unknown, fallback: string) => fallback } },
      ],
    });
  });

  function render(mode: ExamResultsMode = 'adjuntar'): ExamResultsComponent {
    fixture = TestBed.createComponent(ExamResultsComponent);
    fixture.componentRef.setInput('exam', exam);
    fixture.componentRef.setInput('consultationId', 17);
    fixture.componentRef.setInput('patientId', 11);
    fixture.componentRef.setInput('mode', mode);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('lista archivos y emite la cantidad verificada', async () => {
    list.and.returnValue(of([stored]));
    const component = render();
    const changed = jasmine.createSpy('filesChanged');
    component.filesChanged.subscribe(changed);
    component.reload();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(list).toHaveBeenCalledWith(8);
    expect(changed).toHaveBeenCalledWith({ examId: 8, count: 1,
      firstUploadedAt: '2026-10-22T10:00:00.000Z' });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('informe.pdf');
  });

  it('rechaza contexto de paciente ajeno y revocación de permiso sin llamar a la API', () => {
    const component = render();
    list.calls.reset();
    fixture.componentRef.setInput('patientId', 12);
    fixture.detectChanges();
    expect(component.canRead).toBeFalse();
    expect(list).not.toHaveBeenCalled();
    fixture.componentRef.setInput('patientId', 11);
    fixture.detectChanges();
    read.set(false);
    fixture.detectChanges();
    expect(component.files).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No tiene acceso');
  });

  it('selecciona varios archivos, retira uno y muestra progreso y recarga tras subir', () => {
    const stream = new Subject<HttpEvent<ExamResultFileDto[]>>();
    upload.and.returnValue(stream);
    const component = render();
    const first = new File(['A'], 'uno.pdf', { type: 'application/pdf' });
    const second = new File(['B'], 'dos.png', { type: 'image/png' });
    component.selectFiles({ target: { files: [first, second], value: 'seleccion' } } as unknown as Event);
    expect(component.selected).toEqual([first, second]);
    component.removeSelected(1);
    expect(component.selected).toEqual([first]);
    list.and.returnValue(of([stored]));
    component.upload();
    expect(upload).toHaveBeenCalledOnceWith(8, [first]);
    stream.next({ type: HttpEventType.UploadProgress, loaded: 1, total: 2 });
    expect(component.progress).toBe(50);
    stream.next(new HttpResponse({ body: [stored], status: 201 }));
    expect(component.uploading).toBeFalse();
    expect(component.files).toEqual([stored]);
    expect(component.selected).toEqual([]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('input[type=file]')).toBeNull();
  });

  it('no permite iniciar carga si el listado falla o confirma archivos existentes', () => {
    list.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    const component = render('adjuntar');
    const root = fixture.nativeElement as HTMLElement;
    expect(component.listVerified).toBeFalse();
    expect(root.querySelector('input[type=file]')).toBeNull();
    expect(root.textContent).toContain('No se pudieron consultar los resultados');
    expect(root.textContent).not.toContain('0 archivo(s)');
    expect(root.textContent).not.toContain('Pendiente: no hay archivos');
    expect(root.textContent).toContain('Reintentar');
    component.selectFiles({ target: { files: [new File(['A'], 'nuevo.pdf')], value: 'x' } } as unknown as Event);
    component.upload();
    expect(upload).not.toHaveBeenCalled();
    list.and.returnValue(of([stored]));
    component.reload(); fixture.detectChanges();
    expect(component.listVerified).toBeTrue();
    expect(component.canUpload).toBeFalse();
    expect(root.querySelector('input[type=file]')).toBeNull();
    component.upload();
    expect(upload).not.toHaveBeenCalled();
  });

  it('conserva selección ante error incierto y no repite una carga', () => {
    upload.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    const component = render();
    const file = new File(['A'], 'uno.pdf');
    component.selectFiles({ target: { files: [file], value: 'x' } } as unknown as Event);
    component.upload();
    expect(component.selected).toEqual([file]);
    expect(component.error).toContain('Resultado incierto');
    expect(upload).toHaveBeenCalledTimes(1);
  });

  it('pide confirmación antes de eliminar y oculta la acción sin permiso Eliminar', () => {
    list.and.returnValue(of([stored]));
    const component = render();
    component.pendingDeleteId = stored.archivoId;
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('¿Eliminar este archivo?');
    component.pendingDeleteId = null;
    component.confirmDelete(stored);
    expect(deleteFile).not.toHaveBeenCalled();
    remove.set(false);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Eliminar');
    remove.set(true);
    fixture.detectChanges();
    component.pendingDeleteId = stored.archivoId;
    list.and.returnValue(of([]));
    component.confirmDelete(stored);
    expect(deleteFile).toHaveBeenCalledOnceWith(8, stored.archivoId);
    expect(component.files).toEqual([]);
  });

  it('no permite adjuntar sin permiso Modificar y valida límites antes de llamar a la API', () => {
    const component = render();
    modify.set(false);
    fixture.detectChanges();
    component.selectFiles({ target: { files: [new File(['A'], 'uno.pdf')], value: 'x' } } as unknown as Event);
    component.upload();
    expect(upload).not.toHaveBeenCalled();
    modify.set(true);
    TestBed.flushEffects();
    component.selectFiles({ target: { files: [new File(['A'], 'falso.exe')], value: 'x' } } as unknown as Event);
    expect(component.error).toContain('hasta 4 PDF');
    expect(component.selected).toEqual([]);
  });

  it('descarga y abre una vista previa únicamente para un archivo listado', () => {
    list.and.returnValue(of([stored]));
    const component = render();
    const objectUrl = spyOn(URL, 'createObjectURL').and.returnValue('blob:test-result');
    spyOn(URL, 'revokeObjectURL');
    spyOn(HTMLAnchorElement.prototype, 'click');
    component.view(stored);
    fixture.detectChanges();
    expect(get).toHaveBeenCalledWith(8, stored.archivoId);
    expect(component.previewPdf).toBeTrue();
    component.closePreview();
    component.download(stored);
    expect(objectUrl).toHaveBeenCalledTimes(2);
    component.view({ ...stored, archivoId: 'b'.repeat(32) });
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('en detalle muestra documentos de lectura sin controles de carga ni eliminación', () => {
    list.and.returnValue(of([stored]));
    render('detalle');
    const panel = fixture.nativeElement as HTMLElement;
    expect(panel.textContent).toContain('informe.pdf');
    expect(panel.textContent).toContain('1 archivo(s)');
    expect(panel.textContent).toContain('Ver');
    expect(panel.textContent).toContain('Descargar');
    expect(panel.querySelector('input[type=file]')).toBeNull();
    expect(panel.textContent).not.toContain('Subir archivos');
    expect(panel.textContent).not.toContain('Eliminar');
    expect(panel.textContent).not.toContain('Actualizar archivos');
  });

  it('en archivos permite consultar y actualizar sin mostrar carga', () => {
    list.and.returnValue(of([stored]));
    const component = render('archivos');
    const panel = fixture.nativeElement as HTMLElement;
    expect(panel.textContent).toContain('informe.pdf');
    expect(panel.textContent).toContain('application/pdf');
    expect(panel.textContent).toContain('Fecha de carga');
    expect(panel.textContent).toContain('Actualizar archivos');
    expect(panel.querySelector('input[type=file]')).toBeNull();
    expect(panel.textContent).not.toContain('Subir archivos');
    component.reload();
    expect(list).toHaveBeenCalledTimes(2);
    component.selectFiles({ target: { files: [new File(['A'], 'otro.pdf')], value: 'x' } } as unknown as Event);
    component.upload();
    expect(component.selected).toEqual([]);
    expect(upload).not.toHaveBeenCalled();
  });

  it('al salir de adjuntar descarta la selección temporal y conserva archivos almacenados', () => {
    const component = render('adjuntar');
    expect((fixture.nativeElement as HTMLElement).querySelector('input[type=file]')).not.toBeNull();
    component.selectFiles({ target: { files: [new File(['A'], 'nuevo.pdf')], value: 'x' } } as unknown as Event);
    expect(component.selected.length).toBe(1);
    list.and.returnValue(of([stored]));
    fixture.componentRef.setInput('mode', 'detalle');
    fixture.detectChanges();
    expect(component.selected).toEqual([]);
    expect(component.files).toEqual([stored]);
    expect((fixture.nativeElement as HTMLElement).querySelector('input[type=file]')).toBeNull();
    component.upload();
    expect(upload).not.toHaveBeenCalled();
    fixture.componentRef.setInput('mode', 'archivos');
    fixture.detectChanges();
    expect(component.files).toEqual([stored]);
  });

  it('interrumpe una carga en curso al cambiar de modo y solicita un listado actualizado', () => {
    const stream = new Subject<HttpEvent<ExamResultFileDto[]>>();
    upload.and.returnValue(stream);
    const component = render('adjuntar');
    component.selectFiles({ target: { files: [new File(['A'], 'nuevo.pdf')], value: 'x' } } as unknown as Event);
    component.upload();
    expect(stream.observed).toBeTrue();
    list.and.returnValue(of([stored]));
    fixture.componentRef.setInput('mode', 'archivos');
    fixture.detectChanges();
    expect(stream.observed).toBeFalse();
    expect(component.uploading).toBeFalse();
    expect(component.selected).toEqual([]);
    expect(component.files).toEqual([stored]);
    expect(component.notice).toContain('Compruebe el listado');
  });

  it('visualiza una imagen registrada en modo archivos sin ofrecer acciones de escritura', () => {
    const image: ExamResultFileDto = { ...stored, archivoId: 'b'.repeat(32), nombreOriginal: 'imagen.webp',
      tipoContenido: 'image/webp' };
    list.and.returnValue(of([image]));
    get.and.returnValue(of(new Blob(['image'], { type: 'image/webp' })));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:test-image');
    spyOn(URL, 'revokeObjectURL');
    const component = render('archivos');
    component.view(image);
    fixture.detectChanges();
    expect(component.previewPdf).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).querySelector('img.exam-preview-image')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('input[type=file]')).toBeNull();
    expect(deleteFile).not.toHaveBeenCalled();
  });
});
