import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MarketplaceApiService, MarketplaceConnector, MarketplaceInstallation, MarketplaceSyncRun } from '@core';
import { icons } from '../../icons-provider';
import { MarketplaceCatalogComponent } from './marketplace-catalog.component';
import { MarketplaceInstallationComponent } from './marketplace-installation.component';
import { MarketplaceInstallationsComponent } from './marketplace-installations.component';
import { MarketplaceRunsComponent } from './marketplace-runs.component';

const connector: MarketplaceConnector = {
  key: 'stripe',
  name: 'Stripe',
  description: 'Charges and payouts',
  category: 'payment',
  version: '1.0.0',
  vendor: 'Stripe',
  documentation_url: null,
  config_schema: [
    { key: 'secret_key', label: 'Secret key', type: 'secret', required: true, options: [], default: null, help: null },
    { key: 'region', label: 'Region', type: 'string', required: false, options: [], default: null, help: null },
  ],
  required_scopes: ['treasury.write', 'invoicing.read'],
  resources: ['charges', 'payouts'],
  rate_limit_per_minute: 100,
  max_rate_limit_per_minute: 200,
  installations: 1,
};

const installation: MarketplaceInstallation = {
  id: 'i1',
  connector_key: 'stripe',
  connector_name: 'Stripe',
  category: 'payment',
  connector_version: '1.0.0',
  latest_version: '1.0.0',
  update_available: false,
  name: 'Stripe main',
  status: 'enabled',
  settings: { region: 'eu' },
  credentials_set: ['secret_key'],
  granted_scopes: ['treasury.write', 'invoicing.read'],
  rate_limit_per_minute: null,
  effective_rate_limit_per_minute: 100,
  configured_at: '2026-11-01T10:00:00Z',
  enabled_at: '2026-11-01T10:05:00Z',
  disabled_at: null,
  health: { status: 'healthy', checked_at: '2026-11-15T08:00:00Z', message: null },
  last_sync_at: '2026-11-15T09:00:00Z',
  created_at: '2026-11-01T10:00:00Z',
  updated_at: '2026-11-15T09:00:00Z',
};

const run: MarketplaceSyncRun = {
  id: 'r1',
  installation_id: 'i1',
  installation_name: 'Stripe main',
  resource: 'charges',
  trigger: 'manual',
  status: 'succeeded',
  started_at: '2026-11-15T09:00:00Z',
  finished_at: '2026-11-15T09:00:02Z',
  records_processed: 5,
  records_failed: 1,
  message: 'Fetched 5 records of charges.',
};

const page = <T>(data: T) => ({ data });

describe('marketplace pages', () => {
  const api = {
    getOverview: vi.fn(),
    getConnectors: vi.fn(),
    getConnector: vi.fn(),
    getInstallations: vi.fn(),
    getInstallation: vi.fn(),
    install: vi.fn(),
    configure: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    upgrade: vi.fn(),
    uninstall: vi.fn(),
    getHealthChecks: vi.fn(),
    runHealthCheck: vi.fn(),
    getSyncRuns: vi.fn(),
    getInstallationRuns: vi.fn(),
    runSync: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getOverview.mockReturnValue(
      of(page({ installations: 1, by_status: { pending_configuration: 0, disabled: 0, enabled: 1 }, unhealthy: [], updates_available: [], recent_problem_runs: [] }))
    );
    api.getConnectors.mockReturnValue(of(page([connector])));
    api.getConnector.mockReturnValue(of(page(connector)));
    api.getInstallations.mockReturnValue(of(page([installation])));
    api.getInstallation.mockReturnValue(of(page(installation)));
    api.getHealthChecks.mockReturnValue(of(page([])));
    api.getInstallationRuns.mockReturnValue(of(page([run])));
    api.getSyncRuns.mockReturnValue(of(page([run])));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        { provide: MarketplaceApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'i1' }) } } },
      ],
    });
  });

  it('shows the catalog with the connectors and filters them by category and search text', () => {
    const fixture = TestBed.createComponent(MarketplaceCatalogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getConnectors).toHaveBeenCalledWith({ category: undefined, search: undefined });
    expect(component.connectors()).toHaveLength(1);
    expect(component.overview()?.installations).toBe(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Stripe');

    component.category.set('payment');
    component.search.set('  strip ');
    component.load();
    expect(api.getConnectors).toHaveBeenLastCalledWith({ category: 'payment', search: 'strip' });
  });

  it('installs a connector with the scopes it requires and opens the new installation', () => {
    api.install.mockReturnValue(of(page(installation)));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(MarketplaceCatalogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.install();
    expect(api.install).not.toHaveBeenCalled();

    component.openInstall(connector);
    expect(component.name()).toBe('Stripe');
    component.name.set(' Stripe main ');
    component.install();

    expect(api.install).toHaveBeenCalledWith({ connector_key: 'stripe', name: 'Stripe main', granted_scopes: ['treasury.write', 'invoicing.read'] });
    expect(component.installVisible()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/marketplace/installations', 'i1']);
  });

  it('shows the first validation message when an installation is refused', () => {
    api.install.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { connector_key: ['Too many installations'] } } })));
    const fixture = TestBed.createComponent(MarketplaceCatalogComponent);
    fixture.detectChanges();
    fixture.componentInstance.openInstall(connector);

    fixture.componentInstance.install();
    expect(message.error).toHaveBeenCalledWith('Too many installations');
  });

  it('lists the installations, filters by status and runs the lifecycle actions', () => {
    api.enable.mockReturnValue(of(page(installation)));
    api.disable.mockReturnValue(of(page(installation)));
    api.uninstall.mockReturnValue(of(undefined));
    const fixture = TestBed.createComponent(MarketplaceInstallationsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.installations()).toHaveLength(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Stripe main');
    expect(component.statusColor('enabled')).not.toBe('default');
    expect(component.healthColor('nonsense')).toBe('default');

    component.status.set('enabled');
    component.load();
    expect(api.getInstallations).toHaveBeenLastCalledWith({ status: 'enabled', per_page: 100 });

    component.disable(installation);
    component.enable(installation);
    component.uninstall(installation);
    expect(api.disable).toHaveBeenCalledWith('i1');
    expect(api.enable).toHaveBeenCalledWith('i1');
    expect(api.uninstall).toHaveBeenCalledWith('i1');
    expect(message.success).toHaveBeenCalledTimes(3);
  });

  it('reports a failure to load the installations and stops the loading state', () => {
    api.getInstallations.mockReturnValue(throwError(() => new Error('down')));
    const fixture = TestBed.createComponent(MarketplaceInstallationsComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.loading()).toBe(false);
    expect(message.error).toHaveBeenCalled();
  });

  it('lists the sync runs of every installation and filters them by status', () => {
    const fixture = TestBed.createComponent(MarketplaceRunsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.runs()).toHaveLength(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Fetched 5 records of charges.');

    component.status.set('failed');
    component.load();
    expect(api.getSyncRuns).toHaveBeenLastCalledWith({ status: 'failed', per_page: 100 });
    expect(component.runColor('succeeded')).not.toBe('default');
  });

  it('loads an installation with its connector, activity and settings', () => {
    const fixture = TestBed.createComponent(MarketplaceInstallationComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getInstallation).toHaveBeenCalledWith('i1');
    expect(api.getConnector).toHaveBeenCalledWith('stripe');
    expect(component.fields()).toHaveLength(2);
    expect(component.values()).toEqual({ region: 'eu' });
    expect(component.runs()).toHaveLength(1);
    expect(component.isSet(connector.config_schema[0])).toBe(true);
    expect(component.isSet(connector.config_schema[1])).toBe(false);
    expect(component.asNumber(5)).toBe(5);
    expect(component.asNumber('5')).toBeNull();
  });

  it('never sends a secret that was left blank and sends one that was typed', () => {
    api.configure.mockReturnValue(of(page(installation)));
    const fixture = TestBed.createComponent(MarketplaceInstallationComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.setValue('secret_key', '');
    component.setValue('region', 'us');
    component.saveConfiguration();
    expect(api.configure).toHaveBeenLastCalledWith('i1', { config: { region: 'us' }, rate_limit_per_minute: null });

    component.setValue('secret_key', 'typed-value');
    component.setValue('region', null);
    component.rateLimit.set(50);
    component.saveConfiguration();
    expect(api.configure).toHaveBeenLastCalledWith('i1', { config: { secret_key: 'typed-value' }, rate_limit_per_minute: 50 });
    expect(message.success).toHaveBeenCalled();
  });

  it('runs a sync of the chosen resource and warns when it did not succeed', () => {
    api.runSync.mockReturnValueOnce(of(page(run))).mockReturnValueOnce(of(page({ ...run, status: 'failed', message: 'Rejected' })));
    const fixture = TestBed.createComponent(MarketplaceInstallationComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.runSync();
    expect(api.runSync).not.toHaveBeenCalled();

    component.resource.set('charges');
    component.runSync();
    expect(api.runSync).toHaveBeenCalledWith('i1', 'charges');
    expect(message.success).toHaveBeenCalledWith('Fetched 5 records of charges.');

    component.runSync();
    expect(message.warning).toHaveBeenCalledWith('Rejected');
    expect(component.syncing()).toBe(false);
  });

  it('applies the lifecycle actions to the loaded installation and leaves after uninstalling', () => {
    api.enable.mockReturnValue(of(page({ ...installation, status: 'enabled' })));
    api.disable.mockReturnValue(of(page({ ...installation, status: 'disabled' })));
    api.upgrade.mockReturnValue(of(page(installation)));
    api.uninstall.mockReturnValue(of(undefined));
    api.runHealthCheck.mockReturnValue(of(page({ id: 'h1', installation_id: 'i1', status: 'healthy', latency_ms: 10, message: null, checked_at: '2026-11-15T10:00:00Z' })));
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(MarketplaceInstallationComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.disable();
    expect(component.installation()?.status).toBe('disabled');
    component.enable();
    expect(component.installation()?.status).toBe('enabled');
    component.upgrade();
    expect(api.upgrade).toHaveBeenCalledWith('i1', ['treasury.write', 'invoicing.read']);
    component.checkHealth();
    expect(api.runHealthCheck).toHaveBeenCalledWith('i1');
    component.uninstall();
    expect(navigate).toHaveBeenCalledWith(['/marketplace/installations']);
  });
});
