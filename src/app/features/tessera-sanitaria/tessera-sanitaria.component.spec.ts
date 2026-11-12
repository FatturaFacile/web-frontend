import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  TesseraSanitariaApiService,
  TesseraSanitariaExpense,
  TesseraSanitariaSettings,
  TesseraSanitariaSummary,
  TranslateService,
} from '@core';
import { TesseraSanitariaComponent } from './tessera-sanitaria.component';

describe('TesseraSanitariaComponent', () => {
  let component: TesseraSanitariaComponent;
  let fixture: ComponentFixture<TesseraSanitariaComponent>;

  const mockSettings: TesseraSanitariaSettings = {
    is_enabled: true,
    subject_type: 'professional',
    owner_fiscal_code: 'RSSMRA80A01H501Z',
    region_code: '030',
    asl_code: '201',
    ssa_code: '999999',
  };

  const mockExpense: TesseraSanitariaExpense = {
    id: 'exp-1',
    document_type: 'invoice',
    document_id: 'inv-100',
    document_number: 'FATT-2026-001',
    expense_type: 'SV',
    payment_date: '2026-03-15',
    amount: 120.0,
    patient_fiscal_code: 'VRDLGI85C10H501K',
    patient_opposition: false,
    payment_traceable: true,
    transmission_status: 'transmitted',
  };

  const mockOpposedExpense: TesseraSanitariaExpense = {
    id: 'exp-2',
    document_type: 'commercial_document',
    document_id: 'doc-200',
    expense_type: 'AD',
    payment_date: '2026-03-16',
    amount: 50.0,
    patient_opposition: true,
    payment_traceable: false,
    transmission_status: 'opposed',
  };

  const mockSummary: TesseraSanitariaSummary = {
    year: 2026,
    total_expenses: 2,
    total_amount: 170.0,
    total_traceable_amount: 120.0,
    total_opposed: 1,
    total_transmitted: 1,
    total_pending: 0,
  };

  const apiSpy = {
    getExpenses: vi.fn().mockReturnValue(of({ data: [mockExpense, mockOpposedExpense] })),
    getExpense: vi.fn().mockReturnValue(of({ data: mockExpense })),
    flagExpense: vi.fn().mockReturnValue(of({ data: mockExpense })),
    removeExpenseFlag: vi.fn().mockReturnValue(of({ message: 'Removed' })),
    getSummary: vi.fn().mockReturnValue(of({ data: mockSummary })),
    getSettings: vi.fn().mockReturnValue(of({ data: mockSettings })),
    updateSettings: vi.fn().mockReturnValue(of({ data: mockSettings })),
    exportExpenses: vi.fn().mockReturnValue(of({ data: [{ id: 'exp-1' }] })),
  };

  const messageSpy = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };

  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    translate: vi.fn().mockImplementation((key: string) => key),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [TesseraSanitariaComponent],
      providers: [
        { provide: TesseraSanitariaApiService, useValue: apiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TesseraSanitariaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load expenses, summary, and settings', () => {
    expect(component).toBeTruthy();
    expect(apiSpy.getExpenses).toHaveBeenCalledWith({ year: 2026 });
    expect(apiSpy.getSummary).toHaveBeenCalledWith(2026);
    expect(apiSpy.getSettings).toHaveBeenCalled();

    expect(component.expenses().length).toBe(2);
    expect(component.totalExpensesAmount()).toBe(170.0);
    expect(component.totalTraceableAmount()).toBe(120.0);
    expect(component.totalOpposedCount()).toBe(1);
    expect(component.totalTransmittedCount()).toBe(1);
  });

  it('should change year and reload expenses and summary', () => {
    component.changeYear(2025);
    expect(component.selectedYear()).toBe(2025);
    expect(apiSpy.getExpenses).toHaveBeenCalledWith({ year: 2025 });
    expect(apiSpy.getSummary).toHaveBeenCalledWith(2025);
  });

  it('should open flag modal and flag a document as health expense', () => {
    component.openFlagModal();
    expect(component.flagModalVisible()).toBe(true);

    component.flagForm.patchValue({
      document_type: 'invoice',
      document_id: 'inv-300',
      expense_type: 'SP',
      payment_date: '2026-04-10',
      amount: 200.0,
      patient_fiscal_code: 'RSSMRA80A01H501Z',
      patient_opposition: false,
      payment_traceable: true,
    });

    component.submitFlagExpense();
    expect(apiSpy.flagExpense).toHaveBeenCalledWith({
      document_type: 'invoice',
      document_id: 'inv-300',
      expense_type: 'SP',
      expense_flag: undefined,
      payment_date: '2026-04-10',
      amount: 200.0,
      tax_rate: 22.0,
      vat_nature: undefined,
      patient_fiscal_code: 'RSSMRA80A01H501Z',
      patient_opposition: false,
      payment_traceable: true,
    });
    expect(messageSpy.success).toHaveBeenCalledWith('STS.EXPENSE_FLAGGED');
    expect(component.flagModalVisible()).toBe(false);
  });

  it('should not flag an expense without document or patient fiscal code unless the patient opposes', () => {
    component.openFlagModal();
    component.flagForm.patchValue({ document_id: '', patient_fiscal_code: '', patient_opposition: false });
    component.submitFlagExpense();
    expect(apiSpy.flagExpense).not.toHaveBeenCalled();
    expect(component.flagForm.controls.document_id.touched).toBe(true);

    component.flagForm.patchValue({ document_id: 'inv-300', patient_fiscal_code: '' });
    component.submitFlagExpense();
    expect(apiSpy.flagExpense).not.toHaveBeenCalled();
    expect(component.flagForm.controls.patient_fiscal_code.hasError('required')).toBe(true);

    component.flagForm.patchValue({ patient_opposition: true });
    component.submitFlagExpense();
    expect(apiSpy.flagExpense).toHaveBeenCalledTimes(1);
  });

  it('sends either tax_rate or vat_nature, never both (tax_rate prohibits vat_nature)', () => {
    component.openFlagModal();
    component.flagForm.patchValue({ document_id: 'inv-1', patient_opposition: true, vat_nature: 'N4' });
    expect(component.flagForm.controls.tax_rate.value).toBeNull();
    component.submitFlagExpense();
    const sent = apiSpy.flagExpense.mock.calls.at(-1)?.[0];
    expect(sent?.vat_nature).toBe('N4');
    expect(sent?.tax_rate).toBeUndefined();

    component.flagForm.patchValue({ tax_rate: 22 });
    expect(component.flagForm.controls.vat_nature.value).toBe('');
  });

  it('should remove expense flag', () => {
    component.removeExpenseFlag('exp-1');
    expect(apiSpy.removeExpenseFlag).toHaveBeenCalledWith('exp-1');
    expect(messageSpy.success).toHaveBeenCalledWith('STS.FLAG_REMOVED');
  });

  it('should open and close expense details drawer', () => {
    component.openExpenseDrawer(mockExpense);
    expect(component.drawerVisible()).toBe(true);
    expect(component.selectedExpense()).toBe(mockExpense);

    component.closeExpenseDrawer();
    expect(component.drawerVisible()).toBe(false);
    expect(component.selectedExpense()).toBeNull();
  });

  it('should export health expenses data', () => {
    component.exportForm.patchValue({ format: 'json' });
    component.exportExpenses();
    expect(apiSpy.exportExpenses).toHaveBeenCalledWith(2026, 'json');
    expect(messageSpy.success).toHaveBeenCalledWith('STS.EXPORT_SUCCESS');
    expect(component.exportedContent()).toContain('exp-1');
  });

  it('should update settings successfully', () => {
    component.settingsForm.patchValue({
      subject_type: 'structure',
      ssa_code: '123456',
    });

    component.saveSettings();
    expect(apiSpy.updateSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        subject_type: 'structure',
        ssa_code: '123456',
      }),
    );
    expect(messageSpy.success).toHaveBeenCalledWith('STS.SETTINGS_SAVED');
  });

  it('should return correct expense type names and badge colors', () => {
    expect(component.getExpenseTypeName('SV')).toContain('Visita Medica');
    expect(component.getExpenseTypeName('SP')).toContain('Prestazione Specialistica');
    expect(component.getExpenseTypeName('AD')).toContain('Dispositivo Medico');
    expect(component.getExpenseTypeName('TK')).toContain('Ticket Sanitario');

    expect(component.getExpenseTypeColor('SV')).toBe('blue');
    expect(component.getExpenseTypeColor('AD')).toBe('purple');
    expect(component.getExpenseTypeColor('FC')).toBe('cyan');
    expect(component.getExpenseTypeColor('SR')).toBe('red');

    expect(component.getTransmissionStatusColor('transmitted')).toBe('success');
    expect(component.getTransmissionStatusColor('pending')).toBe('warning');
    expect(component.getTransmissionStatusColor('opposed')).toBe('magenta');
    expect(component.getTransmissionStatusColor('rejected')).toBe('error');
    expect(component.getTransmissionStatusColor(undefined)).toBe('default');
  });

  it('should handle errors gracefully during actions', () => {
    apiSpy.flagExpense.mockReturnValueOnce(throwError(() => new Error('Error')));
    component.openFlagModal();
    component.flagForm.patchValue({
      document_type: 'invoice',
      document_id: 'inv-999',
      expense_type: 'SV',
      payment_date: '2026-03-01',
      amount: 100,
      patient_fiscal_code: 'RSSMRA80A01H501Z',
    });
    component.submitFlagExpense();
    expect(messageSpy.error).toHaveBeenCalledWith('STS.ACTION_ERROR');

    apiSpy.exportExpenses.mockReturnValueOnce(throwError(() => new Error('Error')));
    component.exportExpenses();
    expect(messageSpy.error).toHaveBeenCalledWith('STS.ACTION_ERROR');
  });
});
