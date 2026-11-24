import { TestBed } from '@angular/core/testing';
import { PurchaseOrderFulfilmentApiService } from '@data-access/procurement/purchase-order-fulfilment-api.service';
import { Dropshipment, OverdueOrderRow } from '@domain/procurement/purchase-order-fulfilment.models';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PurchaseOrderFulfilmentStore } from './purchase-order-fulfilment.store';

const overdueRow = (id: string): OverdueOrderRow => ({
  order: { id, po_number: `PO-${id}`, status: 'sent' },
  days_overdue: 5,
  overdue_line_ids: ['l-1'],
  reminder_count: 1,
  last_reminder_at: null,
  next_reminder_due: null,
});

const dropship = (status: Dropshipment['status']): Dropshipment => ({ id: 'd-1', status }) as Dropshipment;

describe('PurchaseOrderFulfilmentStore', () => {
  const api = {
    listOverdue: vi.fn(),
    sendReminder: vi.fn(),
    runReminders: vi.fn(),
    listConfirmations: vi.fn(),
    recordConfirmation: vi.fn(),
    dispatch: vi.fn(),
    listDispatches: vi.fn(),
    listReminders: vi.fn(),
    listDropshipments: vi.fn(),
    getDropshipment: vi.fn(),
    createDropshipment: vi.fn(),
    issueDdt: vi.fn(),
    recordDelivery: vi.fn(),
  };
  let store: InstanceType<typeof PurchaseOrderFulfilmentStore>;

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: PurchaseOrderFulfilmentApiService, useValue: api }] });
    store = TestBed.inject(PurchaseOrderFulfilmentStore);
  });

  it('loads overdue orders and counts them', () => {
    api.listOverdue.mockReturnValue(of([overdueRow('1'), overdueRow('2')]));
    store.loadOverdue().subscribe();
    expect(store.overdueCount()).toBe(2);
    expect(store.loading()).toBe(false);
  });

  it('keeps the error and an empty list when the overdue request fails', () => {
    api.listOverdue.mockReturnValue(throwError(() => ({ error: { message: 'boom' } })));
    store.loadOverdue().subscribe();
    expect(store.overdue()).toEqual([]);
    expect(store.error()).toBe('boom');
  });

  it('increments the reminder count of the reminded order', () => {
    api.listOverdue.mockReturnValue(of([overdueRow('1'), overdueRow('2')]));
    api.sendReminder.mockReturnValue(of({ id: 'r-1', sent_at: '2026-11-23T10:00:00Z' }));
    store.loadOverdue().subscribe();
    store.sendReminder('2').subscribe();
    const rows = store.overdue();
    expect(rows[0].reminder_count).toBe(1);
    expect(rows[1].reminder_count).toBe(2);
    expect(rows[1].last_reminder_at).toBe('2026-11-23T10:00:00Z');
    expect(store.busy()).toBe(false);
  });

  it('prepends a recorded confirmation and flags reviews', () => {
    api.recordConfirmation.mockReturnValue(of({ id: 'c-1', requires_review: true }));
    store.recordConfirmation('po-1', { confirmation_number: 'C-1' }).subscribe();
    expect(store.latestConfirmation()?.id).toBe('c-1');
    expect(store.confirmationsNeedingReview()).toBe(1);
  });

  it('rethrows mutation errors after storing the message', () => {
    api.dispatch.mockReturnValue(throwError(() => ({ error: { message: 'no channel' } })));
    let failed = false;
    store.dispatch('po-1', { channel: 'edi' }).subscribe({ error: () => (failed = true) });
    expect(failed).toBe(true);
    expect(store.error()).toBe('no channel');
    expect(store.busy()).toBe(false);
  });

  it('loads dropshipments with their total and updates one after the DDT', () => {
    api.listDropshipments.mockReturnValue(of({ data: [dropship('pending')], meta: { total: 7 } }));
    api.getDropshipment.mockReturnValue(of(dropship('pending')));
    api.issueDdt.mockReturnValue(of(dropship('ddt_issued')));
    store.loadDropshipments().subscribe();
    store.loadDropshipment('d-1').subscribe();
    expect(store.dropshipTotal()).toBe(7);
    store.issueDdt('d-1', { carrier: 'DHL' }).subscribe();
    expect(store.selectedDropship()?.status).toBe('ddt_issued');
    expect(store.dropshipments()[0].status).toBe('ddt_issued');
  });

  it('updates the selected dropshipment after a delivery', () => {
    api.recordDelivery.mockReturnValue(of(dropship('delivered')));
    store.recordDelivery('d-1', {}).subscribe();
    expect(store.selectedDropship()?.status).toBe('delivered');
  });
});
