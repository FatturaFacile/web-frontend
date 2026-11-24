import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../icons-provider';
import { DigitalPreservationApiService } from './digital-preservation-api.service';
import { PreservationItem } from './digital-preservation.models';
import { DigitalPreservationStore } from './digital-preservation.store';
import { batchFixture } from './digital-preservation.testing';
import { PreservationBatchesComponent } from './preservation-batches.component';
import { PreservationExhibitionComponent } from './preservation-exhibition.component';

const ok = <T>(data: T) => of({ success: true, message: '', data });
const page = <T>(data: T[]) =>
  of({
    success: true,
    message: '',
    data,
    meta: { current_page: 1, last_page: 1, per_page: 15, total: data.length },
  });

const item: PreservationItem = {
  id: 'i-1',
  batch_id: 'b-1',
  batch_number: 'PDV-2026-000001',
  document_uuid: 'u-1',
  document_type: 'invoice',
  document_number: 'FT-2026/00125',
  document_date: '2026-11-15',
  counterparty_name: 'Cliente Beta',
  counterparty_tax_id: 'IT09876543210',
  original_filename: 'a.xml',
  archived_filename: 'a.xml',
  mime_type: 'application/xml',
  is_pdfa_compliant: true,
  pdfa_conformance_level: 'XML',
  file_size_bytes: 10,
  sha256_hash: 'f'.repeat(64),
  retention_until: '2036-11-30',
  jurisdiction: 'IT',
};

describe('preservation components', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  const message = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      batches: vi.fn(() => page([batchFixture()])),
      batch: vi.fn(() =>
        ok({ ...batchFixture(), pdv_xml: '<A/>', rdv_xml: null, timestamp: null, items: [item] }),
      ),
      seal: vi.fn(() => ok(batchFixture({ status: 'timestamped', has_timestamp: true }))),
      dispatch: vi.fn(() => ok(batchFixture({ status: 'dispatched' }))),
      verifyBatch: vi.fn(),
      items: vi.fn(() => page([item])),
      verifyItem: vi.fn(() => ok({ ok: true, expected: 'x', actual: 'x' })),
      exportBatchPdd: vi.fn(),
      exportItemPdd: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: DigitalPreservationApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
      ],
    });
  });

  describe('batches', () => {
    let fixture: ComponentFixture<PreservationBatchesComponent>;
    let store: DigitalPreservationStore;

    beforeEach(async () => {
      fixture = TestBed.createComponent(PreservationBatchesComponent);
      store = TestBed.inject(DigitalPreservationStore);
      fixture.detectChanges();
      await fixture.whenStable();
    });

    it('loads the batches on init', () => {
      expect(api['batches']).toHaveBeenCalledTimes(1);
      expect(store.batches()).toHaveLength(1);
    });

    it('filters from page one and reloads', () => {
      store.batchFilters.update((f) => ({ ...f, page: 4 }));
      (fixture.componentInstance as unknown as { filter(p: object): void }).filter({
        status: 'sealed',
      });
      expect(api['batches']).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'sealed', page: 1 }),
      );
    });

    it('seals a batch, then reloads its detail and reports success', () => {
      (fixture.componentInstance as unknown as { seal(id: string): void }).seal('b-1');
      expect(api['seal']).toHaveBeenCalledWith('b-1');
      expect(api['batch']).toHaveBeenCalledWith('b-1');
      expect(message.success).toHaveBeenCalled();
      expect(store.batches()[0].status).toBe('timestamped');
    });

    it('dispatches a sealed batch', () => {
      (fixture.componentInstance as unknown as { dispatch(id: string): void }).dispatch('b-1');
      expect(api['dispatch']).toHaveBeenCalledWith('b-1');
      expect(store.batches()[0].status).toBe('dispatched');
    });

    it('shows the API message when sealing fails', () => {
      api['seal'].mockReturnValue(throwError(() => ({ error: { message: 'Nothing to seal' } })));
      (fixture.componentInstance as unknown as { seal(id: string): void }).seal('b-1');
      expect(message.error).toHaveBeenCalledWith('Nothing to seal');
    });

    it('keeps the verification result for the modal', () => {
      const result = {
        ok: false,
        checked_files: 3,
        failures: [{ type: 'file', reference: 'a', expected: 'x', actual: 'y' }],
        chain: { ok: true },
        timestamp: { valid: null },
        audit_chain: { ok: true },
        verified_at: '2026-11-19T10:00:00Z',
      };
      api['verifyBatch'].mockReturnValue(ok(result));
      const cmp = fixture.componentInstance as unknown as {
        verify(id: string): void;
        verification(): unknown;
      };
      cmp.verify('b-1');
      expect(cmp.verification()).toEqual(result);
    });
  });

  describe('exhibition search', () => {
    let fixture: ComponentFixture<PreservationExhibitionComponent>;
    let store: DigitalPreservationStore;
    let cmp: {
      search(): void;
      reset(): void;
      verify(i: PreservationItem): void;
      verifying(): { result: unknown } | null;
      setRange(r: Date[] | null): void;
      searched(): boolean;
    };

    beforeEach(() => {
      fixture = TestBed.createComponent(PreservationExhibitionComponent);
      store = TestBed.inject(DigitalPreservationStore);
      cmp = fixture.componentInstance as unknown as typeof cmp;
      fixture.detectChanges();
    });

    it('does not query until the user searches', () => {
      expect(api['items']).not.toHaveBeenCalled();
    });

    it('searches with the multi-criteria filters', () => {
      store.setItemFilters({
        document_number: 'FT-2026',
        counterparty: 'Beta',
        tax_id: 'IT0987',
        sha256: 'ab',
      });
      cmp.setRange([new Date(2026, 10, 1), new Date(2026, 10, 30)]);
      cmp.search();
      expect(api['items']).toHaveBeenCalledWith(
        expect.objectContaining({
          document_number: 'FT-2026',
          counterparty: 'Beta',
          tax_id: 'IT0987',
          sha256: 'ab',
          date_from: '2026-11-01',
          date_to: '2026-11-30',
        }),
      );
      expect(store.items()).toEqual([item]);
      expect(cmp.searched()).toBe(true);
    });

    it('verifies the hash of a result live', () => {
      cmp.verify(item);
      expect(api['verifyItem']).toHaveBeenCalledWith('i-1');
      expect(cmp.verifying()?.result).toEqual({ ok: true, expected: 'x', actual: 'x' });
    });

    it('clears results and filters on reset', () => {
      cmp.search();
      cmp.reset();
      expect(store.items()).toEqual([]);
      expect(store.hasFilters()).toBe(false);
      expect(cmp.searched()).toBe(false);
    });
  });
});
