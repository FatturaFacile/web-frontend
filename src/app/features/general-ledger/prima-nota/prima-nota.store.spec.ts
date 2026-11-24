import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccountingTemplate, ChartAccountDetail, GeneralLedgerPrimaNotaApiService } from '@core';
import { GlLookupStore } from '../shared/gl-lookup.store';
import { PrimaNotaStore } from './prima-nota.store';

function account(
  id: string,
  code: string,
  name: string,
  extra: Partial<ChartAccountDetail> = {},
): ChartAccountDetail {
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
    ...extra,
  };
}

const template: AccountingTemplate = {
  id: 't1',
  code: 'EXPENSE_WITH_VAT',
  category: 'expense',
  journal_type: 'standard',
  ledger_type: 'tax',
  name: 'Expense with VAT',
  names: {
    it: 'Costo con IVA',
    de: 'Aufwand mit MWST',
    fr: 'Charge avec TVA',
    en: 'Expense with VAT',
  },
  description: null,
  parameters: [
    { key: 'amount', type: 'amount' },
    { key: 'tax_rate', type: 'rate' },
    { key: 'expense', type: 'account' },
  ],
  lines: [],
  is_system: true,
  is_active: true,
};

describe('PrimaNotaStore', () => {
  const api = {
    getTemplates: vi.fn(),
    previewTemplate: vi.fn(),
    createJournal: vi.fn(),
  };

  function create() {
    TestBed.configureTestingModule({
      providers: [
        PrimaNotaStore,
        { provide: GeneralLedgerPrimaNotaApiService, useValue: api },
        {
          provide: GlLookupStore,
          useValue: {
            accounts: signal([
              account('a1', '6000', 'Rent'),
              account('a2', '1100', 'Bank', { account_type: 'asset' }),
              account('a3', '9999', 'Locked', { allows_manual_posting: false }),
            ]),
            load: vi.fn(),
          },
        },
      ],
    });
    return TestBed.inject(PrimaNotaStore);
  }

  function fillBalanced(store: ReturnType<typeof create>, credit = '100'): void {
    store.setDescription('Rent');
    const [first, second] = store.lines();
    store.selectAccount(first.key, 'a1');
    store.updateLine(first.key, { debit: '100' });
    store.selectAccount(second.key, 'a2');
    store.updateLine(second.key, { credit });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    api.getTemplates.mockReturnValue(of({ success: true, message: '', data: [template] }));
    api.createJournal.mockReturnValue(
      of({ success: true, message: '', data: { id: 'j1', entry_number: 'JE-1' } }),
    );
  });

  it('starts with two empty lines and cannot be submitted', () => {
    const store = create();
    expect(store.lines()).toHaveLength(2);
    expect(store.canSubmit()).toBe(false);
    expect(store.balanced()).toBe(false);
  });

  it('keeps the live Dare, Avere and Differenza in step with the lines', () => {
    const store = create();
    fillBalanced(store, '60');
    expect(store.totals()).toEqual({ debitCents: 10000, creditCents: 6000, differenceCents: 4000 });
    expect(store.differenceLabel()).toBe('40.00');
    expect(store.issues()).toContain('unbalanced');
    expect(store.canSubmit()).toBe(false);
  });

  it('never calls the API with an unbalanced entry', async () => {
    const store = create();
    fillBalanced(store, '60');
    const outcome = await store.submit('posted');
    expect(outcome).toEqual({ ok: false, reason: 'blocked', issues: ['unbalanced'] });
    expect(api.createJournal).not.toHaveBeenCalled();
  });

  it('posts a balanced entry to its book and propagates it to the others', async () => {
    const store = create();
    fillBalanced(store);
    store.setLedger('02');
    store.togglePropagation('03', true);
    store.togglePropagation('02', true); // the book being posted to is ignored
    expect(store.canSubmit()).toBe(true);

    const outcome = await store.submit('posted');

    expect(outcome.ok).toBe(true);
    expect(api.createJournal).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'Rent',
        ledger_type: 'tax',
        post_to_ledgers: ['03'],
        status: 'posted',
        lines: [
          {
            account_id: 'a1',
            debit_amount: 100,
            credit_amount: 0,
            description: null,
            cost_center_id: null,
          },
          {
            account_id: 'a2',
            debit_amount: 0,
            credit_amount: 100,
            description: null,
            cost_center_id: null,
          },
        ],
      }),
    );
  });

  it('omits post_to_ledgers when there is no propagation and keeps the error on failure', async () => {
    api.createJournal.mockReturnValue(throwError(() => new Error('422')));
    const store = create();
    fillBalanced(store);
    const outcome = await store.submit('draft');
    expect(outcome.ok).toBe(false);
    expect(api.createJournal.mock.calls[0][0].post_to_ledgers).toBeUndefined();
    expect(store.error()).toBeInstanceOf(Error);
    expect(store.submitting()).toBe(false);
  });

  it('drops a book from the propagation when it becomes the posting book and cycles the books', () => {
    const store = create();
    store.togglePropagation('02', true);
    store.setLedger('02');
    expect(store.propagateTo()).toEqual([]);
    store.cycleLedger();
    expect(store.ledger()).toBe('03');
    store.cycleLedger();
    expect(store.ledger()).toBe('01');
  });

  it('selects an account when its exact code is typed, only among postable accounts', () => {
    const store = create();
    const key = store.lines()[0].key;
    store.setAccountQuery(key, '6000');
    expect(store.lines()[0].accountId).toBe('a1');
    store.setAccountQuery(key, '600');
    expect(store.lines()[0].accountId).toBeNull();
    store.setAccountQuery(key, '9999');
    expect(store.lines()[0].accountId).toBeNull();
    expect(store.accountOptions('99')).toEqual([]);
    expect(store.accountOptions('bank').map((a) => a.id)).toEqual(['a2']);
  });

  it('autofills the remainder so that the entry balances', () => {
    const store = create();
    store.updateLine(store.lines()[0].key, { debit: '45.5' });
    store.autofill();
    expect(store.lines()[1].credit).toBe('45.50');
    expect(store.balanced()).toBe(true);
  });

  it('keeps at least two lines and adds lines on demand', () => {
    const store = create();
    store.removeLine(store.lines()[0].key);
    expect(store.lines()).toHaveLength(2);
    const key = store.addLine();
    expect(store.lines()).toHaveLength(3);
    expect(store.lines()[2].key).toBe(key);
  });

  it('hydrates the lines from the template preview', async () => {
    api.previewTemplate.mockReturnValue(
      of({
        success: true,
        message: '',
        data: {
          lines: [
            {
              line_number: 1,
              account_id: 'a1',
              account_code: '6000',
              account_name: 'Rent',
              debit_amount: '100.0000',
              credit_amount: '0.0000',
              description: null,
              cost_center_id: null,
              template_line: 1,
            },
            {
              line_number: 2,
              account_id: 'a2',
              account_code: '1100',
              account_name: 'Bank',
              debit_amount: '0.0000',
              credit_amount: '100.0000',
              description: 'Pay',
              cost_center_id: null,
              template_line: 2,
            },
          ],
          total_debit: '100.0000',
          total_credit: '100.0000',
          difference: '0.0000',
          is_balanced: true,
        },
      }),
    );
    const store = create();
    await store.loadTemplates();
    store.selectTemplate('t1');
    store.setTemplateValue({ amount: '100', taxRate: '8.1' });
    store.setTemplateAccount('expense', '6000');

    await store.hydrateFromTemplate();

    expect(api.previewTemplate).toHaveBeenCalledWith('t1', {
      amount: '100',
      tax_rate: '8.1',
      accounts: { expense: '6000' },
      cost_center_id: null,
    });
    expect(store.lines().map((line) => [line.accountId, line.debit, line.credit])).toEqual([
      ['a1', '100.00', ''],
      ['a2', '', '100.00'],
    ]);
    expect(store.description()).toBe('Expense with VAT');
    expect(store.ledger()).toBe('02');
    expect(store.balanced()).toBe(true);
  });

  it('resets the workbench after a posting', () => {
    const store = create();
    fillBalanced(store);
    store.reset();
    expect(store.description()).toBe('');
    expect(store.lines().every((line) => line.accountId === null && line.debit === '')).toBe(true);
  });
});
