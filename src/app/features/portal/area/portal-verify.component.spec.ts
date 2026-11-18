import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { environment } from '@env';
import { I18nService } from '@core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18nStub } from '../../hr/recruiting/testing/recruiting-fixtures';
import { PortalSessionService } from './portal-session.service';
import { PortalVerifyComponent } from './portal-verify.component';

const API = 'https://api.fatturafacile.eu/api/v1';
const TOKEN = 'ab'.repeat(32);
const AUTHENTICATED = {
  success: true,
  message: 'ok',
  data: {
    status: 'authenticated',
    token: 'session-token',
    token_type: 'Bearer',
    abilities: ['portal:customer'],
    expires_at: new Date(Date.now() + 3_600_000).toISOString(),
    customer: { id: 'c1', name: 'Villa Paradiso', email: 'client@villaparadiso.ch' },
  },
};

describe('PortalVerifyComponent (magic link)', () => {
  const originalApiBaseUrl = environment.apiBaseUrl;
  let navigate: ReturnType<typeof vi.spyOn>;

  function create(token: string | null) {
    TestBed.configureTestingModule({
      imports: [PortalVerifyComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: I18nService, useValue: i18nStub() },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ ...(token ? { token } : {}), portal: 'solar' }),
            },
          },
        },
      ],
    });
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(PortalVerifyComponent);
    fixture.detectChanges();
    return { fixture, http: TestBed.inject(HttpTestingController) };
  }

  beforeEach(() => {
    environment.apiBaseUrl = API;
    sessionStorage.clear();
  });

  afterEach(() => {
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('exchanges a valid link for a session and opens the dashboard', () => {
    const { http } = create(TOKEN);

    const request = http.expectOne(`${API}/portal/auth/verify`);
    expect(request.request.body).toEqual({ token: TOKEN, accept_privacy: true });
    request.flush(AUTHENTICATED);

    const session = TestBed.inject(PortalSessionService);
    expect(session.isAuthenticated()).toBe(true);
    expect(session.token()).toBe('session-token');
    expect(session.slug()).toBe('solar');
    expect(navigate).toHaveBeenCalledWith(['/portal/dashboard'], { replaceUrl: true });
  });

  it('shows a clear failure, without calling the API, when the link is malformed', () => {
    const { fixture, http } = create('not-a-token');

    http.expectNone(`${API}/portal/auth/verify`);
    expect(fixture.nativeElement.querySelector('nz-alert')).not.toBeNull();
  });

  it('shows the failure of an expired link (410)', () => {
    const { fixture, http } = create(TOKEN);

    http
      .expectOne(`${API}/portal/auth/verify`)
      .flush({ message: 'expired' }, { status: 410, statusText: 'Gone' });
    fixture.detectChanges();

    expect(TestBed.inject(PortalSessionService).isAuthenticated()).toBe(false);
    expect(fixture.nativeElement.querySelector('nz-alert')).not.toBeNull();
  });

  it('asks for the e-mailed code when the tenant requires it, then signs in', () => {
    const { fixture, http } = create(TOKEN);

    http
      .expectOne(`${API}/portal/auth/verify`)
      .flush({ success: true, message: 'otp', data: { status: 'otp_required' } });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#portal-otp')).not.toBeNull();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#portal-otp');
    input.value = '123456';
    input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));

    const second = http.expectOne(`${API}/portal/auth/verify`);
    expect(second.request.body).toEqual({ token: TOKEN, otp: '123456', accept_privacy: true });
    second.flush(AUTHENTICATED);

    expect(TestBed.inject(PortalSessionService).isAuthenticated()).toBe(true);
  });

  it('tells the customer the code is wrong (422) and keeps the code form', () => {
    const { fixture, http } = create(TOKEN);
    http
      .expectOne(`${API}/portal/auth/verify`)
      .flush({ success: true, message: 'otp', data: { status: 'otp_required' } });
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('#portal-otp');
    input.value = '000000';
    input.dispatchEvent(new Event('input'));
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
    http
      .expectOne(`${API}/portal/auth/verify`)
      .flush({ message: 'wrong' }, { status: 422, statusText: 'Unprocessable' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#portal-otp')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('nz-alert')).not.toBeNull();
  });
});
