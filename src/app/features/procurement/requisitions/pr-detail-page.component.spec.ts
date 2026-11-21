import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthStore } from '@core/auth/auth.store';
import { I18nService } from '@core/i18n';
import { PurchaseRequisitionApiService } from '@data-access/procurement/purchase-requisition-api.service';
import { PurchaseRequisitionDetail } from '@domain/procurement/purchase-requisition.models';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { PrDetailPageComponent } from './pr-detail-page.component';

function buildRequisitionDetail(
  overrides: Partial<PurchaseRequisitionDetail> = {},
): PurchaseRequisitionDetail {
  return {
    id: 'pr-1',
    requisition_number: 'PR-2026-0042',
    title: 'CNC Precision Spindles',
    status: 'pending_approval',
    urgency: 'high',
    currency: 'CHF',
    estimated_total: 6500,
    requested_delivery_date: '2026-12-10',
    requester_id: 'usr-requester',
    requester_name: 'Elena Bianchi',
    cost_center_id: 'cc-1',
    cost_center_code: 'CC-PROD',
    cost_center_name: 'Production',
    project_id: 'proj-1',
    project_code: 'PRJ-09',
    project_name: 'Line Upgrade',
    economic_justification: 'Prevent unplanned spindle downtime',
    can_approve: true,
    created_at: '2026-11-20T09:15:00Z',
    lines: [
      {
        id: 'line-1',
        line_number: 1,
        mode: 'catalog',
        catalog_item_id: 'cat-1',
        item_code: 'SPD-400',
        description: 'High-Speed Spindle',
        quantity: 2,
        converted_quantity: 0,
        remaining_quantity: 2,
        uom: 'PCS',
        estimated_unit_price: 3250,
        line_total: 6500,
      },
    ],
    budget_check_snapshot: {
      cost_center_id: 'cc-1',
      currency: 'CHF',
      allocated_budget: 25000,
      committed_amount: 10000,
      available_budget: 15000,
      requisition_amount: 6500,
      remaining_after_requisition: 8500,
      utilization_percent: 66,
      status: 'ok',
    },
    approval_steps: [
      {
        id: 'step-1',
        tier_level: 1,
        tier_name: 'Department Manager',
        role_name: 'Dept Head',
        approver_name: 'Laura Verdi',
        status: 'approved',
        threshold_amount: 5000,
        decided_at: '2026-11-20T10:30:00Z',
      },
      {
        id: 'step-2',
        tier_level: 2,
        tier_name: 'Division Director',
        role_name: 'Director',
        approver_name: 'Marco Rossi',
        status: 'in_progress',
        threshold_amount: 10000,
        decided_at: null,
      },
      {
        id: 'step-3',
        tier_level: 3,
        tier_name: 'CFO / CEO',
        role_name: 'CFO',
        approver_name: null,
        status: 'pending',
        threshold_amount: 25000,
        decided_at: null,
      },
    ],
    approval_logs: [
      {
        id: 'log-1',
        action: 'submitted',
        actor_name: 'Elena Bianchi',
        channel: 'web',
        comment: 'Urgent replacement order',
        created_at: '2026-11-20T09:20:00Z',
      },
      {
        id: 'log-2',
        action: 'approved',
        actor_name: 'Laura Verdi',
        channel: 'email_one_click',
        comment: 'Approved within Q4 maintenance budget',
        created_at: '2026-11-20T10:30:00Z',
      },
    ],
    document_links: [
      {
        id: 'link-1',
        document_type: 'rfq',
        document_id: 'rfq-1',
        document_number: 'RFQ-2026-0011',
        status: 'bidding_open',
        created_at: '2026-11-21T08:00:00Z',
      },
      {
        id: 'link-2',
        document_type: 'po',
        document_id: 'po-1',
        document_number: 'PO-2026-0088',
        status: 'approved',
        created_at: '2026-11-21T11:00:00Z',
      },
    ],
    ...overrides,
  };
}

describe('PrDetailPageComponent', () => {
  let fixture: ComponentFixture<PrDetailPageComponent>;
  let component: PrDetailPageComponent;
  let apiMock: {
    getById: ReturnType<typeof vi.fn>;
    approve: ReturnType<typeof vi.fn>;
    reject: ReturnType<typeof vi.fn>;
    listPendingApprovals: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    const initial = buildRequisitionDetail();
    apiMock = {
      getById: vi.fn().mockReturnValue(of({ data: initial })),
      approve: vi.fn().mockReturnValue(
        of({ data: buildRequisitionDetail({ status: 'approved', can_approve: false }) }),
      ),
      reject: vi.fn().mockReturnValue(
        of({ data: buildRequisitionDetail({ status: 'rejected', can_approve: false }) }),
      ),
      listPendingApprovals: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0 } })),
    };

    TestBed.configureTestingModule({
      imports: [PrDetailPageComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: PurchaseRequisitionApiService, useValue: apiMock },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn(), info: vi.fn() } },
        {
          provide: AuthStore,
          useValue: {
            activeCurrency: signal<'CHF'>('CHF'),
            user: signal({ id: 'usr-approver', name: 'Marco Rossi' }),
          },
        },
        {
          provide: I18nService,
          useValue: {
            currentLanguage: signal<'en'>('en'),
            translate: vi.fn((key: string) => key),
          },
        },
      ],
    });

    fixture = TestBed.createComponent(PrDetailPageComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('requisitionIdInput', 'pr-1');
    fixture.detectChanges();
  });

  it('renders multi-level approval steps, immutable audit timeline channels, and linked RDO/PO badges', () => {
    const el = fixture.nativeElement as HTMLElement;
    const stepsText = el.querySelector('[data-testid="pr-approval-steps"]')?.textContent ?? '';
    expect(stepsText).toContain('Department Manager');
    expect(stepsText).toContain('Division Director');
    expect(stepsText).toContain('CFO / CEO');

    const timelineText = el.querySelector('[data-testid="pr-audit-timeline"]')?.textContent ?? '';
    expect(timelineText).toContain('Laura Verdi');
    expect(timelineText).toContain('PR.CHANNEL_EMAIL_ONE_CLICK');
    expect(timelineText).toContain('Approved within Q4 maintenance budget');

    const docsText = el.querySelector('[data-testid="pr-linked-documents"]')?.textContent ?? '';
    expect(docsText).toContain('RFQ-2026-0011');
    expect(docsText).toContain('PO-2026-0088');
  });

  it('executes 1-click approve from sticky action bar and updates requisition status', () => {
    const approveBtn = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="pr-detail-approve-btn"]',
    ) as HTMLButtonElement | null;
    expect(approveBtn).not.toBeNull();

    approveBtn?.click();
    fixture.detectChanges();

    expect(apiMock.approve).toHaveBeenCalledWith('pr-1');
    expect(component.detail()?.status).toBe('approved');
  });

  it('requires a valid rejection reason before calling reject API', () => {
    component.openRejectModal();
    component.rejectForm.controls.reason.setValue('no');
    component.confirmReject();

    expect(component.rejectForm.invalid).toBe(true);
    expect(apiMock.reject).not.toHaveBeenCalled();

    component.rejectForm.controls.reason.setValue('Cost exceeds department quarterly allocation');
    component.confirmReject();

    expect(apiMock.reject).toHaveBeenCalledWith(
      'pr-1',
      'Cost exceeds department quarterly allocation',
    );
    expect(component.detail()?.status).toBe('rejected');
  });
});
