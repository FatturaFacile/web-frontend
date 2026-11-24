import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { DmsApiService, DmsApprovalRequestResource, DmsApprovalTemplateResource } from '@core';
import { DmsWorkflowsComponent } from './dms-workflows.component';

describe('DmsWorkflowsComponent', () => {
  let fixture: ComponentFixture<DmsWorkflowsComponent>;
  let component: DmsWorkflowsComponent;

  const pending: DmsApprovalRequestResource = {
    id: 'req-1',
    document_id: 'doc-1',
    document_title: 'Supply contract',
    document_version_id: 'ver-1',
    template_id: 'tpl-1',
    template_name: 'Contract approval',
    status: 'pending',
    current_step: 1,
    total_steps: 2,
    current_step_detail: { position: 1, name: 'Finance', approver_type: 'role', approver_role: 'accountant' },
    requested_by: 'user-1',
    note: null,
    completed_at: null,
    created_at: '2027-06-15T09:00:00Z',
  };

  const template: DmsApprovalTemplateResource = {
    id: 'tpl-1',
    name: 'Contract approval',
    document_type: null,
    is_active: true,
    steps: [{ position: 1, name: 'Finance', approver_type: 'role', approver_role: 'accountant' }],
  };

  const mockApi = {
    getApprovalRequests: vi.fn(),
    getApprovalTemplates: vi.fn(),
    createApprovalTemplate: vi.fn(),
    deleteApprovalTemplate: vi.fn(),
    approveApprovalRequest: vi.fn(),
    rejectApprovalRequest: vi.fn(),
    cancelApprovalRequest: vi.fn(),
    getPreservationChainStatus: vi.fn(),
    anchorPreservationChain: vi.fn(),
    verifyPreservationChain: vi.fn(),
  };
  const mockMessage = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockApi.getApprovalRequests.mockReturnValue(of({ success: true, message: '', data: [pending], meta: {} }));
    mockApi.getApprovalTemplates.mockReturnValue(of({ success: true, message: '', data: [template] }));
    mockApi.getPreservationChainStatus.mockReturnValue(
      of({ success: true, message: '', data: { closed_packages: 1, chained_packages: 0, unchained_packages: 1, packages: [] } }),
    );
    mockApi.approveApprovalRequest.mockReturnValue(of({ success: true, message: '', data: { ...pending, current_step: 2 } }));
    mockApi.rejectApprovalRequest.mockReturnValue(of({ success: true, message: '', data: { ...pending, status: 'rejected' } }));
    mockApi.cancelApprovalRequest.mockReturnValue(of({ success: true, message: '', data: { ...pending, status: 'cancelled' } }));
    mockApi.createApprovalTemplate.mockReturnValue(of({ success: true, message: '', data: template }));
    mockApi.anchorPreservationChain.mockReturnValue(of({ success: true, message: '', data: [{ id: 'l1' }] }));
    mockApi.verifyPreservationChain.mockReturnValue(
      of({ success: true, message: '', data: { valid: true, links_checked: 1, broken_at_sequence: null, reason: null } }),
    );

    await TestBed.configureTestingModule({
      imports: [DmsWorkflowsComponent],
      providers: [
        { provide: DmsApiService, useValue: mockApi },
        { provide: NzMessageService, useValue: mockMessage },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(DmsWorkflowsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the requests waiting for the user, the templates and the chain status', () => {
    expect(mockApi.getApprovalRequests).toHaveBeenCalledWith({ awaiting_me: true });
    expect(mockApi.getApprovalTemplates).toHaveBeenCalled();
    expect(mockApi.getPreservationChainStatus).toHaveBeenCalled();
    expect(component['requests']().length).toBe(1);
  });

  it('shows every request when the filter is switched off', () => {
    component['toggleAwaitingMe'](false);
    expect(mockApi.getApprovalRequests).toHaveBeenLastCalledWith({});
  });

  it('approves a step and reloads', () => {
    component['approve'](pending);
    expect(mockApi.approveApprovalRequest).toHaveBeenCalledWith('req-1');
    expect(mockMessage.success).toHaveBeenCalled();
    expect(mockApi.getApprovalRequests).toHaveBeenCalledTimes(2);
  });

  it('rejects only with a reason', () => {
    component['openReject'](pending);
    component['confirmReject']();
    expect(mockApi.rejectApprovalRequest).not.toHaveBeenCalled();

    component['rejectComment'] = 'Wrong amount';
    component['confirmReject']();
    expect(mockApi.rejectApprovalRequest).toHaveBeenCalledWith('req-1', 'Wrong amount');
    expect(component['rejectTarget']()).toBeNull();
  });

  it('reports a failed decision', () => {
    mockApi.approveApprovalRequest.mockReturnValue(throwError(() => new Error('403')));
    component['approve'](pending);
    expect(mockMessage.error).toHaveBeenCalled();
  });

  it('cancels a pending request', () => {
    component['cancel'](pending);
    expect(mockApi.cancelApprovalRequest).toHaveBeenCalledWith('req-1');
  });

  it('saves a template only when every step names its approver', () => {
    component['openTemplateModal']();
    component['templateName'] = 'Two steps';
    expect(component['canSaveTemplate']()).toBe(false);

    component['updateStep'](0, { name: 'Finance', approver_role: 'accountant' });
    component['addStep']();
    component['updateStep'](1, { name: 'Director', approver_type: 'user' });
    expect(component['canSaveTemplate']()).toBe(false);

    component['updateStep'](1, { approver_user_id: '0198a7b2-0000-7000-8000-000000000001' });
    expect(component['canSaveTemplate']()).toBe(true);

    component['saveTemplate']();
    expect(mockApi.createApprovalTemplate).toHaveBeenCalledWith({
      name: 'Two steps',
      steps: [
        { name: 'Finance', approver_type: 'role', approver_role: 'accountant' },
        { name: 'Director', approver_type: 'user', approver_role: '', approver_user_id: '0198a7b2-0000-7000-8000-000000000001' },
      ],
    });
    expect(component['templateModalVisible']()).toBe(false);
  });

  it('anchors and verifies the preservation chain', () => {
    component['anchorChain']();
    expect(mockApi.anchorPreservationChain).toHaveBeenCalled();
    expect(mockApi.getPreservationChainStatus).toHaveBeenCalledTimes(2);

    component['verifyChain']();
    expect(component['verification']()?.valid).toBe(true);
  });
});
