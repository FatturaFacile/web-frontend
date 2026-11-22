import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientApiService, ReceivablesApiService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { CustomerLedgerComponent } from './customer-ledger.component';
import { ledger } from './receivables.fixtures';

const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};

describe('CustomerLedgerComponent', () => {
  let api: { getLedger: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { getLedger: vi.fn(() => of({ data: ledger })) };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'ledger', component: CustomerLedgerComponent },
          { path: 'ledger/:customerId', component: CustomerLedgerComponent },
        ]),
        { provide: ReceivablesApiService, useValue: api },
        {
          provide: ClientApiService,
          useValue: {
            get: vi.fn((id: string) => of({ data: { id, company_name: 'Rossi SRL' } })),
            list: vi.fn(() => of({ data: [], meta: {} })),
          },
        },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    });
  });

  async function open(url: string) {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(url, CustomerLedgerComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return { harness, component, root: harness.fixture.nativeElement as HTMLElement };
  }

  it('asks to pick a customer and loads nothing without one', async () => {
    const { root } = await open('/ledger');

    expect(root.textContent).toContain('AR.PICK_CUSTOMER_HINT');
    expect(api.getLedger).not.toHaveBeenCalled();
  });

  it('loads the ledger of the customer of the url', async () => {
    const { component } = await open('/ledger/c-1');

    expect(api.getLedger).toHaveBeenCalledWith('c-1', {});
    expect(component.customerId()).toBe('c-1');
  });

  it('shows the movements in order with the running balance and the closing balance', async () => {
    const { root } = await open('/ledger/c-1');
    const rows = root.querySelectorAll('table.matrix tbody tr');

    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('FT-1');
    expect(rows[0].textContent).toContain('AR.KIND_DOCUMENT');
    expect(rows[0].textContent).toContain('AR.STATUS_PARTIALLY_PAID');
    expect(rows[1].textContent).toContain('BONIFICO 7');
    expect(rows[1].textContent).toContain('AR.KIND_PAYMENT');
    // Value date differs from the booking date of the payment.
    expect(rows[1].textContent).toContain('2026-03-10');
    expect(rows[1].textContent).toContain('2026-03-12');
    expect(root.querySelector('tfoot')?.textContent).toContain('AR.CLOSING_BALANCE');
  });

  it('filters by period, status and currency', async () => {
    const { harness, component } = await open('/ledger/c-1');

    component.onRange([new Date(2026, 0, 1), new Date(2026, 2, 31)]);
    await harness.fixture.whenStable();
    expect(api.getLedger).toHaveBeenLastCalledWith('c-1', { from: '2026-01-01', to: '2026-03-31' });

    component.onCurrency('chf');
    await harness.fixture.whenStable();
    expect(api.getLedger).toHaveBeenLastCalledWith(
      'c-1',
      expect.objectContaining({ currency: 'CHF', from: '2026-01-01' }),
    );

    const calls = api.getLedger.mock.calls.length;
    component.onCurrency('ch');
    expect(api.getLedger.mock.calls.length).toBe(calls);
  });

  it('links to the reconciliation of the open items of the customer', async () => {
    const { component, root } = await open('/ledger/c-1');

    expect(component.itemsQuery()).toEqual({ customer_id: 'c-1', open_only: '1' });
    const links = [...root.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(links).toContain('/receivables/credit/c-1');
    expect(links).toContain('/receivables/statement/c-1');
  });

  it('navigates to the ledger of another customer', async () => {
    const { component } = await open('/ledger');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    component.onCustomer({ id: 'c-2', name: 'Bianchi SA' });
    component.onCustomer(null);

    expect(navigate).toHaveBeenNthCalledWith(1, ['/receivables/ledger', 'c-2']);
    expect(navigate).toHaveBeenNthCalledWith(2, ['/receivables/ledger']);
  });
});
