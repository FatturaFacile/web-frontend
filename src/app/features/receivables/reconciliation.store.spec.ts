import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceivablesApiService } from '@core';
import { ReconciliationStore } from './reconciliation.store';
import { item, payments } from './receivables.fixtures';

const TODAY = '2026-03-31';

describe('ReconciliationStore', () => {
  let api: Record<'getUnreconciledPayments' | 'allocate', ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof ReconciliationStore>;
  const first = item('1', { open_amount: '300.00' });
  const second = item('2', { open_amount: '150.00' });

  beforeEach(() => {
    api = {
      getUnreconciledPayments: vi.fn(() =>
        of({ data: [...payments, { ...payments[0], ledger_entry_id: 'l-usd', currency: 'USD' }] }),
      ),
      allocate: vi.fn(() =>
        of({ data: { allocations: [], items: [item('1', { open_amount: '0.00' })] } }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [ReconciliationStore, { provide: ReceivablesApiService, useValue: api }],
    });
    store = TestBed.inject(ReconciliationStore);
  });

  it('starts with one full payment line per item and no residual', () => {
    store.init([first, second], TODAY);

    expect(
      store.lines().map((line) => [line.itemId, line.type, line.amount, line.valueDate]),
    ).toEqual([
      ['1', 'payment', '300.00', TODAY],
      ['2', 'payment', '150.00', TODAY],
    ]);
    expect(store.residuals().map((row) => row.residual)).toEqual(['0.00', '0.00']);
    expect(store.totalSettled()).toBe('450.00');
    expect(store.isValid()).toBe(true);
    expect(store.customerId()).toBe('c-1');
  });

  it('allocates partially and shows what stays open', () => {
    store.init([first], TODAY);
    store.updateLine(1, { amount: '100.00' });

    expect(store.residuals()[0]).toMatchObject({
      settled: '100.00',
      raised: '0.00',
      residual: '200.00',
    });
    expect(store.isValid()).toBe(true);
  });

  it('refuses an amount above the open amount, zero, or a missing date', () => {
    store.init([first], TODAY);

    store.updateLine(1, { amount: '300.01' });
    expect(store.lineErrors()[1]).toEqual(['AR.ERR_EXCEEDS_RESIDUAL']);
    expect(store.isValid()).toBe(false);

    store.updateLine(1, { amount: '0.00', valueDate: '' });
    expect(store.lineErrors()[1]).toEqual(['AR.ERR_AMOUNT', 'AR.ERR_DATE']);

    store.updateLine(1, { amount: '12,50', valueDate: TODAY });
    expect(store.lineErrors()[1]).toEqual(['AR.ERR_AMOUNT']);
  });

  it('splits one item over several lines of different kinds and checks the sum', () => {
    store.init([first], TODAY);
    store.updateLine(1, { amount: '200.00' });
    store.addLine('1', TODAY);

    const added = store.lines()[1];
    expect(added.amount).toBe('100.00');
    store.setType(added.uid, 'discount');
    expect(store.residuals()[0].residual).toBe('0.00');
    expect(store.isValid()).toBe(true);

    store.updateLine(added.uid, { amount: '100.01' });
    expect(store.lineErrors()[added.uid]).toEqual(['AR.ERR_EXCEEDS_RESIDUAL']);
  });

  it('lets a debit adjustment raise the open amount without a cap', () => {
    store.init([first], TODAY);
    store.setType(1, 'debit_adjustment');
    store.updateLine(1, { amount: '25.00' });

    expect(store.residuals()[0]).toMatchObject({
      settled: '0.00',
      raised: '25.00',
      residual: '325.00',
    });
    expect(store.lineErrors()[1]).toBeUndefined();
    expect(store.totalSettled()).toBe('0.00');
    expect(store.capacityOf(1)).toBe('300.00');
  });

  it('takes the whole residual of the item with setFull', () => {
    store.init([first], TODAY);
    store.updateLine(1, { amount: '10.00' });
    store.addLine('1', TODAY);
    const added = store.lines()[1].uid;

    store.updateLine(added, { amount: '1.00' });
    store.setFull(added);

    expect(store.lines()[1].amount).toBe('290.00');
    store.setType(1, 'debit_adjustment');
    store.setFull(1);
    expect(store.lines()[0].amount).toBe('10.00');
  });

  it('requires the credit note id of a credit note', () => {
    store.init([first], TODAY);
    store.setType(1, 'credit_note');
    expect(store.lineErrors()[1]).toEqual(['AR.ERR_SOURCE_REQUIRED']);

    store.updateLine(1, { sourceId: 'cn-9' });
    expect(store.lineErrors()[1]).toBeUndefined();
  });

  it('loads only the unreconciled payments in the currency of the items', async () => {
    store.init([first], TODAY);

    await store.loadPayments();

    expect(api.getUnreconciledPayments).toHaveBeenCalledWith('c-1');
    expect(store.payments().map((payment) => payment.ledger_entry_id)).toEqual(['l-1']);
    expect(store.paymentsLoading()).toBe(false);
  });

  it('picks a payment: its date, reference and amount (capped by the residual) fill the line', async () => {
    store.init([first, second], TODAY);
    await store.loadPayments();

    store.pickPayment(1, 'l-1');

    expect(store.lines()[0]).toMatchObject({
      sourceId: 'l-1',
      reference: 'BONIFICO 12',
      valueDate: '2026-03-20',
      amount: '300.00',
    });
    expect(store.paymentRemaining()['l-1']).toBe('100.00');

    // The second line can take only what the payment has left.
    store.pickPayment(2, 'l-1');
    expect(store.lines()[1].amount).toBe('100.00');
    expect(store.lineErrors()[2]).toBeUndefined();
  });

  it('flags the lines of a payment used above its unallocated amount and clears the pick', async () => {
    store.init([first, second], TODAY);
    await store.loadPayments();
    store.pickPayment(1, 'l-1');
    store.updateLine(2, { sourceId: 'l-1', amount: '150.00' });

    expect(store.paymentRemaining()['l-1']).toBe('-50.00');
    expect(store.lineErrors()[2]).toEqual(['AR.ERR_PAYMENT_EXCEEDED']);
    // Every line that draws on the overdrawn payment is flagged.
    expect(store.lineErrors()[1]).toEqual(['AR.ERR_PAYMENT_EXCEEDED']);

    store.pickPayment(2, null);
    expect(store.lines()[1].sourceId).toBeNull();
    expect(store.lineErrors()[2]).toBeUndefined();
    expect(store.lineErrors()[1]).toBeUndefined();
  });

  it('removes a line', () => {
    store.init([first, second], TODAY);

    store.removeLine(1);

    expect(store.lines().map((line) => line.itemId)).toEqual(['2']);
  });

  it('submits one line per allocation, with the source only when there is one', async () => {
    store.init([first], TODAY);
    await store.loadPayments();
    store.pickPayment(1, 'l-1');
    store.updateLine(1, { notes: ' saldo ' });

    const result = await store.submit();

    expect(result.ok).toBe(true);
    expect(result.items).toHaveLength(1);
    expect(api.allocate).toHaveBeenCalledWith({
      allocations: [
        {
          receivable_item_id: '1',
          type: 'payment',
          amount: '300.00',
          value_date: '2026-03-20',
          source_id: 'l-1',
          reference: 'BONIFICO 12',
          notes: 'saldo',
        },
      ],
    });
    expect(store.saving()).toBe(false);
  });

  it('does not call the API for an invalid draft', async () => {
    store.init([first], TODAY);
    store.updateLine(1, { amount: '0.00' });

    const result = await store.submit();

    expect(result.ok).toBe(false);
    expect(api.allocate).not.toHaveBeenCalled();
  });

  it('keeps the draft and reports the errors when the API refuses', async () => {
    store.init([first], TODAY);
    api.allocate.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              message: 'Invalid',
              errors: { 'allocations.0.amount': ['The amount exceeds the open amount.'] },
            },
          }),
      ),
    );

    const result = await store.submit();

    expect(result.ok).toBe(false);
    expect(result.message).toBe('The amount exceeds the open amount.');
    expect(store.errors()).toEqual({
      'allocations.0.amount': ['The amount exceeds the open amount.'],
    });
    expect(store.lines()).toHaveLength(1);
    expect(store.saving()).toBe(false);
  });
});
