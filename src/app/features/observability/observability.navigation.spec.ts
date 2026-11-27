import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AuthApiService } from '@core/api/auth-api.service';
import { AuthStore } from '@core/auth/auth.store';
import { isUrlOfEnabledMenuRoute, moduleOfUrl } from '../../core/auth/menu-enabled.guard';
import { MENU_SECTIONS } from '../../layout/sidebar/menu-sections';
import { OBSERVABILITY_ROUTES } from './observability.routes';

describe('observability routes', () => {
  it('opens on the connector status and declares breadcrumb and title keys', () => {
    expect(OBSERVABILITY_ROUTES.map((route) => route.path)).toEqual(['', 'profiler', 'connectors']);
    expect(OBSERVABILITY_ROUTES[0].redirectTo).toBe('connectors');
    for (const route of OBSERVABILITY_ROUTES.slice(1)) {
      expect(route.loadComponent, route.path).toBeTypeOf('function');
      expect(route.data?.['breadcrumb'], route.path).toMatch(/^NAV\./);
      expect(route.data?.['title'], route.path).toMatch(/^PAGE_TITLE\./);
    }
  });

  it('guards the profiler for platform administrators and leaves the status page open to every member', () => {
    const profiler = OBSERVABILITY_ROUTES.find((route) => route.path === 'profiler');
    const connectors = OBSERVABILITY_ROUTES.find((route) => route.path === 'connectors');

    expect(profiler?.canActivate).toHaveLength(1);
    expect(connectors?.canActivate).toBeUndefined();
  });

  it('sends a member who is not a platform administrator away from the profiler', () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthStore,
          useValue: { user: signal({ is_platform_admin: false }), isAuthenticated: () => false },
        },
        { provide: AuthApiService, useValue: {} },
      ],
    });
    const guard = OBSERVABILITY_ROUTES.find((route) => route.path === 'profiler')?.canActivate?.[0];

    const result = TestBed.runInInjectionContext(() => (guard as () => unknown)());

    expect(result instanceof UrlTree).toBe(true);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/dashboard');
  });
});

describe('observability menu', () => {
  const entries = MENU_SECTIONS.flatMap((section) => section.items)
    .flatMap((item) => item.children ?? [])
    .filter((child) => child.route.startsWith('/observability/'));

  it('adds the status page for everybody and the profiler for platform administrators', () => {
    const status = entries.find((entry) => entry.key === 'NAV.CONNECTOR_STATUS');
    const profiler = entries.find((entry) => entry.key === 'NAV.OBSERVABILITY_PROFILER');

    expect(status?.route).toBe('/observability/connectors');
    expect(status?.platformAdmin).toBeUndefined();
    expect(profiler?.route).toBe('/observability/profiler');
    expect(profiler?.platformAdmin).toBe(true);
  });

  it('opens both pages from the menu without an ERP module', () => {
    for (const page of ['/observability/connectors', '/observability/profiler']) {
      expect(isUrlOfEnabledMenuRoute(page), page).toBe(true);
      expect(moduleOfUrl(page), page).toBeUndefined();
    }
  });
});
