import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginResponse, User } from '../models/user.model';
import { AuthSessionService } from './auth-session.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AuthSessionService);
  readonly currentUser = this.session.currentUser;
  readonly isAuthenticated = this.session.isAuthenticated;

  get token(): string | null {
    return this.session.token;
  }

  login(usuario: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, {
        username: usuario,   // 👈 "username" coincide con LoginRequest.Username
        password,
      })
      .pipe(tap(response => this.session.establishSession(response)));
  }

  /** Carga el usuario desde GET /api/auth/me */
  loadCurrentUser(): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/auth/me`).pipe(
      tap(user => {
        const normalized: User = {
          ...user,
          id: user.idUsuario,
          fullName: user.fullName ?? user.username,
        };
        this.session.setCurrentUser(normalized);
      })
    );
  }

  logout(): void {
    this.session.logout();
  }

  validateSession(): boolean {
    return this.session.validateAuthenticatedSession();
  }

  hasRole(roles: string[]): boolean {
    if (!roles || roles.length === 0) return true;
    const user = this.currentUser();
    return !!user && !!user.roles && roles.some(r => user.roles?.includes(r));
  }

}
