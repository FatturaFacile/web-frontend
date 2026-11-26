import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ClientApiService,
  PermissionsService,
  ReceivablesApiService,
  TranslateService,
} from '@core';
import { icons } from '../../icons-provider';
import { ReceivablesItemsComponent } from './receivables-items.component';
import { item } from './receivables.fixtures';

const translateSpy = {
  instant: vi.fn((key: string) => key),
  translate: vi.fn((key: string) => key),
  currentLanguage: signal('en'),
};
const messageSpy = { success: vi.fn(), error: vi.fn() };
const meta = { current_page: 1, from: 1, last_page: 1, per_page: 25, to: 3, total: 3 };

describe('ReceivablesItemsComponent', () => {
  let api: Record<
    | 'listItems'
    | 'getItem'
    | 'setDispute'
    | 'reverseAllocation'
    | 'getUnreconciledPayments'
    | 'allocate',
    ReturnType<typeof vi.fn>
  >;
  let canWrite: boolean;
  const rows = [
    item('1'),
    item('2', { customer_id: 'c-2', status: 'open', days_past_due: 0, open_amount: '50.00' }),
    item('3', { status: 'disputed', dispute_reason: 'wrong price' }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    canWrite = true;
    api = {
      listItems: vi.fn(() => of({ data: rows, meta })),
      getItem: vi.fn((id: string) =>
        of({
          data: {
            ...item(id),
            allocations: [
              {
                id: 'a-1',
                receivable_item_id: id,
                source_type: 'payment',
                origin: 'manual',
                source_id: 'l-1',
                source_reference: 'BONIFICO 7',
                amount: '100.00',
                value_date: '2026-03-12',
                notes: null,
                allocated_by: 'u-1',
                reversed_at: null,
              },
              {
                id: 'a-2',
                receivable_item_id: id,
                source_type: 'discount',
                origin: 'manual',
                source_id: null,
                source_reference: null,
                amount: '5.00',
                value_date: '2026-03-13',
                notes: null,
                allocated_by: 'u-1',
                reversed_at: '2026-03-14T10:00:00Z',
              },
            ],
          },
        }),
      ),
      setDispute: vi.fn((id: string) => of({ data: item(id, { status: 'disputed' }) })),
      reverseAllocation: vi.fn(() => of({ data: {} })),
      getUnreconciledPayments: vi.fn(() => of({ data: [] })),
      allocate: vi.fn(() => of({ data: { allocations: [], items: [] } })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', component: ReceivablesItemsComponent }]),
        { provide: ReceivablesApiService, useValue: api },
        {
          provide: ClientApiService,
          useValue: {
            get: vi.fn((id: string) => of({ data: { id, company_name: `Customer ${id}` } })),
            list: vi.fn(() => of({ data: [], meta })),
          },
        },
        { provide: PermissionsService, useValue: { canWrite: () => canWrite } },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
      ],
    });
  });

  async function open(url = '/') {
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl(url, ReceivablesItemsComponent);
    await harness.fixture.whenStable();
    harness.detectChanges();
    return { harness, component, root: harness.fixture.nativeElement as HTMLElement };
  }

  it('opens on the drill-down filters of the url', async () => {
    await open('/?bucket=31_60&customer_id=c-1&currency=EUR');

    expect(api.listItems).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: '31_60',
        customer_id: 'c-1',
        currency: 'EUR',
        open_only: true,
        page: 1,
      }),
    );
  });

  it('lists the items with their status, days past due and customer name', async () => {
    const { root } = await open();
    const body = root.querySelectorAll('table.matrix tbody tr');

    expect(body).toHaveLength(3);
    expect(body[0].classList.contains('overdue-row')).toBe(true);
    expect(body[0].textContent).toContain('FT-1');
    expect(body[0].textContent).toContain('AR.STATUS_OVERDUE');
    expect(body[0].textContent).toContain('Customer c-1');
    expect(body[1].textContent).toContain('AR.STATUS_OPEN');
    expect(body[2].textContent).toContain('AR.STATUS_DISPUTED');
  });

  it('shows the bucket of the drill-down as a chip that can be closed', async () => {
    const { harness, root } = await open('/?bucket=31_60');
    expect(root.textContent).toContain('AR.BUCKET_RANGE');

    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    await harness.fixture.whenStable();

    expect(api.listItems).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ bucket: '31_60' }),
    );
  });

  it('rewrites the url, and reloads from it, when a filter changes', async () => {
    const { harness, component } = await open('/?bucket=1_30');

    component.apply({ status: 'overdue' });
    await harness.fixture.whenStable();

    expect(TestBed.inject(Router).url).toContain('status=overdue');
    expect(TestBed.inject(Router).url).toContain('bucket=1_30');
    expect(api.listItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'overdue', bucket: '1_30', page: 1 }),
    );

    component.onRange('due', [new Date(2026, 2, 1), new Date(2026, 2, 31)]);
    await harness.fixture.whenStable();
    expect(api.listItems).toHaveBeenLastCalledWith(
      expect.objectContaining({ due_from: '2026-03-01', due_to: '2026-03-31' }),
    );

    component.reset();
    await harness.fixture.whenStable();
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('only reloads on a complete currency code', async () => {
    const { harness, component } = await open();
    const calls = api.listItems.mock.calls.length;

    component.applyCurrency('ch');
    await harness.fixture.whenStable();
    expect(api.listItems.mock.calls.length).toBe(calls);

    component.applyCurrency('chf');
    await harness.fixture.whenStable();
    expect(api.listItems).toHaveBeenLastCalledWith(expect.objectContaining({ currency: 'CHF' }));
  });

  it('enables the reconciliation for the items of one customer and warns about a mixed selection', async () => {
    const { harness, component, root } = await open();
    const boxes = root.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]');
    const reconcile = (): HTMLButtonElement =>
      root.querySelector<HTMLButtonElement>('button[nztype="primary"]') as HTMLButtonElement;

    expect(reconcile().disabled).toBe(true);

    boxes[0].click();
    harness.detectChanges();
    expect(component.store.selectedIds()).toEqual(['1']);
    expect(reconcile().disabled).toBe(false);

    boxes[1].click();
    harness.detectChanges();
    expect(reconcile().disabled).toBe(true);
    expect(root.textContent).toContain('AR.SELECTION_MIXED');
  });

  it('selects every item with money open from the header box', async () => {
    const { harness, component, root } = await open();

    root.querySelector<HTMLInputElement>('thead input[type="checkbox"]')?.click();
    harness.detectChanges();

    expect(component.store.selectedIds()).toEqual(['1', '2', '3']);
    expect(component.allSelected()).toBe(true);
  });

  it('hides the write actions from a member without write access', async () => {
    canWrite = false;

    const { root } = await open();

    expect(root.querySelector('tbody input[type="checkbox"]')).toBeNull();
    expect(root.querySelector('button[nztype="primary"]')).toBeNull();
    expect(root.textContent).not.toContain('AR.MARK_DISPUTE');
    expect(root.textContent).toContain('AR.DETAILS');
  });

  it('marks a dispute with a mandatory reason', async () => {
    const { component } = await open();

    component.startDispute(rows[0]);
    component.disputeReason.set('   ');
    await component.confirmDispute();
    expect(api.setDispute).not.toHaveBeenCalled();

    component.disputeReason.set(' Wrong price ');
    await component.confirmDispute();

    expect(api.setDispute).toHaveBeenCalledWith('1', { disputed: true, reason: 'Wrong price' });
    expect(component.disputeTarget()).toBeNull();
    expect(messageSpy.success).toHaveBeenCalledWith('AR.DISPUTE_MARKED');
  });

  it('clears a dispute', async () => {
    const { component } = await open();

    await component.clearDispute(rows[2]);

    expect(api.setDispute).toHaveBeenCalledWith('3', { disputed: false });
    expect(messageSpy.success).toHaveBeenCalledWith('AR.DISPUTE_CLEARED');
  });

  it('shows the allocations of an item and reverses a manual one, not the reversed one', async () => {
    const { harness, component } = await open();

    await component.store.openDetail('1');
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();

    const text = document.body.textContent as string;
    expect(text).toContain('BONIFICO 7');
    expect(text).toContain('AR.REVERSED');
    expect(document.body.querySelectorAll('.ant-drawer-body button[nzdanger]')).toHaveLength(1);

    await component.reverse('a-1');

    expect(api.reverseAllocation).toHaveBeenCalledWith('a-1');
    expect(messageSpy.success).toHaveBeenCalledWith('AR.REVERSED_OK');
  });

  it('shows the message of the API when a write is refused', async () => {
    api.setDispute.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } })),
    );
    const { component } = await open();

    component.startDispute(rows[0]);
    component.disputeReason.set('Wrong price');
    await component.confirmDispute();

    expect(messageSpy.error).toHaveBeenCalledWith('Forbidden');
    expect(messageSpy.success).not.toHaveBeenCalled();
  });
});
