import { TestBed } from '@angular/core/testing';
import { ProcurementApiService } from '@core/api/procurement-api.service';
import { PurchasesExtraApiService } from '@core/api/purchases-extra-api.service';
import { InvoiceMatchingApiService } from '@data-access/procurement/invoice-matching-api.service';
import { InvoiceMatchRun } from '@domain/procurement/invoice-matching.models';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { SupplierInvoiceDetailStore } from './supplier-invoice-detail.store';

const invoice = {
  id: 'i-1',
  invoice_number: 'F-1',
  total_amount: '122.00',
  total_paid: '22.00',
  currency: 'EUR',
};

function setup(overrides: {
  invoice?: unknown;
  lines?: unknown;
  history?: unknown;
  approval?: unknown;
}) {
  TestBed.configureTestingModule({
    providers: [
      SupplierInvoiceDetailStore,
      {
        provide: PurchasesExtraApiService,
        useValue: { getSupplierInvoice: vi.fn(() => overrides.invoice ?? of({ data: invoice })) },
      },
      {
        provide: ProcurementApiService,
        useValue: {
          getSupplierInvoiceLines: vi.fn(() => overrides.lines ?? of({ data: [{ id: 'l-1' }] })),
          getSupplierInvoiceApproval: vi.fn(
            () => overrides.approval ?? of({ data: { approval_status: 'approved', steps: [] } }),
          ),
        },
      },
      {
        provide: InvoiceMatchingApiService,
        useValue: { invoiceHistory: vi.fn(() => overrides.history ?? of([])) },
      },
    ],
  });
  return TestBed.inject(SupplierInvoiceDetailStore);
}

describe('SupplierInvoiceDetailStore', () => {
  it('loads the invoice with its lines and approval and computes the outstanding amount', () => {
    const store = setup({});

    store.load('i-1');

    expect(store.invoice()?.invoice_number).toBe('F-1');
    expect(store.lines()).toHaveLength(1);
    expect(store.approval()?.approval_status).toBe('approved');
    expect(store.outstanding()).toBe(100);
    expect(store.loading()).toBe(false);
  });

  it('leaves out of the outstanding amount what the buyer withholds or pays as split-payment VAT', () => {
    const store = setup({
      invoice: of({
        data: {
          ...invoice,
          total_amount: '1220.00',
          total_paid: '0',
          withholding_tax_amount: '200.00',
          split_payment_tax_amount: '220.00',
        },
      }),
    });

    store.load('i-1');

    expect(store.outstanding()).toBe(800);
  });

  it('picks the current run of the match history', () => {
    const history = [
      { id: 'r-old', is_current: false },
      { id: 'r-now', is_current: true },
    ] as InvoiceMatchRun[];
    const store = setup({ history: of(history) });

    store.load('i-1');

    expect(store.currentRun()?.id).toBe('r-now');
  });

  it('reports the error when the invoice cannot be loaded and keeps the page usable', () => {
    const store = setup({ invoice: throwError(() => ({ error: { message: 'Not found' } })) });

    store.load('missing');

    expect(store.invoice()).toBeNull();
    expect(store.error()).toBe('Not found');
    expect(store.outstanding()).toBeNull();
  });

  it('falls back to empty sections when the secondary calls fail', () => {
    const store = setup({
      lines: throwError(() => new Error('403')),
      history: throwError(() => new Error('403')),
      approval: throwError(() => new Error('403')),
    });

    store.load('i-1');

    expect(store.invoice()).not.toBeNull();
    expect(store.lines()).toEqual([]);
    expect(store.matchRuns()).toEqual([]);
    expect(store.approval()).toBeNull();
    expect(store.error()).toBeNull();
  });
});
