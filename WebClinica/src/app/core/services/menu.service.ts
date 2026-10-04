import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MenuItem } from '../models/menu-item.model';
import { MOCK_MENU } from '../mock/menu.mock';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class MenuService {

  private http = inject(HttpClient);
  private auth = inject(AuthService);

  private _items = signal<MenuItem[]>([]);

  /** Menu ya filtrado por los roles del usuario (para renderizar) */
  readonly menu = computed(() => this.filterByRoles(this._items()));

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
    // MODO MOCK: devuelve el menu de desarrollo sin llamar a la API
    if (environment.useMockApi) {
      return of(MOCK_MENU).pipe(tap(items => this._items.set(items)));
    }
    return this.http.get<MenuItem[]>(`${environment.apiUrl}/menu`).pipe(
      tap(items => this._items.set(items)),
      shareReplay(1),
    );
  }

  /** Permite inyectar un menu mock durante el desarrollo */
  setMenu(items: MenuItem[]): void {
    this._items.set(items);
  }

  /** Filtrado en el cliente segun roles del usuario */
  private filterByRoles(items: MenuItem[]): MenuItem[] {
    return items
      .filter(i => !i.hidden && this.auth.hasRole(i.roles ?? []))
      .map(i => ({
        ...i,
        children: i.children ? this.filterByRoles(i.children) : undefined,
      }));
  }
}
