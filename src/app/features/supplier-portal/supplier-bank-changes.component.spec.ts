import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore, ProcurementApiService, SupplierBankChange, SupplierPortalApiService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { SupplierBankChangesComponent } from './supplier-bank-changes.component';
import { formatIban } from './supplier-portal.utils';

describe('SupplierBankChangesComponent', () => {
  let fixture: ComponentFixture<SupplierBankChangesComponent>;
  let component: SupplierBankChangesComponent;

  const change: SupplierBankChange = {
    id: 'bc-1',
    supplier_id: 'sup-1',
    supplier_name: 'Fornitore Spa',
    source: 'portal',
    requested_by: null,
    account_holder: 'Fornitore Spa',
    iban: 'CH9300762011623852957',
    previous_iban: 'IT60X0542811101000000123456',
    status: 'pending',
    approvals_required: 2,
    approvals: [],
  };

  const apiSpy = {
    getBankChanges: vi.fn(),
    createBankChange: vi.fn(),
    verifyBankChangeCallback: vi.fn(),
    approveBankChange: vi.fn(),
    rejectBankChange: vi.fn(),
    cancelBankChange: vi.fn(),
  };
  const procurementSpy = { getSuppliers: vi.fn() };
  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    translate: vi.fn().mockImplementation((key: string) => key),
  };
  const authSpy = { user: vi.fn().mockReturnValue({ id: 'usr-1' }) };

  beforeEach(async () => {
    vi.clearAllMocks();
    authSpy.user.mockReturnValue({ id: 'usr-1' });
    apiSpy.getBankChanges.mockReturnValue(of({ data: [change] }));
    apiSpy.verifyBankChangeCallback.mockReturnValue(of({ data: { ...change, callback_verified_at: '2027-06-10T08:00:00Z' } }));
    apiSpy.approveBankChange.mockReturnValue(of({ data: { ...change, status: 'applied' } }));
    apiSpy.rejectBankChange.mockReturnValue(of({ data: { ...change, status: 'rejected' } }));
    procurementSpy.getSuppliers.mockReturnValue(of({ data: [] }));

    await TestBed.configureTestingModule({
      imports: [SupplierBankChangesComponent],
      providers: [
        { provide: SupplierPortalApiService, useValue: apiSpy },
        { provide: ProcurementApiService, useValue: procurementSpy },
        { provide: AuthStore, useValue: authSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SupplierBankChangesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the pending requests first', () => {
    expect(apiSpy.getBankChanges).toHaveBeenCalledWith({ status: 'pending' });
    expect(component.changes()).toHaveLength(1);
  });

  it('counts only the approvals, and knows the requester and who already decided', () => {
    const withDecisions: SupplierBankChange = {
      ...change,
      requested_by: 'usr-1',
      approvals: [
        { user_id: 'usr-2', decision: 'approved', decided_at: '2027-06-10T09:00:00Z' },
        { user_id: 'usr-3', decision: 'rejected', decided_at: '2027-06-10T09:30:00Z' },
      ],
    };

    expect(component.approvedCount(withDecisions)).toBe(1);
    expect(component.isRequester(withDecisions)).toBe(true);
    expect(component.isRequester(change)).toBe(false);
    expect(component.hasDecided(withDecisions)).toBe(false);

    authSpy.user.mockReturnValue({ id: 'usr-2' });
    expect(component.hasDecided(withDecisions)).toBe(true);
  });

  it('needs a note to record the callback and sends it', () => {
    component.openStep(change, 'verify-callback');
    expect(component.stepForm.invalid).toBe(true);

    component.stepForm.patchValue({ text: ' Called the number of the first contract ' });
    component.confirmStep();

    expect(apiSpy.verifyBankChangeCallback).toHaveBeenCalledWith('bc-1', { note: 'Called the number of the first contract' });
    expect(component.stepVisible()).toBe(false);
  });

  it('approves without a comment and tells when the IBAN was changed', () => {
    component.openStep(change, 'approve');
    expect(component.stepForm.valid).toBe(true);

    component.confirmStep();

    expect(apiSpy.approveBankChange).toHaveBeenCalledWith('bc-1', { comment: null });
    expect(messageSpy.success).toHaveBeenCalledWith('SUPPLIER_PORTAL.BANK_CHANGE_APPLIED');
  });

  it('needs a reason to reject', () => {
    component.openStep(change, 'reject');
    expect(component.stepForm.invalid).toBe(true);

    component.stepForm.patchValue({ text: 'Not confirmed by phone' });
    component.confirmStep();

    expect(apiSpy.rejectBankChange).toHaveBeenCalledWith('bc-1', { reason: 'Not confirmed by phone' });
  });

  it('refuses an IBAN with a wrong check digit and takes a well formed one', () => {
    component.openRequest();
    component.requestForm.patchValue({ supplier_id: 'sup-1', account_holder: 'Fornitore Spa', iban: 'CH9300762011623852958' });
    expect(component.requestForm.controls.iban.invalid).toBe(true);

    component.requestForm.patchValue({ iban: 'CH93 0076 2011 6238 5295 7' });
    expect(component.requestForm.controls.iban.valid).toBe(true);
  });

  it('writes an IBAN in groups of four', () => {
    expect(formatIban('CH9300762011623852957')).toBe('CH93 0076 2011 6238 5295 7');
    expect(formatIban(null)).toBe('');
  });
});
