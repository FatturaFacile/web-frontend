import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '@core/auth/auth.store';
import { I18nService } from '@core/i18n/i18n.service';
import { ObsConnector, ObsConnectorStatus } from '../../core/models/observability.model';
import { ToastService } from '@shared/ui/toast/toast.service';
import {
  obsConnector,
  obsNoisy,
  obsSettings,
  obsSlowEndpoint,
  obsSlowQuery,
  obsStatements,
} from '../../../testing/observability-fixtures';
import { ConnectorAdminStore } from './connector-admin.store';
import { ConnectorStatusBannerComponent } from './connector-status-banner.component';
import { ConnectorStatusPageComponent } from './connector-status-page.component';
import { ConnectorStatusStore } from './connector-status.store';
import { ProfilerPageComponent } from './profiler-page.component';
import { ProfilerStore } from './profiler.store';
import { SlowQueryDrawerComponent } from './slow-query-drawer.component';

/** Translations are API-served: the specs only need to see which key (and params) a template asks for. */
const i18n = {
  translate: (key: string, params?: Record<string, string | number>) =>
    params ? `${key} ${JSON.stringify(params)}` : key,
};

const text = (fixture: { nativeElement: unknown }): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

function fakeStatusStore(overall: ObsConnectorStatus, connectors: ObsConnector[]) {
  return {
    overall: signal(overall),
    connectors: signal(connectors),
    affected: signal(connectors.filter((connector) => connector.status !== 'operational')),
    bannerVisible: signal(overall !== 'operational'),
    loaded: signal(true),
    loading: signal(false),
    error: signal<string | null>(null),
    startPolling: vi.fn(),
    refresh: vi.fn(),
    dismiss: vi.fn(),
  };
}

describe('ConnectorStatusBannerComponent', () => {
  const vies = obsConnector({ key: 'vies', name_code: 'OBSERVABILITY.CONNECTOR.VIES', status: 'degraded' });

  function create(store: ReturnType<typeof fakeStatusStore>) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: ConnectorStatusStore, useValue: store },
        { provide: I18nService, useValue: i18n },
      ],
    });
    const fixture = TestBed.createComponent(ConnectorStatusBannerComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('shows nothing while everything is operational but still polls', () => {
    const store = fakeStatusStore('operational', [obsConnector()]);
    const fixture = create(store);

    expect(fixture.nativeElement.querySelector('nz-alert')).toBeNull();
    expect(store.startPolling).toHaveBeenCalledTimes(1);
  });

  it('names the affected connectors with a translated message and links to the status page', () => {
    const fixture = create(fakeStatusStore('degraded', [obsConnector(), vies]));

    const content = text(fixture);
    expect(content).toContain('OBSERVABILITY.BANNER.MESSAGE_DEGRADED');
    expect(content).toContain('OBSERVABILITY.CONNECTOR.VIES');
    expect(content).toContain('OBSERVABILITY.BANNER.LINK');
    const link = fixture.nativeElement.querySelector('[data-test="banner-link"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/observability/connectors');
  });

  it.each([
    ['outage', 'ant-alert-error'],
    ['degraded', 'ant-alert-warning'],
    ['maintenance', 'ant-alert-info'],
  ] as const)('uses the alert type that fits %s', (overall, cssClass) => {
    const fixture = create(fakeStatusStore(overall, [obsConnector({ key: 'vies', status: overall })]));

    expect(fixture.nativeElement.querySelector('.ant-alert')?.className).toContain(cssClass);
  });

  it('dismisses through the store', () => {
    const store = fakeStatusStore('degraded', [vies]);
    const fixture = create(store);

    (fixture.nativeElement.querySelector('.ant-alert-close-icon') as HTMLElement).click();

    expect(store.dismiss).toHaveBeenCalledTimes(1);
  });
});

describe('ConnectorStatusPageComponent', () => {
  const connectors = [
    obsConnector(),
    obsConnector({
      key: 'vies',
      name_code: 'OBSERVABILITY.CONNECTOR.VIES',
      country: 'EU',
      group: 'registry',
      status: 'outage',
      last_error: 'timeout',
      last_latency_ms: null,
      last_checked_at: null,
    }),
  ];

  function create(admin: boolean) {
    const adminStore = {
      connectors: signal(admin ? connectors : []),
      loading: signal(false),
      probing: signal(false),
      error: signal<string | null>(null),
      load: vi.fn(),
      probe: vi.fn(),
      setMaintenance: vi.fn(),
    };
    const statusStore = fakeStatusStore('outage', connectors);
    TestBed.configureTestingModule({
      providers: [
        { provide: ConnectorStatusStore, useValue: statusStore },
        { provide: I18nService, useValue: i18n },
        { provide: AuthStore, useValue: { user: signal({ is_platform_admin: admin }) } },
      ],
    });
    TestBed.overrideComponent(ConnectorStatusPageComponent, {
      set: { providers: [{ provide: ConnectorAdminStore, useValue: adminStore }] },
    });
    const fixture = TestBed.createComponent(ConnectorStatusPageComponent);
    fixture.detectChanges();
    return { fixture, adminStore, statusStore };
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('lists every connector with status, latency, uptime and 24 history bars', () => {
    const { fixture, statusStore } = create(false);
    const root = fixture.nativeElement as HTMLElement;

    expect(statusStore.startPolling).toHaveBeenCalled();
    expect(root.querySelectorAll('.connector-card')).toHaveLength(2);
    expect(root.querySelector('[data-test="connector-sdi"] .history')?.children).toHaveLength(24);
    const content = text(fixture);
    expect(content).toContain('OBSERVABILITY.STATUS.OUTAGE');
    expect(content).toContain('OBSERVABILITY.STATUS_PAGE.NEVER_CHECKED');
    expect(content).toContain('95.0');
  });

  it('keeps the administrator tools away from ordinary members', () => {
    const { fixture, adminStore } = create(false);

    expect(fixture.nativeElement.querySelector('[data-test="probe-all"]')).toBeNull();
    expect(text(fixture)).not.toContain('timeout');
    expect(adminStore.load).not.toHaveBeenCalled();
  });

  it('gives platform administrators the last error, probe now and the maintenance switch', () => {
    const { fixture, adminStore } = create(true);
    const root = fixture.nativeElement as HTMLElement;

    expect(adminStore.load).toHaveBeenCalled();
    expect(text(fixture)).toContain('timeout');

    (root.querySelector('[data-test="probe-vies"]') as HTMLElement).click();
    expect(adminStore.probe).toHaveBeenCalledWith('vies');

    (root.querySelector('[data-test="maintenance-vies"]') as HTMLElement).click();
    expect(adminStore.setMaintenance).toHaveBeenCalledWith('vies', true, undefined);
  });
});

describe('ProfilerPageComponent', () => {
  function create(overrides: Record<string, unknown> = {}) {
    const store = {
      slowQueries: signal([obsSlowQuery(), obsSlowQuery({ fingerprint: 'fp-2', n_plus_one: true, n_plus_one_count: 25 })]),
      slowEndpoints: signal([obsSlowEndpoint()]),
      statements: signal(obsStatements()),
      noisyNeighbors: signal([obsNoisy()]),
      settings: signal(obsSettings()),
      selectedQuery: signal(null),
      nPlusOneCount: signal(1),
      slowestQueryMs: signal(980),
      slowestEndpointP95: signal(640),
      suggestedIndexCount: signal(2),
      flaggedTenants: signal(1),
      loading: signal(false),
      saving: signal(false),
      saved: signal(false),
      error: signal<string | null>(null),
      loadAll: vi.fn(),
      select: vi.fn(),
      saveSettings: vi.fn(),
      ...overrides,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(ProfilerPageComponent, { set: { providers: [{ provide: ProfilerStore, useValue: store }] } });
    const fixture = TestBed.createComponent(ProfilerPageComponent);
    fixture.detectChanges();
    return { fixture, store };
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('loads on open and shows the queries with N+1 and index flags', () => {
    const { fixture, store } = create();
    const root = fixture.nativeElement as HTMLElement;

    expect(store.loadAll).toHaveBeenCalledTimes(1);
    expect(root.querySelector('[data-test="query-fp-1"]')).not.toBeNull();
    expect(text(fixture)).toContain('OBSERVABILITY.TAG.N_PLUS_ONE_SHORT');
    expect(text(fixture)).toContain('OBSERVABILITY.TAG.INDEX');
  });

  it('opens the detail of a query', () => {
    const { fixture, store } = create();

    (fixture.nativeElement.querySelector('[data-test="query-fp-1"] button') as HTMLElement).click();

    expect(store.select).toHaveBeenCalledWith('fp-1');
  });

  it('shows the translated error of the store', () => {
    const { fixture } = create({ error: signal('OBSERVABILITY.ERROR.FORBIDDEN') });

    expect(text(fixture)).toContain('OBSERVABILITY.ERROR.FORBIDDEN');
  });
});

describe('SlowQueryDrawerComponent', () => {
  const clipboard = { writeText: vi.fn().mockResolvedValue(undefined) };
  const toasts = { success: vi.fn(), error: vi.fn() };

  function create(query: ReturnType<typeof obsSlowQuery> | null) {
    Object.defineProperty(navigator, 'clipboard', { value: clipboard, configurable: true });
    TestBed.configureTestingModule({
      providers: [
        { provide: I18nService, useValue: i18n },
        { provide: ToastService, useValue: toasts },
      ],
    });
    const fixture = TestBed.createComponent(SlowQueryDrawerComponent);
    fixture.componentRef.setInput('query', query);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    clipboard.writeText.mockClear();
    toasts.success.mockClear();
  });

  it('renders nothing for no query', () => {
    const fixture = create(null);

    expect(document.body.textContent).not.toContain('OBSERVABILITY.DRAWER.SQL');
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('shows the plan with the sequential scan, the index advice and copies the CREATE INDEX statement', async () => {
    create(obsSlowQuery({ n_plus_one: true, n_plus_one_count: 30 }));
    await Promise.resolve();
    const body = document.body;

    expect(body.querySelector('[data-test="n-plus-one-tag"]')).not.toBeNull();
    expect(body.querySelector('[data-test="plan"] .seq-scan')?.textContent).toContain('Seq Scan');
    expect(body.querySelector('[data-test="trace-id"]')?.textContent).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    const index = body.querySelector('[data-test="suggested-index"]');
    expect(index?.textContent).toContain('CREATE INDEX CONCURRENTLY');

    (index?.querySelector('button') as HTMLElement).click();
    await Promise.resolve();
    expect(clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining('CREATE INDEX CONCURRENTLY'));
  });

  it('explains why there is no plan', () => {
    create(obsSlowQuery({ plan_status: 'skipped', plan: null, suggested_indexes: [] }));

    expect(document.body.querySelector('[data-test="plan-unavailable"]')?.textContent).toContain(
      'OBSERVABILITY.PLAN_STATUS.SKIPPED',
    );
    expect(document.body.textContent).toContain('OBSERVABILITY.DRAWER.NO_INDEXES');
  });
});
