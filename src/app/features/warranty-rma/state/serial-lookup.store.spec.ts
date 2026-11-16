import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WarrantyRmaApiService } from '@core';
import { httpError, lookupFixture, rmaFixture } from '../testing/rma-fixtures';
import { RmaNotifier } from './action-result';
import { SerialLookupStore } from './serial-lookup.store';

describe('SerialLookupStore', () => {
  let store: InstanceType<typeof SerialLookupStore>;
  let api: { lookupSerial: ReturnType<typeof vi.fn>; issueRma: ReturnType<typeof vi.fn> };
  let notifier: { success: ReturnType<typeof vi.fn>; conflict: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      lookupSerial: vi.fn().mockReturnValue(of({ data: lookupFixture() })),
      issueRma: vi.fn(),
    };
    notifier = { success: vi.fn(), conflict: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        SerialLookupStore,
        { provide: WarrantyRmaApiService, useValue: api },
        { provide: RmaNotifier, useValue: notifier },
      ],
    });
    store = TestBed.inject(SerialLookupStore);
  });

  it('shows warranty status, expiry, days remaining, policy and RMA history for a known serial', async () => {
    await store.lookup('  SN123 ');
    expect(api.lookupSerial).toHaveBeenCalledWith('SN123');
    expect(store.outcome()).toBe('found');
    expect(store.result()?.warranty).toMatchObject({
      status: 'in_warranty',
      expiry_date: '2027-03-10',
      days_remaining: 120,
      policy_type: 'statutory_ch_24m',
    });
    expect(store.result()?.rma_history).toHaveLength(1);
  });

  it('reports serial_not_found on 404', async () => {
    api.lookupSerial.mockReturnValue(httpError(404, { message: 'x', code: 'serial_not_found' }));
    await store.lookup('XYZ');
    expect(store.outcome()).toBe('serial_not_found');
    expect(store.result()).toBeNull();
  });

  it('reports passport_missing with the stock hint to prefill the passport', async () => {
    api.lookupSerial.mockReturnValue(
      httpError(404, {
        message: 'x',
        code: 'passport_missing',
        stock_hint: { stock_serial_number_id: 'ss-1', serial_number: 'SN9' },
      }),
    );
    await store.lookup('SN9');
    expect(store.outcome()).toBe('passport_missing');
    expect(store.stockHint()).toEqual({ stock_serial_number_id: 'ss-1', serial_number: 'SN9' });
  });

  it('ignores empty input', async () => {
    await store.lookup('   ');
    expect(api.lookupSerial).not.toHaveBeenCalled();
  });

  it('issues an RMA, exposes the label with the tracking link once, then drops it', async () => {
    await store.lookup('SN123');
    api.issueRma.mockReturnValue(
      of({
        data: {
          ...rmaFixture({ status: 'awaiting_arrival', warranty_status: 'covered_in_warranty' }),
          label: {
            rma_number: 'RMA-2026-000123',
            serial_number: 'SN123',
            product_name: 'Printer',
            customer_name: 'ACME SA',
            return_address: 'Lab, Lugano',
            barcode_payload: 'RMA-2026-000123',
            tracking_url: 'https://app.test/rma-tracking?rma=RMA-2026-000123&token=raw',
            tracking_token: 'raw',
          },
        },
      }),
    );
    const res = await store.issueRma({
      equipment_passport_id: 'pp-1',
      reported_symptom: 'No power',
    });
    expect(res.ok).toBe(true);
    expect(store.issuedLabel()?.tracking_token).toBe('raw');
    expect(api.lookupSerial).toHaveBeenCalledTimes(2);

    store.dismissLabel();
    expect(store.issuedLabel()).toBeNull();
  });

  it('returns 422 to the form without a toast', async () => {
    api.issueRma.mockReturnValue(
      httpError(422, { message: 'x', errors: { reported_symptom: ['required'] } }),
    );
    const res = await store.issueRma({ equipment_passport_id: 'pp-1', reported_symptom: '' });
    expect(res).toMatchObject({ ok: false, status: 422 });
    expect(notifier.conflict).not.toHaveBeenCalled();
    expect(store.issuedLabel()).toBeNull();
  });
});
