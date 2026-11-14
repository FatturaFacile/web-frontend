import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  FeeNote,
  LegalCase,
  PracticeActivityControlResponse,
  PracticeActivityItem,
  PracticeAppliedRetainer,
  PracticeApiService,
  PracticeClosing,
  PracticeClosingOverview,
  PracticeRetainer,
  PracticeRetainerBalance,
  ProfessionalsApiService,
  TimeLog,
  TranslateService,
} from '@core';
import { ProfessionalsComponent } from './professionals.component';

describe('ProfessionalsComponent', () => {
  let component: ProfessionalsComponent;
  let fixture: ComponentFixture<ProfessionalsComponent>;

  const mockClient = { id: 'cli-1', company_name: 'Acme Corp' };

  const paged = <T>(data: T[]) => ({ data, meta: { current_page: 1, last_page: 1, per_page: 15, total: data.length } });

  /** Lets the debounced grid models run their first request. */
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

  const mockCases: LegalCase[] = [
    {
      id: 'case-1',
      case_number: 'PR-2026/001',
      client_id: 'cli-1',
      client: mockClient,
      title: 'Contenzioso tributario',
      logged_minutes: 900,
      fee_total: '3500.00',
      aml_kyc_completed: true,
      status: 'open',
    },
  ];

  const mockActivities: TimeLog[] = [
    {
      id: 'act-1',
      legal_case_id: 'case-1',
      legal_case: { id: 'case-1', case_number: 'PR-2026/001', title: 'Contenzioso tributario', client: mockClient },
      date: '2026-11-01',
      description: 'Redazione ricorso',
      duration_minutes: 180,
      hourly_rate: '150.00',
      fee_amount: '450.00',
      is_billed: false,
    },
  ];

  const mockDrawerActivities: PracticeActivityItem[] = [
    {
      id: 'act-1',
      client_id: 'cli-1',
      client_name: 'Acme Corp',
      activity_date: '2026-11-01',
      description: 'Redazione ricorso',
      hours: 3,
      rate: '150.00',
      amount: '450.00',
      status: 'unbilled',
    },
  ];

  const mockActivityControl: PracticeActivityControlResponse = {
    from: '2026-11-01',
    to: '2026-11-30',
    rows: [
      {
        user_id: 'usr-1',
        user_name: 'Partner',
        legal_case_id: 'case-1',
        case_number: 'PR-2026/001',
        client_id: 'cli-1',
        billed_minutes: 0,
        billed_amount: '0.00',
        unbilled_minutes: 180,
        unbilled_amount: '450.00',
      },
    ],
  };

  const mockFeeNotes: FeeNote[] = [
    {
      id: 'fn-1',
      legal_case_id: 'case-1',
      client_id: 'cli-1',
      client: mockClient,
      note_number: '2026/01',
      date: '2026-11-02',
      taxable_fees: '450.00',
      cassa_previdenza_amount: '18.00',
      ritenuta_acconto_amount: '90.00',
      vat_amount: '102.96',
      net_payable: '480.96',
    },
  ];

  const mockRetainers: PracticeRetainer[] = [
    {
      id: 'ret-1',
      client_id: 'cli-1',
      client: mockClient,
      received_on: '2026-11-01',
      amount: '1000.00',
      applied_amount: '0.00',
      status: 'open',
    },
  ];

  const mockRetainerBalances: PracticeRetainerBalance[] = [
    {
      client_id: 'cli-1',
      client_name: 'Acme Corp',
      total_received: '1000.00',
      total_applied: '0.00',
      current_balance: '1000.00',
    },
  ];

  const mockClosing: PracticeClosing = {
    id: 'cls-1',
    client_id: 'cli-1',
    client_name: 'Acme Corp',
    period_start: '2026-01-01',
    period_end: '2026-12-31',
    status: 'open',
    checklist: [
      { key: 'bank_recon', label: 'Riconciliazione bancaria', done: true },
      { key: 'vat_settlement', label: 'Liquidazione IVA', done: false },
    ],
  };

  const mockClosingsOverview: PracticeClosingOverview = {
    closings: [mockClosing],
    total_open: 1,
    total_closed: 0,
    pending_checklists: 1,
  };

  const mockAppliedRetainer: PracticeAppliedRetainer = {
    id: 'app-1',
    retainer_id: 'ret-1',
    fee_note_id: 'fn-1',
    amount: '300.00',
    applied_at: '2026-11-03',
  };

  const profApiSpy = {
    getCases: vi.fn().mockReturnValue(of(paged(mockCases))),
    getTimeLogs: vi.fn().mockReturnValue(of(paged(mockActivities))),
    getFeeNotes: vi.fn().mockReturnValue(of(paged(mockFeeNotes))),
    logTime: vi.fn().mockReturnValue(of({ data: { id: 'tl-1' } })),
  };

  const practiceApiSpy = {
    getActivityControl: vi.fn().mockReturnValue(of({ data: mockActivityControl })),
    createFeeNoteFromActivities: vi.fn().mockReturnValue(of({ data: { id: 'fn-new', status: 'draft' } })),
    getFeeNoteActivities: vi.fn().mockReturnValue(of({ data: mockDrawerActivities })),
    getFeeNoteRetainers: vi.fn().mockReturnValue(of({ data: [mockAppliedRetainer] })),
    getRetainers: vi.fn().mockReturnValue(of(paged(mockRetainers))),
    getRetainerBalances: vi.fn().mockReturnValue(of({ data: mockRetainerBalances })),
    createRetainer: vi.fn().mockReturnValue(of({ data: mockRetainers[0] })),
    applyRetainer: vi.fn().mockReturnValue(of({ data: mockAppliedRetainer })),
    voidRetainer: vi.fn().mockReturnValue(of({ data: { id: 'ret-1', status: 'void' } })),
    getClosingOverview: vi.fn().mockReturnValue(of({ data: mockClosingsOverview })),
    openClosing: vi.fn().mockReturnValue(of({ data: mockClosing })),
    updateClosingChecklist: vi.fn().mockReturnValue(of({ data: mockClosing })),
    closePeriod: vi.fn().mockReturnValue(of({ data: { ...mockClosing, status: 'closed' } })),
    reopenPeriod: vi.fn().mockReturnValue(of({ data: { ...mockClosing, status: 'open' } })),
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
      imports: [ProfessionalsComponent],
      providers: [
        provideNzIcons(icons),
        { provide: ProfessionalsApiService, useValue: profApiSpy },
        { provide: PracticeApiService, useValue: practiceApiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfessionalsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load cases, activities, fee notes, retainers, and closings', async () => {
    await settle();
    expect(component).toBeTruthy();
    expect(profApiSpy.getCases).toHaveBeenCalled();
    expect(profApiSpy.getTimeLogs).toHaveBeenCalled();
    expect(practiceApiSpy.getActivityControl).toHaveBeenCalled();
    expect(profApiSpy.getFeeNotes).toHaveBeenCalled();
    expect(practiceApiSpy.getRetainers).toHaveBeenCalled();
    expect(practiceApiSpy.getRetainerBalances).toHaveBeenCalled();
    expect(practiceApiSpy.getClosingOverview).toHaveBeenCalled();

    expect(component.casesGrid.items()).toEqual(mockCases);
    expect(component.activitiesGrid.items()).toEqual(mockActivities);
    expect(component.feeNotesGrid.items()).toEqual(mockFeeNotes);
    expect(component.retainersGrid.items()).toEqual(mockRetainers);
    expect(component.retainerBalances()).toEqual(mockRetainerBalances);
    expect(component.closings()).toEqual([mockClosing]);

    expect(component.totalUnbilledHours()).toBe(3);
    expect(component.totalUnbilledAmount()).toBe(450);
    expect(component.totalRetainerAvailable()).toBe(1000);
  });

  it('asks the server for the period and the billing status of the activities', async () => {
    await settle();
    const firstQuery = profApiSpy.getTimeLogs.mock.calls[0][0];
    expect(firstQuery).toMatchObject({ is_billed: 'false', page: 1 });
    expect(firstQuery.from).toBe(component.fromDate());
    expect(firstQuery.to).toBe(component.toDate());

    component.filterActivityStatus.set('billed');
    component.applyActivityFilters();
    await settle();
    await new Promise<void>((resolve) => setTimeout(resolve, 350));
    expect(profApiSpy.getTimeLogs.mock.calls.at(-1)?.[0]).toMatchObject({ is_billed: 'true' });
  });

  it('names the grid columns by keys the API knows', () => {
    const serverKeys = (columns: { key: unknown; serverKey?: string }[]) => columns.map((c) => c.serverKey ?? String(c.key));
    expect(serverKeys(component['caseColumns']())).toEqual([
      'case_number',
      'client.name',
      'title',
      'logged_minutes',
      'fee_total',
      'aml_kyc_completed',
      'status',
    ]);
    expect(serverKeys(component['activityColumns']())).toContain('billing_status');
    expect(serverKeys(component['feeNoteColumns']())).toContain('gross_amount');
    expect(serverKeys(component['retainerColumns']())).toContain('balance');
  });

  it('should log professional time and refresh activities', () => {
    component.openLogTimeModal();
    expect(component.timeLogModalVisible()).toBe(true);

    component.timeLogForm.patchValue({
      legal_case_id: 'case-1',
      date: '2026-11-04',
      duration_minutes: 120,
      hourly_rate: 150,
      description: 'Assistenza udienza preliminare',
    });

    component.saveTimeLog();
    expect(profApiSpy.logTime).toHaveBeenCalledWith({
      legal_case_id: 'case-1',
      date: '2026-11-04',
      duration_minutes: 120,
      hourly_rate: 150,
      description: 'Assistenza udienza preliminare',
    });
    expect(component.timeLogModalVisible()).toBe(false);
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('should select activities and generate fee note', async () => {
    await settle();
    component.selectedActivities.set(mockActivities);
    expect(component.selectedActivityIds()).toContain('act-1');

    component.openCreateFeeNoteModal();
    expect(component.feeNoteModalVisible()).toBe(true);

    component.feeNoteForm.patchValue({
      client_id: 'cli-1',
      date: '2026-11-05',
      cpa_rate: '4.00',
      ritenuta_rate: '20.00',
      vat_rate: '22.00',
      note_number: '2026/02',
    });

    component.saveFeeNote();
    expect(practiceApiSpy.createFeeNoteFromActivities).toHaveBeenCalledWith({
      client_id: 'cli-1',
      activity_ids: ['act-1'],
      date: '2026-11-05',
      cpa_rate: '4.00',
      ritenuta_rate: '20.00',
      vat_rate: '22.00',
      note_number: '2026/02',
    });
    expect(component.feeNoteModalVisible()).toBe(false);
    expect(messageSpy.success).toHaveBeenCalled();
    expect(component.selectedTabIndex()).toBe(2);
  });

  it('should open fee note drawer and load details', () => {
    component.openFeeNoteDrawer(mockFeeNotes[0]);
    expect(component.feeNoteDrawerVisible()).toBe(true);
    expect(practiceApiSpy.getFeeNoteActivities).toHaveBeenCalledWith('fn-1');
    expect(practiceApiSpy.getFeeNoteRetainers).toHaveBeenCalledWith('fn-1');

    component.closeFeeNoteDrawer();
    expect(component.feeNoteDrawerVisible()).toBe(false);
    expect(component.selectedFeeNote()).toBeNull();
  });

  it('should apply retainer to fee note', () => {
    component.openApplyRetainerModal(mockFeeNotes[0]);
    expect(component.applyRetainerModalVisible()).toBe(true);

    component.applyRetainerForm.patchValue({
      retainer_id: 'ret-1',
      fee_note_id: 'fn-1',
      amount: '300.00',
    });

    component.saveApplyRetainer();
    expect(practiceApiSpy.applyRetainer).toHaveBeenCalledWith('ret-1', {
      fee_note_id: 'fn-1',
      amount: '300.00',
    });
    expect(component.applyRetainerModalVisible()).toBe(false);
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('should not call the API when the forms are submitted empty or with an invalid amount', () => {
    component.openCreateRetainerModal();
    component.retainerForm.patchValue({ client_id: '' });
    component.saveRetainer();
    expect(practiceApiSpy.createRetainer).not.toHaveBeenCalled();
    expect(component.retainerForm.controls.client_id.touched).toBe(true);

    component.retainerForm.patchValue({ client_id: 'cli-2', amount: '0' });
    component.saveRetainer();
    expect(practiceApiSpy.createRetainer).not.toHaveBeenCalled();
    expect(component.retainerForm.controls.amount.hasError('positive')).toBe(true);
  });

  it('should create retainer and void retainer', () => {
    component.openCreateRetainerModal();
    expect(component.retainerModalVisible()).toBe(true);

    component.retainerForm.patchValue({
      client_id: 'cli-2',
      legal_case_id: 'case-1',
      received_on: '2026-11-06',
      amount: '1200.00',
      reference: 'Bonifico anticipo',
      notes: 'Fondo spese perizia',
    });

    component.saveRetainer();
    expect(practiceApiSpy.createRetainer).toHaveBeenCalledWith({
      client_id: 'cli-2',
      legal_case_id: 'case-1',
      received_on: '2026-11-06',
      amount: '1200.00',
      reference: 'Bonifico anticipo',
      notes: 'Fondo spese perizia',
    });
    expect(component.retainerModalVisible()).toBe(false);

    component.voidRetainer('ret-1');
    expect(practiceApiSpy.voidRetainer).toHaveBeenCalledWith('ret-1');
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('does not open a closing whose period ends before it starts (period_end after_or_equal:period_start)', () => {
    practiceApiSpy.openClosing.mockClear();
    component.openCreateClosingModal();
    component.closingForm.patchValue({ client_id: 'cli-1', period_start: '2026-06-01', period_end: '2026-05-01' });
    component.saveClosing();
    expect(practiceApiSpy.openClosing).not.toHaveBeenCalled();
    expect(component.closingForm.controls.period_end.hasError('endsBeforeStart')).toBe(true);

    component.closingForm.patchValue({ period_start: '2026-04-01' });
    expect(component.closingForm.controls.period_end.hasError('endsBeforeStart')).toBe(false);
    component.saveClosing();
    const sent = practiceApiSpy.openClosing.mock.calls[0][0];
    expect(Object.keys(sent).sort()).toEqual(['checklist', 'client_id', 'notes', 'period_end', 'period_start']);
  });

  it('should open closing, toggle checklist, close period and reopen period', () => {
    component.openCreateClosingModal();
    expect(component.closingModalVisible()).toBe(true);

    component.closingForm.patchValue({
      client_id: 'cli-1',
      period_start: '2026-01-01',
      period_end: '2026-12-31',
      notes: 'Chiusura 2026',
    });

    component.saveClosing();
    expect(practiceApiSpy.openClosing).toHaveBeenCalled();
    expect(component.closingModalVisible()).toBe(false);

    component.openChecklistModal(mockClosing);
    expect(component.checklistModalVisible()).toBe(true);

    component.toggleChecklistItem('vat_settlement', true);
    expect(practiceApiSpy.updateClosingChecklist).toHaveBeenCalled();

    component.closePeriod('cls-1');
    expect(practiceApiSpy.closePeriod).toHaveBeenCalledWith('cls-1', { allow_unbilled: true });

    component.reopenPeriod('cls-1');
    expect(practiceApiSpy.reopenPeriod).toHaveBeenCalledWith('cls-1');
  });

  it('should compute checklist completion and return correct status tags', () => {
    expect(component.getChecklistCompletion(mockClosing)).toBe(50);
    expect(component.getActivityStatusColor('unbilled')).toBe('warning');
    expect(component.getActivityStatusColor('billed')).toBe('success');
    expect(component.getRetainerStatusColor('open')).toBe('success');
    expect(component.getRetainerStatusColor('void')).toBe('error');
  });
});
