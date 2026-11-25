import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PassengerTransportApiService } from '@core';
import { ContractsBillingStore } from './contracts-billing.store';

const envelope = <T>(data: T) => of({ success: true, message: '', data });
const list = (data: unknown[]) => of({ success: true, message: '', data, meta: {} });
const row = (customer: string, gross: string, count: number) => ({
  customer_id: customer,
  customer_name: customer,
  currency: 'EUR',
  bookings_count: count,
  booking_ids: [],
  booking_codes: [],
  monthly_flat_amount: null,
  total_net: gross,
  total_tax: '0.00',
  total_gross: gross,
  concierge_commission: '0.00',
});

describe('ContractsBillingStore', () => {
  const api = {
    listHotelContracts: vi.fn(),
    listSchoolContracts: vi.fn(),
    getLedger: vi.fn(),
    listBookings: vi.fn(),
    previewMonth: vi.fn(),
    invoiceMonth: vi.fn(),
    subcontractBooking: vi.fn(),
  };
  let store: InstanceType<typeof ContractsBillingStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listHotelContracts.mockReturnValue(list([{ id: 'h1' }]));
    api.listSchoolContracts.mockReturnValue(list([{ id: 's1' }]));
    api.getLedger.mockReturnValue(envelope({ rows: [], partners: [] }));
    api.listBookings.mockReturnValue(
      list([
        { id: 'b1', editable: true },
        { id: 'b2', editable: false },
      ]),
    );
    api.previewMonth.mockReturnValue(envelope([row('c1', '100.00', 2), row('c2', '50.50', 1)]));
    TestBed.configureTestingModule({
      providers: [ContractsBillingStore, { provide: PassengerTransportApiService, useValue: api }],
    });
    store = TestBed.inject(ContractsBillingStore);
  });

  it('loads contracts, ledger and the month preview and totals the preview', async () => {
    await store.init();

    expect(store.hotelContracts()).toHaveLength(1);
    expect(store.schoolContracts()).toHaveLength(1);
    expect(store.exchangeable().map((booking) => booking.id)).toEqual(['b1']);
    expect(store.previewBookings()).toBe(3);
    expect(store.previewTotal()).toBeCloseTo(150.5);
  });

  it('issues the invoices of the selected customers for the period and refreshes the preview', async () => {
    await store.init();
    api.invoiceMonth.mockReturnValue(
      envelope([
        {
          customer_id: 'c1',
          invoice_id: 'i1',
          invoice_number: 'FA-1',
          bookings_count: 2,
          total_gross: '100.00',
        },
      ]),
    );

    const outcome = await store.issue(['c1']);

    expect(outcome.ok).toBe(true);
    expect(api.invoiceMonth).toHaveBeenCalledWith(store.period(), ['c1']);
    expect(store.issued()[0].invoice_number).toBe('FA-1');
    expect(api.previewMonth).toHaveBeenCalledTimes(2);
  });

  it('passes the exchange to the API and reloads the ledger', async () => {
    await store.init();
    api.subcontractBooking.mockReturnValue(envelope({}));

    const outcome = await store.exchange('b1', 'cede', 'carrier-1', '80.00');

    expect(outcome.ok).toBe(true);
    expect(api.subcontractBooking).toHaveBeenCalledWith('b1', 'cede', 'carrier-1', '80.00');
    expect(api.getLedger).toHaveBeenCalledTimes(2);
  });
});
