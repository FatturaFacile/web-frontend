import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { iamErrorInterceptor } from './iam-error.interceptor';
import { PermissionStore } from './permission.store';

describe('iamErrorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  const store = { reload: vi.fn().mockResolvedValue(undefined) };
  const router = { navigateByUrl: vi.fn().mockResolvedValue(true) };

  beforeEach(() => {
    store.reload.mockClear();
    router.navigateByUrl.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([iamErrorInterceptor])),
        provideHttpClientTesting(),
        { provide: PermissionStore, useValue: store },
        { provide: Router, useValue: router },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  const fail = (code: string | null, status = 403, url = '/api/v1/x') => {
    let error: unknown;
    http.get(url).subscribe({ error: (e) => (error = e) });
    controller.expectOne(url).flush(code ? { code } : {}, { status, statusText: 'x' });
    return error;
  };

  it('reloads the permissions on permission_denied and still reports the error', () => {
    expect(fail('permission_denied')).toBeTruthy();
    expect(store.reload).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('reloads and returns to the dashboard on company_access_revoked', async () => {
    fail('company_access_revoked');
    await Promise.resolve();
    await Promise.resolve();
    expect(store.reload).toHaveBeenCalledOnce();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/');
  });

  it('sends the user to the security page on mfa_required', () => {
    fail('mfa_required');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/settings/security');
  });

  it('ignores other statuses, codeless 403s and the permissions endpoint itself', () => {
    fail('permission_denied', 500);
    fail(null);
    fail('permission_denied', 403, '/api/v1/profile/permissions');
    expect(store.reload).not.toHaveBeenCalled();
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });
});
