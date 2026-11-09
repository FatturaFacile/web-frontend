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
      total_value: '18000.00',
      status: 'active',
    },
  ];

  const mockParties: ContractPartyResource[] = [
    {
      id: 'pty-1',
      role: 'committente',
      name: 'Tech Solutions SA',
      contact_email: 'legal@techsolutions.ch',
      vat_number: 'CHE-123.456.789',
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
      responsible_party: 'Fornitore',
      penalty_amount: '1000.00',
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
    getAllObligations: vi.fn().mockReturnValue(of({ success: true, data: mockObligations, meta: { total: 1 } })),
    completeObligation: vi.fn().mockReturnValue(of({ success: true, data: { ...mockObligations[0], status: 'completed' } })),
    waiveObligation: vi.fn().mockReturnValue(of({ success: true, data: { ...mockObligations[0], status: 'waived' } })),
    getAlerts: vi.fn().mockReturnValue(of({ success: true, data: mockAlerts })),
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
      counterparty_id: 'supp-99',
      contract_number: 'CTR-SUP-2026-02',
      title: 'Locazione Server Datacenter Lugano',
      start_date: '2026-02-01',
      total_value: '12000.00',
    });

    component.submitCreateContract();
    expect(mockContractApi.createContract).toHaveBeenCalled();
    expect(component.createModalVisible()).toBe(false);
    expect(mockMessage.success).toHaveBeenCalled();
  });

  it('opens renew modal and renews contract', () => {
    const contract = component.contracts()[0];
    component.openRenewModal(contract);
    expect(component.renewModalVisible()).toBe(true);

    component.renewForm.patchValue({
      new_end_date: '2027-12-31',
      renewal_term_months: 12,
      revised_value: '19500.00',
    });

    component.submitRenewContract();
    expect(mockContractApi.renewContract).toHaveBeenCalled();
    expect(component.renewModalVisible()).toBe(false);
    expect(mockMessage.success).toHaveBeenCalled();
  });

  it('opens notice modal and sends cancellation notice', () => {
    const contract = component.contracts()[0];
    component.openNoticeModal(contract);
    expect(component.noticeModalVisible()).toBe(true);

    component.noticeDate.set('2026-10-15');
    component.noticeReason.set('Cessazione attività ramo aziendale');
    component.submitNotice();

    expect(mockContractApi.sendNotice).toHaveBeenCalledWith(contract.kind, contract.id, {
      notice_date: '2026-10-15',
      reason: 'Cessazione attività ramo aziendale',
    });
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

  it('switches to obligations and alerts tabs, completes obligation and acknowledges alert', () => {
    component.onTabChange(1);
    expect(mockContractApi.getAllObligations).toHaveBeenCalled();
    expect(component.globalObligations().length).toBe(1);

    const ob = component.globalObligations()[0];
    component.openCompleteObligationModal(ob);
    expect(component.completeModalVisible()).toBe(true);
    component.submitCompleteObligation();
    expect(mockContractApi.completeObligation).toHaveBeenCalledWith(ob.id, expect.any(Object));

    // Tab 2: Alerts
    component.onTabChange(2);
    expect(mockContractApi.getAlerts).toHaveBeenCalled();
    expect(component.alerts().length).toBe(1);

    const alert = component.alerts()[0];
    component.acknowledgeAlert(alert);
    expect(mockContractApi.acknowledgeAlert).toHaveBeenCalledWith(alert.id);
    expect(alert.is_acknowledged).toBe(true);
  });
});
