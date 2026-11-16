import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LogisticsApiService, StockTransferResource } from '@core';
import { icons } from '../../../../icons-provider';
import { TransferDispatchDrawerComponent } from './transfer-dispatch-drawer.component';
import { TransferReceiptModalComponent } from './transfer-receipt-modal.component';
import { TransferTrackerComponent } from './transfer-tracker.component';

const transfer = (patch: Partial<StockTransferResource> = {}): StockTransferResource => ({
  id: 't1',
  transfer_number: 'TR-1',
  purpose: 'inter_warehouse',
  status: 'in_transit',
  origin_warehouse_id: 'w1',
  transit_bin_id: null,
  destination_warehouse_id: 'w2',
  delivery_note_id: null,
  is_inter_company: false,
  shipped_at: null,
  received_at: null,
  lines: [
    {
      id: 'l1',
      product_id: 'p1',
      description: null,
      quantity: 10,
      shipped_qty: 10,
      received_qty: 0,
      damaged_qty: 0,
      discrepancy_qty: 0,
      discrepancy_reason: null,
    },
    {
      id: 'l2',
      product_id: 'p2',
      description: null,
      quantity: 5,
      shipped_qty: 5,
      received_qty: 5,
      damaged_qty: 0,
      discrepancy_qty: 0,
      discrepancy_reason: null,
    },
  ],
  ...patch,
});

const envelope = (data: StockTransferResource) => of({ success: true, message: '', data });

describe('transfer workflow components', () => {
  const api = {
    receiveTransfer: vi.fn(),
    shipTransfer: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        { provide: LogisticsApiService, useValue: api },
      ],
    });
  });

  describe('TransferReceiptModalComponent', () => {
    const create = (t: StockTransferResource | null) => {
      const fixture = TestBed.createComponent(TransferReceiptModalComponent);
      fixture.componentRef.setInput('transfer', t);
      fixture.detectChanges();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { fixture, c: fixture.componentInstance as any };
    };

    it('lists only the lines still in transit and defaults to a clean full receipt', () => {
      const { c } = create(transfer());

      expect(c.rows().map((r: { line: { id: string } }) => r.line.id)).toEqual(['l1']);
      expect(c.validation().valid).toBe(true);
      expect(c.validation().hasDiscrepancy).toBe(false);
    });

    it('highlights a shortage and demands a reason before it can be confirmed', () => {
      const { c } = create(transfer());

      c.setGood('l1', 7);
      expect(c.rows()[0].variance.shortage).toBe(3);
      expect(c.validation().valid).toBe(false);
      expect(c.validation().lineIssues['l1']).toEqual(['REASON_REQUIRED']);

      c.setReason('l1', 'Lost by the carrier');
      expect(c.validation().valid).toBe(true);
      expect(c.validation().hasDiscrepancy).toBe(true);
    });

    it('rejects good + damaged above the outstanding quantity', () => {
      const { c } = create(transfer());

      c.setGood('l1', 8);
      c.setDamaged('l1', 3);
      c.setReason('l1', 'Crushed');

      expect(c.validation().valid).toBe(false);
      expect(c.validation().lineIssues['l1']).toContain('EXCEEDS_OUTSTANDING');
    });

    it('a partial receipt keeps the rest in transit and sends final=false with explicit lines', () => {
      api.receiveTransfer.mockReturnValue(envelope(transfer({ status: 'partially_received' })));
      const { fixture, c } = create(transfer());
      const received = vi.fn();
      fixture.componentInstance.received.subscribe(received);

      c.partial.set(true);
      c.setGood('l1', 4);
      expect(c.validation().valid).toBe(true);
      c.confirm();

      expect(api.receiveTransfer).toHaveBeenCalledWith(
        't1',
        [{ line_id: 'l1', received_qty: 4, damaged_qty: 0, discrepancy_reason: null }],
        false,
      );
      expect(received).toHaveBeenCalledTimes(1);
    });

    it('refuses an empty partial receipt', () => {
      const { c } = create(transfer());
      c.partial.set(true);
      c.setGood('l1', 0);

      expect(c.validation().nothingReceived).toBe(true);
      c.confirm();
      expect(api.receiveTransfer).not.toHaveBeenCalled();
    });

    it('shows the API business error and stays open', () => {
      api.receiveTransfer.mockReturnValue(
        throwError(() => ({ error: { success: false, message: 'Already received' } })),
      );
      const { fixture, c } = create(transfer());
      const received = vi.fn();
      fixture.componentInstance.received.subscribe(received);

      c.confirm();

      expect(c.error()).toBe('Already received');
      expect(c.busy()).toBe(false);
      expect(received).not.toHaveBeenCalled();
    });

    it('starts over for the next transfer', () => {
      const { fixture, c } = create(transfer());
      c.partial.set(true);
      c.setGood('l1', 1);

      fixture.componentRef.setInput('transfer', transfer({ id: 't2' }));
      fixture.detectChanges();

      expect(c.partial()).toBe(false);
      expect(c.inputs()['l1'].good).toBe(10);
    });
  });

  describe('TransferDispatchDrawerComponent', () => {
    const create = (t: StockTransferResource | null) => {
      const fixture = TestBed.createComponent(TransferDispatchDrawerComponent);
      fixture.componentRef.setInput('transfer', t);
      fixture.detectChanges();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { fixture, c: fixture.componentInstance as any };
    };

    it('derives the fiscal transport reason and DDT type from the purpose', () => {
      const { c } = create(transfer({ status: 'approved', purpose: 'subcontracting' }));

      expect(c.reason()).toBe('subcontracting');
      expect(c.ddtType()).toBe('subcontracting_out');
      expect(c.showsPrices()).toBe(true);
      expect(c.interCompany()).toBe(false);
    });

    it('announces the invoice of an inter-company transfer', () => {
      const { c } = create(
        transfer({ status: 'approved', purpose: 'inter_company', is_inter_company: true }),
      );
      expect(c.interCompany()).toBe(true);
    });

    it('requires a carrier name while a carrier transports, then moves to the preview', () => {
      const { c } = create(transfer({ status: 'approved' }));
      expect(c.canContinue()).toBe(false);
      c.next();
      expect(c.step()).toBe(0);

      c.form.controls.carrier_name.setValue('DHL');
      expect(c.canContinue()).toBe(true);
      c.next();
      expect(c.step()).toBe(1);

      c.back();
      c.form.controls.transport_by.setValue('sender');
      c.form.controls.carrier_name.setValue('');
      expect(c.canContinue()).toBe(true);
    });

    it('ships with the collected transport data and reports the result', () => {
      api.shipTransfer.mockReturnValue(envelope(transfer({ status: 'in_transit' })));
      const { fixture, c } = create(transfer({ status: 'approved' }));
      const shipped = vi.fn();
      fixture.componentInstance.shipped.subscribe(shipped);

      c.form.patchValue({
        carrier_name: ' DHL ',
        carrier_license_plate: 'AB123CD',
        packages_count: 3,
        gross_weight_kg: 12.5,
      });
      c.next();
      c.confirm();

      expect(api.shipTransfer).toHaveBeenCalledWith('t1', {
        transport_by: 'carrier',
        carriage_terms: 'free',
        carrier_name: 'DHL',
        carrier_license_plate: 'AB123CD',
        packages_count: 3,
        gross_weight_kg: 12.5,
      });
      expect(shipped).toHaveBeenCalledTimes(1);
    });

    it('keeps the wizard open and shows the business error when shipping fails', () => {
      api.shipTransfer.mockReturnValue(
        throwError(() => ({
          error: { success: false, message: 'Only approved transfers can be shipped' },
        })),
      );
      const { c } = create(transfer({ status: 'approved' }));
      c.form.controls.carrier_name.setValue('DHL');
      c.next();
      c.confirm();

      expect(c.error()).toBe('Only approved transfers can be shipped');
      expect(c.step()).toBe(1);
    });
  });

  describe('TransferTrackerComponent', () => {
    it('reflects the status on the five step tracker', () => {
      const fixture = TestBed.createComponent(TransferTrackerComponent);
      fixture.componentRef.setInput('status', 'discrepancy_pending');
      fixture.detectChanges();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = fixture.componentInstance as any;

      expect(c.steps).toHaveLength(5);
      expect(c.state()).toMatchObject({ current: 3, status: 'error' });
      expect(c.description('received')).toBe('LOGISTICS.TRACKER.DISCREPANCY');

      fixture.componentRef.setInput('status', 'partially_received');
      fixture.detectChanges();
      expect(c.description('received')).toBe('LOGISTICS.TRACKER.PARTIAL');
      expect(c.description('shipped')).toBeNull();
    });
  });
});
