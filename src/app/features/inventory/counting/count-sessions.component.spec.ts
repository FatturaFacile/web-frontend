import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CountSession, InventoryCountApiService, InventoryValuationApiService } from '@core';
import { httpError, inventoryTestProviders } from '../shared/inventory-valuation.testing';
import { CountSessionsComponent } from './count-sessions.component';

const SESSION = {
  id: 's1',
  session_number: 'INV-2026-0001',
  warehouse_id: 'w1',
  warehouse_zone_id: null,
  count_type: 'cycle_count_abc',
  status: 'in_progress',
  scheduled_date: '2026-11-20',
  snapshot_at: null,
  is_blind: true,
  freezes_stock: true,
  frozen_at: '2026-11-20T08:00:00Z',
  assigned_to: null,
  inventory_adjustment_id: null,
} as CountSession;

describe('CountSessionsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      listSessions: vi.fn(() =>
        of({ success: true, message: '', data: [SESSION], meta: { total: 1, per_page: 10, current_page: 1, last_page: 1 } }),
      ),
      createSession: vi.fn(() => of(SESSION)),
      getSession: vi.fn(() => of(SESSION)),
      getSheet: vi.fn(() => of({ session: SESSION, data: [{ id: 'l1', is_counted: true }, { id: 'l2', is_counted: false }] })),
      freeze: vi.fn(() => of(SESSION)),
      unfreeze: vi.fn(() => of({ ...SESSION, frozen_at: null })),
      assign: vi.fn(() => of(SESSION)),
      cancel: vi.fn(() => of({ ...SESSION, status: 'cancelled' })),
      reconcile: vi.fn(() => of({})),
    };
    TestBed.configureTestingModule({
      imports: [CountSessionsComponent],
      providers: [
        ...inventoryTestProviders(),
        { provide: InventoryCountApiService, useValue: api },
        { provide: InventoryValuationApiService, useValue: { listWarehouses: vi.fn(() => of([{ id: 'w1', name: 'Main' }])) } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  function render() {
    const fixture = TestBed.createComponent(CountSessionsComponent);
    fixture.detectChanges();
    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    return fixture;
  }

  it('lists sessions with status, blind and frozen badges', () => {
    const el = render().nativeElement as HTMLElement;

    expect(el.textContent).toContain('INV-2026-0001');
    expect(el.textContent).toContain('INVENTORY_COUNT.SESSION.STATUS_IN_PROGRESS');
    expect(el.textContent).toContain('INVENTORY_COUNT.SESSION.BLIND');
    expect(el.textContent).toContain('INVENTORY_COUNT.SESSION.FROZEN');
  });

  it('computes the sheet progress when opening a session', () => {
    const fixture = render();
    fixture.componentInstance.openDetail(SESSION);

    expect(api['getSheet']).toHaveBeenCalledWith('s1');
    expect(fixture.componentInstance.countedLines()).toBe(1);
    expect(fixture.componentInstance.totalLines()).toBe(2);
    expect(fixture.componentInstance.progressPercent()).toBe(50);
  });

  it('creates a session with a plain ISO date and optional fields omitted', () => {
    const fixture = render();
    const c = fixture.componentInstance;
    c.openCreate();
    c.createForm.patchValue({
      warehouse_id: 'w1',
      count_type: 'spot_check',
      scheduled_date: new Date(2026, 10, 25),
      freezes_stock: true,
    });

    c.create();

    expect(api['createSession']).toHaveBeenCalledWith({
      warehouse_id: 'w1',
      count_type: 'spot_check',
      scheduled_date: '2026-11-25',
      freezes_stock: true,
      is_blind: true,
      assigned_to: undefined,
      warehouse_zone_id: undefined,
      bin_ids: undefined,
    });
  });

  it('does not create without a warehouse', () => {
    const c = render().componentInstance;
    c.openCreate();
    c.create();

    expect(api['createSession']).not.toHaveBeenCalled();
  });

  it('requires a reason to release the freeze', () => {
    const c = render().componentInstance;
    c.openDetail(SESSION);

    c.openUnfreeze();
    c.unfreeze();
    expect(api['unfreeze']).not.toHaveBeenCalled();

    c.unfreezeReason.set('  Counted by mistake  ');
    c.unfreeze();
    expect(api['unfreeze']).toHaveBeenCalledWith('s1', 'Counted by mistake');
  });

  it('assigns, clearing the counter when blank', () => {
    const c = render().componentInstance;
    c.openDetail(SESSION);
    c.assignedTo.set('  ');
    c.assign();

    expect(api['assign']).toHaveBeenCalledWith('s1', { assigned_to: null });
  });

  it('shows validation errors of a 422 inline', () => {
    api['freeze'].mockReturnValue(throwError(() => httpError(422, { message: 'Invalid', errors: { reason: ['Stock already frozen'] } })));
    const c = render().componentInstance;
    c.openDetail(SESSION);

    c.freeze();

    expect(c.errors()).toEqual(['Stock already frozen']);
    expect(c.busy()).toBe(false);
  });
});
