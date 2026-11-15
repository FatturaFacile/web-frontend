import { HttpErrorResponse } from '@angular/common/http';
import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../icons-provider';
import { PermissionsService, TmsCarrier, TmsTariffBand, TmsTariffTable, TmsTransportOrder, TmsTrip, TmsTripStop, TranslateService, TransportationApiService } from '@core';
import { TariffBandsEditorComponent } from './tariff-bands-editor.component';
import { TmsCarrierDetailComponent } from './tms-carrier-detail.component';
import { TmsOrderDetailComponent } from './tms-order-detail.component';
import { TmsTariffDetailComponent } from './tms-tariff-detail.component';
import { TmsTripDetailComponent } from './tms-trip-detail.component';
import { isRangeValid, moveId } from './transportation.util';
import { TRANSPORTATION_ROUTES } from './transportation.routes';

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };
const permissionsSpy = { canWrite: vi.fn().mockReturnValue(true) };

function configure(api: Record<string, unknown>, component: Type<unknown>, routeId = 'rec-1'): void {
  TestBed.configureTestingModule({
    imports: [component],
    providers: [
      provideRouter([]),
      { provide: TransportationApiService, useValue: api },
      { provide: PermissionsService, useValue: permissionsSpy },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => routeId } } } },
      provideNzIcons(icons),
    ],
  });
}

const carrierRef = { id: 'car-1', code: 'DHL', name: 'DHL Freight' };

const band = (id: string, overrides: Partial<TmsTariffBand> = {}): TmsTariffBand => ({
  id,
  tariff_table_id: 'tab-1',
  origin_zone: 'N',
  destination_zone: 'S',
  weight_from_kg: '0',
  weight_to_kg: '100',
  distance_from_km: '0',
  distance_to_km: null,
  fixed_amount: '10',
  price_per_kg: '0.5',
  price_per_km: '0',
  ...overrides,
});

const table: TmsTariffTable = {
  id: 'tab-1',
  carrier_id: 'car-1',
  name: 'Standard 2026',
  currency: 'EUR',
  valid_from: '2026-01-01',
  valid_to: null,
  rate_basis: 'weight',
  fuel_surcharge_percent: '5',
  minimum_charge: '20',
  is_active: true,
  notes: null,
  carrier: carrierRef,
};

const stop = (id: string, sequence: number, type: 'pickup' | 'delivery', status: 'pending' | 'completed' = 'pending'): TmsTripStop => ({
  id,
  trip_id: 'trip-1',
  sequence,
  stop_type: type,
  transport_order_id: 'ord-1',
  location: 'Via Roma 1',
  city: 'Milan',
  planned_arrival_at: null,
  actual_arrival_at: null,
  actual_departure_at: null,
  status,
  order_number: 'TO-1',
});

const trip = (status: TmsTrip['status'], stops: TmsTripStop[]): TmsTrip => ({
  id: 'trip-1',
  number: 'TR-1',
  status,
  carrier_id: 'car-1',
  vehicle_id: null,
  planned_start_at: null,
  planned_end_at: null,
  actual_start_at: null,
  actual_end_at: null,
  capacity_weight_kg: '1000',
  capacity_volume_cbm: null,
  planned_distance_km: '300',
  actual_distance_km: null,
  actual_cost: null,
  currency: 'EUR',
  total_weight_kg: '200',
  total_volume_cbm: '1',
  utilization_percent: '20',
  notes: null,
  carrier: carrierRef,
  stops,
});

const order: TmsTransportOrder = {
  id: 'ord-1',
  number: 'TO-1',
  reference: 'REF',
  status: 'planned',
  origin_name: 'Warehouse',
  origin_location: 'Via Roma 1',
  origin_city: 'Milan',
  origin_zone: null,
  destination_name: 'Customer',
  destination_location: 'Via Napoli 2',
  destination_city: 'Rome',
  destination_zone: null,
  pickup_from: null,
  pickup_to: null,
  delivery_from: null,
  delivery_to: null,
  weight_kg: '120',
  volume_cbm: '1',
  pallets: 2,
  distance_km: null,
  goods_description: null,
  carrier_id: 'car-1',
  currency: 'EUR',
  expected_cost: '90.00',
  actual_cost: null,
  trip_id: null,
  delivered_at: null,
  notes: null,
  carrier: carrierRef,
  trip: null,
  is_on_time: null,
};

describe('transportation utilities', () => {
  it('accepts an open ended or growing range only', () => {
    expect(isRangeValid('0', '')).toBe(true);
    expect(isRangeValid('0', '10')).toBe(true);
    expect(isRangeValid('10', '10')).toBe(false);
    expect(isRangeValid('', '0')).toBe(false);
  });

  it('moves an id inside the list and ignores a move out of it', () => {
    expect(moveId(['a', 'b', 'c'], 0, 1)).toEqual(['b', 'a', 'c']);
    expect(moveId(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveId(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });

  it('routes the detail screens', () => {
    const paths = TRANSPORTATION_ROUTES.map((route) => route.path);
    expect(paths).toEqual(expect.arrayContaining(['carriers/:id', 'tariffs/:id', 'orders/:id', 'trips/:id']));
  });
});

describe('TariffBandsEditorComponent', () => {
  const api = { getTariffBands: vi.fn(), createTariffBand: vi.fn(), updateTariffBand: vi.fn(), deleteTariffBand: vi.fn() };

  const create = () => {
    const fixture = TestBed.createComponent(TariffBandsEditorComponent);
    fixture.componentRef.setInput('tariffTableId', 'tab-1');
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getTariffBands.mockReturnValue(of({ data: [band('b-1')] }));
    configure(api, TariffBandsEditorComponent);
  });

  it('lists the bands of the table and creates a band with the nullable limits as null', () => {
    api.createTariffBand.mockReturnValue(of({ data: band('b-2') }));
    const component = create().componentInstance;

    expect(api.getTariffBands).toHaveBeenCalledWith('tab-1');
    expect(component.bands()).toHaveLength(1);

    component.startAdd();
    component.form.patchValue({ origin_zone: 'N', destination_zone: '', weight_from_kg: '100', weight_to_kg: '500', fixed_amount: '25' });
    expect(component.isValid()).toBe(true);
    component.save();

    expect(api.createTariffBand).toHaveBeenCalledWith({
      tariff_table_id: 'tab-1',
      origin_zone: 'N',
      destination_zone: null,
      weight_from_kg: '100',
      weight_to_kg: '500',
      distance_from_km: '0',
      distance_to_km: null,
      fixed_amount: '25',
      price_per_kg: '0',
      price_per_km: '0',
    });
    expect(component.editing()).toBeNull();
    expect(api.getTariffBands).toHaveBeenCalledTimes(2);
  });

  it('refuses a range whose upper limit is not above the lower limit', () => {
    const component = create().componentInstance;

    component.startAdd();
    component.form.patchValue({ weight_from_kg: '100', weight_to_kg: '50' });
    expect(component.rangesValid()).toBe(false);
    expect(component.isValid()).toBe(false);
    component.save();

    expect(api.createTariffBand).not.toHaveBeenCalled();
  });

  it('updates an existing band without the table id and shows the validation message of the API', () => {
    api.updateTariffBand.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { weight_from_kg: ['Overlapping band'] } } })));
    const component = create().componentInstance;

    component.startEdit(band('b-1'));
    expect(component.form.getRawValue().weight_to_kg).toBe('100');
    component.save();

    expect(api.updateTariffBand).toHaveBeenCalledWith('b-1', expect.not.objectContaining({ tariff_table_id: expect.anything() }));
    expect(messageSpy.error).toHaveBeenCalledWith('Overlapping band');
    expect(component.editing()).not.toBeNull();
  });

  it('deletes a band and reloads', () => {
    api.deleteTariffBand.mockReturnValue(of(undefined));
    const component = create().componentInstance;

    component.remove(band('b-1'));

    expect(api.deleteTariffBand).toHaveBeenCalledWith('b-1');
    expect(api.getTariffBands).toHaveBeenCalledTimes(2);
  });

  it('hides the editing controls without write access', () => {
    const fixture = TestBed.createComponent(TariffBandsEditorComponent);
    fixture.componentRef.setInput('tariffTableId', 'tab-1');
    fixture.componentRef.setInput('canEdit', false);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('TMS.ACTION_NEW_TARIFF_BAND');
  });
});

describe('TmsTariffDetailComponent', () => {
  const api = { getTariffTable: vi.fn(), getTariffBands: vi.fn() };

  it('loads the table and embeds the bands editor', () => {
    vi.clearAllMocks();
    api.getTariffTable.mockReturnValue(of({ data: table }));
    api.getTariffBands.mockReturnValue(of({ data: [band('b-1')] }));
    configure(api, TmsTariffDetailComponent, 'tab-1');
    const fixture = TestBed.createComponent(TmsTariffDetailComponent);
    fixture.detectChanges();

    expect(api.getTariffTable).toHaveBeenCalledWith('tab-1');
    expect(api.getTariffBands).toHaveBeenCalledWith('tab-1');
    expect(fixture.nativeElement.querySelector('app-tariff-bands-editor')).not.toBeNull();
  });
});

describe('TmsCarrierDetailComponent', () => {
  const api = { getCarrier: vi.fn(), getTariffTables: vi.fn() };

  it('loads the carrier with its tariff tables', () => {
    vi.clearAllMocks();
    const carrier: TmsCarrier = { id: 'car-1', code: 'DHL', name: 'DHL Freight', mode: 'road', service_level: null, currency: 'EUR', is_active: true, notes: null };
    api.getCarrier.mockReturnValue(of({ data: carrier }));
    api.getTariffTables.mockReturnValue(of({ data: [table] }));
    configure(api, TmsCarrierDetailComponent, 'car-1');
    const fixture = TestBed.createComponent(TmsCarrierDetailComponent);
    fixture.detectChanges();

    expect(api.getTariffTables).toHaveBeenCalledWith('car-1');
    expect(fixture.componentInstance.tables()).toEqual([table]);
    expect(fixture.nativeElement.textContent).toContain('Standard 2026');
  });
});

describe('TmsOrderDetailComponent', () => {
  const api = { getTransportOrder: vi.fn(), getTrackingEvents: vi.fn(), planTransportOrder: vi.fn(), cancelTransportOrder: vi.fn(), createTrackingEvent: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getTransportOrder.mockReturnValue(of({ data: order }));
    api.getTrackingEvents.mockReturnValue(of({ data: [{ id: 'e-1', transport_order_id: 'ord-1', event_type: 'picked_up', location: null, occurred_at: '2026-11-01T08:00:00Z', notes: null }] }));
    configure(api, TmsOrderDetailComponent, 'ord-1');
  });

  it('shows the shipment with the timeline of its tracking events', () => {
    const fixture = TestBed.createComponent(TmsOrderDetailComponent);
    fixture.detectChanges();

    expect(api.getTrackingEvents).toHaveBeenCalledWith('ord-1');
    expect(fixture.nativeElement.querySelectorAll('.tl-item')).toHaveLength(1);
  });

  it('records a tracking event for the shipment', () => {
    api.createTrackingEvent.mockReturnValue(of({ data: {} }));
    const fixture = TestBed.createComponent(TmsOrderDetailComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openEventDialog();
    expect(component.eventForm.invalid).toBe(true);
    component.eventForm.patchValue({ event_type: 'at_hub', occurred_at: '2026-11-02T10:30', location: 'Bologna hub' });
    component.saveEvent();

    expect(api.createTrackingEvent).toHaveBeenCalledWith({ transport_order_id: 'ord-1', event_type: 'at_hub', occurred_at: '2026-11-02T10:30', location: 'Bologna hub', notes: null });
    expect(component.eventDialog()).toBe(false);
  });

  it('cancels a planned shipment and reloads it', () => {
    api.cancelTransportOrder.mockReturnValue(of({ data: { ...order, status: 'cancelled' } }));
    const fixture = TestBed.createComponent(TmsOrderDetailComponent);
    fixture.detectChanges();

    fixture.componentInstance.cancel();

    expect(api.cancelTransportOrder).toHaveBeenCalledWith('ord-1');
    expect(api.getTransportOrder).toHaveBeenCalledTimes(2);
  });
});

describe('TmsTripDetailComponent', () => {
  const api = { getTrip: vi.fn(), reorderTripStops: vi.fn(), completeTripStop: vi.fn(), dispatchTrip: vi.fn(), startTrip: vi.fn(), completeTrip: vi.fn(), cancelTrip: vi.fn() };
  const stops = [stop('s-1', 1, 'pickup'), stop('s-2', 2, 'delivery')];

  const create = (record: TmsTrip) => {
    api.getTrip.mockReturnValue(of({ data: record }));
    configure(api, TmsTripDetailComponent, 'trip-1');
    const fixture = TestBed.createComponent(TmsTripDetailComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  };

  beforeEach(() => vi.clearAllMocks());

  it('reorders the stops of a planned trip and saves the sequence', () => {
    api.reorderTripStops.mockReturnValue(of({ data: trip('planned', stops) }));
    const component = create(trip('planned', [stop('s-1', 1, 'pickup'), stop('s-2', 2, 'pickup'), stop('s-3', 3, 'delivery')]));

    expect(component.canReorder()).toBe(true);
    expect(component.orderChanged()).toBe(false);
    component.move(1, -1);
    expect(component.orderedStops().map((s) => s.id)).toEqual(['s-2', 's-1', 's-3']);
    expect(component.orderChanged()).toBe(true);

    component.resetOrder();
    expect(component.orderChanged()).toBe(false);
    component.move(0, 1);
    component.saveOrder();

    expect(api.reorderTripStops).toHaveBeenCalledWith('trip-1', ['s-2', 's-1', 's-3']);
  });

  it('shows the message of the API when the order breaks pickup before delivery', () => {
    api.reorderTripStops.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { stop_ids: ['Pickup after delivery'] } } })));
    const component = create(trip('planned', stops));

    component.move(0, 1);
    component.saveOrder();

    expect(messageSpy.error).toHaveBeenCalledWith('Pickup after delivery');
  });

  it('does not offer the reorder once the trip is in progress and completes only the first pending stop', () => {
    api.completeTripStop.mockReturnValue(of({ data: trip('in_progress', stops) }));
    const component = create(trip('in_progress', stops));

    expect(component.canReorder()).toBe(false);
    expect(component.canComplete(stops[0])).toBe(true);
    expect(component.canComplete(stops[1])).toBe(false);

    component.openStopDialog(stops[0]);
    component.stopForm.patchValue({ arrived_at: '2026-11-02T09:00' });
    component.submit();

    expect(api.completeTripStop).toHaveBeenCalledWith('trip-1', 's-1', { arrived_at: '2026-11-02T09:00', departed_at: null });
    expect(component.dialog()).toBeNull();
  });

  it('completes the trip with the kilometres and the cost', () => {
    api.completeTrip.mockReturnValue(of({ data: trip('completed', stops) }));
    const component = create(trip('in_progress', [stop('s-1', 1, 'pickup', 'completed')]));

    component.openTripDialog();
    component.tripForm.patchValue({ actual_distance_km: '310', actual_cost: '' });
    component.submit();

    expect(api.completeTrip).toHaveBeenCalledWith('trip-1', { actual_distance_km: '310', actual_cost: null });
  });

  it('runs the lifecycle actions', () => {
    api.dispatchTrip.mockReturnValue(of({ data: trip('dispatched', stops) }));
    const component = create(trip('planned', stops));

    component.run('dispatch');

    expect(api.dispatchTrip).toHaveBeenCalledWith('trip-1');
    expect(api.getTrip).toHaveBeenCalledTimes(2);
  });
});
