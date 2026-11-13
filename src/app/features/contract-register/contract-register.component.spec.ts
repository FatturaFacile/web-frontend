import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  ContractAlertResource,
  ContractObligationResource,
  ContractPartyResource,
  ContractRegisterApiService,
  ContractResource,
  ContractStatusChangeResource,
} from '@core';
import { ContractRegisterComponent } from './contract-register.component';

describe('ContractRegisterComponent', () => {
  let fixture: ComponentFixture<ContractRegisterComponent>;
  let component: ContractRegisterComponent;

  const mockContracts: ContractResource[] = [
    {
      id: 'ctr-001-uuid',
      kind: 'customer',
      contract_number: 'CTR-2026-001',
      title: 'Canone Assistenza & Manutenzione ERP',
      counterparty_id: 'cust-1',
      counterparty_name: 'Tech Solutions SA',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      notice_period_days: 60,
      auto_renew: true,
      renewal_term_months: 12,
      currency: 'CHF',
      contract_value: '18000.00',
      status: 'active',
    },
  ];

  const mockParties: ContractPartyResource[] = [
    {
      id: 'pty-1',
      party_type: 'external',
      role: 'signatory',
      name: 'Tech Solutions SA',
      email: 'legal@techsolutions.ch',
    },
  ];

  const mockObligations: ContractObligationResource[] = [
    {
      id: 'ob-1',
      contract_kind: 'customer',
      contract_id: 'ctr-001-uuid',
      type: 'obligation',
      title: 'Report SLA Trimestrale',
      due_date: '2026-03-31',
      status: 'pending',
      responsible_party: 'counterparty',
      amount: '1000.00',
      currency: 'CHF',
    },
  ];

  const mockHistory: ContractStatusChangeResource[] = [
    {
      id: 'h-1',
      from_status: 'draft',
      to_status: 'active',
      reason: 'Firma digitale completata',
      created_at: '2026-01-01T09:00:00Z',
    },
  ];

  const mockAlerts: ContractAlertResource[] = [
    {
      id: 'al-1',
      contract_kind: 'customer',
      contract_id: 'ctr-001-uuid',
      contract_number: 'CTR-2026-001',
      contract_title: 'Canone Assistenza & Manutenzione ERP',
      alert_type: 'notice_deadline',
      due_on: '2026-10-31',
      is_acknowledged: false,
      message: 'Scadenza termine disdetta (60 giorni prima del rinnovo)',
    },
  ];

  const mockContractApi = {
    getContracts: vi.fn().mockReturnValue(of({ success: true, data: mockContracts, meta: { total: 1 } })),
    createContract: vi.fn().mockReturnValue(of({ success: true, data: mockContracts[0] })),
    renewContract: vi.fn().mockReturnValue(of({ success: true, data: { ...mockContracts[0], status: 'renewed' } })),
    sendNotice: vi.fn().mockReturnValue(of({ success: true, data: { ...mockContracts[0], status: 'terminated' } })),
    getParties: vi.fn().mockReturnValue(of({ success: true, data: mockParties })),
    addParty: vi.fn().mockReturnValue(of({ success: true, data: mockParties[0] })),
    deleteParty: vi.fn().mockReturnValue(of(null)),
    getContractObligations: vi.fn().mockReturnValue(of({ success: true, data: mockObligations })),
    addObligation: vi.fn().mockReturnValue(of({ success: true, data: mockObligations[0] })),
    getContractHistory: vi.fn().mockReturnValue(of({ success: true, data: mockHistory })),
    getAllObligations: vi.fn().mockReturnValue(of({ success: true, data: mockObligations, meta: { total: 1, last_page: 1 } })),
    completeObligation: vi.fn().mockReturnValue(of({ success: true, data: { ...mockObligations[0], status: 'completed' } })),
    waiveObligation: vi.fn().mockReturnValue(of({ success: true, data: { ...mockObligations[0], status: 'waived' } })),
    getAlerts: vi.fn().mockReturnValue(of({ success: true, data: mockAlerts, meta: { total: 1, last_page: 1 } })),
    acknowledgeAlert: vi.fn().mockReturnValue(of({ success: true, data: { success: true } })),
  };

  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContractRegisterComponent],
      providers: [
        { provide: ContractRegisterApiService, useValue: mockContractApi },
        { provide: NzMessageService, useValue: mockMessage },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ContractRegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes component and loads contracts register', () => {
    expect(component).toBeTruthy();
    expect(mockContractApi.getContracts).toHaveBeenCalled();
    expect(component.contracts().length).toBe(1);
    expect(component.contracts()[0].contract_number).toBe('CTR-2026-001');
  });

  it('submits create contract modal form', () => {
    component.openCreateModal();
    expect(component.createModalVisible()).toBe(true);

    component.contractForm.patchValue({
      kind: 'supplier',
      counterparty_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
      contract_number: 'CTR-SUP-2026-02',
      title: 'Locazione Server Datacenter Lugano',
      start_date: '2026-02-01',
      end_date: '2027-02-01',
      contract_value: '12000.00',
    });

    component.submitCreateContract();
    expect(mockContractApi.createContract).toHaveBeenCalledWith(
      expect.objectContaining({ counterparty_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', contract_value: '12000.00' }),
    );
    expect(mockContractApi.createContract.mock.calls[0][0]).not.toHaveProperty('total_value');
    expect(component.createModalVisible()).toBe(false);
    expect(mockMessage.success).toHaveBeenCalled();
  });

  it('opens renew modal and renews contract', () => {
    const contract = component.contracts()[0];
    component.openRenewModal(contract);
    expect(component.renewModalVisible()).toBe(true);

    component.renewForm.patchValue({ new_end_date: '2027-12-31' });

    component.submitRenewContract();
    expect(mockContractApi.renewContract).toHaveBeenCalledWith(contract.kind, contract.id, { new_end_date: '2027-12-31' });
    expect(component.renewModalVisible()).toBe(false);
    expect(mockMessage.success).toHaveBeenCalled();
  });

  it('opens notice modal and sends cancellation notice', () => {
    const contract = component.contracts()[0];
    component.openNoticeModal(contract);
    expect(component.noticeModalVisible()).toBe(true);

    component.noticeDate.set('2026-10-15');
    component.submitNotice();

    expect(mockContractApi.sendNotice).toHaveBeenCalledWith(contract.kind, contract.id, { notice_given_at: '2026-10-15' });
    expect(component.noticeModalVisible()).toBe(false);
  });

  it('opens drawer and inspects parties, obligations, and history', () => {
    const contract = component.contracts()[0];
    component.openDrawer(contract);
    expect(component.drawerVisible()).toBe(true);
    expect(mockContractApi.getParties).toHaveBeenCalledWith(contract.kind, contract.id);
    expect(mockContractApi.getContractObligations).toHaveBeenCalledWith(contract.kind, contract.id);
    expect(mockContractApi.getContractHistory).toHaveBeenCalledWith(contract.kind, contract.id);
    expect(component.contractParties().length).toBe(1);
    expect(component.contractObligations().length).toBe(1);
  });

  it('switches to obligations and alerts tabs, completes obligation and acknowledges alert', async () => {
    const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));
    component.onTabChange(1);
    await vi.waitFor(() => expect(mockContractApi.getAllObligations).toHaveBeenCalled());
    await settle();
    expect(mockContractApi.getAllObligations).toHaveBeenCalled();
    const obligationsGrid = (component as unknown as { obligationsGrid: { items: () => ContractObligationResource[] } }).obligationsGrid;
    expect(obligationsGrid.items().length).toBe(1);

    const ob = obligationsGrid.items()[0];
    component.openCompleteObligationModal(ob);
    expect(component.completeModalVisible()).toBe(true);
    component.submitCompleteObligation();
    expect(mockContractApi.completeObligation).toHaveBeenCalledWith(ob.id, expect.any(Object));

    // Tab 2: Alerts
    component.onTabChange(2);
    await vi.waitFor(() => expect(mockContractApi.getAlerts).toHaveBeenCalled());
    await settle();
    expect(mockContractApi.getAlerts).toHaveBeenCalled();
    const alertsGrid = (component as unknown as { alertsGrid: { items: () => ContractAlertResource[] } }).alertsGrid;
    expect(alertsGrid.items().length).toBe(1);

    const alert = alertsGrid.items()[0];
    const callsBefore = mockContractApi.getAlerts.mock.calls.length;
    component.acknowledgeAlert(alert);
    expect(mockContractApi.acknowledgeAlert).toHaveBeenCalledWith(alert.id);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(mockContractApi.getAlerts.mock.calls.length).toBeGreaterThan(callsBefore);
  });

  it('does not call the API when the forms are submitted empty and requires the end date of a supplier contract', () => {
    mockContractApi.createContract.mockClear();
    mockContractApi.addObligation.mockClear();
    mockContractApi.addParty.mockClear();
    component.openCreateModal();
    component.submitCreateContract();
    expect(mockContractApi.createContract).not.toHaveBeenCalled();
    expect(component.contractForm.controls.title.touched).toBe(true);

    component.contractForm.patchValue({ kind: 'supplier' });
    expect(component.contractForm.controls.end_date.hasError('required')).toBe(true);
    component.contractForm.patchValue({ kind: 'customer' });
    expect(component.contractForm.controls.end_date.hasError('required')).toBe(false);

    component.openDrawer(component.contracts()[0]);
    component.openObligationModal();
    component.submitObligation();
    expect(mockContractApi.addObligation).not.toHaveBeenCalled();
    component.openPartyModal();
    component.partyForm.patchValue({ name: '' });
    component.submitParty();
    expect(mockContractApi.addParty).not.toHaveBeenCalled();
  });

  it('sends a party with the API field names, the name only for external parties', () => {
    component.openDrawer(component.contracts()[0]);
    component.openPartyModal();
    component.partyForm.patchValue({ party_type: 'external', role: 'guarantor', name: 'Mario Rossi', email: 'mario@example.ch' });
    component.submitParty();
    expect(mockContractApi.addParty).toHaveBeenLastCalledWith(
      'customer',
      'ctr-001-uuid',
      expect.objectContaining({ party_type: 'external', role: 'guarantor', name: 'Mario Rossi', email: 'mario@example.ch', party_id: undefined }),
    );

    component.openPartyModal();
    component.partyForm.patchValue({ party_type: 'supplier', role: 'witness' });
    expect(component.partyForm.controls.party_id.hasError('required')).toBe(true);
    expect(component.partyForm.controls.name.hasError('required')).toBe(false);
    component.partyForm.patchValue({ party_id: 'not-a-uuid' });
    expect(component.partyForm.controls.party_id.hasError('uuid')).toBe(true);
    component.partyForm.patchValue({ party_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7' });
    component.submitParty();
    expect(mockContractApi.addParty).toHaveBeenLastCalledWith(
      'customer',
      'ctr-001-uuid',
      expect.objectContaining({ party_type: 'supplier', party_id: '7c9e6679-7425-40de-944b-e07fc1f90ae7', name: undefined }),
    );
  });

  it('sends an obligation with amount and currency together and rejects one without the other', () => {
    component.openDrawer(component.contracts()[0]);
    component.openObligationModal();
    component.obligationForm.patchValue({ title: 'Collaudo', due_date: '2026-09-30', amount: '500.00', currency: '' });
    expect(component.obligationForm.controls.currency.hasError('required')).toBe(true);
    component.obligationForm.patchValue({ currency: 'chf' });
    component.submitObligation();
    expect(mockContractApi.addObligation).toHaveBeenLastCalledWith(
      'customer',
      'ctr-001-uuid',
      expect.objectContaining({ amount: '500.00', currency: 'CHF', responsible_party: 'own', remind_days_before: 7 }),
    );
    expect(mockContractApi.addObligation.mock.calls.at(-1)?.[2]).not.toHaveProperty('penalty_amount');
  });

  it('flags a contract that ends before it starts', () => {
    component.openCreateModal();
    component.contractForm.patchValue({ start_date: '2026-05-10', end_date: '2026-05-01' });
    expect(component.contractForm.controls.end_date.hasError('endsBeforeStart')).toBe(true);
    expect(component.errorTip(component.contractForm, 'end_date')).toBe('COMMON.VALIDATION.END_AFTER_START');
  });
});
