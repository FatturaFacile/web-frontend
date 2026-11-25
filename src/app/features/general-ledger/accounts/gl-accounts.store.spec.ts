import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { GeneralLedgerApiService } from '../../../core/api/general-ledger-api.service';
import { GlAccountsStore } from './gl-accounts.store';

describe('GlAccountsStore', () => {
  let store: InstanceType<typeof GlAccountsStore>;
  let apiMock: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    apiMock = {
      getAccountList: vi.fn().mockReturnValue(
        of({
          data: [
            {
              id: 'acc-1',
              account_code: '1000',
              name: 'Cassa',
              account_name: 'Cassa',
              account_type: 'asset',
              normal_balance: 'debit',
              is_active: true,
              allows_manual_posting: true,
            },
          ],
        }),
      ),
      getAccountsTree: vi.fn().mockReturnValue(
        of({
          data: [
            {
              id: 'acc-1',
              account_code: '1000',
              account_name: 'Cassa',
              account_type: 'asset',
              normal_balance: 'debit',
              parent_account_id: null,
              level: 1,
              hierarchy_path: '1000',
              vat_code_id: null,
              default_cost_center_id: null,
              open_items_enabled: false,
              allowed_currencies: ['CHF'],
              is_postable: true,
              allows_manual_posting: true,
              is_system: true,
              is_active: true,
              template_code: 'ch_kmu_pme',
              statutory_code: null,
              reporting_class: null,
              reconciliation_type: null,
              outgoing_mappings_count: 1,
              incoming_mappings_count: 0,
              has_postings: false,
              children: [],
            },
          ],
          meta: {
            total_accounts: 1,
            postable_accounts: 1,
            active_accounts: 1,
            max_depth: 1,
            standards: ['ch_kmu_pme'],
            ui_copy: { page_title: 'Piano dei Conti Multi-Standard' },
          },
        }),
      ),
      getAccountTemplates: vi.fn().mockReturnValue(
        of({
          data: [{ key: 'ch_kmu_pme', standard: 'ch_kmu_pme', name: 'KMU', country: 'CH', currency: 'CHF', accounts: 50 }],
          ui_copy: { provision_button: 'Inizializza Piano dei Conti' },
        }),
      ),
      getAccountMappings: vi.fn().mockReturnValue(of({ data: [], incoming: [], tree: [] })),
      getVatCodesLookup: vi.fn().mockReturnValue(of({ data: [] })),
      getCostCenters: vi.fn().mockReturnValue(of({ data: [] })),
      getAccountDetail: vi.fn().mockReturnValue(
        of({
          data: { id: 'acc-1', account_code: '1000', name: 'Cassa', account_type: 'asset', normal_balance: 'debit', is_active: true, allows_manual_posting: true },
          meta: { breadcrumbs: [{ id: 'acc-1', account_code: '1000', account_name: 'Cassa' }], has_postings: false },
        }),
      ),
      provisionAccountTemplate: vi.fn().mockReturnValue(of({ data: { template: 'ch_kmu_pme', created: 50, skipped: 0, mappings_created: 30 } })),
      moveAccount: vi.fn().mockReturnValue(of({ data: {} })),
      createAccountMapping: vi.fn().mockReturnValue(of({ data: {} })),
    };

    TestBed.configureTestingModule({
      providers: [
        GlAccountsStore,
        { provide: GeneralLedgerApiService, useValue: apiMock },
      ],
    });

    store = TestBed.inject(GlAccountsStore);
  });

  it('loads accounts, tree, templates, and merges backend uiCopy', () => {
    store.loadAll();

    expect(store.accounts().length).toBe(1);
    expect(store.tree().length).toBe(1);
    expect(store.uiCopy()['page_title']).toBe('Piano dei Conti Multi-Standard');
    expect(store.uiCopy()['provision_button']).toBe('Inizializza Piano dei Conti');
  });

  it('selects a tree node and fetches breadcrumbs', () => {
    store.loadAll();
    store.selectAccount(store.tree()[0]);

    expect(apiMock['getAccountDetail']).toHaveBeenCalledWith('acc-1');
    expect(store.selectedBreadcrumbs().length).toBe(1);
    expect(store.selectedHasPostings()).toBe(false);
  });

  it('provisions a template in 1 click and reloads state', () => {
    const onDone = vi.fn();
    store.provisionTemplate('ch_kmu_pme', true, onDone, vi.fn());

    expect(apiMock['provisionAccountTemplate']).toHaveBeenCalledWith('ch_kmu_pme', { include_default_mappings: true });
    expect(onDone).toHaveBeenCalledWith({ template: 'ch_kmu_pme', created: 50, skipped: 0, mappings_created: 30 });
  });
});
