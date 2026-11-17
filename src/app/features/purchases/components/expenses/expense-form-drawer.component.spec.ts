import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { icons } from '../../../../icons-provider';
import { ExpensesApiService, I18nService, LookupService } from '@core';
import { ExpenseFormDrawerComponent } from './expense-form-drawer.component';

describe('ExpenseFormDrawerComponent', () => {
  let fixture: ComponentFixture<ExpenseFormDrawerComponent>;
  let component: ExpenseFormDrawerComponent;
  let api: Record<'createExpense' | 'updateExpense' | 'getExpense' | 'uploadExpenseAttachment' | 'downloadExpenseAttachment', ReturnType<typeof vi.fn>>;

  beforeEach(async () => {
    api = {
      createExpense: vi.fn().mockReturnValue(of({ data: { id: 'e-1' } })),
      updateExpense: vi.fn().mockReturnValue(of({ data: { id: 'e-1' } })),
      getExpense: vi.fn().mockReturnValue(of({ data: { id: 'e-1', attachments: [{ id: 'a-1', expense_id: 'e-1', original_name: 'r.pdf', mime_type: 'application/pdf', size: 1 }] } })),
      uploadExpenseAttachment: vi.fn().mockReturnValue(of({ data: {} })),
      downloadExpenseAttachment: vi.fn().mockReturnValue(of(new Blob(['x']))),
    };
    TestBed.configureTestingModule({
      imports: [ExpenseFormDrawerComponent],
      providers: [
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: ExpensesApiService, useValue: api },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: LookupService, useValue: { getLookup: vi.fn().mockResolvedValue([{ id: 'cat-1', code: 'travel', label: 'Travel' }]) } },
        { provide: I18nService, useValue: { translate: vi.fn((key: string) => key), instant: vi.fn((key: string) => key) } },
      ],
    });
    fixture = TestBed.createComponent(ExpenseFormDrawerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('open', true);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads the expense categories and requires one', () => {
    expect(component['categories']().map((c) => c.id)).toEqual(['cat-1']);
    component['submit']();
    expect(api.createExpense).not.toHaveBeenCalled();
  });

  it('posts the field names of the API (category_id, amount_gross, merchant_name, notes)', () => {
    component['form'].patchValue({
      category_id: 'cat-1',
      date: new Date(2026, 10, 9),
      amount_gross: 12.5,
      merchant_name: 'Bar',
      notes: 'Coffee',
      status: 'submitted',
    });
    component['submit']();
    const payload = api.createExpense.mock.calls[0][0] as Record<string, unknown>;
    expect(payload).toMatchObject({
      category_id: 'cat-1',
      amount_gross: 12.5,
      merchant_name: 'Bar',
      notes: 'Coffee',
      status: 'submitted',
      currency: 'EUR',
    });
    for (const legacy of ['amount', 'merchant', 'description']) {
      expect(payload).not.toHaveProperty(legacy);
    }
  });

  it('lists the receipts of an edited expense and uploads new ones as files[]', () => {
    fixture.componentRef.setInput('expense', { id: 'e-1', date: '2026-11-09', amount_gross: 5, currency: 'EUR', status: 'draft' });
    fixture.detectChanges();
    expect(api.getExpense).toHaveBeenCalledWith('e-1');
    expect(component['attachments']().map((a) => a.id)).toEqual(['a-1']);

    const file = new File(['x'], 'scan.pdf', { type: 'application/pdf' });
    component['upload']({ target: { files: [file], value: '' } } as unknown as Event);
    const body = api.uploadExpenseAttachment.mock.calls[0][1] as FormData;
    expect(api.uploadExpenseAttachment.mock.calls[0][0]).toBe('e-1');
    expect(body.getAll('files[]')).toHaveLength(1);
  });

  it('downloads a receipt through the API', () => {
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    component['download']({ id: 'a-1', expense_id: 'e-1', original_name: 'r.pdf', mime_type: 'application/pdf', size: 1 });
    expect(api.downloadExpenseAttachment).toHaveBeenCalledWith('e-1', 'a-1');
  });
});
