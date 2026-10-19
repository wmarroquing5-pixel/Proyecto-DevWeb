import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MenuItem } from '../models/menu-item.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class MenuService {

  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private _items = signal<MenuItem[]>([]);

  /** La API filtra por permisos; aquí solo se ocultan elementos de presentación. */
  readonly menu = computed(() => this.filterVisibleItems(this._items()));

  constructor() {
    // Si el usuario recarga la pagina con sesion activa, volver a cargar el menu
    if (this.auth.isAuthenticated()) {
      this.loadMenu().subscribe();
    }
  }

  /**
   * Carga el menu desde la API .NET.
   * Recomendado: que el backend ya lo devuelva filtrado por rol.
   * shareReplay(1) evita peticiones repetidas.
   */
  loadMenu(): Observable<MenuItem[]> {
    return this.http.get<MenuItem[]>(`${environment.apiUrl}/menu`).pipe(
      tap(items => this._items.set(items)),
      shareReplay(1),
    );
  }

  /** Permite inyectar un menu mock durante el desarrollo */
  setMenu(items: MenuItem[]): void {
    this._items.set(items);
  }

  /** /auth/me no entrega roles; los roles decorativos del menú no son permisos. */
  private filterVisibleItems(items: MenuItem[]): MenuItem[] {
    return items
      .filter(i => !i.hidden)
      .map(i => ({
        ...i,
        children: i.children ? this.filterVisibleItems(i.children) : undefined,
      }));
  }
}
