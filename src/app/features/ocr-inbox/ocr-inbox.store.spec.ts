import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OcrInboxApiService } from './ocr-inbox-api.service';
import { OcrInboxStore } from './ocr-inbox.store';
import { pageFixture, workbenchFixture } from './ocr-inbox.testing';
import { ReviewedPayload } from './ocr-inbox.models';

const ok = <T>(data: T) => of({ success: true, message: '', data });
const job = {
  id: 'job-1',
  dms_document_id: 'doc-1',
  status: 'confirmed' as const,
  document_category: 'vendor_invoice' as const,
  resulting_entity_type: 'supplier_invoice',
  resulting_entity_id: 'inv-1',
};

const reviewed: ReviewedPayload = {
  vendor_id: 'v-1',
  header: {
    number: 'R-1',
    issue_date: '2026-03-05',
    due_date: null,
    currency: 'CHF',
    qr_reference: null,
  },
  totals: { net: 1, vat: 0, gross: 1 },
  lines: [],
  purchase_order_ids: [],
  goods_receipt_ids: [],
};

describe('OcrInboxStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: OcrInboxStore;

  beforeEach(() => {
    api = {
      inbox: vi.fn(() => ok(pageFixture())),
      workbench: vi.fn(() => ok(workbenchFixture())),
      saveDraft: vi.fn(() => ok({ ...job, status: 'ready_for_review' })),
      confirm: vi.fn(() => ok(job)),
      reject: vi.fn(() => ok({ ...job, status: 'rejected' })),
      rerun: vi.fn(() => ok({ ...job, status: 'queued' })),
    };
    TestBed.configureTestingModule({ providers: [{ provide: OcrInboxApiService, useValue: api }] });
    store = TestBed.inject(OcrInboxStore);
  });

  it('loads the queue with its counters and the paging', () => {
    store.setStatusFilter('failed');
    store.loadQueue(2).subscribe();

    expect(api['inbox']).toHaveBeenCalledWith({ status: 'failed', page: 2, perPage: 25 });
    expect(store.items()).toHaveLength(2);
    expect(store.counters()).toEqual({ queued: 1, processing: 0, ready_for_review: 2, failed: 1 });
    expect(store.inboxTotal()).toBe(4);
    expect(store.meta()?.total).toBe(2);
    expect(store.loading()).toBe(false);
  });

  it('opens a job with a clean focus and exposes its boxes and confidence', () => {
    store.focusField('header.document_number');
    store.select('job-1').subscribe();

    expect(api['workbench']).toHaveBeenCalledWith('job-1');
    expect(store.selectedId()).toBe('job-1');
    expect(store.activeFieldKey()).toBeNull();
    expect(Object.keys(store.boxes())).toContain('header.document_number');
    expect(store.confidence()['totals.gross']).toBe(100);
    expect(store.canReview()).toBe(true);
    expect(store.activeBox()).toBeNull();
  });

  it('treats the empty PHP array of boxes as no boxes', () => {
    api['workbench'].mockReturnValue(ok(workbenchFixture({ bounding_boxes: [] })));
    store.select('job-1').subscribe();

    expect(store.boxes()).toEqual({});
  });

  it('clears the workbench when it cannot be loaded', () => {
    store.select('job-1').subscribe();
    api['workbench'].mockReturnValue(throwError(() => new Error('boom')));
    store.select('job-2').subscribe({ error: () => undefined });

    expect(store.workbench()).toBeNull();
    expect(store.loadingWorkbench()).toBe(false);
  });

  it('keeps the form and the document in step through the active field', () => {
    store.select('job-1').subscribe();
    const tick = store.focusTick();

    store.focusField('lines[0].unit_price');

    expect(store.activeFieldKey()).toBe('lines[0].unit_price');
    expect(store.activeBox()).toEqual({ page: 1, x: 0.7, y: 0.45, width: 0.1, height: 0.02 });
    expect(store.focusTick()).toBe(tick + 1);

    store.focusField('lines[0].unit_price');
    expect(store.focusTick()).toBe(tick + 2);

    store.focusField(null);
    expect(store.activeFieldKey()).toBeNull();
    expect(store.focusTick()).toBe(tick + 2);
  });

  it('lets a drawn region replace the box of the engine, until another document is opened', () => {
    store.select('job-1').subscribe();
    store.assignRegion('header.document_number', {
      page: 1,
      x: 0.5,
      y: 0.5,
      width: 0.1,
      height: 0.1,
    });

    expect(store.boxes()['header.document_number']).toEqual({
      page: 1,
      x: 0.5,
      y: 0.5,
      width: 0.1,
      height: 0.1,
    });
    expect(store.activeFieldKey()).toBe('header.document_number');

    store.select('job-1').subscribe();
    expect(store.boxes()['header.document_number']?.x).toBe(0.1);
  });

  it('saves a draft without reloading, and reloads the queue and the workbench after a confirmation', () => {
    store.select('job-1').subscribe();
    api['inbox'].mockClear();
    api['workbench'].mockClear();

    store.saveDraft(reviewed).subscribe();
    expect(api['saveDraft']).toHaveBeenCalledWith('job-1', reviewed);
    expect(api['inbox']).not.toHaveBeenCalled();

    store.confirm(reviewed).subscribe();
    expect(api['confirm']).toHaveBeenCalledWith('job-1', reviewed);
    expect(api['inbox']).toHaveBeenCalledTimes(1);
    expect(api['workbench']).toHaveBeenCalledTimes(1);
    expect(store.busy()).toBe(false);
  });

  it('rejects with a reason and runs the extraction again', () => {
    store.select('job-1').subscribe();

    store.reject('Not for us').subscribe();
    expect(api['reject']).toHaveBeenCalledWith('job-1', 'Not for us');

    store.rerun().subscribe();
    expect(api['rerun']).toHaveBeenCalledWith('job-1');
  });

  it('is not busy after a failed action and keeps the error for the caller', () => {
    store.select('job-1').subscribe();
    api['confirm'].mockReturnValue(throwError(() => new Error('422')));
    let failed = false;

    store.confirm(reviewed).subscribe({ error: () => (failed = true) });

    expect(failed).toBe(true);
    expect(store.busy()).toBe(false);
  });

  it('refuses an action when no document is open', () => {
    expect(() => store.confirm(reviewed)).toThrow('No document is selected.');
  });

  it('refreshes the queue and the open workbench when the server announces a document', () => {
    store.select('job-1').subscribe();
    api['inbox'].mockClear();
    api['workbench'].mockClear();

    store.onServerEvent('job-9').subscribe();
    expect(api['inbox']).toHaveBeenCalledTimes(1);
    expect(api['workbench']).not.toHaveBeenCalled();

    store.onServerEvent('job-1').subscribe();
    expect(api['workbench']).toHaveBeenCalledWith('job-1');
  });

  it('closes the workbench', () => {
    store.select('job-1').subscribe();
    store.clearSelection();

    expect(store.workbench()).toBeNull();
    expect(store.selectedId()).toBeNull();
  });
});
