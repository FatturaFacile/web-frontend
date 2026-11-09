import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { WorkflowApiService } from './workflow-api.service';
import {
  WorkflowCreateDelegationRequest,
  WorkflowRecordDecisionRequest,
  WorkflowSaveDefinitionRequest,
  WorkflowStartWorkflowRequest,
} from '../models';

describe('WorkflowApiService', () => {
  let service: WorkflowApiService;
  let httpTesting: HttpTestingController;
  const base = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WorkflowApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WorkflowApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('fetches inbox tasks with query params', () => {
    service
      .getMyTasks({ workflow_code: 'purchase_approval', status: 'pending', page: 1, per_page: 15 })
      .subscribe((res) => {
        expect(res.data.length).toBe(1);
        expect(res.data[0].step_id).toBe('step-1');
      });

    const req = httpTesting.expectOne((r) => r.url === `${base}/workflows/my-tasks`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('workflow_code')).toBe('purchase_approval');
    expect(req.request.params.get('status')).toBe('pending');

    req.flush({
      success: true,
      data: [{ step_id: 'step-1', workflow_code: 'purchase_approval', status: 'pending' }],
      meta: { current_page: 1, total: 1 },
    });
  });

  it('records an approval decision on a workflow step', () => {
    const payload: WorkflowRecordDecisionRequest = {
      decision: 'approved',
      comment: 'Budget approved up to 10k CHF',
    };

    service.recordDecision('step-123', payload).subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const req = httpTesting.expectOne(`${base}/workflows/steps/step-123/decide`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    req.flush({ success: true, data: { success: true } });
  });

  it('starts a new workflow instance', () => {
    const payload: WorkflowStartWorkflowRequest = {
      workflow_code: 'sales_discount_approval',
      approvable_type: 'Quote',
      approvable_id: 'quote-456',
      context: { requested_discount: 15 },
    };

    service.startInstance(payload).subscribe((res) => {
      expect(res.data.id).toBe('inst-1');
      expect(res.data.status).toBe('pending');
    });

    const req = httpTesting.expectOne(`${base}/workflows/instances`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    req.flush({
      success: true,
      data: { id: 'inst-1', status: 'pending', approvable_type: 'Quote', approvable_id: 'quote-456' },
    });
  });

  it('cancels a workflow instance with reason', () => {
    service.cancelInstance('inst-1', 'Order cancelled by customer').subscribe((res) => {
      expect(res.success).toBe(true);
    });

    const req = httpTesting.expectOne(`${base}/workflows/instances/inst-1/cancel`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ reason: 'Order cancelled by customer' });

    req.flush({ success: true, data: { success: true } });
  });

  it('verifies instance cryptographic audit trail', () => {
    service.verifyInstanceAuditTrail('inst-1').subscribe((res) => {
      expect(res.data.is_valid).toBe(true);
      expect(res.data.chain_length).toBe(4);
    });

    const req = httpTesting.expectOne(`${base}/workflows/instances/inst-1/audit-trail/verify`);
    expect(req.request.method).toBe('GET');

    req.flush({
      success: true,
      data: { is_valid: true, chain_length: 4, verified_entries: 4, last_hash: 'sha256-abc123' },
    });
  });

  it('creates a definition and publishes it', () => {
    const payload: WorkflowSaveDefinitionRequest = {
      code: 'expense_policy',
      name: 'Expense Policy Approval',
      approvable_type: 'Expense',
    };

    service.createDefinition(payload).subscribe((res) => {
      expect(res.data.id).toBe('def-1');
    });

    const req1 = httpTesting.expectOne(`${base}/workflows/definitions`);
    expect(req1.request.method).toBe('POST');
    req1.flush({ success: true, data: { id: 'def-1', code: 'expense_policy' } });

    service.publishDefinition('def-1').subscribe((res) => {
      expect(res.data.is_published).toBe(true);
    });

    const req2 = httpTesting.expectOne(`${base}/workflows/definitions/def-1/publish`);
    expect(req2.request.method).toBe('POST');
    req2.flush({ success: true, data: { id: 'def-1', is_published: true } });
  });

  it('manages delegations', () => {
    const payload: WorkflowCreateDelegationRequest = {
      delegate_user_id: 'user-2',
      starts_at: '2026-08-01T00:00:00Z',
      ends_at: '2026-08-15T23:59:59Z',
      reason: 'Summer vacation',
    };

    service.createDelegation(payload).subscribe((res) => {
      expect(res.data.id).toBe('del-1');
    });

    const req = httpTesting.expectOne(`${base}/workflows/delegations`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, data: { id: 'del-1', ...payload } });

    service.deleteDelegation('del-1').subscribe();
    const reqDel = httpTesting.expectOne(`${base}/workflows/delegations/del-1`);
    expect(reqDel.request.method).toBe('DELETE');
    reqDel.flush(null);
  });
});
