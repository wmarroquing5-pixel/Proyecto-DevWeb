import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { ActivatedRouteSnapshot, Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PermisoRequerido } from '../models/permiso.model';
import { ApiErrorService } from './api-error.service';
import { AuthSessionService } from './auth-session.service';
import { MenuService } from './menu.service';
import { PermisosService } from './permisos.service';

export type EstadoActualizacionAutorizacion =
  'inactiva' | 'programada' | 'actualizando' | 'actualizada' | 'error';

@Injectable({ providedIn: 'root' })
export class AutorizacionActualizacionService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly session = inject(AuthSessionService);
  private readonly permisos = inject(PermisosService);
  private readonly menu = inject(MenuService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly estadoState = signal<EstadoActualizacionAutorizacion>('inactiva');
  private temporizador?: ReturnType<typeof setTimeout>;
  private listenersActivos = false;
  private fallosConsecutivos = 0;
  private revisionForbiddenObservada = 0;
  private identidadObservada: string | null = null;
  private actualizacionEnCurso?: { identidad: string; observable: Observable<boolean> };

  readonly estado = this.estadoState.asReadonly();

  private readonly handleFocus = (): void => {
    if (this.document.visibilityState === 'visible') this.dispararRevalidacion();
  };

  private readonly handleVisibilityChange = (): void => {
    if (this.document.visibilityState === 'visible') {
      this.dispararRevalidacion();
    } else {
      this.limpiarTemporizador();
    }
  };

  constructor() {
    effect(() => {
      const identidad = this.identidadActual();
      if (identidad) {
        const cambioDeUsuario = this.identidadObservada !== null
          && this.identidadObservada !== identidad;
        this.identidadObservada = identidad;
        this.iniciarRecursos();
        if (cambioDeUsuario) this.dispararRevalidacion();
      } else {
        this.identidadObservada = null;
        this.detenerRecursos();
      }
    }, { allowSignalWrites: true });

    effect(() => {
      const revision = this.apiErrors.authorizationRefreshRevision();
      if (revision > this.revisionForbiddenObservada) {
        this.revisionForbiddenObservada = revision;
        if (this.identidadActual()) this.dispararRevalidacion();
      }
    }, { allowSignalWrites: true });

    this.destroyRef.onDestroy(() => this.detenerRecursos());
  }

  revalidarSiDesactualizado(): Observable<boolean> {
    const maxAge = environment.authorizationRefreshIntervalMs;
    if (!this.permisos.estaDesactualizado(maxAge) && !this.menu.estaDesactualizado(maxAge)) {
      return of(true);
    }
    return this.revalidarAhora();
  }

  revalidarAhora(): Observable<boolean> {
    const identidad = this.identidadActual();
    if (!identidad) return of(false);
    if (this.actualizacionEnCurso?.identidad === identidad) {
      return this.actualizacionEnCurso.observable;
    }

    this.limpiarTemporizador();
    this.permisos.invalidarSiCaducada(environment.authorizationMaxStaleMs);
    this.estadoState.set('actualizando');
    let siguienteRetraso = environment.authorizationRefreshIntervalMs;
    let request$!: Observable<boolean>;
    request$ = this.permisos.revalidarPermisos().pipe(
      switchMap(() => this.identidadActual() === identidad
        ? this.menu.loadMenu().pipe(
          map(() => true),
          catchError(() => of(false)),
        )
        : of(false)),
      tap(menuActualizado => {
        if (this.identidadActual() !== identidad) return;
        this.validarRutaActual();
        if (menuActualizado) {
          this.fallosConsecutivos = 0;
          this.estadoState.set('actualizada');
        } else {
          siguienteRetraso = this.registrarFallo();
        }
      }),
      catchError(() => {
        if (this.identidadActual() === identidad) {
          this.permisos.invalidarSiCaducada(environment.authorizationMaxStaleMs);
          this.validarRutaActual();
          siguienteRetraso = this.registrarFallo();
        }
        return of(false);
      }),
      finalize(() => {
        if (this.actualizacionEnCurso?.observable === request$) {
          this.actualizacionEnCurso = undefined;
          if (this.identidadActual() === identidad) this.programar(siguienteRetraso);
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.actualizacionEnCurso = { identidad, observable: request$ };
    return request$;
  }

  private iniciarRecursos(): void {
    if (!this.listenersActivos) {
      this.document.addEventListener('visibilitychange', this.handleVisibilityChange);
      this.document.defaultView?.addEventListener('focus', this.handleFocus);
      this.listenersActivos = true;
    }
    if (!this.temporizador && !this.actualizacionEnCurso
      && this.document.visibilityState === 'visible') {
      this.programar(environment.authorizationRefreshIntervalMs);
    }
  }

  private detenerRecursos(): void {
    this.limpiarTemporizador();
    if (this.listenersActivos) {
      this.document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.document.defaultView?.removeEventListener('focus', this.handleFocus);
      this.listenersActivos = false;
    }
    this.actualizacionEnCurso = undefined;
    this.fallosConsecutivos = 0;
    this.estadoState.set('inactiva');
  }

  private dispararRevalidacion(): void {
    this.revalidarAhora().subscribe({ error: () => undefined });
  }

  private programar(delayMs: number): void {
    this.limpiarTemporizador();
    if (!this.identidadActual() || this.document.visibilityState !== 'visible') return;
    if (this.estadoState() === 'inactiva') this.estadoState.set('programada');
    this.temporizador = setTimeout(() => {
      this.temporizador = undefined;
      this.dispararRevalidacion();
    }, delayMs);
  }

  private limpiarTemporizador(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = undefined;
  }

  private registrarFallo(): number {
    this.fallosConsecutivos += 1;
    this.estadoState.set('error');
    const esperaGradual = Math.min(
      environment.authorizationRetryBaseMs * 2 ** (this.fallosConsecutivos - 1),
      environment.authorizationRetryMaxMs,
    );
    const hastaCaducidad = this.permisos.tiempoHastaCaducidad(
      environment.authorizationMaxStaleMs,
    );
    return hastaCaducidad === null ? esperaGradual : Math.min(esperaGradual, hastaCaducidad);
  }

  private validarRutaActual(): void {
    if (!this.identidadActual()
      || this.router.url === '/acceso-denegado'
      || this.router.url === '/login') return;
    const requisitos = this.requisitosDeRuta(this.router.routerState.snapshot.root);
    if (requisitos.length > 0 && !this.permisos.tieneTodos(requisitos)) {
      void this.router.navigate(['/acceso-denegado'], { replaceUrl: true });
    }
  }

  private requisitosDeRuta(snapshot: ActivatedRouteSnapshot): readonly PermisoRequerido[] {
    const requisitos: PermisoRequerido[] = [];
    let actual: ActivatedRouteSnapshot | null = snapshot;
    while (actual) {
      const metadata = actual.data['permisos'];
      if (Array.isArray(metadata)) requisitos.push(...metadata as PermisoRequerido[]);
      actual = actual.firstChild;
    }
    return requisitos;
  }

  private identidadActual(): string | null {
    const userId = this.session.currentUser()?.idUsuario;
    const token = this.session.token;
    return this.session.isAuthenticated() && userId && token ? `${userId}:${token}` : null;
  }
}
