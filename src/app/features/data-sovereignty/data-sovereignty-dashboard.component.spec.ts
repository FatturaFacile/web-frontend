import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DataSovereigntyApiService } from './data-sovereignty-api.service';
import { DataSovereigntyDashboardComponent } from './data-sovereignty-dashboard.component';
import {
  all,
  baseProviders,
  byId,
  dashboardFixture,
  envelope,
  ok,
  q,
  scope,
  settle,
} from './data-sovereignty.testing';

describe('DataSovereigntyDashboardComponent', () => {
  let fixture: ComponentFixture<DataSovereigntyDashboardComponent>;
  let api: {
    dashboard: ReturnType<typeof vi.fn>;
    generateAttestation: ReturnType<typeof vi.fn>;
    attestationPdf: ReturnType<typeof vi.fn>;
  };
  const message = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };
  const issued = {
    attestation: {
      id: 'att-1',
      certificate_number: 'FF-SOV-CH-2026-000001',
      jurisdiction_zone: 'Strict-CH-Only',
      compliance_frameworks: [],
      sha256_payload_hash: 'h',
      signer_key_fingerprint: 'f',
      issued_at: '2026-11-21T10:00:00Z',
      valid_until: '2027-02-19T10:00:00Z',
    },
    bundle: { payload: { certificate_number: 'FF-SOV-CH-2026-000001' } },
  };

  async function create(): Promise<void> {
    fixture = TestBed.createComponent(DataSovereigntyDashboardComponent);
    await settle(fixture);
  }

  beforeEach(() => {
    api = {
      dashboard: vi.fn(() => ok(dashboardFixture())),
      generateAttestation: vi.fn(() => ok(issued)),
      attestationPdf: vi.fn(() => of(new Blob(['%PDF'], { type: 'application/pdf' }))),
    };
    TestBed.configureTestingModule({
      providers: baseProviders([
        provideRouter([]),
        { provide: DataSovereigntyApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
      ]) as never,
    });
    URL.createObjectURL = vi.fn(() => 'blob:certificate');
    URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    fixture?.nativeElement.remove();
    vi.restoreAllMocks();
  });

  it('shows the jurisdictions and the compliance frameworks of the group', async () => {
    await create();

    expect(byId(fixture, 'zone-Strict-CH-Only')).not.toBeNull();
    expect(byId(fixture, 'zone-Strict-IT-Only')).not.toBeNull();
    const frameworks = byId(fixture, 'frameworks')?.textContent ?? '';
    expect(frameworks).toContain('nLPD Art. 16-17');
    expect(frameworks).toContain('FINMA Circ. 2018/3');
    expect(frameworks).toContain('GDPR Art. 44-50');
    expect(frameworks).toContain('ACN/AgID');
  });

  it('lists each legal entity of a cross-border group on its own nodes', async () => {
    await create();

    const swiss = byId(fixture, 'scope-entity-lug')?.textContent ?? '';
    const italian = byId(fixture, 'scope-entity-mil')?.textContent ?? '';

    expect(swiss).toContain('Lugano Holding SA');
    expect(swiss).toContain('ch-lug-01');
    expect(swiss).toContain('ch-lug-02');
    expect(swiss).toContain('ch-lug-s3-01');
    expect(swiss).not.toContain('it-mil');
    expect(italian).toContain('Milano S.r.l.');
    expect(italian).toContain('it-mil-01');
    expect(italian).not.toContain('ch-lug');
    expect(swiss).toContain('DATA_SOVEREIGNTY.AGGREGATES_ONLY');
  });

  it('draws one pin per data center and describes it on selection, from the keyboard too', async () => {
    await create();

    expect(
      all(fixture, '[data-testid^="pin-"]').map((pin) => pin.getAttribute('data-testid')),
    ).toEqual(['pin-CH-Lugano', 'pin-IT-Milan']);
    expect(byId(fixture, 'site-detail')).toBeNull();

    byId(fixture, 'pin-CH-Lugano')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await settle(fixture);

    const detail = byId(fixture, 'site-detail')?.textContent ?? '';
    expect(detail).toContain('Lugano');
    expect(detail).toContain('TI');
    expect(detail).toContain('FINMA-2018-3');
    expect(byId(fixture, 'site-list')?.textContent).toContain('ACN-QC2');
  });

  it('warns when key access is suspended', async () => {
    api.dashboard.mockReturnValue(
      ok(dashboardFixture({ key_envelopes: [envelope({ status: 'SUSPENDED' })] })),
    );
    await create();

    expect(byId(fixture, 'locked-banner')).not.toBeNull();
  });

  it('has no warning while the keys are active', async () => {
    await create();

    expect(byId(fixture, 'locked-banner')).toBeNull();
    expect(byId(fixture, 'key-health')?.textContent).toContain('DATA_SOVEREIGNTY.STATUS_ACTIVE');
  });

  it('asks for a policy when none exists and reports a load failure', async () => {
    api.dashboard.mockReturnValue(ok(dashboardFixture({ scopes: [] })));
    await create();
    expect(byId(fixture, 'no-policy')).not.toBeNull();

    fixture.nativeElement.remove();
    api.dashboard.mockReturnValue(throwError(() => new Error('offline')));
    await create();
    expect(byId(fixture, 'load-error')).not.toBeNull();
  });

  it('issues the certificate and downloads the PDF in the language of the interface', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    await create();

    (byId(fixture, 'download-pdf') as HTMLButtonElement).click();
    await settle(fixture);

    // The primary scope is the tenant default, or the first entity when there is none.
    expect(api.generateAttestation).toHaveBeenCalledWith('entity-lug');
    expect(api.attestationPdf).toHaveBeenCalledWith(
      'att-1',
      expect.stringMatching(/^(it|en|de|fr)$/),
    );
    expect(click).toHaveBeenCalledTimes(1);
    expect(byId(fixture, 'certificate-number')?.textContent).toContain('FF-SOV-CH-2026-000001');
  });

  it('offers the verifiable JSON bundle', async () => {
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);
    await create();

    (byId(fixture, 'download-json') as HTMLButtonElement).click();
    await settle(fixture);

    expect(api.attestationPdf).not.toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    expect((URL.createObjectURL as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBeInstanceOf(Blob);
  });

  it('tells the user when the certificate cannot be issued', async () => {
    api.generateAttestation.mockReturnValue(throwError(() => new Error('422')));
    await create();

    (byId(fixture, 'download-pdf') as HTMLButtonElement).click();
    await settle(fixture);

    expect(message.error).toHaveBeenCalledWith('DATA_SOVEREIGNTY.CERTIFICATE_ERROR');
  });

  it('keeps the tenant default as the primary scope when there is one', async () => {
    api.dashboard.mockReturnValue(
      ok(
        dashboardFixture({
          scopes: [
            scope({ site: 'mil' }),
            scope({
              site: 'lug',
              scope_type: 'TENANT_DEFAULT',
              legal_entity_id: null,
              legal_entity_name: null,
            }),
          ],
        }),
      ),
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await create();

    (byId(fixture, 'download-pdf') as HTMLButtonElement).click();
    await settle(fixture);

    expect(api.generateAttestation).toHaveBeenCalledWith(null);
    expect(q(fixture, '[data-testid="scope-default"]')?.textContent).toContain(
      'DATA_SOVEREIGNTY.TENANT_DEFAULT',
    );
  });
});
