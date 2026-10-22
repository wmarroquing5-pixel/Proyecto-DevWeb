import { DestroyRef, effect, inject, untracked } from '@angular/core';
import { EMPTY, Observable, Subscription, defer, expand, reduce, tap } from 'rxjs';
import { PagedResponse } from '../../core/models/inventario.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { PermisosService } from '../../core/services/permisos.service';

export const idInventarioValido = (id: number): boolean =>
  Number.isInteger(id) && id > 0 && id <= 2_147_483_647;

export function fechaInventarioValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha <= '0001-01-01') return false;
  const valor = new Date(`${fecha}T00:00:00Z`);
  return Number.isFinite(valor.getTime()) && valor.toISOString().slice(0, 10) === fecha;
}

/** Carga atómica para los selectores existentes: nunca publica una primera página incompleta. */
export function cargarCatalogoInventario<T>(
  solicitar: (pagina: number, tamano: number) => Observable<PagedResponse<T>>,
  identificador: (item: T) => number,
): Observable<T[]> {
  return defer(() => {
    const ids = new Set<number>();
    let total: number | undefined;
    const leer = (pagina: number): Observable<PagedResponse<T>> => defer(() => solicitar(pagina, 100)).pipe(
      tap(res => {
        if (!res || !Array.isArray(res.items) || res.page !== pagina || res.pageSize !== 100 ||
          !Number.isSafeInteger(res.totalCount) || res.totalCount < 0 ||
          res.totalPages !== Math.ceil(res.totalCount / 100) ||
          res.items.length !== Math.min(100, Math.max(0, res.totalCount - (pagina - 1) * 100)) ||
          (total !== undefined && total !== res.totalCount)) {
          throw new Error('El catálogo cambió o devolvió paginación incoherente. Recargue el catálogo completo.');
        }
        total = res.totalCount;
        for (const item of res.items) {
          const id = identificador(item);
          if (!idInventarioValido(id) || ids.has(id)) {
            throw new Error('El catálogo contiene identificadores inválidos o duplicados. Recargue el catálogo.');
          }
          ids.add(id);
        }
      }),
    );
    return leer(1).pipe(
      expand(res => res.page < res.totalPages ? leer(res.page + 1) : EMPTY),
      reduce((items, pagina) => items.concat(pagina.items), [] as T[]),
    );
  });
}

/** Contexto local de estas vistas; no cambia sesión, JWT ni permisos compartidos. */
export class ContextoInventario {
  private readonly session = inject(AuthSessionService);
  private readonly permisos = inject(PermisosService);
  private solicitudes = new Subscription();
  private destruido = false;

  constructor(private readonly modulos: readonly string[]) {
    inject(DestroyRef).onDestroy(() => {
      this.destruido = true;
      this.solicitudes.unsubscribe();
    });
  }

  observar(reiniciar: () => void): void {
    let anterior = this.clave();
    effect(() => {
      const actual = this.clave();
      if (actual === anterior) return;
      anterior = actual;
      this.solicitudes.unsubscribe();
      this.solicitudes = new Subscription();
      untracked(reiniciar);
    });
  }

  clave(): string {
    const user = this.session.currentUser();
    const token = this.session.token;
    const autenticado = this.session.isAuthenticated();
    const permisos = this.modulos.map(modulo => [this.permisos.puedeConsultar(modulo),
      this.permisos.puedeCrear(modulo), this.permisos.puedeModificar(modulo),
      this.permisos.puedeEliminar(modulo)].join(',')).join(';');
    return `${autenticado && token && user ? `${user.idUsuario}:${user.idRol}:${token}` : ''}|${permisos}`;
  }

  vigente(clave: string): boolean {
    return !this.destruido && this.session.isAuthenticated() && !!this.session.token &&
      !!this.session.currentUser() && clave === this.clave();
  }

  agregar(solicitud: Subscription): void { this.solicitudes.add(solicitud); }
}
