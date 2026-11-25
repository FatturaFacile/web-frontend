import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PassengerTransportApiService } from '@core';
import { BookingsStore } from './bookings.store';

const page = (data: unknown[], total = data.length) => ({
  success: true,
  message: '',
  data,
  meta: { current_page: 1, per_page: 25, total, last_page: 1 },
});

describe('BookingsStore', () => {
  const api = {
    getLookups: vi.fn(),
    listBookings: vi.fn(),
    quoteBooking: vi.fn(),
    createBooking: vi.fn(),
    transitionBooking: vi.fn(),
    invoiceBooking: vi.fn(),
  };
  let store: InstanceType<typeof BookingsStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.getLookups.mockReturnValue(
      of({
        success: true,
        message: '',
        data: { jurisdiction: 'CH', airports: [], border_crossings: [], currencies: ['CHF'] },
      }),
    );
    api.listBookings.mockReturnValue(of(page([{ id: 'b1' }, { id: 'b2' }], 2)));
    TestBed.configureTestingModule({
      providers: [BookingsStore, { provide: PassengerTransportApiService, useValue: api }],
    });
    store = TestBed.inject(BookingsStore);
  });

  it('loads the lookups and the first page on init', async () => {
    await store.init();

    expect(store.jurisdiction()).toBe('CH');
    expect(store.currencies()).toEqual(['CHF']);
    expect(store.bookings()).toHaveLength(2);
    expect(store.total()).toBe(2);
    expect(api.listBookings).toHaveBeenCalledWith({ per_page: 25, page: 1 });
  });

  it('applies filters from the first page', async () => {
    await store.init();
    await store.setPage(3);
    await store.setFilters({ status: 'confirmed' });

    expect(api.listBookings).toHaveBeenLastCalledWith({
      per_page: 25,
      page: 1,
      status: 'confirmed',
    });
  });

  it('keeps the quote and clears it on request', async () => {
    api.quoteBooking.mockReturnValue(
      of({ success: true, message: '', data: { vat: { total_gross: '110.00' } } }),
    );

    const outcome = await store.quote({
      service_type: 'airport_transfer',
      pickup_datetime: '2028-03-10 10:00:00',
      pickup_address: 'a',
      dropoff_address: 'b',
      agreed_price_net: 100,
    });

    expect(outcome.ok).toBe(true);
    expect(store.quote()?.vat.total_gross).toBe('110.00');
    store.clearQuote();
    expect(store.quote()).toBeNull();
  });

  it('reloads the list after a write and reports a refused transition', async () => {
    api.transitionBooking.mockReturnValue(of({ success: true, message: '', data: {} }));
    await store.init();
    const ok = await store.transition('b1', 'confirm');
    expect(ok.ok).toBe(true);
    expect(api.listBookings).toHaveBeenCalledTimes(2);

    api.transitionBooking.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: {
              code: 'booking_transition_refused',
              params: { action: 'confirm', status: 'draft' },
            },
          }),
      ),
    );
    const refused = await store.transition('b1', 'confirm');
    expect(refused.ok).toBe(false);
    expect(refused.errorKey).toBe('passengerTransport.error.booking_transition_refused');
    expect(refused.params).toEqual({ action: 'confirm', status: 'draft' });
    expect(store.saving()).toBe(false);
  });
});
