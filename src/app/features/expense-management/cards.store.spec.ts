import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExpenseManagementApiService } from '@core';
import { CardsStore, matchableLines, remainingAfter } from './cards.store';
import { line, pageMeta, report, transaction, wrap } from './expense-management.testing';

describe('card reconciliation helpers', () => {
  it('lists the card lines that are not linked to a transaction yet', () => {
    const lines = [
      line('1', { payment_method: 'corporate_card' }),
      line('2', { payment_method: 'corporate_card', corporate_card_transaction_id: 'tx-1' }),
      line('3'),
    ];

    expect(matchableLines(lines).map((item) => item.id)).toEqual(['1']);
  });

  it('computes what is left of a transaction after a split', () => {
    const tx = transaction('tx-1', { remaining_amount: '120.00' });

    expect(remainingAfter(tx, [{ line: line('1'), amount: 80 }])).toBe(40);
    expect(
      remainingAfter(tx, [
        { line: line('1'), amount: 80 },
        { line: line('2'), amount: 40 },
      ]),
    ).toBe(0);
    expect(remainingAfter(tx, [{ line: line('1'), amount: 130 }])).toBe(-10);
  });
});

describe('CardsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof CardsStore>;

  beforeEach(() => {
    api = {
      listCardAccounts: vi.fn(() =>
        of(
          wrap([
            {
              id: 'card-1',
              holder_name: 'Anna',
              card_last4: '4242',
              currency: 'EUR',
              issuer: null,
            },
          ]),
        ),
      ),
      listReports: vi.fn(() => of({ ...wrap([report('1')]), meta: pageMeta })),
      listCardTransactions: vi.fn(() => of({ ...wrap([transaction('tx-1')]), meta: pageMeta })),
      getReport: vi.fn(() =>
        of(
          wrap({
            ...report('1'),
            lines: [line('l-1', { payment_method: 'corporate_card' })],
            per_diems: [],
            audit: [],
            payouts: [],
          }),
        ),
      ),
      reconcileCardTransaction: vi.fn(() => of(wrap(transaction('tx-1', { status: 'matched' })))),
    };
    TestBed.configureTestingModule({
      providers: [CardsStore, { provide: ExpenseManagementApiService, useValue: api }],
    });
    store = TestBed.inject(CardsStore);
  });

  it('loads the unmatched transactions first', async () => {
    await store.init();

    expect(store.transactions()).toHaveLength(1);
    expect(store.accounts()).toHaveLength(1);
    expect(store.reports()).toHaveLength(2);
    expect(api['listCardTransactions']).toHaveBeenCalledWith({
      status: 'unmatched',
      per_page: 25,
      page: 1,
    });
  });

  it('reads the card lines of the chosen report', async () => {
    await store.init();
    await store.openReport('1');

    expect(store.candidates().map((item) => item.id)).toEqual(['l-1']);

    await store.openReport(null);
    expect(store.lines()).toEqual([]);
  });

  it('matches a transaction with its lines as a split and reloads', async () => {
    await store.init();
    const tx = store.transactions()[0];
    const outcome = await store.match(tx, [
      { line: line('l-1'), amount: 70 },
      { line: line('l-2'), amount: 50 },
    ]);

    expect(outcome.ok).toBe(true);
    expect(api['reconcileCardTransaction']).toHaveBeenCalledWith('tx-1', {
      action: 'match',
      matches: [
        { expense_line_id: 'l-1', amount: 70 },
        { expense_line_id: 'l-2', amount: 50 },
      ],
    });
    expect(api['listCardTransactions']).toHaveBeenCalledTimes(2);
  });

  it('ignores, disputes and releases a transaction', async () => {
    await store.init();
    const tx = store.transactions()[0];

    for (const action of ['ignore', 'dispute', 'unmatch'] as const) {
      expect((await store.act(tx, action)).ok).toBe(true);
      expect(api['reconcileCardTransaction']).toHaveBeenLastCalledWith('tx-1', { action });
    }
  });

  it('answers the refusal of the API', async () => {
    await store.init();
    api['reconcileCardTransaction'].mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { code: 'amount_exceeds_transaction' } }),
      ),
    );

    const outcome = await store.match(store.transactions()[0], [
      { line: line('l-1'), amount: 500 },
    ]);

    expect(outcome.errorKey).toBe('expenseManagement.error.amount_exceeds_transaction');
    expect(store.busy()).toBe(false);
  });
});
