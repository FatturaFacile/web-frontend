import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { icons } from '../../../icons-provider';
import { AccountingApiService, I18nService } from '@core';
import { LedgerEntryFormDrawerComponent } from './ledger-entry-form-drawer.component';

describe('LedgerEntryFormDrawerComponent', () => {
  let fixture: ComponentFixture<LedgerEntryFormDrawerComponent>;
  let component: LedgerEntryFormDrawerComponent;
  let api: { getFiscalPeriods: ReturnType<typeof vi.fn>; createLedgerEntry: ReturnType<typeof vi.fn> };
  let message: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      getFiscalPeriods: vi.fn().mockReturnValue(
        of({
          data: [
            { id: 'fp-open', name: '2026-11', status: 'open' },
            { id: 'fp-closed', name: '2026-10', status: 'closed' },
          ],
        }),
      ),
      createLedgerEntry: vi.fn().mockReturnValue(of({ data: { id: 'je-1' } })),
    };
    message = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      imports: [LedgerEntryFormDrawerComponent],
      providers: [
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: AccountingApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: { translate: vi.fn((key: string) => key), instant: vi.fn((key: string) => key) } },
      ],
    });

    fixture = TestBed.createComponent(LedgerEntryFormDrawerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
  });

  const fill = (reverseOn: Date | null): void => {
    component['form'].patchValue({
      fiscal_period_id: 'fp-open',
      date: new Date(2026, 10, 9),
      description: 'Accrual',
      auto_reverse_on: reverseOn,
    });
    component['linesArray'].at(0).patchValue({ account_id: 'acc-1', debit: 100, credit: 0 });
    component['linesArray'].at(1).patchValue({ account_id: 'acc-2', debit: 0, credit: 100 });
  };

  it('offers only the open fiscal periods and no editable entry number', () => {
    expect(component['openPeriods']().map((p) => p.id)).toEqual(['fp-open']);
    expect(component['form'].contains('entry_number' as never)).toBe(false);
  });

  it('sends auto_reverse_on as YYYY-MM-DD for a draft journal', () => {
    fill(new Date(2026, 10, 30));
    component['submit']();
    expect(api.createLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        fiscal_period_id: 'fp-open',
        posting_date: '2026-11-09',
        status: 'draft',
        auto_reverse_on: '2026-11-30',
      }),
    );
    expect(api.createLedgerEntry.mock.calls[0][0]).not.toHaveProperty('entry_number');
  });

  it('does not save an empty form', () => {
    component['submit']();
    expect(api.createLedgerEntry).not.toHaveBeenCalled();
    expect(component['form'].controls.description.hasError('required')).toBe(true);
  });

  it('refuses a reversal date that is not after the posting date', () => {
    fill(new Date(2026, 10, 9));
    component['submit']();
    expect(api.createLedgerEntry).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith('accounting.errors.autoReverseAfterPosting');
  });

  it('drops the reversal date when the journal is posted at once', () => {
    fill(new Date(2026, 10, 30));
    component['form'].patchValue({ save_as_draft: false });
    component['submit']();
    expect(api.createLedgerEntry).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'posted', auto_reverse_on: null }),
    );
  });
});
