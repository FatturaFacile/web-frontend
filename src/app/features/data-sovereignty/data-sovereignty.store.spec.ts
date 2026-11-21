import { TestBed } from '@angular/core/testing';
import { throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataSovereigntyApiService } from './data-sovereignty-api.service';
import { DataSovereigntyStore } from './data-sovereignty.store';
import { audit, dashboardFixture, envelope, ok, resource, scope } from './data-sovereignty.testing';
import { project } from './data-sovereignty.utils';

describe('DataSovereigntyStore', () => {
  let store: DataSovereigntyStore;
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {
      dashboard: vi.fn(() => ok(dashboardFixture())),
      auditLogs: vi.fn(() =>
        ok([audit('CACHE_HIT')], { chain: { valid: false, checked: 1, broken_at: 'x' } }),
      ),
      rotate: vi.fn(() => ok(resource({ current_key_version: 'v2' }))),
      killSwitch: vi.fn(() => ok(resource({ status: 'SUSPENDED', current_key_version: 'v2' }))),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: DataSovereigntyApiService, useValue: api }],
    });
    store = TestBed.inject(DataSovereigntyStore);
  });

  it('loads the posture and derives the scopes, the sites and the lock state', () => {
    store.loadDashboard().subscribe();

    expect(store.scopes().length).toBe(2);
    expect(store.blockedLast30Days()).toBe(3);
    expect(store.isLocked()).toBe(false);
    expect(store.sites().map((site) => site.key)).toEqual(['CH-Lugano', 'IT-Milan']);
    expect(store.sites()[0].services).toEqual([
      'postgres_primary',
      'postgres_replicas',
      's3_dms',
      'pgvector',
      'ai_inference',
      'backup_vault',
      'queue_broker',
    ]);
    expect(store.auditChain()?.valid).toBe(true);
  });

  it('marks the load as failed instead of throwing', () => {
    api['dashboard'].mockReturnValue(throwError(() => new Error('offline')));

    store.loadDashboard().subscribe();

    expect(store.failed()).toBe(true);
    expect(store.loading()).toBe(false);
    expect(store.dashboard()).toBeNull();
  });

  it('prefers the tenant default as the primary scope and the tenant key as the primary envelope', () => {
    api['dashboard'].mockReturnValue(
      ok(
        dashboardFixture({
          scopes: [
            scope({ site: 'mil' }),
            scope({ site: 'lug', scope_type: 'TENANT_DEFAULT', legal_entity_id: null }),
          ],
          key_envelopes: [
            envelope({ id: 'entity-key', legal_entity_id: 'entity-mil' }),
            envelope({ id: 'tenant-key' }),
          ],
        }),
      ),
    );

    store.loadDashboard().subscribe();

    expect(store.primaryScope()?.policy_id).toBe('policy-lug');
    expect(store.primaryEnvelope()?.id).toBe('tenant-key');
  });

  it('shows every site as degraded while a key is locked', () => {
    api['dashboard'].mockReturnValue(
      ok(dashboardFixture({ key_envelopes: [envelope({ status: 'REVOKED_CRYPTO_SHREDDED' })] })),
    );

    store.loadDashboard().subscribe();

    expect(store.isLocked()).toBe(true);
    expect(store.sites().every((site) => !site.healthy)).toBe(true);
  });

  it('applies a rotation and a kill-switch to the envelope in place', () => {
    store.loadDashboard().subscribe();

    store.rotate('env-1').subscribe();
    expect(store.envelopes()[0].key_version).toBe('v2');
    expect(store.envelopes()[0].rotation_due).toBe(false);

    store
      .killSwitch('env-1', {
        action: 'SUSPEND',
        reason: 'incident response',
        confirmation_phrase: 'SUSPEND KEY ACCESS',
        mfa_code: '123456',
      })
      .subscribe();
    expect(store.envelopes()[0].status).toBe('SUSPENDED');
    expect(store.isLocked()).toBe(true);
    expect(store.busy()).toBe(false);
  });

  it('keeps the chain state returned with a filtered audit page', () => {
    store.loadAudit('CACHE_HIT').subscribe();

    expect(store.auditOperation()).toBe('CACHE_HIT');
    expect(store.auditEntries().map((entry) => entry.operation)).toEqual(['CACHE_HIT']);
    expect(store.auditChain()?.valid).toBe(false);
  });

  it('projects the data centers onto the map in the right order', () => {
    const lugano = project(46.0036778, 8.9510711);
    const milan = project(45.4642035, 9.1899817);
    const rome = project(41.9027835, 12.4963655);

    expect(milan.y).toBeGreaterThan(lugano.y);
    expect(rome.y).toBeGreaterThan(milan.y);
    expect(rome.x).toBeGreaterThan(milan.x);
    expect(lugano.x).toBeGreaterThan(0);
    expect(rome.y).toBeLessThan(600);
  });
});
