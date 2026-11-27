import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { EsterometroApiService } from '../../core/api/esterometro-api.service';
import { EsterometroStore } from './esterometro.store';

describe('EsterometroStore', () => {
  let store: EsterometroStore;
  const mockApi = {
    getDashboard: vi.fn().mockReturnValue(
      of({
        data: {
          as_of: '2026-04-20',
          next_monthly_deadline: '2026-05-15',
          days_to_next_monthly_deadline: 25,
          counts: {
            total: 2,
            overdue: 1,
            due_soon: 0,
            upcoming: 1,
            transmitted: 0,
            rejected: 0,
            draft: 1,
            reconciled: 1,
          },
          totals_eur: {
            taxable_eur: 1000,
            vat_eur: 220,
            deductible_vat_eur: 220,
            non_deductible_vat_eur: 0,
          },
          by_document_type: [],
        },
      }),
    ),
    listSelfInvoices: vi.fn().mockReturnValue(of({ data: [] })),
    listRules: vi.fn().mockReturnValue(of({ data: [] })),
    getSettings: vi.fn().mockReturnValue(of({ data: null })),
    batchSendToSdi: vi.fn().mockReturnValue(of({ data: { sent_ids: ['si-1'], failed: [] } })),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [EsterometroStore, { provide: EsterometroApiService, useValue: mockApi }],
    });
    store = TestBed.inject(EsterometroStore);
  });

  it('loads dashboard and computes hasOverdue', async () => {
    await store.loadAll();
    expect(store.hasOverdue()).toBe(true);
    expect(store.dashboard()?.counts.total).toBe(2);
  });

  it('toggles selection and clears after batch send', async () => {
    store.toggleSelection('si-1', true);
    expect(store.selectedCount()).toBe(1);
    const result = await store.batchSendSelected();
    expect(result).toEqual({ sentCount: 1, failedCount: 0 });
    expect(store.selectedCount()).toBe(0);
  });
});
