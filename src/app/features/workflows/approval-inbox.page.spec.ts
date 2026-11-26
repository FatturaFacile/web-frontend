import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminApiService, WorkflowApiService, WorkflowTask } from '@core';
import { ApprovalInboxPageComponent } from './approval-inbox.page';

function task(id: string, overrides: Partial<WorkflowTask> = {}): WorkflowTask {
  return {
    step_id: id,
    workflow_instance_id: `inst-${id}`,
    workflow_code: 'PO_APPROVAL',
    workflow_name: 'Purchase order approval',
    node_name: 'Finance',
    approvable_type: 'purchase_order',
    approvable_id: `po-${id}`,
    approvable_label: `PO ${id}`,
    initiator_name: 'Mario Rossi',
    due_at: '2026-12-01T10:00:00Z',
    is_overdue: false,
    hours_remaining: '30',
    ...overrides,
  };
}

describe('ApprovalInboxPageComponent', () => {
  let fixture: ComponentFixture<ApprovalInboxPageComponent>;
  let component: ApprovalInboxPageComponent;

  const api = {
    getMyTasks: vi.fn(),
    getSubjectTypes: vi.fn(),
    recordDecision: vi.fn(),
  };
  const admin = { listUsers: vi.fn() };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getMyTasks.mockReturnValue(of({ success: true, message: '', data: [task('s1'), task('s2')], meta: { total: 2 } }));
    api.getSubjectTypes.mockReturnValue(of({ success: true, message: '', data: [{ code: 'purchase_order', module: 'procurement', registered: true }] }));
    api.recordDecision.mockReturnValue(of({ success: true, message: '', data: { success: true } }));
    admin.listUsers.mockReturnValue(of({ success: true, message: '', data: [{ id: 'u2', name: 'Anna', email: 'a@x.ch', is_active: true }], meta: { total: 1 } }));

    await TestBed.configureTestingModule({
      imports: [ApprovalInboxPageComponent],
      providers: [
        provideRouter([]),
        { provide: WorkflowApiService, useValue: api },
        { provide: AdminApiService, useValue: admin },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ApprovalInboxPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the tasks and the document types on init', () => {
    expect(api.getMyTasks).toHaveBeenCalledWith({ page: 1, per_page: 15 });
    expect(component.tasks().length).toBe(2);
    expect(component.subjectTypes()[0].code).toBe('purchase_order');
  });

  it('sends the due and type filters to the API and goes back to page 1', () => {
    component.onPage(3);
    component.onDueFilter('overdue');
    component.onTypeFilter('purchase_order');

    expect(api.getMyTasks).toHaveBeenLastCalledWith({ page: 1, per_page: 15, approvable_type: 'purchase_order', state: 'overdue' });
  });

  it('approves a task straight away with an idempotency key and reloads the inbox', () => {
    component.quickApprove(component.tasks()[0]);

    const [stepId, payload] = api.recordDecision.mock.calls[0];
    expect(stepId).toBe('s1');
    expect(payload.decision).toBe('approved');
    expect(typeof payload.idempotency_key).toBe('string');
    expect(message.success).toHaveBeenCalled();
    expect(api.getMyTasks).toHaveBeenCalledTimes(2);
  });

  it('does not reject without a reason', () => {
    component.openDecision(component.tasks()[0], 'rejected');
    component.submitDialog();

    expect(component.dialogError()).toBe('workflows.decision.error.commentRequired');
    expect(api.recordDecision).not.toHaveBeenCalled();
    expect(component.dialogTask()).not.toBeNull();
  });

  it('rejects with the reason, closes the dialog and reloads', () => {
    component.openDecision(component.tasks()[0], 'rejected');
    component.comment.set('  Over budget  ');
    component.submitDialog();

    const [stepId, payload] = api.recordDecision.mock.calls[0];
    expect(stepId).toBe('s1');
    expect(payload.decision).toBe('rejected');
    expect(payload.comment).toBe('Over budget');
    expect(component.dialogTask()).toBeNull();
    expect(api.getMyTasks).toHaveBeenCalledTimes(2);
  });

  it('requires a reason to request changes and a user to reassign', () => {
    component.openDecision(component.tasks()[0], 'request_changes');
    component.submitDialog();
    expect(component.dialogError()).toBe('workflows.decision.error.commentRequired');

    component.openDecision(component.tasks()[0], 'reassign');
    expect(admin.listUsers).toHaveBeenCalled();
    component.submitDialog();
    expect(component.dialogError()).toBe('workflows.decision.error.reassignRequired');

    component.reassignTo.set('u2');
    component.submitDialog();
    expect(api.recordDecision.mock.calls[0][1]).toMatchObject({ decision: 'reassign', reassign_to_user_id: 'u2' });
  });

  it('tells the user when somebody else decided the step first (409)', () => {
    api.recordDecision.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409 })));

    component.quickApprove(component.tasks()[0]);

    expect(message.warning).toHaveBeenCalled();
    expect(message.error).not.toHaveBeenCalled();
    expect(api.getMyTasks).toHaveBeenCalledTimes(2);
  });

  it('shows the message of the API on a separation-of-duties refusal (403)', () => {
    api.recordDecision.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Self approval is not allowed' } })),
    );

    component.quickApprove(component.tasks()[0]);

    expect(message.error).toHaveBeenCalledWith('Self approval is not allowed');
  });

  it('approves every selected task in bulk', () => {
    component.toggleAll(true);
    expect(component.selectedIds().size).toBe(2);

    component.bulkApprove();

    expect(api.recordDecision).toHaveBeenCalledTimes(2);
    expect(api.recordDecision.mock.calls.map((call) => call[0])).toEqual(['s1', 's2']);
    expect(message.success).toHaveBeenCalled();
    expect(component.selectedIds().size).toBe(0);
  });

  it('keeps going and warns when some bulk approvals fail', () => {
    api.recordDecision.mockReturnValueOnce(of({ success: true })).mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 409 })));
    component.toggleAll(true);

    component.bulkApprove();

    expect(api.recordDecision).toHaveBeenCalledTimes(2);
    expect(message.warning).toHaveBeenCalled();
  });

  it('renders one quick-approve button per task', () => {
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="quick-approve"]');
    expect(buttons.length).toBe(2);
  });
});
