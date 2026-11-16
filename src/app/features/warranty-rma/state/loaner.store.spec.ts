import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WarrantyRmaApiService } from '@core';
import { httpError, loanerFixture } from '../testing/rma-fixtures';
import { RmaNotifier } from './action-result';
import { LoanerStore } from './loaner.store';

describe('LoanerStore', () => {
  let store: InstanceType<typeof LoanerStore>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let notifier: { success: ReturnType<typeof vi.fn>; conflict: ReturnType<typeof vi.fn> };
  const meta = { current_page: 1, from: 1, last_page: 1, per_page: 25, to: 1, total: 1 };

  beforeEach(() => {
    api = {
      listLoaners: vi
        .fn()
        .mockReturnValue(
          of({ data: [loanerFixture({ is_overdue: true, days_outstanding: 12 })], meta }),
        ),
      returnLoaner: vi.fn(),
      markLoanerLost: vi.fn(),
    };
    notifier = { success: vi.fn(), conflict: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        LoanerStore,
        { provide: WarrantyRmaApiService, useValue: api },
        { provide: RmaNotifier, useValue: notifier },
      ],
    });
    store = TestBed.inject(LoanerStore);
  });

  it('loads the register', () => {
    store.loadList();
    expect(api['listLoaners']).toHaveBeenCalledWith({
      status: null,
      register_type: null,
      overdue: null,
      page: 1,
    });
    expect(store.items()[0].is_overdue).toBe(true);
  });

  it('filters overdue loaners with overdue=1', () => {
    store.setFilters({ overdue: true, register_type: 'prestito_uso' });
    expect(api['listLoaners']).toHaveBeenLastCalledWith({
      status: null,
      register_type: 'prestito_uso',
      overdue: 1,
      page: 1,
    });
  });

  it('returns a loaner and refreshes the register', async () => {
    api['returnLoaner'].mockReturnValue(of({ data: loanerFixture({ status: 'returned' }) }));
    api['listLoaners'].mockClear();
    const res = await store.returnLoaner('ln-1');
    expect(res.ok).toBe(true);
    expect(api['returnLoaner']).toHaveBeenCalledWith('ln-1', {});
    expect(api['listLoaners']).toHaveBeenCalled();
    expect(notifier.success).toHaveBeenCalledWith('RMA.MESSAGES.LOANER_RETURNED');
  });

  it('marks a loaner lost and refreshes the register', async () => {
    api['markLoanerLost'].mockReturnValue(of({ data: loanerFixture({ status: 'lost' }) }));
    api['listLoaners'].mockClear();
    await store.markLost('ln-1');
    expect(api['listLoaners']).toHaveBeenCalled();
  });

  it('reloads and informs the user on 409', async () => {
    api['markLoanerLost'].mockReturnValue(httpError(409, { code: 'invalid_transition' }));
    api['listLoaners'].mockClear();
    const res = await store.markLost('ln-1');
    expect(res.ok).toBe(false);
    expect(notifier.conflict).toHaveBeenCalledWith('invalid_transition');
    expect(api['listLoaners']).toHaveBeenCalled();
    expect(store.busyId()).toBeNull();
  });
});
