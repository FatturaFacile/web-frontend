import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { TreasuryApiService } from '@core/api/treasury-api.service';
import { TreasuryBankingApiService } from '@core/api/treasury-banking-api.service';
import { TrPaymentFlowsComponent } from './tr-payment-flows.component';

const envelope = { success: true, message: '', data: [] };

async function mount(overrides: Record<string, unknown> = {}) {
  const banking = {
    getPaymentFlows: vi.fn(() => of(envelope)),
    previewPaymentFlow: vi.fn(),
    createPaymentFlowBatch: vi.fn(),
    ...overrides,
  };

  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    providers: [
      provideNzI18n(en_US),
      provideNzIcons([]),
      provideNzDateFnsAdapter(),
      provideHttpClient(),
      provideRouter([]),
      { provide: TreasuryBankingApiService, useValue: banking },
      { provide: TreasuryApiService, useValue: { getBankAccounts: vi.fn(() => of(envelope)) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(TrPaymentFlowsComponent);
  fixture.detectChanges();
  await fixture.whenStable();

  const component = fixture.componentInstance;
  component['bankAccountId'].set('acc-1');
  component['executionDate'].set(new Date(2026, 2, 20));
  component['patch'](0, { recipient_name: 'Muster AG', recipient_iban: 'CH9300762011623852957', amount: '10.00' });

  return { fixture, component, banking, host: fixture.nativeElement as HTMLElement };
}

describe('TrPaymentFlowsComponent ISO 20022 additions', () => {
  it('sends the category purpose and the charge bearer with the flow', async () => {
    const preview = vi.fn(() => of({ success: true, message: '', data: { transactions: 1, control_sum: '10.00', currency: 'CHF', pain_version: '09', sha256: 'x', filename: 'f.xml', xml: '<x/>' } }));
    const { component, banking, fixture } = await mount({ previewPaymentFlow: preview });

    component['categoryPurpose'].set('SUPP');
    component['chargeBearer'].set('SHAR');
    component['preview']();
    fixture.detectChanges();

    expect(banking.previewPaymentFlow).toHaveBeenCalledWith(
      expect.objectContaining({ category_purpose: 'SUPP', charge_bearer: 'SHAR', bank_account_id: 'acc-1' }),
    );
  });

  it('leaves both fields empty when none is chosen', async () => {
    const preview = vi.fn(() => of({ success: true, message: '', data: { transactions: 1, control_sum: '10.00', currency: 'CHF', pain_version: '09', sha256: 'x', filename: 'f.xml', xml: null } }));
    const { component, banking } = await mount({ previewPaymentFlow: preview });

    component['preview']();

    expect(banking.previewPaymentFlow).toHaveBeenCalledWith(
      expect.objectContaining({ category_purpose: null, charge_bearer: null }),
    );
  });

  it('shows the duplicate payment messages under the line they belong to', async () => {
    const duplicate = new HttpErrorResponse({
      status: 422,
      error: {
        errors: {
          'lines.0.invoice_id': ['Invoice FA-1 is already in an open payment batch.'],
          'lines.0.end_to_end_id': ['End-to-end id already used.'],
        },
      },
    });
    const { component, fixture, host } = await mount({ previewPaymentFlow: vi.fn(() => throwError(() => duplicate)) });

    component['preview']();
    fixture.detectChanges();

    const lineErrors = host.querySelector('[data-testid="line-errors"]');
    expect(lineErrors?.textContent).toContain('Invoice FA-1 is already in an open payment batch.');
    expect(lineErrors?.textContent).toContain('End-to-end id already used.');
    expect(host.querySelector('[data-testid="errors"]')).toBeNull();
  });

  it('shows the ISO reason of a rejected line after the batch is stored', async () => {
    const create = vi.fn(() =>
      of({
        success: true,
        message: '',
        data: {
          id: 'b-1',
          batch_reference: 'DIST-1',
          status: 'exported',
          lines: [
            { recipient_name: 'Muster AG', recipient_iban: 'CH9300762011623852957', amount: 10, end_to_end_id: 'E2E-1', error_code: 'AM04', error_message: 'No cover' },
            { recipient_name: 'Other AG', recipient_iban: 'CH9300762011623852957', amount: 5, end_to_end_id: 'E2E-2' },
          ],
        },
      }),
    );
    const { component, fixture, host } = await mount({ createPaymentFlowBatch: create });

    component['createBatch']();
    fixture.detectChanges();

    const rows = host.querySelectorAll('[data-testid="line-status-row"]');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain('AM04');
    expect(rows[0]?.textContent).toContain('No cover');
  });
});
