import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { PlmApiService, PlmChangeOrder, PlmItemRevision, SettingsApiService, TranslateService } from '@core';
import { PlmChangeOrderDetailComponent } from './plm-change-order-detail.component';
import { PlmChangeOrdersComponent } from './plm-change-orders.component';
import { PlmRevisionsComponent } from './plm-revisions.component';
import { apiErrorText, blankToNull } from './plm.util';

const order: PlmChangeOrder = {
  id: 'co-1',
  code: 'ECO-1',
  title: 'Replace the bearing',
  reason: 'Discontinued',
  change_type: 'material',
  priority: 'high',
  status: 'in_review',
  requested_by: null,
  effective_date: null,
  submitted_at: null,
  decided_at: null,
  implemented_at: null,
  rejection_reason: null,
  notes: null,
  approvals: [{ id: 'ap-1', approver_id: 'u-1', approver_name: 'Owner', sequence: 1, status: 'pending', decided_at: null, comment: null }],
  affected_items: [{ id: 'ai-1', mfg_item_id: 'it-1', item_code: 'BRG-1', item_name: 'Bearing', to_revision: 'B', change_summary: null }],
  affected_boms: [{ id: 'ab-1', bom_id: 'bm-1', bom_number: 'BOM-1', bom_name: 'Pump', bom_revision: 'A', bom_status: 'active', note: null }],
};

const revision: PlmItemRevision = {
  id: 'rv-1',
  mfg_item_id: 'it-1',
  item: { id: 'it-1', item_code: 'BRG-1', name: 'Bearing' },
  revision: 'A',
  status: 'draft',
  change_summary: null,
  change_order_id: null,
  effective_from: null,
  released_at: null,
  obsoleted_at: null,
};

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };
const settingsSpy = { getTenantUsers: vi.fn() };

function configure(api: Record<string, unknown>): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: PlmApiService, useValue: api },
      { provide: SettingsApiService, useValue: settingsSpy },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'co-1' }) } } },
      provideNzIcons(icons),
    ],
  });
}

describe('plm util', () => {
  it('reads the first validation message of a 422 and blanks to null', () => {
    expect(apiErrorText(new HttpErrorResponse({ status: 422, error: { errors: { change_order: ['It is not your turn'] } } }))).toBe('It is not your turn');
    expect(apiErrorText(new Error('boom'))).toBeNull();
    expect(blankToNull(' ')).toBeNull();
  });
});

describe('PlmChangeOrdersComponent', () => {
  const api = { getChangeOrders: vi.fn(), createChangeOrder: vi.fn(), getItemOptions: vi.fn(), getBomOptions: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getChangeOrders.mockReturnValue(of({ data: [order] }));
    api.createChangeOrder.mockReturnValue(of({ data: order }));
    api.getItemOptions.mockReturnValue(of([{ id: 'it-1', label: 'BRG-1 - Bearing' }]));
    api.getBomOptions.mockReturnValue(of([{ id: 'bm-1', label: 'BOM-1' }]));
    settingsSpy.getTenantUsers.mockReturnValue(of({ data: [{ id: 'u-1', name: 'Owner', email: 'o@example.org' }] }));
    configure(api);
  });

  it('lists the orders and filters by status and by the decision awaited from the user', () => {
    const fixture = TestBed.createComponent(PlmChangeOrdersComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance.orders()).toEqual([order]);
    expect(fixture.componentInstance.users()).toEqual([{ id: 'u-1', label: 'Owner (o@example.org)' }]);

    fixture.componentInstance.statusFilter.set('approved');
    fixture.componentInstance.awaitingMe.set(true);
    fixture.componentInstance.load();
    expect(api.getChangeOrders).toHaveBeenLastCalledWith({ status: 'approved', awaiting_me: true, per_page: 100 });
  });

  it('creates an order with approvers, an affected item and bills of material', () => {
    const fixture = TestBed.createComponent(PlmChangeOrdersComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.patchValue({ code: 'ECO-1', title: 'Replace the bearing', reason: 'Discontinued', approvers: ['u-1'], item_id: 'it-1', to_revision: ' B ', bom_ids: ['bm-1'] });
    component.save();

    expect(api.createChangeOrder).toHaveBeenCalledWith({
      code: 'ECO-1',
      title: 'Replace the bearing',
      reason: 'Discontinued',
      change_type: 'design',
      priority: 'normal',
      effective_date: null,
      approvers: ['u-1'],
      affected_items: [{ mfg_item_id: 'it-1', to_revision: 'B' }],
      affected_boms: [{ bom_id: 'bm-1' }],
    });
    expect(messageSpy.success).toHaveBeenCalledWith('PLM.ORDER_SAVED');
  });

  it('sends no affected item when the revision is left empty', () => {
    const fixture = TestBed.createComponent(PlmChangeOrdersComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.patchValue({ code: 'ECO-2', title: 'T', reason: 'R', item_id: 'it-1', to_revision: '' });
    component.save();

    expect(api.createChangeOrder).toHaveBeenCalledWith(expect.objectContaining({ affected_items: [] }));
  });
});

describe('PlmChangeOrderDetailComponent', () => {
  const api = { getChangeOrder: vi.fn(), submitChangeOrder: vi.fn(), decideChangeOrder: vi.fn(), cancelChangeOrder: vi.fn(), implementChangeOrder: vi.fn(), deleteChangeOrder: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getChangeOrder.mockReturnValue(of({ data: order }));
    api.submitChangeOrder.mockReturnValue(of({ data: { ...order, status: 'in_review' } }));
    api.decideChangeOrder.mockReturnValue(of({ data: { ...order, status: 'approved' } }));
    api.implementChangeOrder.mockReturnValue(of({ data: { ...order, status: 'implemented' } }));
    api.cancelChangeOrder.mockReturnValue(of({ data: { ...order, status: 'cancelled' } }));
    configure(api);
  });

  it('loads the order and approves with a comment', () => {
    const fixture = TestBed.createComponent(PlmChangeOrderDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(api.getChangeOrder).toHaveBeenCalledWith('co-1');

    component.openDecision('approve');
    component.comment.set(' fine ');
    component.decide();

    expect(api.decideChangeOrder).toHaveBeenCalledWith('co-1', { decision: 'approve', comment: 'fine' });
    expect(component.order()?.status).toBe('approved');
    expect(component.decisionVisible()).toBe(false);
  });

  it('shows the API refusal of a rejection without comment', () => {
    api.decideChangeOrder.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { comment: ['A rejection needs a comment.'] } } })));
    const fixture = TestBed.createComponent(PlmChangeOrderDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance.openDecision('reject');
    fixture.componentInstance.decide();

    expect(api.decideChangeOrder).toHaveBeenCalledWith('co-1', { decision: 'reject', comment: null });
    expect(messageSpy.error).toHaveBeenCalledWith('A rejection needs a comment.');
  });

  it('submits, implements and cancels through the action endpoints', () => {
    const fixture = TestBed.createComponent(PlmChangeOrderDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.submit();
    component.implement();
    component.cancel();

    expect(api.submitChangeOrder).toHaveBeenCalledWith('co-1');
    expect(api.implementChangeOrder).toHaveBeenCalledWith('co-1');
    expect(api.cancelChangeOrder).toHaveBeenCalledWith('co-1');
    expect(messageSpy.success).toHaveBeenCalledWith('PLM.IMPLEMENTED');
  });
});

describe('PlmRevisionsComponent', () => {
  const api = { getRevisions: vi.fn(), createRevision: vi.fn(), updateRevision: vi.fn(), releaseRevision: vi.fn(), obsoleteRevision: vi.fn(), deleteRevision: vi.fn(), getItemOptions: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getRevisions.mockReturnValue(of({ data: [revision] }));
    api.createRevision.mockReturnValue(of({ data: revision }));
    api.releaseRevision.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { revision: ['The item already has a released revision.'] } } })));
    api.obsoleteRevision.mockReturnValue(of({ data: { ...revision, status: 'obsolete' } }));
    api.getItemOptions.mockReturnValue(of([{ id: 'it-1', label: 'BRG-1 - Bearing' }]));
    configure(api);
  });

  it('lists the revisions by status and creates a draft for an item', () => {
    const fixture = TestBed.createComponent(PlmRevisionsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.revisions()).toEqual([revision]);

    component.statusFilter.set('released');
    component.load();
    expect(api.getRevisions).toHaveBeenLastCalledWith({ status: 'released', per_page: 100 });

    component.openModal();
    component.form.patchValue({ mfg_item_id: 'it-1', revision: 'A', change_summary: '' });
    component.save();
    expect(api.createRevision).toHaveBeenCalledWith({ revision: 'A', effective_from: null, change_summary: null, mfg_item_id: 'it-1' });
  });

  it('shows the API refusal of a second release and makes a revision obsolete', () => {
    const fixture = TestBed.createComponent(PlmRevisionsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.release(revision);
    expect(messageSpy.error).toHaveBeenCalledWith('The item already has a released revision.');

    component.obsolete(revision);
    expect(api.obsoleteRevision).toHaveBeenCalledWith('rv-1');
    expect(messageSpy.success).toHaveBeenCalledWith('PLM.MADE_OBSOLETE');
  });
});
