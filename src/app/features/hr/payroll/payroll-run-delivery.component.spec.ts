import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HrEmployeeApiService, PayrollApiService, TreasuryApiService } from '@core';
import { icons } from '../../../icons-provider';
import { PayrollRunDeliveryComponent } from './payroll-run-delivery.component';

const ok = (data: unknown) => of({ success: true, message: '', data });

interface Delivery {
  deliver(): void;
  openBatches(): void;
  addRow(): void;
  update(i: number, change: object): void;
  createBatches(): void;
  canCreate(): boolean;
  delivery(): { sent: number; skipped: unknown[] } | null;
  batches(): unknown[] | null;
}

describe('PayrollRunDeliveryComponent', () => {
  const api = { deliverPayslips: vi.fn(), createPaymentBatches: vi.fn() };
  const treasury = { getBankAccounts: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn() };

  function setup(): Delivery {
    const fixture = TestBed.createComponent(PayrollRunDeliveryComponent);
    fixture.componentRef.setInput('runId', 'r1');
    fixture.detectChanges();
    return fixture.componentInstance as unknown as Delivery;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    treasury.getBankAccounts.mockReturnValue(
      ok([{ id: 'b1', bank_name: 'UBS', iban: 'CH93 0076 2011 6238 5295 7' }]),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: PayrollApiService, useValue: api },
        { provide: TreasuryApiService, useValue: treasury },
        {
          provide: HrEmployeeApiService,
          useValue: { getDepartments: () => ok([{ id: 'd1', code: 'OPS', name: 'Operations' }]) },
        },
        { provide: NzMessageService, useValue: message },
      ],
    });
  });

  it('delivers the payslips and keeps who was skipped', () => {
    api.deliverPayslips.mockReturnValue(
      ok({ sent: 3, skipped: [{ employee_id: 'e1', reason: 'Indirizzo e-mail mancante.' }] }),
    );
    const component = setup();
    component.deliver();
    expect(api.deliverPayslips).toHaveBeenCalledWith('r1');
    expect(component.delivery()?.sent).toBe(3);
    expect(component.delivery()?.skipped).toHaveLength(1);
  });

  it('shows the server message when the run is not closed', () => {
    api.deliverPayslips.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Run not final' } })),
    );
    setup().deliver();
    expect(message.error).toHaveBeenCalledWith('Run not final');
  });

  it('creates the payment batches of the chosen accounts and departments', () => {
    api.createPaymentBatches.mockReturnValue(
      ok([
        {
          id: 'pb1',
          bank_account_id: 'b1',
          batch_reference: 'PAY-1',
          total_amount: '9000.00',
          item_count: 3,
          status: 'draft',
        },
      ]),
    );
    const component = setup();
    component.openBatches();
    expect(treasury.getBankAccounts).toHaveBeenCalled();
    expect(component.canCreate()).toBe(false);
    component.update(0, { bankAccountId: 'b1', departmentId: 'd1' });
    component.addRow();
    component.update(1, { bankAccountId: 'b1' });
    expect(component.canCreate()).toBe(true);
    component.createBatches();
    expect(api.createPaymentBatches).toHaveBeenCalledWith('r1', [
      { bank_account_id: 'b1', department_id: 'd1' },
      { bank_account_id: 'b1' },
    ]);
    expect(component.batches()).toHaveLength(1);
  });
});
