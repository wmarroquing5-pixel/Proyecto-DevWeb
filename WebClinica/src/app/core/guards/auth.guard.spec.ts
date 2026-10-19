import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

@Component({ standalone: true, template: '' })
class GuardTestPage {}

describe('authGuard', () => {
  let sessionValid: boolean;
  let validateSession: jasmine.Spy;
  beforeEach(() => {
    sessionValid = false;
    validateSession = jasmine.createSpy('validateSession').and.callFake(() => sessionValid);
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { validateSession } },
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
    sessionValid = true;
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/protected');
    expect(TestBed.inject(Router).url).toBe('/protected');
  });

  it('rechaza una sesión expirada después de que AuthService la valida', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/protected');
    expect(validateSession).toHaveBeenCalledTimes(1);
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('no vuelve a ejecutar el guard ni genera bucles en la ruta de login', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login');
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(validateSession).not.toHaveBeenCalled();
  });
});
