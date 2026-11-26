import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { LOCALLY_HANDLED_ERROR_STATUSES } from '../http/error-handling.context';
import { IamApiService } from './iam-api.service';

describe('IamApiService passkeys', () => {
  let service: IamApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/auth/passkeys`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(IamApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('renames a passkey with a PATCH', () => {
    let name = '';
    service.renamePasskey('p1', 'Work key').subscribe((res) => (name = res.data.name));

    const req = http.expectOne(`${base}/p1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'Work key' });
    req.flush({ success: true, message: '', data: { id: 'p1', name: 'Work key', aaguid: null, created_at: null, last_used_at: null } });
    expect(name).toBe('Work key');
  });

  it('returns the recovery codes of the first factor with the registered passkey', () => {
    let codes: string[] | null | undefined;
    service.finishPasskeyRegistration('c1', 'Laptop', { id: 'x' }).subscribe((res) => (codes = res.data.recovery_codes));

    const req = http.expectOne(base);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ ceremony_id: 'c1', name: 'Laptop', credential: { id: 'x' } });
    req.flush({ success: true, message: '', data: { id: 'p1', name: 'Laptop', aaguid: null, created_at: null, last_used_at: null, recovery_codes: ['AAAA-1111'] } });
    expect(codes).toEqual(['AAAA-1111']);
  });

  it('leaves the 403 of the last required factor to the caller when a passkey is revoked', () => {
    service.revokePasskey('p1').subscribe();

    const req = http.expectOne(`${base}/p1`);
    expect(req.request.method).toBe('DELETE');
    expect(req.request.context.get(LOCALLY_HANDLED_ERROR_STATUSES)).toEqual([403]);
    req.flush({ success: true, message: '', data: null });
  });
});
