import { CommonModule, DOCUMENT } from '@angular/common';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { Component, DestroyRef, effect, EventEmitter, inject, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Subscription } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ExamResultFileDto, ExamenResponseDto } from '../../core/models/historial.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { HistorialService } from '../../core/services/historial.service';
import { PermisosService } from '../../core/services/permisos.service';

const MAX_FILES = 4;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
export type ExamResultsMode = 'cerrado' | 'detalle' | 'archivos' | 'adjuntar';

@Component({
  selector: 'app-exam-results',
  imports: [CommonModule],
  template: `
    <section class="card mt-3 border-primary-subtle" aria-label="Resultados adjuntos del examen">
      <div class="card-header d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div><h4 class="h6 mb-0">Resultados de {{ exam.nombreExamen }}</h4>
          <small class="text-muted">{{ files.length }} archivo(s) · El estado indica adjuntos, no un estado clínico.</small></div>
        @if (mode === 'archivos' || mode === 'adjuntar') {
          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="reload()" [disabled]="loading || uploading">Actualizar archivos</button>
        }
      </div>
      <div class="card-body">
        @if (!canRead) {
          <p class="alert alert-warning mb-0" role="alert">No tiene acceso a los resultados de este examen.</p>
        } @else {
          @if (error) { <p class="alert alert-danger" role="alert">{{ error }}</p> }
          @if (notice) { <p class="alert alert-success" role="status">{{ notice }}</p> }
          @if (loading) { <p class="text-muted" role="status">Cargando archivos…</p> }
          @else if (files.length === 0) { <p class="text-muted">Pendiente: no hay archivos de resultado adjuntos.</p> }
          @else {
            <div class="table-responsive">
              <table class="table table-sm align-middle mb-0">
                <thead><tr><th scope="col">Archivo</th><th scope="col">Formato</th><th scope="col">Tamaño</th><th scope="col">Fecha de carga</th><th scope="col">Acciones</th></tr></thead>
                <tbody>
                  @for (file of files; track file.archivoId) {
                    <tr>
                      <td class="text-break">{{ file.nombreOriginal }}</td>
                      <td>{{ file.tipoContenido }}</td>
                      <td>{{ file.tamanoBytes / 1024 | number:'1.0-0' }} KB</td>
                      <td>{{ file.fechaCargaUtc | date:'dd/MM/yyyy HH:mm' }}</td>
                      <td><div class="d-flex flex-wrap gap-1">
                        <button type="button" class="btn btn-outline-primary btn-sm" (click)="view(file)">Ver</button>
                        <button type="button" class="btn btn-outline-secondary btn-sm" (click)="download(file)">Descargar</button>
                        @if (mode === 'adjuntar' && canDelete) { <button type="button" class="btn btn-outline-danger btn-sm" (click)="pendingDeleteId = file.archivoId">Eliminar</button> }
                      </div>
                      @if (mode === 'adjuntar' && pendingDeleteId === file.archivoId && canDelete) {
                        <div class="mt-2" role="group" aria-label="Confirmar eliminación">
                          <span class="small me-2">¿Eliminar este archivo?</span>
                          <button type="button" class="btn btn-danger btn-sm me-1" (click)="confirmDelete(file)" [disabled]="deleting">Confirmar</button>
                          <button type="button" class="btn btn-outline-secondary btn-sm" (click)="pendingDeleteId = null" [disabled]="deleting">Cancelar</button>
                        </div>
                      }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
          @if (previewUrl) {
            <div class="border rounded p-2 mt-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <strong>Vista previa de {{ previewName }}</strong>
                <button type="button" class="btn btn-outline-secondary btn-sm" (click)="closePreview()">Cerrar vista</button>
              </div>
              @if (previewPdf) {
                <iframe title="Vista previa del resultado PDF" sandbox referrerpolicy="no-referrer"
                  [src]="safePdfUrl" class="w-100 exam-preview-pdf"></iframe>
              } @else {
                <img [src]="previewUrl" [alt]="'Vista previa de ' + previewName" class="img-fluid exam-preview-image">
              }
            </div>
          }
          @if (canEditEmptyResults) {
            <div class="border-top mt-3 pt-3">
              <label class="form-label" for="exam-result-files">Adjuntar resultados (PDF, JPEG, PNG o WEBP; máximo 4 archivos de 5 MB)</label>
              <input id="exam-result-files" class="form-control" type="file" multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                (change)="selectFiles($event)" [disabled]="uploading">
              @if (selected.length > 0) {
                <ul class="list-group mt-2">
                  @for (file of selected; track $index) {
                    <li class="list-group-item d-flex justify-content-between align-items-center gap-2">
                      <span class="text-break">{{ file.name }} · {{ file.size / 1024 | number:'1.0-0' }} KB</span>
                      <button type="button" class="btn btn-outline-secondary btn-sm" (click)="removeSelected($index)" [disabled]="uploading">Retirar</button>
                    </li>
                  }
                </ul>
              }
              <button type="button" class="btn btn-primary mt-2" (click)="upload()" [disabled]="uploading || selected.length === 0">{{ uploading ? 'Cargando…' : 'Subir archivos' }}</button>
              @if (uploading) {
                <div class="progress mt-2" role="progressbar" [attr.aria-valuenow]="progress" aria-valuemin="0" aria-valuemax="100">
                  <div class="progress-bar" [style.width.%]="progress">{{ progress }}%</div>
                </div>
              }
            </div>
          }
        }
      </div>
    </section>
  `,
  styles: [`
    .exam-preview-pdf { height: min(70vh, 680px); border: 0; }
    .exam-preview-image { max-height: 70vh; object-fit: contain; }
  `],
})
export class ExamResultsComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) exam!: ExamenResponseDto;
  @Input({ required: true }) consultationId!: number;
  @Input({ required: true }) patientId!: number;
  @Input({ required: true }) mode!: ExamResultsMode;
  @Output() filesChanged = new EventEmitter<{ examId: number; count: number | null; firstUploadedAt: string | null }>();

  private readonly service = inject(HistorialService);
  private readonly session = inject(AuthSessionService);
  private readonly permissions = inject(PermisosService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private request?: Subscription;
  private revision = 0;
  private observedIdentity: string | null | undefined;
  private awaitingUploadIds: string[] = [];
  private awaitingDeleteId: string | null = null;

  files: ExamResultFileDto[] = [];
  selected: File[] = [];
  pendingDeleteId: string | null = null;
  loading = false;
  listVerified = false;
  uploading = false;
  deleting = false;
  progress = 0;
  error = '';
  notice = '';
  previewUrl: string | null = null;
  safePdfUrl: SafeResourceUrl | null = null;
  previewPdf = false;
  previewName = '';

  constructor() {
    effect(() => {
      const identity = this.identity();
      const read = this.permissions.puedeConsultar(MODULOS_PERMISO.HISTORIAL);
      const remove = this.permissions.puedeEliminar(MODULOS_PERMISO.HISTORIAL);
      if ((this.observedIdentity !== undefined && this.observedIdentity !== identity) || !read) {
        this.clear();
      }
      if (!remove) this.pendingDeleteId = null;
      this.observedIdentity = identity;
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['exam'] || changes['consultationId'] || changes['patientId']) {
      this.clear();
      if (this.canRead) this.reload();
    } else if (changes['mode']) {
      this.changeMode();
    }
  }

  ngOnDestroy(): void { this.clear(); }

  get canRead(): boolean {
    return !!this.identity() && this.permissions.puedeConsultar(MODULOS_PERMISO.HISTORIAL)
      && Number.isSafeInteger(this.exam?.idExamen) && this.exam.idExamen > 0
      && this.exam.idConsulta === this.consultationId && this.exam.idPaciente === this.patientId;
  }

  get canModify(): boolean {
    return this.canRead && this.permissions.puedeModificar(MODULOS_PERMISO.HISTORIAL);
  }

  get canDelete(): boolean {
    return this.canRead && this.permissions.puedeEliminar(MODULOS_PERMISO.HISTORIAL);
  }

  get canEditEmptyResults(): boolean {
    return this.mode === 'adjuntar' && this.canModify && this.listVerified
      && this.files.length === 0;
  }

  get canUpload(): boolean {
    return this.canEditEmptyResults && !this.loading && !this.uploading && !this.deleting;
  }

  reload(): void {
    if (!this.canRead || this.uploading || this.deleting) return;
    const revision = ++this.revision;
    const identity = this.identity();
    const id = this.exam.idExamen;
    this.request?.unsubscribe();
    this.loading = true;
    this.listVerified = false;
    this.error = '';
    this.request = this.service.listarArchivosExamen(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: files => {
        if (!this.current(revision, identity, id)) return;
        this.loading = false;
        if (!Array.isArray(files) || files.some(file => !/^[a-f0-9]{32}$/.test(file.archivoId))) {
          this.error = 'La API devolvió un listado de archivos inválido.';
          this.notifyUnverified(revision, identity, id);
          return;
        }
        this.files = files;
        this.listVerified = true;
        const count = files.length;
        const dates = files.map(file => Date.parse(file.fechaCargaUtc)).filter(Number.isFinite);
        const firstUploadedAt = dates.length ? new Date(Math.min(...dates)).toISOString() : null;
        queueMicrotask(() => {
          if (this.current(revision, identity, id)) this.filesChanged.emit({ examId: id, count, firstUploadedAt });
        });
        if (this.awaitingUploadIds.length) {
          if (this.awaitingUploadIds.every(uploaded => files.some(file => file.archivoId === uploaded))) {
            this.selected = [];
            this.notice = 'Archivos almacenados y verificados en el listado.';
          } else {
            this.error = 'La carga fue aceptada, pero uno o más archivos aún no aparecen. Actualice antes de repetir.';
            this.notice = '';
          }
          this.awaitingUploadIds = [];
        }
        if (this.awaitingDeleteId) {
          if (files.some(file => file.archivoId === this.awaitingDeleteId)) {
            this.error = 'La eliminación fue aceptada, pero el archivo aún aparece. Actualice el listado.';
            this.notice = '';
          } else this.notice = 'Archivo eliminado y listado actualizado.';
          this.awaitingDeleteId = null;
        }
      },
      error: (err: HttpErrorResponse) => {
        if (!this.current(revision, identity, id)) return;
        this.loading = false;
        this.error = this.apiErrors.messageFor(err, 'No se pudieron cargar los archivos de resultado.');
        this.notifyUnverified(revision, identity, id);
      },
    });
  }

  private notifyUnverified(revision: number, identity: string | null, examId: number): void {
    queueMicrotask(() => {
      if (this.current(revision, identity, examId))
        this.filesChanged.emit({ examId, count: null, firstUploadedAt: null });
    });
  }

  selectFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const incoming = Array.from(input.files ?? []);
    input.value = '';
    if (!this.canUpload) return;
    const next = [...this.selected, ...incoming];
    if (next.length > MAX_FILES || next.some(file => file.size < 1 || file.size > MAX_FILE_BYTES)
      || next.reduce((sum, file) => sum + file.size, 0) > MAX_FILES * MAX_FILE_BYTES
      || next.some(file => !/\.(pdf|jpe?g|png|webp)$/i.test(file.name))) {
      this.error = 'Seleccione hasta 4 PDF o imágenes válidas, de 5 MB como máximo cada una.';
      return;
    }
    this.selected = next;
    this.error = '';
  }

  removeSelected(index: number): void {
    if (this.mode === 'adjuntar' && !this.uploading)
      this.selected = this.selected.filter((_, position) => position !== index);
  }

  upload(): void {
    if (!this.canUpload || this.selected.length < 1) return;
    const revision = ++this.revision;
    const identity = this.identity();
    const id = this.exam.idExamen;
    this.uploading = true;
    this.progress = 0;
    this.error = this.notice = '';
    this.request = this.service.adjuntarArchivosExamen(id, this.selected)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: event => {
          if (!this.current(revision, identity, id)) return;
          if (event.type === HttpEventType.UploadProgress && event.total)
            this.progress = Math.min(100, Math.round(100 * event.loaded / event.total));
          if (event.type === HttpEventType.Response) {
            this.uploading = false;
            if (!Array.isArray(event.body) || event.body.length !== this.selected.length
              || new Set(event.body.map(file => file.archivoId)).size !== event.body.length
              || event.body.some(file => !/^[a-f0-9]{32}$/.test(file.archivoId))) {
              this.error = 'La confirmación de carga es inconsistente. Actualice el listado antes de repetir.';
              return;
            }
            this.awaitingUploadIds = event.body.map(file => file.archivoId);
            this.notice = 'Carga aceptada; verificando archivos almacenados.';
            this.reload();
          }
        },
        error: (err: HttpErrorResponse) => {
          if (!this.current(revision, identity, id)) return;
          this.uploading = false;
          this.error = err.status === 0 || err.status >= 500
            ? 'Resultado incierto: actualice la lista antes de repetir la carga. Algunos archivos pueden haberse guardado.'
            : this.apiErrors.messageFor(err, 'No se pudieron adjuntar los archivos.');
        },
      });
  }

  view(file: ExamResultFileDto): void { this.fetch(file, true); }
  download(file: ExamResultFileDto): void { this.fetch(file, false); }

  private fetch(file: ExamResultFileDto, preview: boolean): void {
    if (!this.canRead || !this.files.some(item => item.archivoId === file.archivoId)) return;
    const revision = this.revision;
    const identity = this.identity();
    const id = this.exam.idExamen;
    this.error = '';
    this.service.descargarArchivoExamen(id, file.archivoId)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: blob => {
          if (!this.current(revision, identity, id)) return;
          if (blob.size < 1 || blob.size > MAX_FILE_BYTES || blob.type !== file.tipoContenido) {
            this.error = 'La descarga no coincide con los metadatos del resultado.';
            return;
          }
          const url = URL.createObjectURL(blob);
          if (preview) {
            this.closePreview();
            this.previewUrl = url;
            this.previewPdf = file.tipoContenido === 'application/pdf';
            this.safePdfUrl = this.previewPdf ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
            this.previewName = file.nombreOriginal;
          } else {
            const link = this.document.createElement('a');
            link.href = url;
            link.download = file.nombreOriginal;
            link.rel = 'noopener noreferrer';
            link.click();
            setTimeout(() => URL.revokeObjectURL(url), 0);
          }
        },
        error: (err: HttpErrorResponse) => {
          if (this.current(revision, identity, id))
            this.error = this.apiErrors.messageFor(err, 'No se pudo obtener el archivo de resultado.');
        },
      });
  }

  confirmDelete(file: ExamResultFileDto): void {
    if (this.mode !== 'adjuntar' || !this.canDelete || this.deleting || this.pendingDeleteId !== file.archivoId) return;
    const revision = ++this.revision;
    const identity = this.identity();
    const id = this.exam.idExamen;
    this.deleting = true;
    this.error = this.notice = '';
    this.service.eliminarArchivoExamen(id, file.archivoId)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => {
          if (!this.current(revision, identity, id)) return;
          this.deleting = false;
          this.pendingDeleteId = null;
          this.closePreview();
          this.awaitingDeleteId = file.archivoId;
          this.notice = 'Archivo eliminado. Actualizando listado.';
          this.reload();
        },
        error: (err: HttpErrorResponse) => {
          if (!this.current(revision, identity, id)) return;
          this.deleting = false;
          this.error = this.apiErrors.messageFor(err, 'No se pudo eliminar el archivo.');
        },
      });
  }

  closePreview(): void {
    if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
    this.previewUrl = null;
    this.safePdfUrl = null;
    this.previewName = '';
    this.previewPdf = false;
  }

  private changeMode(): void {
    const interrupted = this.uploading || this.deleting;
    this.revision++;
    this.request?.unsubscribe();
    this.request = undefined;
    this.loading = this.uploading = this.deleting = false;
    this.listVerified = false;
    this.selected = [];
    this.pendingDeleteId = null;
    this.progress = 0;
    this.closePreview();
    this.error = '';
    this.notice = interrupted
      ? 'Operación interrumpida. Compruebe el listado actualizado antes de intentar otra acción.' : '';
    if (this.mode !== 'cerrado' && this.canRead) this.reload();
  }

  private clear(): void {
    this.revision++;
    this.request?.unsubscribe();
    this.request = undefined;
    this.closePreview();
    this.files = this.selected = [];
    this.pendingDeleteId = null;
    this.loading = this.uploading = this.deleting = false;
    this.listVerified = false;
    this.progress = 0;
    this.awaitingUploadIds = [];
    this.awaitingDeleteId = null;
    this.error = this.notice = '';
  }

  private current(revision: number, identity: string | null, examId: number): boolean {
    return revision === this.revision && identity === this.identity()
      && this.canRead && this.exam.idExamen === examId;
  }

  private identity(): string | null {
    const user = this.session.currentUser();
    const token = this.session.token;
    return this.session.isAuthenticated() && user && token
      ? `${user.idUsuario}:${user.idRol}:${token}` : null;
  }
}
