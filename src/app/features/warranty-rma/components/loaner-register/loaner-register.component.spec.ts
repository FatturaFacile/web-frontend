import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService, WarrantyRmaApiService } from '@core';
import { RmaNotifier } from '../../state/action-result';
import { LoanerStore } from '../../state/loaner.store';
import { i18nStub, loanerFixture } from '../../testing/rma-fixtures';
import { LoanerRegisterComponent } from './loaner-register.component';

describe('LoanerRegisterComponent', () => {
  let api: { listLoaners: ReturnType<typeof vi.fn> };

  async function setup(query: Record<string, string> = {}) {
    await TestBed.configureTestingModule({
      imports: [LoanerRegisterComponent],
      providers: [
        provideRouter([]),
        LoanerStore,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
        { provide: WarrantyRmaApiService, useValue: api },
        { provide: I18nService, useValue: i18nStub() },
        { provide: RmaNotifier, useValue: { success: vi.fn(), conflict: vi.fn() } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(LoanerRegisterComponent);
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    api = {
      listLoaners: vi.fn().mockReturnValue(
        of({
          data: [
            loanerFixture({ id: 'a', is_overdue: true, days_outstanding: 12 }),
            loanerFixture({
              id: 'b',
              loaner_serial_number: 'LOAN-2',
              status: 'returned',
              is_overdue: false,
            }),
          ],
          meta: { current_page: 1, from: 1, last_page: 1, per_page: 25, to: 2, total: 2 },
        }),
      ),
    };
  });

  it('flags overdue loaners with icon and "Overdue Nd" text', async () => {
    const fixture = await setup();
    const flags = (fixture.nativeElement as HTMLElement).querySelectorAll('.ln-overdue');
    expect(flags).toHaveLength(1);
    expect(flags[0].textContent).toContain('RMA.LOANER.OVERDUE_DAYS 12');
    expect(flags[0].querySelector('i.fa-triangle-exclamation')).not.toBeNull();
  });

  it('offers return / mark lost only for issued loaners', async () => {
    const fixture = await setup();
    const rows = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr'),
    ).filter((r) => r.textContent?.includes('LOAN-'));
    const buttons = (row: Element) =>
      Array.from(row.querySelectorAll('button')).map((b) => b.textContent?.trim());
    expect(buttons(rows[0])).toEqual(['RMA.ACTIONS.LOANER_RETURN', 'RMA.ACTIONS.LOANER_LOST']);
    expect(buttons(rows[1])).toEqual([]);
  });

  it('applies overdue=1 from the URL', async () => {
    await setup({ overdue: '1' });
    expect(api.listLoaners).toHaveBeenCalledWith(expect.objectContaining({ overdue: 1 }));
  });
});
