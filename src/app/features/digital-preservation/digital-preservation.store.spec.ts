import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { batchFixture } from './digital-preservation.testing';
import { DigitalPreservationStore } from './digital-preservation.store';
import { auditLogsToCsv, highlightXml, shortHash, toIsoDate } from './digital-preservation.utils';

const meta = { current_page: 1, last_page: 1, per_page: 15, total: 1 };
const base = '/api/v1/preservation';

describe('DigitalPreservationStore', () => {
  let store: DigitalPreservationStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(DigitalPreservationStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the dashboard into its signal and toggles loading', () => {
    store.loadDashboard().subscribe();
    expect(store.loading()).toBe(true);
    http.expectOne(`${base}/dashboard`).flush({
      success: true,
      message: '',
      data: {
        preserved_documents: 12,
        worm_size_bytes: 2048,
        last_sealed_batch: null,
        chain_status: 'alert',
        pending_unpreserved_documents: 2,
        retention_years: 10,
        batches_by_status: {},
        last_verification_at: null,
      },
    });
    expect(store.loading()).toBe(false);
    expect(store.dashboard()?.preserved_documents).toBe(12);
    expect(store.chainOk()).toBe(false);
  });

  it('sends the batch filters, resetting the page when a filter changes', () => {
    store.batchFilters.update((f) => ({ ...f, page: 3 }));
    store.setBatchFilters({ status: 'sealed', search: '' });
    store.loadBatches().subscribe();
    const req = http.expectOne((r) => r.url === `${base}/batches`);
    expect(req.request.params.get('status')).toBe('sealed');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.has('search')).toBe(false);
    req.flush({ success: true, message: '', data: [batchFixture({ status: 'sealed' })], meta });
    expect(store.batches()).toHaveLength(1);
    expect(store.batchMeta().total).toBe(1);
  });

  it('prepends a created batch and updates the open one after a transition', () => {
    store.batches.set([batchFixture({ id: 'b-0' })]);
    store
      .createBatch({
        document_category: 'active_invoices',
        period_from: '2026-11-01',
        period_to: '2026-11-30',
      })
      .subscribe();
    http.expectOne(`${base}/batches`).flush({ success: true, message: '', data: batchFixture() });
    expect(store.batches().map((b) => b.id)).toEqual(['b-1', 'b-0']);

    store.selectedBatch.set({
      ...batchFixture(),
      pdv_xml: null,
      rdv_xml: null,
      timestamp: null,
      items: [],
    });
    store.seal('b-1').subscribe();
    http.expectOne(`${base}/batches/b-1/seal`).flush({
      success: true,
      message: '',
      data: batchFixture({
        status: 'timestamped',
        has_timestamp: true,
        pdv_sha256: 'a'.repeat(64),
      }),
    });
    expect(store.batches()[0].status).toBe('timestamped');
    expect(store.selectedBatch()?.status).toBe('timestamped');
    expect(store.busy()).toBe(false);
  });

  it('keeps the audit chain verdict of the page meta', () => {
    store.loadAuditLogs().subscribe();
    http
      .expectOne((r) => r.url === `${base}/audit-logs`)
      .flush({
        success: true,
        message: '',
        data: [],
        meta: { ...meta, total: 0, chain_valid: false },
      });
    expect(store.auditMeta().chain_valid).toBe(false);
  });
});

describe('preservation utils', () => {
  it('truncates hashes and formats dates', () => {
    expect(shortHash('a'.repeat(64))).toBe(`${'a'.repeat(8)}…${'a'.repeat(6)}`);
    expect(shortHash(null)).toBe('');
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('escapes and highlights XML without letting markup through', () => {
    const html = highlightXml('<Doc a="1"><x>&</x></Doc><script>');
    expect(html).toContain('<span class="x-tag">&lt;Doc</span>');
    expect(html).toContain('<span class="x-attr">a</span>');
    expect(html).toContain('&amp;');
    expect(html).not.toContain('<script>');
  });

  it('quotes CSV cells of the audit trail', () => {
    const csv = auditLogsToCsv([
      {
        id: '1',
        sequence: 1,
        action: 'sealed',
        preservation_batch_id: 'b',
        preservation_item_id: null,
        actor_id: null,
        details: { note: 'a,b' },
        sha256_snapshot: null,
        previous_log_sha256: null,
        entry_sha256: 'h',
        ip_address: null,
        user_agent: null,
        created_at: '2026-11-19',
      },
    ]);
    expect(csv.split('\n')).toHaveLength(2);
    expect(csv).toContain('"{""note"":""a,b""}"');
  });
});
