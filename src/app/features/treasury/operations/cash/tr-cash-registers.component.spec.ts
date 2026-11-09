import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CashRegister, CashRegisterClosing, GeneralLedgerApiService, PermissionsService, TreasuryOpsApiService } from '@core';
import { TrCashRegistersComponent } from './tr-cash-registers.component';

const register: CashRegister = {
  id: 'c1',
  code: 'C1',
  name: 'Shop',
  currency: 'EUR',
  gl_account_id: 'g1',
  opening_balance: '0.00',
  current_balance: '100.00',
  last_closed_date: null,
  is_active: true,
};

const closing: CashRegisterClosing = {
  id: 'cl1',
  cash_register_id: 'c1',
  closing_date: '2026-11-01',
  opening_balance: '0.00',
  total_in: '100.00',
  total_out: '0.00',
  expected_balance: '100.00',
  counted_balance: '98.00',
  difference: '-2.00',
  difference_journal_entry_id: 'j1',
  notes: null,
};

describe('TrCashRegistersComponent', () => {
  const api = {
    getCashRegisters: vi.fn(),
    getCashRegister: vi.fn(),
    getCashRegisterMovements: vi.fn(),
    getCashRegisterClosings: vi.fn(),
    closeCashRegisterDay: vi.fn(),
    addCashRegisterMovement: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    api.getCashRegisters.mockReturnValue(of({ success: true, message: '', data: [register] }));
    api.getCashRegister.mockReturnValue(of({ success: true, message: '', data: register }));
    api.getCashRegisterMovements.mockReturnValue(of({ success: true, message: '', data: [] }));
    api.getCashRegisterClosings.mockReturnValue(of({ success: true, message: '', data: [closing] }));
    api.closeCashRegisterDay.mockReturnValue(of({ success: true, message: '', data: closing }));
    api.addCashRegisterMovement.mockReturnValue(of({ success: true, message: '', data: {} }));
    await TestBed.configureTestingModule({
      imports: [TrCashRegistersComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TreasuryOpsApiService, useValue: api },
        {
          provide: GeneralLedgerApiService,
          useValue: {
            getAccountList: () => of({ data: [] }),
            getCostCenters: () => of({ data: [] }),
            getProfitCenters: () => of({ data: [] }),
          },
        },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn() } },
      ],
    }).compileComponents();
  });

  interface Internals {
    open(r: CashRegister): void;
    openModal(kind: 'close'): void;
    closeForm: { patchValue(v: object): void };
    saveClose(): void;
    lastClosing(): CashRegisterClosing | null;
  }

  it('closes the day with the counted cash and keeps the difference to show it', () => {
    const fixture = TestBed.createComponent(TrCashRegistersComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Internals;
    component.open(register);
    component.openModal('close');
    component.closeForm.patchValue({ closing_date: '2026-11-01', counted_balance: 98 });
    component.saveClose();

    expect(api.closeCashRegisterDay).toHaveBeenCalledWith('c1', {
      closing_date: '2026-11-01',
      counted_balance: 98,
      notes: null,
    });
    expect(component.lastClosing()?.difference).toBe('-2.00');
  });

  it('sends an idempotency key with every cash movement', () => {
    const fixture = TestBed.createComponent(TrCashRegistersComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance as unknown as Internals & {
      movementForm: { patchValue(v: object): void };
      saveMovement(): void;
    };
    component.open(register);
    component.movementForm.patchValue({
      movement_date: '2026-11-01',
      amount: 20,
      counter_account_id: 'x',
      description: 'Sale',
    });
    component.saveMovement();
    const payload = api.addCashRegisterMovement.mock.calls[0][1];
    expect(payload.idempotency_key).toMatch(/[0-9a-f-]{36}/);
    expect(payload.direction).toBe('in');
  });
});
