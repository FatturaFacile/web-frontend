import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FpaDocumentsApiService, PermissionsService, SdiTransmissionsApiService } from '@core';
import { icons } from '../../icons-provider';
import { SdiCockpitComponent } from './sdi-cockpit.component';
import { SdiInboxComponent } from './sdi-inbox.component';
import { SdiPreflightDrawerComponent } from './sdi-preflight-drawer.component';
import { SdiSettingsComponent } from './sdi-settings.component';

const rejected = {
  id: 'd1',
  invoice_id: 'inv-1',
  parent_fpa_document_id: null,
  direction: 'outbound',
  format_transmission: 'FPR12',
  document_type: 'TD01',
  document_number: '7',
  document_date: '2026-03-15',
  sdi_identifier: '99',
  file_name: 'IT1_00001.xml',
  transmission_progressive: '00001',
  status: 'rejected',
  validation_errors: [{ code: '00423', description: 'Total mismatch' }],
  transmitted_at: null,
  rejected_at: null,
  resubmission_deadline_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
};
const kpi = {
  ready: 1,
  transmitted: 2,
  delivered: 3,
  undelivered: 4,
  rejected: 5,
  inbound_to_process: 6,
};

describe('SDI cockpit pages', () => {
  const api = {
    list: vi.fn(),
    show: vi.fn(),
    resubmit: vi.fn(),
    preflight: vi.fn(),
    send: vi.fn(),
    render: vi.fn(),
    settings: vi.fn(),
    saveSettings: vi.fn(),
    saveSettingsWithCertificate: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };

  function setup<T>(component: new () => T): {
    fixture: ReturnType<typeof TestBed.createComponent<T>>;
  } {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: FpaDocumentsApiService, useValue: api },
        {
          provide: SdiTransmissionsApiService,
          useValue: { previewHtml: () => of(new Blob(['<p/>'])) },
        },
        { provide: PermissionsService, useValue: { canWrite: () => true, canRead: () => true } },
        { provide: NzMessageService, useValue: message },
      ],
    });
    const fixture = TestBed.createComponent(component);
    fixture.detectChanges();

    return { fixture };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.list.mockReturnValue(
      of({
        data: [rejected],
        meta: { total: 1, current_page: 1, last_page: 1, per_page: 25, kpi },
      }),
    );
    api.show.mockReturnValue(
      of({
        data: {
          ...rejected,
          notifications: [
            { id: 'n1', type: 'NS', outcome_code: null, error_codes: null, received_at: null },
          ],
        },
      }),
    );
    api.resubmit.mockReturnValue(of({ data: rejected }));
    api.preflight.mockReturnValue(
      of({
        data: {
          xml: '<xml/>',
          valid: false,
          errors: [{ code: '00423', path: 'DettaglioLinee[1]', params: {} }],
          warnings: [],
        },
      }),
    );
    api.send.mockReturnValue(of({ data: {} }));
    api.render.mockReturnValue(of(new Blob(['<p/>'])));
    api.settings.mockReturnValue(
      of({
        data: {
          signature_mode: 'none',
          default_codice_destinatario: '0000000',
          transmitter_country_code: 'IT',
          progressivo_invio_counter: 7,
          has_certificate: false,
          has_credentials: false,
        },
      }),
    );
    api.saveSettings.mockReturnValue(
      of({
        data: {
          signature_mode: 'remote_hsm_provider',
          default_codice_destinatario: '0000000',
          transmitter_country_code: 'IT',
          progressivo_invio_counter: 7,
          has_certificate: false,
          has_credentials: false,
        },
      }),
    );
  });

  it('shows the KPI counters and the rejection countdown badge', () => {
    const { fixture } = setup(SdiCockpitComponent);
    const html: string = fixture.nativeElement.textContent;

    expect(html).toContain('5');
    expect(fixture.nativeElement.querySelector('[data-testid="countdown-badge"]')).not.toBeNull();
  });

  it('resubmits a rejected envelope and reloads', () => {
    const { fixture } = setup(SdiCockpitComponent);
    (fixture.componentInstance as unknown as { resubmit(doc: object): void }).resubmit(rejected);

    expect(api.resubmit).toHaveBeenCalledWith('d1');
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('blocks the send button while the pre-flight has errors', () => {
    const { fixture } = setup(SdiPreflightDrawerComponent);
    fixture.componentRef.setInput('invoiceId', 'inv-1');
    fixture.detectChanges();

    expect(api.preflight).toHaveBeenCalledWith('inv-1');
    const result = (
      fixture.componentInstance as unknown as { result(): { valid: boolean } | null }
    ).result();
    expect(result?.valid).toBe(false);
  });

  it('sends the invoice once the pre-flight is clean', () => {
    api.preflight.mockReturnValue(
      of({ data: { xml: '<xml/>', valid: true, errors: [], warnings: [] } }),
    );
    const { fixture } = setup(SdiPreflightDrawerComponent);
    const sent = vi.fn();
    fixture.componentInstance.sent.subscribe(sent);
    fixture.componentRef.setInput('invoiceId', 'inv-1');
    fixture.detectChanges();

    (fixture.componentInstance as unknown as { send(): void }).send();

    expect(api.send).toHaveBeenCalledWith('inv-1');
    expect(sent).toHaveBeenCalled();
  });

  it('lists inbound envelopes in the inbox', () => {
    setup(SdiInboxComponent);

    expect(api.list).toHaveBeenCalledWith({ direction: 'inbound', per_page: 50 });
  });

  it('saves the SDI settings', () => {
    const { fixture } = setup(SdiSettingsComponent);
    const view = fixture.componentInstance as unknown as {
      patch(key: string, value: unknown): void;
      save(): void;
    };
    view.patch('signature_mode', 'remote_hsm_provider');
    view.save();

    expect(api.saveSettings).toHaveBeenCalledWith(
      expect.objectContaining({ signature_mode: 'remote_hsm_provider' }),
    );
    expect(message.success).toHaveBeenCalled();
  });
});
