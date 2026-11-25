import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DebtCollectionApiService } from '@core';
import { batch, notice, pageMeta, wrap } from './debt-collection.testing';
import { NoticesStore } from './notices.store';

describe('NoticesStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof NoticesStore>;
  let downloads: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    downloads = [];
    URL.createObjectURL = vi.fn(() => 'blob:file');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      downloads.push(this.download);
    });
    api = {
      listNotices: vi.fn(() =>
        of({ success: true, message: 'ok', data: [notice('1'), notice('2')], meta: pageMeta }),
      ),
      getNotice: vi.fn((id: string) => of(wrap(notice(id, { channel: 'pec', status: 'sent' })))),
      sendNotice: vi.fn((id: string) => of(wrap(notice(id, { status: 'sent' })))),
      cancelNotice: vi.fn((id: string) => of(wrap(notice(id, { status: 'cancelled' })))),
      registerReceipt: vi.fn(() => of(wrap({}))),
      downloadNoticePdf: vi.fn(() => of(new Blob(['pdf']))),
      exportNotice: vi.fn(() => of(new Blob(['zip']))),
      listBatches: vi.fn(() =>
        of({ success: true, message: 'ok', data: [batch('b-1')], meta: pageMeta }),
      ),
      getBatch: vi.fn(() => of(wrap({ ...batch('b-1'), notices: [notice('1')] }))),
      retryBatch: vi.fn(() => of(wrap(batch('b-1')))),
    };
    TestBed.configureTestingModule({
      providers: [NoticesStore, { provide: DebtCollectionApiService, useValue: api }],
    });
    store = TestBed.inject(NoticesStore);
  });

  it('loads the notices with the pagination', async () => {
    await store.load();

    expect(store.notices()).toHaveLength(2);
    expect(store.total()).toBe(2);
    expect(store.page()).toBe(1);
  });

  it('applies a filter from the first page and keeps the others', async () => {
    await store.setFilters({ status: 'failed' });
    await store.setPage(2);

    const calls = api['listNotices']?.mock.calls as Record<string, unknown>[][];
    expect(calls[0]?.[0]).toEqual({ page: 1, status: 'failed' });
    expect(calls[1]?.[0]).toEqual({ page: 2, status: 'failed' });
  });

  it('opens the detail of a notice with its receipts', async () => {
    await store.openDetail('1');

    expect(store.detail()?.id).toBe('1');
    store.closeDetail();
    expect(store.detail()).toBeNull();
  });

  it('sends a notice and replaces it in the list and in the drawer', async () => {
    await store.load();
    await store.openDetail('1');

    const outcome = await store.send('1', 'email');

    expect(outcome.ok).toBe(true);
    expect(api['sendNotice']).toHaveBeenCalledWith('1', 'email');
    expect(store.notices().find((row) => row.id === '1')?.status).toBe('sent');
    expect(store.detail()?.status).toBe('sent');
    expect(store.busyId()).toBeNull();
  });

  it('cancels a notice', async () => {
    await store.load();

    await store.cancel('2');

    expect(store.notices().find((row) => row.id === '2')?.status).toBe('cancelled');
  });

  it('registers a PEC receipt and re-reads the notice', async () => {
    await store.load();

    const outcome = await store.registerReceipt('1', {
      kind: 'consegna',
      received_at: '2026-05-06T10:00:00Z',
    });

    expect(outcome.ok).toBe(true);
    expect(api['registerReceipt']).toHaveBeenCalledWith('1', {
      kind: 'consegna',
      received_at: '2026-05-06T10:00:00Z',
    });
    expect(api['getNotice']).toHaveBeenCalledWith('1');
    expect(store.notices().find((row) => row.id === '1')?.channel).toBe('pec');
  });

  it('answers the refusal of the API with its error key', async () => {
    api['sendNotice']?.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { code: 'notice_not_sendable' } }),
      ),
    );

    const outcome = await store.send('1');

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('debtCollection.error.notice_not_sendable');
    expect(store.busyId()).toBeNull();
  });

  it('downloads the PDF and the PEC export package under the number of the notice', async () => {
    await store.downloadPdf(notice('1'));
    await store.exportPackage(notice('1'));

    expect(downloads).toEqual(['SOL-1.pdf', 'SOL-1.zip']);
  });

  it('loads the batches, opens one and retries the failed notices', async () => {
    await store.loadBatches();
    expect(store.batches()).toHaveLength(1);

    await store.openBatch('b-1');
    expect(store.batchDetail()?.notices).toHaveLength(1);
    store.closeBatch();
    expect(store.batchDetail()).toBeNull();

    const outcome = await store.retryBatch('b-1');

    expect(outcome.ok).toBe(true);
    expect(api['retryBatch']).toHaveBeenCalledWith('b-1');
    expect(api['listBatches']).toHaveBeenCalledTimes(2);
  });
});
