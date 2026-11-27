import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  dpChain,
  dpDeposit,
  dpInstallment,
  dpLink,
  dpPlanPreview,
} from '../../../testing/down-payments-fixtures';
import {
  buildTimeline,
  canConfirmProforma,
  canCreditNote,
  canEmit,
  canSettle,
  checkRow,
  creditableGross,
  DpMilestoneRow,
  errorKey,
  failureOf,
  fromCents,
  heldEarnest,
  inputOf,
  isoDay,
  progressOf,
  rowIsValid,
  sumCents,
  toCents,
} from './down-payments.util';

const row = (overrides: Partial<DpMilestoneRow> = {}): DpMilestoneRow => ({
  key: 1,
  label: '',
  trigger: 'on_order_confirmation',
  mode: 'percentage',
  value: 30,
  instrument: 'advance_invoice_immediate',
  dueDate: null,
  ...overrides,
});

describe('down payments util', () => {
  describe('errors', () => {
    it('builds the key of the dictionary from the code of the problem', () => {
      expect(errorKey('open_proformas')).toBe('down_payments.error.open_proformas');
      expect(errorKey(null)).toBe('down_payments.error.generic');
    });

    it('reads the code, the scalar parameters and the detail of a refused call', () => {
      const error = new HttpErrorResponse({
        status: 422,
        error: {
          code: 'plan_exceeds_contract',
          detail: 'Too much',
          params: { contract_gross: '1220.00', nested: { a: 1 } },
        },
      });

      const outcome = failureOf(error);

      expect(outcome.ok).toBe(false);
      expect(outcome.errorKey).toBe('down_payments.error.plan_exceeds_contract');
      expect(outcome.params).toEqual({ contract_gross: '1220.00' });
      expect(outcome.detail).toBe('Too much');
    });

    it('falls back to the generic key when the failure is not a problem', () => {
      expect(failureOf(new Error('offline')).errorKey).toBe('down_payments.error.generic');
    });
  });

  describe('amounts', () => {
    it('works in cents without floating point drift', () => {
      expect(toCents('0.29')).toBe(29);
      expect(toCents('1220.10')).toBe(122010);
      expect(sumCents(['0.10', '0.20'])).toBe(30);
      expect(fromCents(30)).toBe('0.30');
    });

    it('formats a picked day as an ISO date', () => {
      expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05');
      expect(isoDay(null)).toBeNull();
    });
  });

  describe('cent-exact check of a plan row', () => {
    it('accepts the slices that add up to the installment', () => {
      const plan = dpPlanPreview();

      expect(checkRow(plan.installments[0]).exact).toBe(true);
    });

    it('flags a slice that drifts from the installment by a cent', () => {
      const [first] = dpPlanPreview().installments;
      const drifted = { ...first, vat_breakdown: [{ ...first.vat_breakdown[0], vat: '110.01' }] };

      const check = checkRow(drifted);

      expect(check.exact).toBe(false);
      expect(check.vatOk).toBe(false);
      expect(check.vatDelta).toBe('0.01');
    });

    it('has nothing to verify on a deposit that is not split over the VAT rates', () => {
      const [first] = dpPlanPreview().installments;

      expect(checkRow({ ...first, vat_breakdown: [] }).exact).toBe(true);
    });
  });

  describe('progress bar', () => {
    it('splits the contract into deposits, advances net of credit notes and residual', () => {
      const chain = dpChain({
        total_contract_gross: '1000.00',
        total_earnest_deposits_held: '100.00',
        total_security_deposits_held: '0.00',
        total_advance_invoiced_gross: '400.00',
        total_credited_advances_gross: '100.00',
        residual_order_gross: '600.00',
      });

      const progress = progressOf(chain);

      expect(progress.deposits).toBe(10000);
      expect(progress.advances).toBe(30000);
      expect(progress.residual).toBe(60000);
      expect(progress.depositsPercent).toBe(10);
      expect(progress.advancesPercent).toBe(30);
      expect(progress.residualPercent).toBe(60);
    });

    it('never fills more than the bar', () => {
      const progress = progressOf(
        dpChain({
          total_contract_gross: '100.00',
          total_advance_invoiced_gross: '0.00',
          residual_order_gross: '500.00',
        }),
      );

      expect(progress.residualPercent).toBe(100);
    });
  });

  describe('timeline', () => {
    it('starts with the source and lists the documents chronologically', () => {
      const chain = dpChain({
        links: [
          dpLink({
            id: 'l2',
            link_type: 'credit_note_td04',
            document_number: 'NC-1',
            document_date: '2026-12-20',
            status: 'issued',
          }),
          dpLink({ id: 'l1', document_date: '2026-12-05' }),
          dpLink({
            id: 'l3',
            link_type: 'final_settlement_td01',
            document_number: 'F-1',
            document_date: '2026-12-20',
            status: 'settled',
          }),
        ],
        deposits: [dpDeposit({ issue_date: '2026-12-01' })],
      });

      const items = buildTimeline(chain);

      expect(items.map((item) => item.kind)).toEqual(['source', 'deposit', 'link', 'link', 'link']);
      expect(items[0].labelKey).toBe('down_payments.sourceType.sales_order');
      expect(items.slice(1).map((item) => item.number)).toEqual([
        'CAP-2026-1',
        'AC-2026-1',
        'NC-1',
        'F-1',
      ]);
    });

    it('lists a deposit once when the API also lists it as a link', () => {
      const chain = dpChain({
        links: [dpLink({ id: 'l9', link_type: 'earnest_money_deposit', document_id: 'd1' })],
        deposits: [dpDeposit({ id: 'd1' })],
      });

      expect(buildTimeline(chain).filter((item) => item.kind !== 'source')).toHaveLength(1);
    });
  });

  describe('what a row can do', () => {
    it('emits only the planned installments of an open chain', () => {
      const chain = dpChain();

      expect(canEmit(chain, dpInstallment({ status: 'planned' }))).toBe(true);
      expect(canEmit(chain, dpInstallment({ status: 'invoiced' }))).toBe(false);
      expect(canEmit(dpChain({ status: 'settled' }), dpInstallment({ status: 'planned' }))).toBe(
        false,
      );
    });

    it('confirms the payment of an open pro-forma only', () => {
      const chain = dpChain();

      expect(
        canConfirmProforma(
          chain,
          dpLink({ link_type: 'proforma_advance_request', status: 'open' }),
        ),
      ).toBe(true);
      expect(
        canConfirmProforma(
          chain,
          dpLink({ link_type: 'proforma_advance_request', status: 'converted' }),
        ),
      ).toBe(false);
      expect(canConfirmProforma(chain, dpLink())).toBe(false);
    });

    it('credits an issued advance invoice while something of it is open and the chain is not settled', () => {
      expect(canCreditNote(dpChain(), dpLink())).toBe(true);
      expect(
        canCreditNote(
          dpChain(),
          dpLink({ status: 'partially_credited', credited_gross_amount: '100.00' }),
        ),
      ).toBe(true);
      expect(
        canCreditNote(dpChain(), dpLink({ status: 'credited', credited_gross_amount: '366.00' })),
      ).toBe(false);
      expect(canCreditNote(dpChain({ final_invoice_id: 'f1' }), dpLink())).toBe(false);
      expect(
        creditableGross(dpLink({ credited_gross_amount: '66.00', settled_gross_amount: '100.00' })),
      ).toBe('200.00');
    });

    it('settles a chain that is open and has no final invoice yet', () => {
      expect(canSettle(dpChain())).toBe(true);
      expect(canSettle(dpChain({ final_invoice_id: 'f1' }))).toBe(false);
      expect(canSettle(dpChain({ status: 'cancelled' }))).toBe(false);
    });

    it('lists the earnest money that blocks the settlement, security deposits excluded', () => {
      const chain = dpChain({
        deposits: [
          dpDeposit({ id: 'd1', status: 'held_active' }),
          dpDeposit({
            id: 'd2',
            status: 'held_active',
            deposit_type: 'security_deposit_cauzionale',
          }),
          dpDeposit({ id: 'd3', status: 'deducted_in_final_invoice' }),
        ],
      });

      expect(heldEarnest(chain).map((deposit) => deposit.id)).toEqual(['d1']);
    });
  });

  describe('wizard rows', () => {
    it('sends a percentage or a two-decimal amount depending on the calculation mode', () => {
      expect(inputOf(row({ value: 30 }))).toEqual({
        trigger_type: 'on_order_confirmation',
        calculation_mode: 'percentage',
        instrument_type: 'advance_invoice_immediate',
        percentage: '30',
      });
      expect(
        inputOf(
          row({
            mode: 'fixed_gross',
            value: 250,
            label: ' Deposit ',
            dueDate: new Date(2026, 11, 31),
          }),
        ),
      ).toEqual({
        trigger_type: 'on_order_confirmation',
        calculation_mode: 'fixed_gross',
        instrument_type: 'advance_invoice_immediate',
        milestone_label: 'Deposit',
        due_date: '2026-12-31',
        amount: '250.00',
      });
    });

    it('needs a positive value, at most 100 percent and a date for the fixed-date trigger', () => {
      expect(rowIsValid(row({ value: null }))).toBe(false);
      expect(rowIsValid(row({ value: 101 }))).toBe(false);
      expect(rowIsValid(row({ mode: 'fixed_net', value: 101 }))).toBe(true);
      expect(rowIsValid(row({ trigger: 'custom_date' }))).toBe(false);
      expect(rowIsValid(row({ trigger: 'custom_date', dueDate: new Date(2026, 11, 31) }))).toBe(
        true,
      );
    });
  });
});
