import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GcBillingResult, GcContract, GcRoute, GcStop, GreenCareApiService } from '@core';
import { GreenCareContractsStore, GreenCarePlannerStore, GreenCareTreatmentsStore } from './green-care.stores';

const envelope = <T>(data: T) => of({ success: true, message: 'OK', data });

const stop = (id: string, routeId: string, overrides: Partial<GcStop> = {}): GcStop =>
  ({
    id,
    route_schedule_id: routeId,
    site_id: 's-1',
    stop_order: 1,
    planned_activities: ['mowing'],
    estimated_duration_minutes: 60,
    before_photos: [],
    after_photos: [],
    counts_toward_contract_passage: true,
    is_extra_passage: false,
    billing_status: 'included_in_contract',
    ...overrides,
  }) as GcStop;

const route = (id: string, overrides: Partial<GcRoute> = {}): GcRoute =>
  ({
    id,
    schedule_date: '2026-06-09',
    crew_team_id: 'c-1',
    weather_alert_status: 'clear',
    status: 'planned',
    stops: [stop(`${id}-st`, id)],
    ...overrides,
  }) as GcRoute;

describe('green care stores', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    api = {};
    TestBed.configureTestingModule({
      providers: [
        { provide: GreenCareApiService, useValue: api },
        GreenCarePlannerStore,
        GreenCareContractsStore,
        GreenCareTreatmentsStore,
      ],
    });
  });

  it('merges the rescheduled routes into the board and keeps the summary of the run', async () => {
    api['listRoutes'] = vi.fn(() => envelope([route('r-1'), route('r-2')]));
    api['rescheduleForWeather'] = vi.fn(() =>
      envelope({
        rescheduled_stops: 1,
        affected_routes: [route('r-1', { weather_alert_status: 'rescheduled_due_to_weather' })],
        routes: [route('r-1', { weather_alert_status: 'rescheduled_due_to_weather' })],
      }),
    );
    const store = TestBed.inject(GreenCarePlannerStore);

    await store.load({ from: '2026-06-08', to: '2026-06-14' });
    const outcome = await store.reschedule({ from: '2026-06-08', to: '2026-06-14' });

    expect(outcome.ok).toBe(true);
    expect(store.lastReschedule()?.rescheduled_stops).toBe(1);
    expect(store.routes().find((item) => item.id === 'r-1')?.weather_alert_status).toBe('rescheduled_due_to_weather');
    expect(store.routes().find((item) => item.id === 'r-2')?.weather_alert_status).toBe('clear');
    expect(store.rescheduling()).toBe(false);
  });

  it('replaces the stop with the one the API returns after an intervention (passage 17 of 16 is an extra passage)', async () => {
    api['listRoutes'] = vi.fn(() => envelope([route('r-1')]));
    api['logIntervention'] = vi.fn(() =>
      envelope(stop('r-1-st', 'r-1', { is_extra_passage: true, billing_status: 'ready_to_invoice', passage_number: 17, passage_included: 16 })),
    );
    const store = TestBed.inject(GreenCarePlannerStore);
    await store.load();

    const outcome = await store.logIntervention('r-1-st', {
      checkin_at: null,
      checkout_at: null,
      checkin_gps: null,
      checkout_gps: null,
      crew_hours: [],
      machinery_hours: [],
      materials: [],
      counts_toward_contract_passage: true,
    });

    const updated = store.routes()[0].stops[0];
    expect(outcome.ok).toBe(true);
    expect(updated.is_extra_passage).toBe(true);
    expect(updated.billing_status).toBe('ready_to_invoice');
    expect(updated.passage_number).toBe(17);
  });

  it('reports the translated refusal of a failed optimisation instead of throwing', async () => {
    api['optimizeRoutes'] = vi.fn(() =>
      throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'no_crews_available' } })),
    );
    const store = TestBed.inject(GreenCarePlannerStore);

    const outcome = await store.optimize({ week_start: '2026-06-08' });

    expect(outcome).toMatchObject({ ok: false, errorKey: 'greenCare.error.no_crews_available' });
    expect(store.optimizing()).toBe(false);
  });

  it('keeps the invoice preview with the 4% condominium withholding and refreshes the contract after generating it', async () => {
    const billing: GcBillingResult = {
      lines: [],
      total_net: 1000,
      total_vat: 220,
      withholding: { applies: true, percent: 4, base: 1000, amount: 40, type: 'RT02', reason: 'A' },
      net_payable: 1180,
      jurisdiction: 'IT',
      condominium: { fiscal_code: '90012345678', administrator_name: 'Studio Rossi' },
      invoice_id: 'inv-1',
      invoice_status: 'draft',
    };
    const contract = { id: 'k-1', contract_number: 'GC-1' } as GcContract;
    api['listContracts'] = vi.fn(() => envelope([{ ...contract, completed_passages_count: 16 }]));
    api['previewBilling'] = vi.fn(() => envelope({ ...billing, invoice_id: null }));
    api['generateInvoice'] = vi.fn(() => envelope(billing));
    api['getContract'] = vi.fn(() => envelope({ ...contract, completed_passages_count: 17 }));
    const store = TestBed.inject(GreenCareContractsStore);
    await store.load();

    await store.previewBilling('k-1', {});
    expect(store.billing()?.withholding?.amount).toBe(40);
    expect(store.billing()?.invoice_id).toBeNull();

    await store.generateInvoice('k-1', {});
    expect(store.billing()?.invoice_id).toBe('inv-1');
    expect((store.contracts()[0] as GcContract & { completed_passages_count: number }).completed_passages_count).toBe(17);
    expect(store.billingBusy()).toBe(false);
  });

  it('keeps the licence check of the operator and clears it on request', async () => {
    api['validateLicense'] = vi.fn(() =>
      envelope({ valid: false, license: null, reason: 'operator_license_expired', jurisdiction: 'CH' }),
    );
    const store = TestBed.inject(GreenCareTreatmentsStore);

    await store.checkLicense('m-1', '2026-06-10', 's-1');
    expect(api['validateLicense']).toHaveBeenCalledWith({ operator_id: 'm-1', treatment_date: '2026-06-10', site_id: 's-1' });
    expect(store.licenseCheck()?.reason).toBe('operator_license_expired');

    store.clearLicenseCheck();
    expect(store.licenseCheck()).toBeNull();
  });
});
