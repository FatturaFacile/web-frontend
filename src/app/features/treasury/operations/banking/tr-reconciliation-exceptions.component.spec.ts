import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { BankingApiService } from '@core/api/banking-api.service';
import { InvoiceApiService } from '@core/api/invoice-api.service';
import { ProcurementApiService } from '@core/api/procurement-api.service';
import { exceptionLine, exceptionPage } from './iso-reconciliation.testing';
import { TrReconciliationExceptionsComponent } from './tr-reconciliation-exceptions.component';

const ok = { success: true, data: {} };

async function mount() {
  const banking = {
    getReconciliationExceptions: vi.fn(() =>
      of(
        exceptionPage(
          [
            exceptionLine({ id: 'l-1' }),
            exceptionLine({ id: 'l-2', exception_code: 'Unmatched', exception_candidate: null }),
          ],
          { AmountMismatch: 1, Unmatched: 1 },
        ),
      ),
    ),
    assignLineToInvoice: vi.fn(() => of(ok)),
    categorizeLine: vi.fn(() => of(ok)),
  };
  const invoices = { list: vi.fn(() => of({ data: [], meta: {} })) };
  const procurement = { getSupplierInvoices: vi.fn(() => of({ data: [], meta: {} })) };

  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideRouter([]),
      provideNzIcons([]),
      { provide: BankingApiService, useValue: banking },
      { provide: InvoiceApiService, useValue: invoices },
      { provide: ProcurementApiService, useValue: procurement },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(TrReconciliationExceptionsComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return { fixture, banking, invoices, procurement, host: fixture.nativeElement as HTMLElement };
}

describe('TrReconciliationExceptionsComponent', () => {
  it('loads the exceptions on open and shows one row per line', async () => {
    const { banking, host } = await mount();

    expect(banking.getReconciliationExceptions).toHaveBeenCalledTimes(1);
    expect(host.querySelectorAll('[data-testid="exception-row"]')).toHaveLength(2);
    expect(host.querySelector('[data-testid="code-AmountMismatch"]')).not.toBeNull();
  });

  it('filters by exception code through the tab buttons', async () => {
    const { banking, host, fixture } = await mount();

    (host.querySelector('[data-testid="code-Unmatched"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(banking.getReconciliationExceptions).toHaveBeenLastCalledWith(
      expect.objectContaining({ code: 'Unmatched', page: 1 }),
    );
  });

  it('confirms the suggested invoice in one click and removes the row', async () => {
    const { banking, host, fixture } = await mount();

    (host.querySelector('[data-testid="confirm-suggestion"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(banking.assignLineToInvoice).toHaveBeenCalledWith('l-1', {
      invoice_id: 'inv-1',
      difference_handling: 'none',
    });
    expect(host.querySelectorAll('[data-testid="exception-row"]')).toHaveLength(1);
    expect(host.querySelectorAll('[data-testid="confirm-suggestion"]')).toHaveLength(0);
  });

  it('offers the suggestion only for lines that have one', async () => {
    const { host } = await mount();

    expect(host.querySelectorAll('[data-testid="confirm-suggestion"]')).toHaveLength(1);
    expect(host.querySelectorAll('[data-testid="assign-button"]')).toHaveLength(2);
  });

  it('assigns a line to the chosen invoice with the difference handling', async () => {
    const { fixture, banking, invoices } = await mount();
    const component = fixture.componentInstance;
    const line = exceptionLine({ id: 'l-1' });

    component.openAssign(line);
    expect(invoices.list).toHaveBeenCalledWith(expect.objectContaining({ payment_status: 'unpaid' }));
    component['difference'].set('write_off');
    await component.confirmAssign();

    expect(banking.assignLineToInvoice).toHaveBeenCalledWith('l-1', {
      invoice_id: 'inv-1',
      difference_handling: 'write_off',
    });
    expect(component['assigning']()).toBeNull();
  });

  it('looks up supplier invoices for a debit line', async () => {
    const { fixture, procurement } = await mount();

    fixture.componentInstance.openAssign(exceptionLine({ id: 'l-9', direction: 'debit', exception_candidate: null }));

    expect(procurement.getSupplierInvoices).toHaveBeenCalledWith(expect.objectContaining({ payment_status: 'unpaid' }));
  });

  it('categorizes a line only with a category and a valid ledger account', async () => {
    const { fixture, banking } = await mount();
    const component = fixture.componentInstance;

    component.openCategorize(exceptionLine({ id: 'l-2' }));
    await component.confirmCategorize();
    expect(banking.categorizeLine).not.toHaveBeenCalled();

    component['category'].set('bank_expense');
    component['ledgerCode'].set('bad code!');
    await component.confirmCategorize();
    expect(banking.categorizeLine).not.toHaveBeenCalled();

    component['ledgerCode'].set('6940');
    component['notes'].set('  Account fee ');
    await component.confirmCategorize();

    expect(banking.categorizeLine).toHaveBeenCalledWith('l-2', {
      category: 'bank_expense',
      ledger_account_code: '6940',
      notes: 'Account fee',
    });
    expect(component['categorizing']()).toBeNull();
  });

  it('opens the detail drawer with the raw line data', async () => {
    const { host, fixture } = await mount();

    (host.querySelector('[data-testid="detail-button"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const detail = document.body.querySelector('[data-testid="detail"]')?.textContent ?? '';
    expect(detail).toContain('210000000003139471430009017');
    expect(detail).toContain('CH4431999123000889012');
    expect(detail).toContain('Cafe Mueller AG');
  });
});
