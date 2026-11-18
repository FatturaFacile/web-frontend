import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { portalAuthInterceptor } from '@core/interceptors/portal-auth.interceptor';
import { PortalBranding } from '@core/models/portal-area.models';
import { portalAuthGuard } from './portal-auth.guard';
import { PortalSessionService } from './portal-session.service';

const API = 'https://api.fatturafacile.eu/api/v1';
const BRANDING: PortalBranding = {
  company_name: 'Solar Installers Sagl',
  portal_slug: 'solar',
  logo_url: 'https://cdn.example.test/logo.png',
  favicon_url: 'https://cdn.example.test/favicon.png',
  primary_color: '#0a7cff',
  secondary_color: '#112233',
  support_email: 'help@solar.example',
  privacy_policy_url: null,
  region: 'CH',
};
const CUSTOMER = { id: 'c1', name: 'Villa Paradiso', email: 'client@villaparadiso.ch' };

describe('portal session, guard and interceptor', () => {
  const originalApiBaseUrl = environment.apiBaseUrl;

  beforeEach(() => {
    environment.apiBaseUrl = API;
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([portalAuthInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => {
    environment.apiBaseUrl = originalApiBaseUrl;
    document.documentElement.style.removeProperty('--portal-primary');
    document.documentElement.style.removeProperty('--portal-secondary');
  });

  describe('white-label theme', () => {
    it('applies the tenant colours as CSS custom properties, the favicon and the title', () => {
      TestBed.inject(PortalSessionService).applyBranding(BRANDING);

      expect(document.documentElement.style.getPropertyValue('--portal-primary')).toBe('#0a7cff');
      expect(document.documentElement.style.getPropertyValue('--portal-secondary')).toBe('#112233');
      expect(document.title).toBe('Solar Installers Sagl');
      expect(document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href).toBe(
        'https://cdn.example.test/favicon.png',
      );
    });

    it('ignores a colour that is not a hex value and a favicon that is not https', () => {
      const session = TestBed.inject(PortalSessionService);
      session.applyBranding({
        ...BRANDING,
        primary_color: 'red; background: url(x)',
        favicon_url: 'http://insecure.test/f.png',
      });

      expect(document.documentElement.style.getPropertyValue('--portal-primary')).toBe('');
      expect(document.querySelector<HTMLLinkElement>('link[rel~="icon"]')?.href).not.toBe(
        'http://insecure.test/f.png',
      );
    });
  });

  describe('session', () => {
    it('is authenticated until the token expires, and clear() signs out', () => {
      const session = TestBed.inject(PortalSessionService);
      expect(session.isAuthenticated()).toBe(false);

      session.start('t'.repeat(64), new Date(Date.now() + 3_600_000).toISOString(), CUSTOMER);
      expect(session.isAuthenticated()).toBe(true);
      expect(sessionStorage.getItem('ff_portal_token')).toBe('t'.repeat(64));

      session.clear();
      expect(session.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem('ff_portal_token')).toBeNull();
    });

    it('is not authenticated with an expired token', () => {
      const session = TestBed.inject(PortalSessionService);
      session.start('t'.repeat(64), new Date(Date.now() - 1000).toISOString(), CUSTOMER);

      expect(session.isAuthenticated()).toBe(false);
    });
  });

  describe('portalAuthGuard', () => {
    it('lets a signed-in customer through', () => {
      TestBed.inject(PortalSessionService).start(
        't'.repeat(64),
        new Date(Date.now() + 3_600_000).toISOString(),
        CUSTOMER,
      );

      expect(TestBed.runInInjectionContext(() => portalAuthGuard({} as never, {} as never))).toBe(
        true,
      );
    });

    it('sends anyone else to /portal/login and keeps the portal slug', () => {
      const session = TestBed.inject(PortalSessionService);
      session.useSlug('solar');

      const result = TestBed.runInInjectionContext(() => portalAuthGuard({} as never, {} as never));

      expect(result).toBeInstanceOf(UrlTree);
      expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe(
        '/portal/login?portal=solar',
      );
    });
  });

  describe('portalAuthInterceptor', () => {
    it('adds the bearer session to the session API only', () => {
      TestBed.inject(PortalSessionService).start(
        's'.repeat(64),
        new Date(Date.now() + 3_600_000).toISOString(),
        CUSTOMER,
      );
      const http = TestBed.inject(HttpClient);
      const backend = TestBed.inject(HttpTestingController);

      http.get(`${API}/portal/invoices`).subscribe();
      expect(backend.expectOne(`${API}/portal/invoices`).request.headers.get('Authorization')).toBe(
        `Bearer ${'s'.repeat(64)}`,
      );

      http.get(`${API}/portal/branding`).subscribe();
      expect(backend.expectOne(`${API}/portal/branding`).request.headers.has('Authorization')).toBe(
        false,
      );

      http.get(`${API}/portal/quotes/${'a'.repeat(64)}`).subscribe();
      expect(
        backend
          .expectOne(`${API}/portal/quotes/${'a'.repeat(64)}`)
          .request.headers.has('Authorization'),
      ).toBe(false);

      http.get(`${API}/invoices`).subscribe();
      expect(backend.expectOne(`${API}/invoices`).request.headers.has('Authorization')).toBe(false);
    });

    it('ends the session and returns to /portal/login on a 401', () => {
      const session = TestBed.inject(PortalSessionService);
      session.start('s'.repeat(64), new Date(Date.now() + 3_600_000).toISOString(), CUSTOMER);
      session.useSlug('solar');
      const router = TestBed.inject(Router);
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      TestBed.inject(HttpClient)
        .get(`${API}/portal/me`)
        .subscribe({ error: () => undefined });
      TestBed.inject(HttpTestingController)
        .expectOne(`${API}/portal/me`)
        .flush({}, { status: 401, statusText: 'Unauthorized' });

      expect(session.isAuthenticated()).toBe(false);
      expect(navigate).toHaveBeenCalledWith(['/portal/login'], {
        queryParams: { portal: 'solar' },
      });
    });
  });
});
