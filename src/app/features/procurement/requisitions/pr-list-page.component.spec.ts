import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthStore } from '@core/auth/auth.store';
import { I18nService } from '@core/i18n';
import { PurchaseRequisitionApiService } from '@data-access/procurement/purchase-requisition-api.service';
import { PurchaseRequisitionSummary } from '@domain/procurement/purchase-requisition.models';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { PrListPageComponent } from './pr-list-page.component';
import { PurchaseRequisitionStore } from './purchase-requisition.store';

describe('PrListPageComponent', () => {
  let fixture: ComponentFixture<PrListPageComponent>;
  let component: PrListPageComponent;
  let apiMock: {
    list: ReturnType<typeof vi.fn>;
    listPendingApprovals: ReturnType<typeof vi.fn>;
    listCostCenters: ReturnType<typeof vi.fn>;
    listProjects: ReturnType<typeof vi.fn>;
    listRequesters: ReturnType<typeof vi.fn>;
    listQualifiedSuppliers: ReturnType<typeof vi.fn>;
    approve: ReturnType<typeof vi.fn>;
    reject: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    getById: ReturnType<typeof vi.fn>;
  };

  const sampleRows: PurchaseRequisitionSummary[] = [
    {
      id: 'pr-1',
      requisition_number: 'PR-2026-0010',
      title: 'Lab Oscilloscope',
      status: 'budget_exceeded_blocked',
      urgency: 'critical',
      currency: 'CHF',
      estimated_total: 9200,
      requested_delivery_date: '2026-12-15',
      requester_id: 'usr-1',
      requester_name: 'Marco Rossi',
      cost_center_id: 'cc-1',
      cost_center_code: 'CC-RD',
      project_id: 'proj-1',
      project_code: 'PRJ-09',
      document_links: [
        {
          id: 'lnk-1',
          document_type: 'rfq',
          document_id: 'rfq-1',
          document_number: 'RFQ-2026-0005',
          status: 'awarded',
          created_at: '2026-11-20T10:00:00Z',
        },
        {
          id: 'lnk-2',
          document_type: 'po',
          document_id: 'po-1',
          document_number: 'PO-2026-0033',
          status: 'sent',
          created_at: '2026-11-21T10:00:00Z',
        },
      ],
      created_at: '2026-11-18T08:00:00Z',
    },
  ];

  const pendingRows: PurchaseRequisitionSummary[] = [
    {
      id: 'pr-2',
      requisition_number: 'PR-2026-0011',
      title: 'Safety Gear',
      status: 'pending_approval',
      urgency: 'high',
      currency: 'EUR',
      estimated_total: 1250,
      requested_delivery_date: '2026-12-01',
      requester_id: 'usr-2',
      requester_name: 'Elena Bianchi',
      cost_center_id: 'cc-1',
      cost_center_code: 'CC-RD',
      can_approve: true,
      created_at: '2026-11-19T08:00:00Z',
    },
  ];

  beforeEach(() => {
    apiMock = {
      list: vi.fn().mockReturnValue(of({ data: sampleRows, meta: { total: 1, current_page: 1 } })),
      listPendingApprovals: vi
        .fn()
        .mockReturnValue(of({ data: pendingRows, meta: { total: 3, current_page: 1 } })),
      listCostCenters: vi.fn().mockReturnValue(of([])),
      listProjects: vi.fn().mockReturnValue(of([])),
      listRequesters: vi.fn().mockReturnValue(of([])),
      listQualifiedSuppliers: vi.fn().mockReturnValue(of([])),
      approve: vi.fn().mockReturnValue(of({ data: { ...pendingRows[0], status: 'approved' } })),
      reject: vi.fn().mockReturnValue(of({ data: { ...pendingRows[0], status: 'rejected' } })),
      delete: vi.fn().mockReturnValue(of(undefined)),
      getById: vi.fn().mockReturnValue(
        of({
          data: {
            ...sampleRows[0],
            lines: [],
            budget_check_snapshot: null,
            approval_steps: [],
            approval_logs: [],
            document_links: sampleRows[0].document_links ?? [],
          },
        }),
      ),
    };

    TestBed.configureTestingModule({
      imports: [PrListPageComponent],
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
            user: signal({ id: 'usr-1', name: 'Marco Rossi' }),
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

    const store = TestBed.inject(PurchaseRequisitionStore);
    store.setTab('mine');
    store.resetFilters();

    fixture = TestBed.createComponent(PrListPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads My Requisitions, pending approval badge count, budget-blocked status tag, and RDO/PO badges', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(apiMock.list).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'mine', requester_id: 'usr-1' }),
    );
    expect(component.store.pendingApprovalCount()).toBe(3);
    expect(text).toContain('PR-2026-0010');
    expect(text).toContain('PR.STATUS_BUDGET_EXCEEDED_BLOCKED');
    expect(text).toContain('RDO: RFQ-2026-0005');
    expect(text).toContain('PO: PO-2026-0033');
  });

  it('switches to Pending My Approval tab and executes quick approve', () => {
    component.onTabIndexChange(2);
    fixture.detectChanges();

    expect(component.store.activeTab()).toBe('pending_approval');
    expect(apiMock.listPendingApprovals).toHaveBeenCalled();

    component.quickApprove(pendingRows[0]);
    expect(apiMock.approve).toHaveBeenCalledWith('pr-2');
  });

  it('filters by cost center and urgency and resets filters cleanly', () => {
    component.onCostCenterChange('cc-1');
    component.onUrgencyChange('critical');

    expect(apiMock.list).toHaveBeenLastCalledWith(
      expect.objectContaining({ cost_center_id: 'cc-1', urgency: 'critical' }),
    );
    expect(component.store.hasActiveFilters()).toBe(true);

    component.resetAllFilters();
    expect(component.store.hasActiveFilters()).toBe(false);
  });
});
