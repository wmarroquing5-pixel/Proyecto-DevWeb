import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { LoginResponse, User } from '../models/user.model';

export const AUTH_TOKEN_KEY = 'auth_token';
export const AUTH_USER_KEY = 'auth_user';
export const AUTH_EXPIRES_AT_KEY = 'auth_expires_at_utc';

const MAX_TIMEOUT_MS = 2_147_483_647;

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly router = inject(Router);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tokenState = signal<string | null>(null);
  private readonly expiresAtState = signal<number | null>(null);
  private readonly userState = signal<User | null>(null);
  private expirationTimer?: ReturnType<typeof setTimeout>;
  private redirectInProgress = false;

  readonly currentUser = this.userState.asReadonly();
  readonly isAuthenticated = computed(() =>
    this.tokenState() !== null && this.expiresAtState() !== null && this.userState() !== null,
  );

  private readonly handleVisibilityChange = (): void => {
    if (this.document.visibilityState === 'visible') {
      this.validateToken(true);
    }
  };

  private readonly handleWindowFocus = (): void => {
    this.validateToken(true);
  };

  constructor() {
    this.restoreSession();
    this.document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.document.defaultView?.addEventListener('focus', this.handleWindowFocus);
    this.destroyRef.onDestroy(() => {
      this.clearExpirationTimer();
      this.document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      this.document.defaultView?.removeEventListener('focus', this.handleWindowFocus);
    });
  }

  get token(): string | null {
    return this.validateToken(true) ? this.tokenState() : null;
  }

  establishSession(response: LoginResponse): void {
    const token = response.accessToken?.trim();
    const expiresAt = this.parseExpiration(response.expiresAtUtc);

    if (!token || expiresAt === null || expiresAt <= Date.now()) {
      this.clearSession(false);
      throw new Error('La API devolvió una sesión inválida o expirada.');
    }

    this.clearExpirationTimer();
    this.tokenState.set(token);
    this.expiresAtState.set(expiresAt);
    this.userState.set(null);
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_EXPIRES_AT_KEY, new Date(expiresAt).toISOString());
    localStorage.removeItem(AUTH_USER_KEY);
    this.scheduleExpiration(token, expiresAt);
  }

  setCurrentUser(user: User): void {
    if (!this.validateToken(true)) {
      throw new Error('La sesión expiró antes de completar la autenticación.');
    }

    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    this.userState.set(user);
  }

  validateAuthenticatedSession(redirectOnInvalid = false): boolean {
    const hadSession = this.hasSessionData();
    if (!this.validateToken(redirectOnInvalid) || !this.userState()) {
      if (hadSession && this.tokenState() !== null) {
        this.clearSession(redirectOnInvalid);
      }
      return false;
    }

    return true;
  }

  invalidateForToken(expectedToken: string): boolean {
    if (this.tokenState() !== expectedToken) {
      return false;
    }

    return this.clearSession(true);
  }

  logout(): void {
    this.clearSession(false);
    this.redirectToLogin();
  }

  private restoreSession(): void {
    const token = localStorage.getItem(AUTH_TOKEN_KEY)?.trim() || null;
    const rawUser = localStorage.getItem(AUTH_USER_KEY);
    const rawExpiration = localStorage.getItem(AUTH_EXPIRES_AT_KEY);

    if (!token || !rawUser) {
      this.clearSession(false);
      return;
    }

    const expiresAt = rawExpiration === null
      ? this.readJwtExpiration(token)
      : this.parseExpiration(rawExpiration);
    const user = this.parseUser(rawUser);

    if (expiresAt === null || expiresAt <= Date.now() || user === null) {
      this.clearSession(false);
      return;
    }

    this.tokenState.set(token);
    this.expiresAtState.set(expiresAt);
    this.userState.set(user);
    if (rawExpiration === null) {
      localStorage.setItem(AUTH_EXPIRES_AT_KEY, new Date(expiresAt).toISOString());
    }
    this.scheduleExpiration(token, expiresAt);
  }

  private validateToken(redirectOnInvalid: boolean): boolean {
    const token = this.tokenState();
    const expiresAt = this.expiresAtState();

    if (!token || expiresAt === null) {
      if (this.hasStoredSessionData()) {
        this.clearSession(redirectOnInvalid);
      }
      return false;
    }

    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY);
    const storedExpiration = this.parseExpiration(localStorage.getItem(AUTH_EXPIRES_AT_KEY));
    if (storedToken !== token || storedExpiration !== expiresAt || expiresAt <= Date.now()) {
      this.clearSession(redirectOnInvalid);
      return false;
    }

    return true;
  }

  private clearSession(redirect: boolean): boolean {
    const hadSession = this.hasSessionData() || this.hasStoredSessionData();
    this.clearExpirationTimer();
    this.tokenState.set(null);
    this.expiresAtState.set(null);
    this.userState.set(null);
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_EXPIRES_AT_KEY);
    localStorage.removeItem(AUTH_USER_KEY);

    if (redirect && hadSession) {
      this.redirectToLogin();
    }

    return hadSession;
  }

  private scheduleExpiration(token: string, expiresAt: number): void {
    this.clearExpirationTimer();
    const delay = expiresAt - Date.now();
    if (delay <= 0) {
      this.invalidateForToken(token);
      return;
    }

    this.expirationTimer = setTimeout(() => {
      if (expiresAt > Date.now()) {
        this.scheduleExpiration(token, expiresAt);
        return;
      }
      this.invalidateForToken(token);
    }, Math.min(delay, MAX_TIMEOUT_MS));
  }

  private clearExpirationTimer(): void {
    if (this.expirationTimer !== undefined) {
      clearTimeout(this.expirationTimer);
      this.expirationTimer = undefined;
    }
  }

  private redirectToLogin(): void {
    if (this.redirectInProgress || this.router.url === '/login') {
      return;
    }

    this.redirectInProgress = true;
    void Promise.resolve(this.router.navigate(['/login']))
      .finally(() => this.redirectInProgress = false);
  }

  private parseExpiration(value: string | null | undefined): number | null {
    if (!value) {
      return null;
    }

    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private readJwtExpiration(token: string): number | null {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    try {
      const payloadPart = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const paddedPayload = payloadPart.padEnd(Math.ceil(payloadPart.length / 4) * 4, '=');
      const payload = JSON.parse(atob(paddedPayload)) as { exp?: unknown };
      return typeof payload.exp === 'number' && Number.isFinite(payload.exp)
        ? payload.exp * 1000
        : null;
    } catch {
      return null;
    }
  }

  private parseUser(rawUser: string): User | null {
    try {
      const value = JSON.parse(rawUser) as Partial<User> | null;
      if (!value || typeof value.idUsuario !== 'number' || typeof value.idRol !== 'number'
        || typeof value.username !== 'string' || !value.username.trim()) {
        return null;
      }
      return value as User;
    } catch {
      return null;
    }
  }

  private hasSessionData(): boolean {
    return this.tokenState() !== null || this.expiresAtState() !== null || this.userState() !== null;
  }

  private hasStoredSessionData(): boolean {
    return localStorage.getItem(AUTH_TOKEN_KEY) !== null
      || localStorage.getItem(AUTH_EXPIRES_AT_KEY) !== null
      || localStorage.getItem(AUTH_USER_KEY) !== null;
  }
}
