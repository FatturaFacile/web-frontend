import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEST_API_BASE_URL } from '../../../testing/api';
import { PurchaseRequisitionApiService } from './purchase-requisition-api.service';

describe('PurchaseRequisitionApiService', () => {
  const base = TEST_API_BASE_URL;
  const originalApiBaseUrl = environment.apiBaseUrl;
  let api: PurchaseRequisitionApiService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    environment.apiBaseUrl = base;
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(PurchaseRequisitionApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('lists requisitions with query filters', () => {
    api
      .list({
        status: 'budget_exceeded_blocked',
        cost_center_id: 'cc-1',
        project_id: 'proj-1',
        urgency: 'critical',
        requester_id: 'usr-1',
        date_from: '2026-11-01',
        date_to: '2026-11-30',
        search: 'PR-2026',
        page: 2,
        per_page: 25,
      })
      .subscribe();

    const req = httpTesting.expectOne(
      (r) => r.url === `${base}/procurement/purchase-requisitions`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('budget_exceeded_blocked');
    expect(req.request.params.get('cost_center_id')).toBe('cc-1');
    expect(req.request.params.get('project_id')).toBe('proj-1');
    expect(req.request.params.get('urgency')).toBe('critical');
    expect(req.request.params.get('requester_id')).toBe('usr-1');
    expect(req.request.params.get('date_from')).toBe('2026-11-01');
    expect(req.request.params.get('date_to')).toBe('2026-11-30');
    expect(req.request.params.get('search')).toBe('PR-2026');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('per_page')).toBe('25');
    req.flush({ success: true, message: 'ok', data: [], meta: { total: 0 } });
  });

  it('creates, updates, fetches, and deletes a requisition', () => {
    const payload = {
      title: 'CNC Coolant & Tools',
      cost_center_id: 'cc-1',
      project_id: null,
      urgency: 'high' as const,
      requested_delivery_date: '2026-12-01',
      currency: 'CHF' as const,
      economic_justification: 'Prevent production stoppage',
      lines: [
        {
          item_type: 'catalog_item' as const,
          catalog_item_id: 'item-1',
          item_code: 'SKU-1',
          description: 'Coolant',
          quantity: 10,
          unit_of_measure: 'L',
          estimated_unit_price: 25,
          cost_center_id: null,
          project_id: null,
          notes: null,
        },
      ],
    };

    api.create(payload).subscribe();
    const createReq = httpTesting.expectOne(`${base}/procurement/purchase-requisitions`);
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual(payload);
    createReq.flush({ success: true, message: 'ok', data: { id: 'pr-1' } });

    api.getById('pr-1').subscribe();
    const getReq = httpTesting.expectOne(`${base}/procurement/purchase-requisitions/pr-1`);
    expect(getReq.request.method).toBe('GET');
    getReq.flush({ success: true, message: 'ok', data: { id: 'pr-1' } });

    api.update('pr-1', payload).subscribe();
    const updateReq = httpTesting.expectOne(`${base}/procurement/purchase-requisitions/pr-1`);
    expect(updateReq.request.method).toBe('PUT');
    updateReq.flush({ success: true, message: 'ok', data: { id: 'pr-1' } });

    api.delete('pr-1').subscribe();
    const deleteReq = httpTesting.expectOne(`${base}/procurement/purchase-requisitions/pr-1`);
    expect(deleteReq.request.method).toBe('DELETE');
    deleteReq.flush(null);
  });

  it('calls budget-preview, submit, approve, reject, one-click-action, pending-approvals, and convert', () => {
    const previewPayload = {
      cost_center_id: 'cc-1',
      currency: 'CHF' as const,
      exclude_requisition_id: null,
      lines: [{ quantity: 10, estimated_unit_price: 150, cost_center_id: 'cc-1' }],
    };
    api.budgetPreview(previewPayload).subscribe();
    const previewReq = httpTesting.expectOne(
      `${base}/procurement/purchase-requisitions/budget-preview`,
    );
    expect(previewReq.request.method).toBe('POST');
    expect(previewReq.request.body).toEqual(previewPayload);
    previewReq.flush({ success: true, message: 'ok', data: { status: 'ok' } });

    api.submit('pr-1').subscribe();
    const submitReq = httpTesting.expectOne(`${base}/procurement/purchase-requisitions/pr-1/submit`);
    expect(submitReq.request.method).toBe('POST');
    submitReq.flush({ success: true, message: 'ok', data: { id: 'pr-1' } });

    api.approve('pr-1', 'Approved for Q4').subscribe();
    const approveReq = httpTesting.expectOne(
      `${base}/procurement/purchase-requisitions/pr-1/approve`,
    );
    expect(approveReq.request.method).toBe('POST');
    expect(approveReq.request.body).toEqual({ comment: 'Approved for Q4', channel: 'web' });
    approveReq.flush({ success: true, message: 'ok', data: { id: 'pr-1' } });

    api.reject('pr-1', 'Insufficient justification').subscribe();
    const rejectReq = httpTesting.expectOne(`${base}/procurement/purchase-requisitions/pr-1/reject`);
    expect(rejectReq.request.method).toBe('POST');
    expect(rejectReq.request.body).toEqual({
      comment: 'Insufficient justification',
      channel: 'web',
    });
    rejectReq.flush({ success: true, message: 'ok', data: { id: 'pr-1' } });

    api.oneClickAction({ token: 'tok-abc', action: 'approve' }).subscribe();
    const oneClickReq = httpTesting.expectOne(
      `${base}/procurement/purchase-requisitions/one-click-action`,
    );
    expect(oneClickReq.request.method).toBe('POST');
    expect(oneClickReq.request.body).toEqual({ token: 'tok-abc', action: 'approve' });
    oneClickReq.flush({ success: true, message: 'ok', data: { status: 'approved' } });

    api.listPendingApprovals({ page: 1, per_page: 10 }).subscribe();
    const pendingReq = httpTesting.expectOne(
      (r) => r.url === `${base}/procurement/purchase-requisitions/pending-approvals`,
    );
    expect(pendingReq.request.method).toBe('GET');
    expect(pendingReq.request.params.get('per_page')).toBe('10');
    pendingReq.flush({ success: true, message: 'ok', data: [], meta: { total: 0 } });

    api
      .convert({
        target_type: 'po',
        supplier_id: 'sup-1',
        items: [{ requisition_line_id: 'line-1', quantity: 4 }],
      })
      .subscribe();
    const convertReq = httpTesting.expectOne(`${base}/procurement/purchase-requisitions/convert`);
    expect(convertReq.request.method).toBe('POST');
    expect(convertReq.request.body).toEqual({
      target_type: 'po',
      supplier_id: 'sup-1',
      items: [{ requisition_line_id: 'line-1', quantity: 4 }],
    });
    convertReq.flush({
      success: true,
      message: 'ok',
      data: { target_type: 'po', target_id: 'po-1' },
    });
  });

  it('normalizes Laravel Mod 044 wire resources into domain models', () => {
    let detailResult: unknown;
    api.getById('pr-wire-1').subscribe((res) => {
      detailResult = res.data;
    });
    const detailReq = httpTesting.expectOne(
      `${base}/procurement/purchase-requisitions/pr-wire-1`,
    );
    detailReq.flush({
      success: true,
      message: 'ok',
      data: {
        id: 'pr-wire-1',
        requisition_number: 'PR-2026-0440',
        title: 'Hydraulic Pump Rebuild',
        requester_user_id: 'usr-9',
        requester: { id: 'usr-9', name: 'Giulia Conti', email: 'giulia@example.ch' },
        cost_center_id: 'cc-prod',
        project_id: 'proj-9',
        project: { id: 'proj-9', project_number: 'PRJ-009', name: 'Plant Revamp' },
        urgency: 'high',
        requested_delivery_date: '2026-12-20',
        economic_justification: 'Prevent line downtime',
        currency: 'CHF',
        total_estimated_amount: '4500.00',
        status: 'pending_approval',
        current_approval_level: 2,
        lines: [
          {
            id: 'line-w1',
            line_number: 1,
            item_type: 'catalog_item',
            catalog_item_id: 'cat-9',
            description: 'High-pressure piston seal kit',
            quantity: '3.0000',
            unit_of_measure: 'SET',
            estimated_unit_price: '1500.00',
            estimated_line_total: '4500.00',
            converted_quantity: '1.0000',
            remaining_convertible_quantity: '2.0000',
          },
        ],
        approval_steps: [
          {
            level: 1,
            label: 'Department Manager',
            approver_type: 'user',
            approver_value: 'usr-2',
            status: 'approved',
            step_id: 'stp-1',
            decided_by_name: 'Marco Verdi',
            completed_at: '2026-11-20T09:00:00Z',
          },
          {
            level: 2,
            label: 'Division Director',
            approver_type: 'role',
            approver_value: 'division_director',
            status: 'pending',
            step_id: 'stp-2',
            assigned_role: 'division_director',
          },
          {
            level: 3,
            label: 'CFO',
            approver_type: 'role',
            approver_value: 'cfo',
            status: 'upcoming',
            step_id: null,
          },
        ],
        approval_logs: [
          {
            id: 'log-w1',
            approval_step_level: 1,
            approver_user_id: 'usr-2',
            approver: { id: 'usr-2', name: 'Marco Verdi', email: 'marco@example.ch' },
            action: 'approved',
            channel: 'email_one_click',
            comment: 'OK for maintenance shutdown',
            acted_at: '2026-11-20T09:00:00Z',
          },
        ],
        document_links: [
          {
            id: 'lnk-w1',
            target_document_type: 'rfq',
            target_document_id: 'rfq-44',
            target_document_number: 'RFQ-2026-0044',
            created_at: '2026-11-21T08:30:00Z',
          },
        ],
        created_at: '2026-11-19T14:00:00Z',
      },
    });
    expect(detailResult).toMatchObject({
      id: 'pr-wire-1',
      estimated_total: 4500,
      requester_id: 'usr-9',
      requester_name: 'Giulia Conti',
      project_code: 'PRJ-009',
      project_name: 'Plant Revamp',
      current_approval_tier: 2,
      lines: [
        {
          id: 'line-w1',
          mode: 'catalog',
          uom: 'SET',
          line_total: 4500,
          remaining_quantity: 2,
        },
      ],
      approval_steps: [
        { id: 'stp-1', tier_level: 1, approver_name: 'Marco Verdi', status: 'approved' },
        { id: 'stp-2', tier_level: 2, role_name: 'division_director', status: 'in_progress' },
        { id: 'step-3', tier_level: 3, role_name: 'cfo', status: 'pending' },
      ],
      approval_logs: [
        {
          id: 'log-w1',
          actor_id: 'usr-2',
          actor_name: 'Marco Verdi',
          channel: 'email_one_click',
          created_at: '2026-11-20T09:00:00Z',
        },
      ],
      document_links: [
        {
          id: 'lnk-w1',
          document_type: 'rfq',
          document_id: 'rfq-44',
          document_number: 'RFQ-2026-0044',
        },
      ],
    });

    let previewResult: unknown;
    api
      .budgetPreview({
        cost_center_id: 'cc-prod',
        currency: 'CHF',
        lines: [{ quantity: 3, estimated_unit_price: 1500, cost_center_id: 'cc-prod' }],
      })
      .subscribe((res) => {
        previewResult = res.data;
      });
    const budgetReq = httpTesting.expectOne(
      `${base}/procurement/purchase-requisitions/budget-preview`,
    );
    budgetReq.flush({
      data: {
        currency: 'CHF',
        fiscal_year: 2026,
        enforcement_policy: 'hard_block',
        has_configured_budget: true,
        allocated_budget: '10000.00',
        actual_spent: '6000.00',
        committed_amount: '1500.00',
        residual_available: '2500.00',
        requested_amount: '4500.00',
        projected_residual: '-2000.00',
        is_over_budget: true,
        overage_amount: '2000.00',
        cost_centers: [
          {
            cost_center_id: 'cc-prod',
            cost_center_code: 'CC-PROD',
            cost_center_name: 'Production',
          },
        ],
      },
    });
    expect(previewResult).toMatchObject({
      cost_center_id: 'cc-prod',
      cost_center_code: 'CC-PROD',
      allocated_budget: 10000,
      committed_amount: 7500,
      available_budget: 2500,
      requisition_amount: 4500,
      remaining_after_requisition: -2000,
      status: 'hard_block',
      is_hard_blocked: true,
    });

    let oneClickResult: unknown;
    api
      .oneClickAction({ token: 'signed-email-token-123456', action: 'approve' })
      .subscribe((res) => {
        oneClickResult = res.data;
      });
    const ocReq = httpTesting.expectOne(
      `${base}/procurement/purchase-requisitions/one-click-action`,
    );
    ocReq.flush({
      message: 'Purchase requisition approved via 1-click token.',
      data: {
        id: 'pr-wire-1',
        requisition_number: 'PR-2026-0440',
        status: 'approved',
        approved_at: '2026-11-21T11:15:00Z',
      },
    });
    expect(oneClickResult).toEqual({
      requisition_id: 'pr-wire-1',
      requisition_number: 'PR-2026-0440',
      status: 'approved',
      action: 'approve',
      message: 'Purchase requisition approved via 1-click token.',
      next_approver_name: null,
      acted_at: '2026-11-21T11:15:00Z',
    });

    let convertResult: unknown;
    api
      .convert({
        target_type: 'rfq',
        items: [{ requisition_line_id: 'line-w1', quantity: 2 }],
      })
      .subscribe((res) => {
        convertResult = res.data;
      });
    const convReq = httpTesting.expectOne(
      `${base}/procurement/purchase-requisitions/convert`,
    );
    convReq.flush({
      data: {
        target_type: 'rfq',
        target_document_id: 'rfq-501',
        target_document_number: 'RFQ-2026-0501',
        links: [{ id: 'lnk-1' }],
      },
    });
    expect(convertResult).toMatchObject({
      target_type: 'rfq',
      target_id: 'rfq-501',
      target_document_id: 'rfq-501',
      target_number: 'RFQ-2026-0501',
      rfq_id: 'rfq-501',
      converted_line_count: 1,
    });
  });
});
