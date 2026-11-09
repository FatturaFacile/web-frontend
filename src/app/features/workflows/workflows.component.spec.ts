import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  WorkflowApiService,
  WorkflowAuditEntryResource,
  WorkflowAuditVerification,
  WorkflowDefinitionResource,
  WorkflowDelegationModel,
  WorkflowEscalationRule,
  WorkflowInstanceResource,
  WorkflowSlaReport,
  WorkflowTask,
} from '@core';
import { WorkflowsComponent } from './workflows.component';

describe('WorkflowsComponent', () => {
  let fixture: ComponentFixture<WorkflowsComponent>;
  let component: WorkflowsComponent;

  const mockTasks: WorkflowTask[] = [
    {
      step_id: 'step-101',
      workflow_instance_id: 'inst-1',
      workflow_code: 'purchase_approval',
      workflow_name: 'Approvazione Ordine di Acquisto',
      approvable_type: 'PurchaseOrder',
      approvable_id: 'PO-2026-001',
      approvable_label: 'Fornitore Bosch CH (CHF 12,000)',
      initiator_name: 'Mario Rossi',
      step_name: 'Approvazione Direzione Tecnica',
      step_index: 1,
      due_at: '2026-11-15T18:00:00Z',
      status: 'pending',
      is_sla_breached: false,
      is_escalated: false,
    },
  ];

  const mockInstances: WorkflowInstanceResource[] = [
    {
      id: 'inst-001-uuid',
      workflow_definition_id: 'def-1',
      workflow_definition_version: 1,
      approvable_type: 'Invoice',
      approvable_id: 'INV-2026-99',
      status: 'pending',
      started_at: '2026-11-09T10:00:00Z',
      definition: {
        id: 'def-1',
        code: 'invoice_approval',
        name: 'Approvazione Fattura Fornitore',
        version: 1,
        is_active: true,
        is_published: true,
        approvable_type: 'Invoice',
      },
    },
  ];

  const mockDefinitions: WorkflowDefinitionResource[] = [
    {
      id: 'def-1',
      code: 'invoice_approval',
      name: 'Approvazione Fattura Fornitore',
      description: 'Controllo conformità e budget',
      version: 1,
      is_active: true,
      is_published: false,
      approvable_type: 'Invoice',
    },
  ];

  const mockDelegations: WorkflowDelegationModel[] = [
    {
      id: 'del-1',
      delegator_user_id: 'usr-admin',
      delegate_user_id: 'usr-deputy',
      delegate_user_name: 'Laura Bianchi',
      workflow_code: null,
      starts_at: '2026-12-01T00:00:00Z',
      ends_at: '2026-12-15T23:59:59Z',
      is_active: true,
      reason: 'Ferie natalizie',
    },
  ];

  const mockRules: WorkflowEscalationRule[] = [
    {
      id: 'rule-1',
      name: 'Sollecito 24h ed escalation CFO a 48h',
      workflow_code: 'purchase_approval',
      reminder_hours: 24,
      escalation_hours: 48,
      escalate_to_type: 'role',
      escalate_to_target: 'cfo',
      is_active: true,
    },
  ];

  const mockAuditTrail: WorkflowAuditEntryResource[] = [
    {
      id: 'audit-1',
      sequence: 1,
      workflow_instance_id: 'inst-001-uuid',
      event_type: 'workflow.started',
      actor_id: 'usr-1',
      actor_name: 'Mario Rossi',
      hash: 'a1b2c3d4e5f6789012345678abcdef01',
      created_at: '2026-11-09T10:00:00Z',
    },
  ];

  const mockVerification: WorkflowAuditVerification = {
    is_valid: true,
    chain_length: 1,
    verified_entries: 1,
    last_hash: 'a1b2c3d4e5f6789012345678abcdef01',
  };

  const mockSlaReport: WorkflowSlaReport = {
    figures: {
      average_approval_time_hours: 4.5,
      total_completed_instances: 42,
      sla_compliance_rate_percent: 98.2,
      breached_steps_count: 1,
    },
    bottlenecks: [
      {
        step_name: 'Approvazione Direzione Generale',
        average_hours: 12.4,
        breached_count: 1,
      },
    ],
  };

  const mockWorkflowApi = {
    getMyTasks: vi.fn().mockReturnValue(of({ success: true, data: mockTasks, meta: { total: 1 } })),
    recordDecision: vi.fn().mockReturnValue(of({ success: true, data: { success: true } })),
    getInstances: vi.fn().mockReturnValue(of({ success: true, data: mockInstances, meta: { total: 1 } })),
    startInstance: vi.fn().mockReturnValue(of({ success: true, data: mockInstances[0] })),
    cancelInstance: vi.fn().mockReturnValue(of({ success: true, data: { success: true } })),
    getInstanceAuditTrail: vi.fn().mockReturnValue(of({ success: true, data: mockAuditTrail })),
    verifyInstanceAuditTrail: vi.fn().mockReturnValue(of({ success: true, data: mockVerification })),
    getDefinitions: vi.fn().mockReturnValue(of({ success: true, data: mockDefinitions, meta: { total: 1 } })),
    createDefinition: vi.fn().mockReturnValue(of({ success: true, data: mockDefinitions[0] })),
    publishDefinition: vi.fn().mockReturnValue(of({ success: true, data: { ...mockDefinitions[0], is_published: true } })),
    deleteDefinition: vi.fn().mockReturnValue(of(null)),
    getDelegations: vi.fn().mockReturnValue(of({ success: true, data: mockDelegations })),
    createDelegation: vi.fn().mockReturnValue(of({ success: true, data: mockDelegations[0] })),
    deleteDelegation: vi.fn().mockReturnValue(of(null)),
    getEscalationRules: vi.fn().mockReturnValue(of({ success: true, data: mockRules })),
    createEscalationRule: vi.fn().mockReturnValue(of({ success: true, data: mockRules[0] })),
    deleteEscalationRule: vi.fn().mockReturnValue(of(null)),
    getSlaReport: vi.fn().mockReturnValue(of({ success: true, data: mockSlaReport })),
  };

  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkflowsComponent],
      providers: [
        { provide: WorkflowApiService, useValue: mockWorkflowApi },
        { provide: NzMessageService, useValue: mockMessage },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkflowsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('initializes component and loads pending inbox tasks', () => {
    expect(component).toBeTruthy();
    expect(mockWorkflowApi.getMyTasks).toHaveBeenCalled();
    expect(component.tasks().length).toBe(1);
    expect(component.tasks()[0].workflow_code).toBe('purchase_approval');
  });

  it('submits approval decision from decision modal', () => {
    const task = component.tasks()[0];
    component.openDecisionModal(task, 'approved');
    expect(component.decisionModalVisible()).toBe(true);
    expect(component.decisionType()).toBe('approved');

    component.decisionComment.set('Approvato');
    component.submitDecision();

    expect(mockWorkflowApi.recordDecision).toHaveBeenCalledWith('step-101', {
      decision: 'approved',
      comment: 'Approvato',
    });
    expect(component.decisionModalVisible()).toBe(false);
    expect(mockMessage.success).toHaveBeenCalled();
  });

  it('navigates to instances tab, starts a workflow, and inspects audit hash verification', () => {
    component.onTabChange(1);
    expect(mockWorkflowApi.getInstances).toHaveBeenCalled();
    expect(component.instances().length).toBe(1);

    component.openStartModal();
    expect(component.startModalVisible()).toBe(true);
    component.startForm.patchValue({
      workflow_code: 'purchase_approval',
      approvable_type: 'Invoice',
      approvable_id: 'INV-1234',
      context_note: 'Richiesta urgente',
    });
    component.submitStartWorkflow();
    expect(mockWorkflowApi.startInstance).toHaveBeenCalled();
    expect(component.startModalVisible()).toBe(false);

    // Audit trail & hash verify
    const inst = component.instances()[0];
    component.openAuditTrail(inst);
    expect(mockWorkflowApi.getInstanceAuditTrail).toHaveBeenCalledWith(inst.id);
    expect(mockWorkflowApi.verifyInstanceAuditTrail).toHaveBeenCalledWith(inst.id);
    expect(component.auditVerification()?.is_valid).toBe(true);
  });

  it('navigates to definitions tab, creates and publishes a definition', () => {
    component.onTabChange(2);
    expect(mockWorkflowApi.getDefinitions).toHaveBeenCalled();
    expect(component.definitions().length).toBe(1);

    component.openCreateDefModal();
    expect(component.createDefModalVisible()).toBe(true);
    component.defForm.patchValue({
      code: 'customs_approval',
      name: 'Customs Clearance Process',
      description: 'Approval of cross-border customs declarations',
      approvable_type: 'CustomsDossier',
    });
    component.submitCreateDefinition();
    expect(mockWorkflowApi.createDefinition).toHaveBeenCalled();
    expect(component.createDefModalVisible()).toBe(false);

    const def = component.definitions()[0];
    component.publishDefinition(def);
    expect(mockWorkflowApi.publishDefinition).toHaveBeenCalledWith(def.id);
  });

  it('navigates to delegations tab, manages delegations, and views SLA report', () => {
    component.onTabChange(3);
    expect(mockWorkflowApi.getDelegations).toHaveBeenCalled();
    expect(mockWorkflowApi.getEscalationRules).toHaveBeenCalled();

    component.openCreateDelegationModal();
    component.delegationForm.patchValue({
      delegate_user_id: 'usr-colleague',
      reason: 'Congedo parentale',
    });
    component.submitCreateDelegation();
    expect(mockWorkflowApi.createDelegation).toHaveBeenCalled();

    // Tab 4: SLA
    component.onTabChange(4);
    expect(mockWorkflowApi.getSlaReport).toHaveBeenCalled();
    expect(component.slaReport()?.figures.sla_compliance_rate_percent).toBe(98.2);
  });
});
