import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AuthStore,
  ChartAccountDetail,
  GeneralLedgerPrimaNotaApiService,
  PermissionsService,
} from '@core';
import { GlLookupStore } from '../shared/gl-lookup.store';
import { GlPrimaNotaComponent } from './gl-prima-nota.component';
import { PrimaNotaStore } from './prima-nota.store';

function account(id: string, code: string, name: string): ChartAccountDetail {
  return {
    id,
    account_code: code,
    name,
    account_class: '6',
    account_type: 'expense',
    normal_balance: 'debit',
    currency: 'EUR',
    is_reconciliation_account: false,
    reconciliation_type: null,
    allows_manual_posting: true,
    is_cost_center_mandatory: false,
    is_active: true,
    reporting_class: null,
  };
}

function press(init: KeyboardEventInit): void {
  document.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }),
  );
}

describe('GlPrimaNotaComponent', () => {
  const api = { getTemplates: vi.fn(), previewTemplate: vi.fn(), createJournal: vi.fn() };
  const message = { success: vi.fn() };
  let fixture: ComponentFixture<GlPrimaNotaComponent>;
  let store: InstanceType<typeof PrimaNotaStore>;

  const rows = (): number => fixture.nativeElement.querySelectorAll('tbody tr').length;
  const postButton = (): HTMLButtonElement =>
    fixture.nativeElement.querySelector('[data-testid="pn-post"]');

  async function create(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [GlPrimaNotaComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: GeneralLedgerPrimaNotaApiService, useValue: api },
        {
          provide: GlLookupStore,
          useValue: {
            accounts: signal([account('a1', '6000', 'Rent'), account('a2', '1100', 'Bank')]),
            costCenters: signal([]),
            load: vi.fn(),
          },
        },
        { provide: AuthStore, useValue: { activeCurrency: () => 'EUR' } },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(GlPrimaNotaComponent);
    store = fixture.debugElement.injector.get(PrimaNotaStore);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function fillBalanced(credit = '100'): void {
    store.setDescription('Rent');
    const [first, second] = store.lines();
    store.selectAccount(first.key, 'a1');
    store.updateLine(first.key, { debit: '100' });
    store.selectAccount(second.key, 'a2');
    store.updateLine(second.key, { credit });
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    api.getTemplates.mockReturnValue(of({ success: true, message: '', data: [] }));
    api.createJournal.mockReturnValue(
      of({ success: true, message: '', data: { id: 'j1', entry_number: 'JE-1' } }),
    );
    await create();
  });

  it('renders two empty lines and blocks the post button while the entry is incomplete', () => {
    expect(rows()).toBe(2);
    expect(postButton().disabled).toBe(true);
  });

  it('shows the unbalanced indicator and keeps posting blocked, then enables it when Dare equals Avere', () => {
    fillBalanced('60');
    const balance: HTMLElement = fixture.nativeElement.querySelector('.pn-balance');
    expect(balance.classList.contains('pn-unbalanced')).toBe(true);
    expect(postButton().disabled).toBe(true);

    store.updateLine(store.lines()[1].key, { credit: '100' });
    fixture.detectChanges();
    expect(balance.classList.contains('pn-balanced')).toBe(true);
    expect(postButton().disabled).toBe(false);
  });

  it('adds a line with Alt+N and balances with Alt+B', () => {
    press({ key: 'n', altKey: true });
    fixture.detectChanges();
    expect(rows()).toBe(3);

    store.updateLine(store.lines()[0].key, { debit: '30' });
    press({ key: 'b', altKey: true });
    fixture.detectChanges();
    expect(store.balanced()).toBe(true);
  });

  it('cycles the ledger book with Alt+L', () => {
    press({ key: 'l', altKey: true });
    expect(store.ledger()).toBe('02');
  });

  it('does not post with Ctrl+Enter while unbalanced', () => {
    fillBalanced('60');
    press({ key: 'Enter', ctrlKey: true });
    expect(api.createJournal).not.toHaveBeenCalled();
  });

  it('posts a balanced entry with Ctrl+Enter and saves a draft with Ctrl+S', async () => {
    fillBalanced();
    press({ key: 'Enter', ctrlKey: true });
    expect(api.createJournal).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'posted', ledger_type: 'statutory' }),
    );
    // The workbench is cleared after a posting.
    await vi.waitFor(() => expect(store.description()).toBe(''));
    expect(message.success).toHaveBeenCalled();

    fillBalanced();
    press({ key: 's', ctrlKey: true });
    expect(api.createJournal).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'draft' }),
    );
  });
});
