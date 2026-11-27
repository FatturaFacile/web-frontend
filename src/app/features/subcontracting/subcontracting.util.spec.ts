import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { SctComponent, SctOrder } from '@core';
import {
  availableActions,
  buildOrderPayload,
  countdownOf,
  deadlineColor,
  emptyOrderForm,
  errorKey,
  failureOf,
  isoDay,
  plannedFor,
  progressOf,
  regimesFor,
  registerFilename,
  statusColor,
  stepIsValid,
} from './subcontracting.util';

const line = (overrides: Partial<SctComponent> = {}): SctComponent => ({
  id: 'c1',
  component_product_id: 'p1',
  sku: 'RAW',
  product_name: 'Raw steel',
  unit_of_measure: 'KG',
  required_qty_per_unit: '2.000000',
  total_planned_qty: '20.0000',
  dispatched_qty: '0.0000',
  consumed_qty: '0.0000',
  scrap_qty: '0.0000',
  returned_unused_qty: '0.0000',
  held_qty: '0.0000',
  to_dispatch_qty: '20.0000',
  lot_id: null,
  serial_number: null,
  ...overrides,
});

const order = (overrides: Partial<SctOrder> = {}): SctOrder =>
  ({
    id: 'o1',
    order_number: 'SCT-2026-00001',
    direction: 'passive',
    subcontracting_type: 'full_bom',
    status: 'draft',
    planned_quantity: '10.0000',
    received_quantity: '0.0000',
    scrap_quantity: '0.0000',
    delivered_quantity: '0.0000',
    open_quantity: '10.0000',
    components: [line()],
    ...overrides,
  }) as SctOrder;

describe('subcontracting util', () => {
  describe('actions of an order', () => {
    it('offers the confirmation or the cancellation of a draft', () => {
      expect(availableActions(order())).toEqual(['confirm', 'cancel']);
    });

    it('offers the dispatch of a confirmed passive order and the customer material of an active one', () => {
      expect(availableActions(order({ status: 'confirmed' }))).toEqual(['dispatch', 'cancel']);
      expect(availableActions(order({ status: 'confirmed', direction: 'active' }))).toEqual([
        'receiveMaterials',
        'cancel',
      ]);
    });

    it('offers the receipt and the return of the goods held by the vendor, nothing once everything went out and came back', () => {
      const dispatched = order({
        status: 'materials_dispatched',
        components: [line({ dispatched_qty: '20.0000', held_qty: '20.0000', to_dispatch_qty: '0.0000' })],
      });
      expect(availableActions(dispatched)).toEqual(['receive', 'returnUnused']);

      const partial = order({
        status: 'in_progress',
        components: [line({ dispatched_qty: '12.0000', held_qty: '12.0000', to_dispatch_qty: '8.0000' })],
      });
      expect(availableActions(partial)).toEqual(['dispatch', 'receive', 'returnUnused']);

      const drained = order({
        status: 'partially_returned',
        components: [line({ dispatched_qty: '20.0000', held_qty: '0.0000', to_dispatch_qty: '0.0000' })],
      });
      expect(availableActions(drained)).toEqual([]);
    });

    it('offers production and delivery on an active order that holds the material, and nothing on a closed order', () => {
      const active = order({
        direction: 'active',
        status: 'materials_dispatched',
        components: [line({ dispatched_qty: '20.0000', held_qty: '20.0000', to_dispatch_qty: '0.0000' })],
      });
      expect(availableActions(active)).toEqual(['produce', 'deliver']);

      const produced = order({
        direction: 'active',
        status: 'in_progress',
        received_quantity: '9.0000',
        open_quantity: '1.0000',
        components: [line({ dispatched_qty: '20.0000', held_qty: '2.0000', to_dispatch_qty: '0.0000' })],
      });
      expect(availableActions(produced)).toEqual(['produce', 'deliver']);

      expect(availableActions(order({ status: 'completed' }))).toEqual([]);
      expect(availableActions(order({ status: 'cancelled' }))).toEqual([]);
    });
  });

  describe('progress and countdown', () => {
    it('measures the progress by the units received (passive) or delivered (active) plus the scrap', () => {
      expect(progressOf(order({ received_quantity: '4.0000', scrap_quantity: '1.0000' }))).toBe(50);
      expect(progressOf(order({ direction: 'active', received_quantity: '9.0000', delivered_quantity: '3.0000' }))).toBe(30);
      expect(progressOf(order({ received_quantity: '30.0000' }))).toBe(100);
      expect(progressOf(order({ planned_quantity: '0.0000' }))).toBe(0);
    });

    it('turns the days to the statutory deadline into a countdown key', () => {
      expect(countdownOf(12)).toEqual({ key: 'subcontracting.countdown.left', days: 12 });
      expect(countdownOf(0)).toEqual({ key: 'subcontracting.countdown.left', days: 0 });
      expect(countdownOf(-5)).toEqual({ key: 'subcontracting.countdown.late', days: 5 });
      expect(countdownOf(null)).toBeNull();
    });

    it('colours the deadline green within the year, orange when expiring, red when expired', () => {
      expect(deadlineColor('ok')).toBe('green');
      expect(deadlineColor('warning')).toBe('orange');
      expect(deadlineColor('expired')).toBe('red');
      expect(deadlineColor('closed')).toBe('default');
      expect(statusColor('completed')).toBe('green');
    });
  });

  describe('order form', () => {
    it('lets a passive order use TPP and an active order TPA, never the other way round', () => {
      expect(regimesFor('passive')).toEqual(['none', 'tpp_outward_processing']);
      expect(regimesFor('active')).toEqual(['none', 'tpa_inward_processing']);
    });

    it('asks the basics before the wizard goes on, then the BOM or valid component lines', () => {
      const form = emptyOrderForm();
      expect(stepIsValid(0, form)).toBe(false);

      form.partner_id = 'v1';
      form.output_product_id = 'p9';
      form.planned_quantity = 10;
      expect(stepIsValid(0, form)).toBe(true);
      expect(stepIsValid(1, form)).toBe(true);

      expect(stepIsValid(2, form)).toBe(false);
      form.components = [{ component_product_id: 'p1', required_qty_per_unit: null, unit_of_measure: 'KG' }];
      expect(stepIsValid(2, form)).toBe(false);
      form.components = [{ component_product_id: 'p1', required_qty_per_unit: 2, unit_of_measure: 'KG' }];
      expect(stepIsValid(2, form)).toBe(true);

      form.components = [];
      form.bom_id = 'b1';
      expect(stepIsValid(2, form)).toBe(true);
    });

    it('builds the payload of a full-BOM order from explicit component lines', () => {
      const form = emptyOrderForm();
      Object.assign(form, {
        partner_id: 'v1',
        output_product_id: 'p9',
        planned_quantity: 10,
        unit_service_cost: 5.5,
        currency: 'eur',
        expected_return_date: new Date(2026, 6, 4),
        customs_regime: 'tpp_outward_processing',
        generate_service_purchase_order: true,
        routing_operation_label: '  OP30 Galvanizing ',
        components: [
          { component_product_id: 'p1', required_qty_per_unit: 2, unit_of_measure: 'KG' },
          { component_product_id: null, required_qty_per_unit: 1, unit_of_measure: 'PCS' },
        ],
      });

      expect(buildOrderPayload(form)).toEqual({
        direction: 'passive',
        subcontracting_type: 'full_bom',
        partner_id: 'v1',
        output_product_id: 'p9',
        planned_quantity: '10',
        unit_service_cost: '5.5',
        currency: 'EUR',
        customs_regime: 'tpp_outward_processing',
        expected_return_date: '2026-07-04',
        routing_operation_label: 'OP30 Galvanizing',
        generate_service_purchase_order: true,
        components: [{ component_product_id: 'p1', required_qty_per_unit: '2', unit_of_measure: 'KG' }],
      });
    });

    it('sends the BOM instead of the lines for a single operation order, and never asks an active order for a purchase order', () => {
      const form = emptyOrderForm();
      Object.assign(form, {
        direction: 'active',
        subcontracting_type: 'single_operation',
        partner_id: 'c1',
        output_product_id: 'p9',
        planned_quantity: 4,
        bom_id: 'b1',
        linked_production_order_id: 'mo1',
        generate_service_purchase_order: true,
      });

      const payload = buildOrderPayload(form);

      expect(payload.bom_id).toBe('b1');
      expect(payload.linked_production_order_id).toBe('mo1');
      expect(payload.components).toBeUndefined();
      expect(payload.generate_service_purchase_order).toBeUndefined();
    });

    it('previews the planned quantity of a line without rounding noise', () => {
      expect(plannedFor(0.1, 3)).toBe(0.3);
      expect(plannedFor(2.2, 10)).toBe(22);
      expect(plannedFor(null, 10)).toBe(0);
    });

    it('formats a calendar day in local time', () => {
      expect(isoDay(new Date(2026, 0, 5))).toBe('2026-01-05');
      expect(isoDay(null)).toBeNull();
      expect(registerFilename('csv', new Date(2026, 10, 27))).toBe('registro-conto-lavoro-2026-11-27.csv');
    });
  });

  describe('failures', () => {
    it('keys a refusal by the code of the problem, with its parameters and field errors', () => {
      const error = new HttpErrorResponse({
        status: 422,
        error: {
          code: 'dispatch_exceeds_plan',
          detail: 'Too much',
          params: { product: 'Steel', max: '8.0000', nested: { ignored: true } },
          errors: { quantity: ['Too big'] },
        },
      });

      const outcome = failureOf(error);

      expect(outcome.ok).toBe(false);
      expect(outcome.errorKey).toBe('subcontracting.error.dispatch_exceeds_plan');
      expect(outcome.params).toEqual({ product: 'Steel', max: '8.0000' });
      expect(outcome.detail).toBe('Too big');
      expect(errorKey(null)).toBe('subcontracting.error.generic');
      expect(failureOf(new Error('boom')).errorKey).toBe('subcontracting.error.generic');
    });
  });
});
