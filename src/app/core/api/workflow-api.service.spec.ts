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
      approvable_id: '0b8f6c1e-7a52-4d3b-9c64-2e1f0a9b8c7d',
      context_snapshot: { requested_discount: 15 },
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
      target_entity_type: 'purchase_order',
    };

    service.createDefinition(payload).subscribe((res) => {
      expect(res.data.id).toBe('def-1');
    });

    const req1 = httpTesting.expectOne(`${base}/workflows/definitions`);
    expect(req1.request.method).toBe('POST');
    req1.flush({ success: true, data: { id: 'def-1', code: 'expense_policy' } });

    service.publishDefinition('def-1').subscribe((res) => {
      expect(res.data.status).toBe('published');
    });

    const req2 = httpTesting.expectOne(`${base}/workflows/definitions/def-1/publish`);
    expect(req2.request.method).toBe('POST');
    req2.flush({ success: true, data: { id: 'def-1', status: 'published' } });
  });

  it('manages delegations', () => {
    const payload: WorkflowCreateDelegationRequest = {
      delegate_user_id: 'user-2',
      scope: 'all',
      starts_at: '2026-08-01T00:00:00Z',
      ends_at: '2026-08-15T23:59:59Z',
      reason: 'Summer vacation',
    };

    service.createDelegation(payload).subscribe((res) => {
      expect(res.data.id).toBe('del-1');
    });

    const req = httpTesting.expectOne(`${base}/workflows/delegations`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ id: 'del-1', ...payload });

    service.deleteDelegation('del-1').subscribe();
    const reqDel = httpTesting.expectOne(`${base}/workflows/delegations/del-1`);
    expect(reqDel.request.method).toBe('DELETE');
    reqDel.flush(null);
  });
  describe('approval engine (Mod 006)', () => {
    it('reads the pending counters of the header badge', () => {
      service.getPendingCount().subscribe((res) => {
        expect(res.data.pending_count).toBe(4);
        expect(res.data.overdue_count).toBe(1);
      });
      const req = httpTesting.expectOne(`${base}/workflows/pending-count`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, message: '', data: { pending_count: 4, overdue_count: 1 } });
    });

    it('lists the subject types', () => {
      service.getSubjectTypes().subscribe((res) => expect(res.data[0].code).toBe('purchase_order'));
      const req = httpTesting.expectOne(`${base}/workflows/subject-types`);
      req.flush({ success: true, message: '', data: [{ code: 'purchase_order', module: 'procurement', registered: true }] });
    });

    it('saves and simulates approval matrices', () => {
      const body = {
        code: 'PO_HIGH',
        subject_type: 'purchase_order',
        name: 'PO',
        currency: 'CHF',
        priority: 10,
        is_active: true,
        is_default: false,
        auto_approve_below: null,
        fallback_approver: null,
        conditions: [{ field: 'amount', operator: 'gte' as const, value: 10000 }],
        tiers: [
          {
            tier_level: 1,
            threshold_min: null,
            threshold_max: null,
            approver_type: 'role' as const,
            approver_value: 'cfo',
            approval_type: 'single' as const,
          },
        ],
      };
      service.createMatrix(body).subscribe();
      const create = httpTesting.expectOne(`${base}/workflows/matrices`);
      expect(create.request.method).toBe('POST');
      expect(create.request.body).toEqual(body);
      create.flush({ success: true, message: '', data: { id: 'm1', ...body } });

      service.updateMatrix('m1', body).subscribe();
      const update = httpTesting.expectOne(`${base}/workflows/matrices/m1`);
      expect(update.request.method).toBe('PUT');
      update.flush({ success: true, message: '', data: { id: 'm1', ...body } });

      service
        .simulateMatrix({ subject_type: 'purchase_order', matrix_id: 'm1', attributes: { amount: 5000, currency: 'CHF' } })
        .subscribe((res) => expect(res.data.auto_approved).toBe(false));
      const simulate = httpTesting.expectOne(`${base}/workflows/matrices/simulate`);
      expect(simulate.request.method).toBe('POST');
      expect(simulate.request.body.attributes.amount).toBe(5000);
      simulate.flush({ success: true, message: '', data: { matrix: null, used_default: true, used_fallback: false, auto_approved: false, blocked: false, tiers: [] } });
    });

    it('manages calendars and holidays', () => {
      service.getHolidays('c1').subscribe();
      httpTesting.expectOne(`${base}/workflows/calendars/c1/holidays`).flush({ success: true, message: '', data: [] });

      service.addHoliday('c1', { holiday_date: '2026-12-25', name: 'Christmas', holiday_type: 'national' }).subscribe();
      const add = httpTesting.expectOne(`${base}/workflows/calendars/c1/holidays`);
      expect(add.request.method).toBe('POST');
      expect(add.request.body.holiday_date).toBe('2026-12-25');
      add.flush({ success: true, message: '', data: { id: 'h1', holiday_date: '2026-12-25', name: 'Christmas', holiday_type: 'national' } });

      service.deleteHoliday('c1', 'h1').subscribe();
      const del = httpTesting.expectOne(`${base}/workflows/calendars/c1/holidays/h1`);
      expect(del.request.method).toBe('DELETE');
      del.flush(null);

      service.seedHolidays('c1', { country: 'CH', canton: 'TI', year: 2026 }).subscribe();
      const seed = httpTesting.expectOne(`${base}/workflows/calendars/c1/seed-holidays`);
      expect(seed.request.body).toEqual({ country: 'CH', canton: 'TI', year: 2026 });
      seed.flush({ success: true, message: '', data: [] });
    });

    it('reads the timeline and withdraws or cancels an instance', () => {
      service.getInstanceTimeline('i1').subscribe((res) => expect(res.data.length).toBe(1));
      httpTesting
        .expectOne(`${base}/workflows/instances/i1/timeline`)
        .flush({ success: true, message: '', data: [{ id: 's1', type: 'approval', status: 'pending' }] });

      service.withdrawInstance('i1').subscribe();
      const withdraw = httpTesting.expectOne(`${base}/workflows/instances/i1/withdraw`);
      expect(withdraw.request.method).toBe('POST');
      withdraw.flush({ success: true, message: '', data: { success: true } });

      service.cancelInstanceWithReason('i1', 'Duplicate').subscribe();
      const cancel = httpTesting.expectOne(`${base}/workflows/instances/i1/cancel`);
      expect(cancel.request.body).toEqual({ reason: 'Duplicate' });
      cancel.flush({ success: true, message: '', data: { success: true } });
    });

    it('downloads the evidence and the SLA export as blobs', () => {
      service.downloadInstanceEvidence('i1').subscribe((blob) => expect(blob).toBeInstanceOf(Blob));
      const evidence = httpTesting.expectOne(`${base}/workflows/instances/i1/evidence`);
      expect(evidence.request.responseType).toBe('blob');
      evidence.flush(new Blob(['pdf']));

      service.exportSlaReport('xlsx').subscribe();
      const exportReq = httpTesting.expectOne((r) => r.url === `${base}/workflows/sla-report/export`);
      expect(exportReq.request.params.get('format')).toBe('xlsx');
      expect(exportReq.request.responseType).toBe('blob');
      exportReq.flush(new Blob(['x']));
    });

    it('sends reassign and request-changes decisions', () => {
      service
        .recordDecision('s1', { decision: 'reassign', reassign_to_user_id: 'u2', idempotency_key: 'k1' })
        .subscribe();
      const req = httpTesting.expectOne(`${base}/workflows/steps/s1/decide`);
      expect(req.request.body.decision).toBe('reassign');
      expect(req.request.body.reassign_to_user_id).toBe('u2');
      req.flush({ success: true, message: '', data: { success: true } });
    });

    it('previews and confirms a remote approval', () => {
      service.getRemoteApprovalPreview('tok/en', 'approve').subscribe((res) => expect(res.data.requires_reauth).toBe(true));
      const preview = httpTesting.expectOne((r) => r.url === `${base}/workflows/remote-approval/tok%2Fen`);
      expect(preview.request.params.get('action')).toBe('approve');
      preview.flush({
        success: true,
        message: '',
        data: {
          requires_reauth: true,
          subject_label: 'PO 1',
          subject_type: 'purchase_order',
          amount: 10,
          currency: 'CHF',
          requester_name: 'A',
          approver_name: 'B',
          action: 'approve',
          expires_at: null,
        },
      });

      service.confirmRemoteApproval('tok', { action: 'reject', confirm: true, comment: 'No' }).subscribe();
      const confirm = httpTesting.expectOne(`${base}/workflows/remote-approval/tok/confirm`);
      expect(confirm.request.method).toBe('POST');
      expect(confirm.request.body.confirm).toBe(true);
      confirm.flush({ message: 'ok', step_id: 's1', status: 'rejected' });
    });
  });
});
