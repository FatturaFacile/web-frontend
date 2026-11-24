import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService, RmaBoardColumn, WarrantyRmaApiService } from '@core';
import { RmaNotifier } from '../../state/action-result';
import { RmaBoardStore } from '../../state/rma-board.store';
import { RmaDetailStore } from '../../state/rma-detail.store';
import { i18nStub, rmaFixture } from '../../testing/rma-fixtures';
import { RmaBoardComponent } from './rma-board.component';

const columns: RmaBoardColumn[] = [
  {
    status: 'awaiting_arrival',
    label: 'Attesa arrivo merce',
    count: 2,
    items: [
      {
        id: 'rma-1',
        rma_number: 'RMA-2026-000001',
        serial_number: 'SN1',
        customer_name: 'ACME SA',
        warranty_status: 'covered_in_warranty',
        estimate_approval_status: 'not_required',
        age_days: 2,
        has_loaner: false,
        loaner_overdue: false,
      },
    ],
  },
  {
    status: 'returned',
    label: 'Riconsegnato',
    count: 1,
    items: [
      {
        id: 'rma-2',
        rma_number: 'RMA-2026-000002',
        serial_number: 'SN2',
        customer_name: 'Beta Srl',
        warranty_status: 'out_of_warranty_billable',
        estimate_approval_status: 'approved',
        age_days: 40,
        has_loaner: true,
        loaner_overdue: true,
      },
    ],
  },
];

describe('RmaBoardComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    api = {
      getBoard: vi.fn().mockReturnValue(of({ data: { columns }, meta: {} })),
      getRma: vi
        .fn()
        .mockReturnValue(of({ data: rmaFixture({ id: 'rma-1', status: 'awaiting_arrival' }) })),
    };
    await TestBed.configureTestingModule({
      imports: [RmaBoardComponent],
      providers: [
        provideRouter([]),
        RmaBoardStore,
        RmaDetailStore,
        { provide: WarrantyRmaApiService, useValue: api },
        { provide: I18nService, useValue: i18nStub() },
        { provide: RmaNotifier, useValue: { success: vi.fn(), conflict: vi.fn() } },
      ],
    }).compileComponents();
  });

  function render() {
    const fixture = TestBed.createComponent(RmaBoardComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders one column per status with its count', () => {
    const el = render().nativeElement as HTMLElement;
    const titles = Array.from(el.querySelectorAll('.board-column-title')).map((t) =>
      t.textContent?.trim(),
    );
    expect(titles).toEqual([
      'RMA.STATUS.AWAITING_ARRIVAL',
      'RMA.STATUS.IN_DIAGNOSIS',
      'RMA.STATUS.AWAITING_ESTIMATE_APPROVAL',
      'RMA.STATUS.AWAITING_PARTS',
      'RMA.STATUS.IN_REPAIR_TESTING',
      'RMA.STATUS.READY_FOR_RETURN',
      'RMA.STATUS.RETURNED',
    ]);
    const counts = Array.from(el.querySelectorAll('.board-count')).map((c) =>
      c.textContent?.trim(),
    );
    expect(counts[0]).toBe('2');
    expect(counts[6]).toBe('1');
  });

  it('offers only the actions legal for the card status', () => {
    const el = render().nativeElement as HTMLElement;
    const [arrival, , , , , , returned] = Array.from(el.querySelectorAll('.board-column'));
    const actions = (col: Element) =>
      Array.from(col.querySelectorAll('.board-card-actions button')).map((b) =>
        b.textContent?.trim(),
      );
    expect(actions(arrival)).toEqual(['RMA.ACTIONS.RECEIVE', 'RMA.ACTIONS.CANCEL']);
    expect(actions(returned)).toEqual(['RMA.ACTIONS.CLOSE']);
  });

  it('flags an overdue loaner with icon and text, not colour alone', () => {
    const el = render().nativeElement as HTMLElement;
    const overdue = el.querySelectorAll('.board-overdue');
    expect(overdue).toHaveLength(1);
    expect(overdue[0].textContent).toContain('RMA.LOANER.OVERDUE');
    expect(overdue[0].querySelector('i.fa-triangle-exclamation')).not.toBeNull();
  });

  it('opens the detail drawer from a card', async () => {
    const fixture = render();
    const card = (fixture.nativeElement as HTMLElement).querySelector(
      '.board-card-open',
    ) as HTMLButtonElement;
    card.click();
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.componentInstance.drawerOpen()).toBe(true);
    expect(api['getRma']).toHaveBeenCalledWith('rma-1');
  });
});
