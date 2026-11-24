import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayablesApiService } from '@core';
import { PayablesBatchesStore } from './payables-batches.store';
import { batch, preview } from './payables.fixtures';

const meta = { current_page: 1, from: 1, last_page: 1, per_page: 20, to: 1, total: 1 };

describe('PayablesBatchesStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof PayablesBatchesStore>;

  beforeEach(() => {
    api = {
      listBatches: vi.fn(() => of({ data: [batch()], meta })),
      getBatch: vi.fn(() => of({ data: batch() })),
      previewBatch: vi.fn(() => of({ data: preview() })),
      createBatch: vi.fn(() => of({ data: batch() })),
      submitBatch: vi.fn(() => of({ data: batch({ status: 'pending_approval' }) })),
      approveBatch: vi.fn(() => of({ data: batch({ status: 'approved' }) })),
      rejectBatch: vi.fn(() => of({ data: batch({ status: 'rejected' }) })),
      executeBatch: vi.fn(() => of({ data: batch({ status: 'executed' }) })),
      cancelBatch: vi.fn(() => of({ data: batch({ status: 'cancelled' }) })),
    };
    TestBed.configureTestingModule({
      providers: [PayablesBatchesStore, { provide: PayablesApiService, useValue: api }],
    });
    store = TestBed.inject(PayablesBatchesStore);
  });

  describe('list', () => {
    it('loads the batches and filters by status from the first page', async () => {
      await store.loadList({ per_page: 20, page: 1 });
      expect(store.batches()).toHaveLength(1);
      expect(store.total()).toBe(1);

      await store.setStatus('approved');
      expect(api['listBatches']).toHaveBeenLastCalledWith({
        per_page: 20,
        page: 1,
        status: 'approved',
      });
      await store.setPage(2);
      expect(api['listBatches']).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'approved', page: 2 }),
      );
    });

    it('reports a load error', async () => {
      api['listBatches'].mockReturnValueOnce(throwError(() => new Error('offline')));
      await store.loadList({});
      expect(store.error()).toBe('AP.LOAD_ERROR');
    });
  });

  describe('wizard', () => {
    it('proposes the items and ticks everything the API put in the batch', async () => {
      await store.propose({ cutoff_date: '2026-04-15', prioritize_skonto: true });

      expect(api['previewBatch']).toHaveBeenCalledWith(
        expect.objectContaining({ cutoff_date: '2026-04-15', prioritize_skonto: true }),
      );
      expect(store.selectedItemIds()).toEqual(['i-1', 'i-2']);
      expect(store.selectedSetOffIds()).toEqual(['cn-1']);
      expect(store.proposed()?.totals.net_amount).toBe('1830.00');
      expect(store.canCreate()).toBe(true);
    });

    it('asks the API to recompute the netting and the IBAN groups when an item is unticked', async () => {
      await store.propose({ cutoff_date: '2026-04-15', prioritize_skonto: false });
      await store.toggleItem('i-1', false);

      expect(api['previewBatch']).toHaveBeenLastCalledWith(
        expect.objectContaining({ item_ids: ['i-2'], set_off_ids: ['cn-1'] }),
      );
      expect(store.selectedItemIds()).toEqual(['i-2']);
    });

    it('lets the user leave a credit note out of the set-off', async () => {
      await store.propose({ cutoff_date: '2026-04-15', prioritize_skonto: false });
      await store.toggleSetOff('cn-1', false);

      expect(api['previewBatch']).toHaveBeenLastCalledWith(
        expect.objectContaining({ item_ids: ['i-1', 'i-2'], set_off_ids: [] }),
      );
      expect(store.selectedSetOffIds()).toEqual([]);
    });

    it('cannot create a batch without items', async () => {
      await store.propose({ cutoff_date: '2026-04-15', prioritize_skonto: false });
      await store.toggleItem('i-1', false);
      api['previewBatch'].mockReturnValueOnce(
        of({ data: preview({ batch: batch({ transfers: [], set_offs: [] }) }) }),
      );
      await store.toggleItem('i-2', false);

      expect(store.selectedItemIds()).toEqual([]);
      expect(store.canCreate()).toBe(false);
    });

    it('creates the draft from the selection', async () => {
      await store.propose({ cutoff_date: '2026-04-15', prioritize_skonto: true, currency: 'EUR' });
      const result = await store.create();

      expect(api['createBatch']).toHaveBeenCalledWith({
        cutoff_date: '2026-04-15',
        prioritize_skonto: true,
        currency: 'EUR',
        item_ids: ['i-1', 'i-2'],
        set_off_ids: ['cn-1'],
      });
      expect(result.ok).toBe(true);
      expect(result.batch?.id).toBe('b-1');
    });

    it('reports a rejected creation and keeps the wizard', async () => {
      api['createBatch'].mockReturnValueOnce(
        throwError(
          () =>
            new HttpErrorResponse({ status: 422, error: { message: 'Item blocked meanwhile' } }),
        ),
      );
      await store.propose({ cutoff_date: '2026-04-15', prioritize_skonto: true });
      const result = await store.create();

      expect(result.ok).toBe(false);
      expect(result.message).toBe('Item blocked meanwhile');
      expect(result.batch).toBeNull();
      expect(store.preview()).not.toBeNull();
    });

    it('reports a preview error', async () => {
      api['previewBatch'].mockReturnValueOnce(throwError(() => new Error('offline')));
      await store.propose({ cutoff_date: '2026-04-15', prioritize_skonto: true });

      expect(store.error()).toBe('AP.PREVIEW_ERROR');
      expect(store.previewing()).toBe(false);
    });

    it('starts again from today with nothing selected', async () => {
      await store.propose({ cutoff_date: '2026-04-15', prioritize_skonto: true });
      store.resetWizard();

      expect(store.preview()).toBeNull();
      expect(store.selectedItemIds()).toEqual([]);
      expect(store.params().cutoff_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('workflow', () => {
    it('submits for CFO approval and updates the open batch', async () => {
      await store.loadDetail('b-1');
      const outcome = await store.submit('b-1');

      expect(outcome.ok).toBe(true);
      expect(store.detail()?.status).toBe('pending_approval');
    });

    it('approves with an optional note', async () => {
      await store.approve('b-1');
      expect(api['approveBatch']).toHaveBeenCalledWith('b-1', {});
      await store.approve('b-1', 'ok for Friday');
      expect(api['approveBatch']).toHaveBeenLastCalledWith('b-1', { reason: 'ok for Friday' });
      expect(store.detail()?.status).toBe('approved');
    });

    it('rejects with the reason', async () => {
      const outcome = await store.reject('b-1', 'cash is short');

      expect(api['rejectBatch']).toHaveBeenCalledWith('b-1', { reason: 'cash is short' });
      expect(outcome.ok).toBe(true);
      expect(store.detail()?.status).toBe('rejected');
    });

    it('executes the payment and cancels a batch', async () => {
      await store.execute('b-1');
      expect(store.detail()?.status).toBe('executed');
      await store.cancel('b-1');
      expect(store.detail()?.status).toBe('cancelled');
    });

    it('answers the failure of a transition and keeps the status', async () => {
      api['executeBatch'].mockReturnValueOnce(
        throwError(
          () => new HttpErrorResponse({ status: 409, error: { message: 'Batch is not approved' } }),
        ),
      );
      await store.loadDetail('b-1');
      const outcome = await store.execute('b-1');

      expect(outcome.ok).toBe(false);
      expect(outcome.message).toBe('Batch is not approved');
      expect(store.detail()?.status).toBe('draft');
      expect(store.saving()).toBe(false);
    });
  });
});
