import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

@Component({ standalone: true, template: '' })
class GuardTestPage {}

describe('authGuard', () => {
  let authenticated: boolean;
  beforeEach(() => {
    authenticated = false;
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { isAuthenticated: () => authenticated } },
      provideRouter([
        { path: 'login', component: GuardTestPage },
        { path: 'protected', component: GuardTestPage, canActivate: [authGuard] },
      ]),
    ] });
  });

  it('redirige al login al abrir una ruta protegida sin sesión', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/protected');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('permite la ruta protegida con sesión', async () => {
    authenticated = true;
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/protected');
    expect(TestBed.inject(Router).url).toBe('/protected');
  });
});
