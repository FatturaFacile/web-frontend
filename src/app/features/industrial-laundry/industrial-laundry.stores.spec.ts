import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IndustrialLaundryApiService } from '@core';
import { BillingStore } from './billing.store';
import { DashboardStore } from './dashboard.store';
import { DormantStore } from './dormant.store';
import { LockersStore } from './lockers.store';
import { PpeMonitorStore } from './ppe-monitor.store';
import { RabcConsoleStore } from './rabc-console.store';

const ok = <T>(data: T) => of({ success: true, message: '', data });
const problem = (code: string, status = 422) =>
  throwError(() => new HttpErrorResponse({ status, error: { code, detail: 'refused' } }));

const customers = [
  { id: 'c1', name: 'Hotel Bellavista' },
  { id: 'c2', name: 'RSA Villa Serena' },
];

type Mock = ReturnType<typeof vi.fn>;

function setup<T>(token: new (...args: never[]) => T, api: Record<string, Mock>): T {
  TestBed.configureTestingModule({
    // The stores are component-scoped (no providedIn), so they must be provided explicitly.
    providers: [{ provide: IndustrialLaundryApiService, useValue: api }, token as never],
  });
  return TestBed.inject(token as never) as T;
}

const lookups = () =>
  ok({
    customers,
    programs: [{ code: 'THERMAL_71_3MIN' }],
    nominal_article_types: ['personal_workwear_uniform'],
    defaults: { dormant_days: 45 },
  });

describe('Industrial laundry stores', () => {
  beforeEach(() => TestBed.resetTestingModule());

  describe('DashboardStore', () => {
    it('loads the lookups and the par stock, then reloads with the filters', async () => {
      const api = { getLookups: vi.fn(lookups), getParStock: vi.fn(() => ok([{ customer_id: 'c1' }])) };
      const store = setup(DashboardStore, api) as InstanceType<typeof DashboardStore>;

      await store.init();

      expect(store.customers()).toHaveLength(2);
      expect(store.rows()).toHaveLength(1);

      await store.setFilters({ segment: 'hotel', customerId: 'c1' });

      expect(api.getParStock).toHaveBeenLastCalledWith({ segment: 'hotel', customer_id: 'c1' });
      await store.setFilters({ segment: null });
      expect(api.getParStock).toHaveBeenLastCalledWith({ segment: undefined, customer_id: 'c1' });
    });

    it('keeps the translated error key when the load fails', async () => {
      const api = { getLookups: vi.fn(lookups), getParStock: vi.fn(() => problem('forbidden', 403)) };
      const store = setup(DashboardStore, api) as InstanceType<typeof DashboardStore>;

      await store.init();

      expect(store.error()).toBe('industrialLaundry.error.forbidden');
      expect(store.loading()).toBe(false);
    });
  });

  describe('PpeMonitorStore', () => {
    it('counts the garments at the limit and near it and sends the decision', async () => {
      const alerts = [{ status: 'limit_reached' }, { status: 'near_limit' }, { status: 'near_limit' }];
      const api = {
        getLookups: vi.fn(lookups),
        getPpeAlerts: vi.fn(() => ok(alerts)),
        decidePpe: vi.fn(() => ok({})),
      };
      const store = setup(PpeMonitorStore, api) as InstanceType<typeof PpeMonitorStore>;

      await store.init();

      expect(store.reachedCount()).toBe(1);
      expect(store.nearCount()).toBe(2);
      expect(store.customerName()('c2')).toBe('RSA Villa Serena');

      const outcome = await store.decide('g1', { action: 'condemn' } as never);

      expect(outcome.ok).toBe(true);
      expect(api.decidePpe).toHaveBeenCalledWith('g1', { action: 'condemn' });
      expect(api.getPpeAlerts).toHaveBeenCalledTimes(2);
    });

    it('returns the refusal of the API and does not reload', async () => {
      const api = {
        getLookups: vi.fn(lookups),
        getPpeAlerts: vi.fn(() => ok([])),
        decidePpe: vi.fn(() => problem('epc_taken')),
      };
      const store = setup(PpeMonitorStore, api) as InstanceType<typeof PpeMonitorStore>;
      await store.init();

      const outcome = await store.decide('g1', { action: 'replace' } as never);

      expect(outcome.ok).toBe(false);
      expect(outcome.errorKey).toBe('industrialLaundry.error.epc_taken');
      expect(store.saving()).toBe(false);
      expect(api.getPpeAlerts).toHaveBeenCalledTimes(1);
    });

    it('filters by the limit reached only', async () => {
      const api = { getLookups: vi.fn(lookups), getPpeAlerts: vi.fn(() => ok([])) };
      const store = setup(PpeMonitorStore, api) as InstanceType<typeof PpeMonitorStore>;

      await store.setFilters({ limitReachedOnly: true });

      expect(api.getPpeAlerts).toHaveBeenCalledWith(undefined, true);
    });
  });

  describe('DormantStore', () => {
    it('takes the default threshold from the lookups and groups the garments by customer', async () => {
      const rows = [
        { customer_name: 'Hotel Bellavista' },
        { customer_name: 'RSA Villa Serena' },
        { customer_name: 'Hotel Bellavista' },
      ];
      const api = { getLookups: vi.fn(lookups), getDormant: vi.fn(() => ok(rows)) };
      const store = setup(DormantStore, api) as InstanceType<typeof DormantStore>;

      await store.init();

      expect(store.defaultDays()).toBe(45);
      expect(store.byCustomer()).toEqual([
        { customer: 'Hotel Bellavista', count: 2 },
        { customer: 'RSA Villa Serena', count: 1 },
      ]);

      await store.setFilters({ days: 90 });
      expect(api.getDormant).toHaveBeenLastCalledWith({ customer_id: undefined, days: 90 });
    });
  });

  describe('LockersStore', () => {
    const garment = (id: string, over: Record<string, unknown> = {}) => ({
      id,
      article_type: 'personal_workwear_uniform',
      current_lifecycle_state: 'delivered_to_customer',
      assigned_wearer_employee_name: null,
      ...over,
    });

    it('offers only the nominal garments nobody wears as candidates', async () => {
      const api = {
        getLookups: vi.fn(lookups),
        getLockers: vi.fn(() => ok([{ employee: 'Marco' }])),
        listGarments: vi.fn(() =>
          ok([
            garment('a'),
            garment('b', { assigned_wearer_employee_name: 'Marco' }),
            garment('c', { article_type: 'flat_linen' }),
            garment('d', { current_lifecycle_state: 'condemned_rag' }),
          ]),
        ),
      };
      const store = setup(LockersStore, api) as InstanceType<typeof LockersStore>;

      await store.init();

      expect(store.groups()).toHaveLength(1);
      expect(store.candidates().map((item) => item.id)).toEqual(['a']);
    });

    it('assigns and releases through the same endpoint and reloads', async () => {
      const api = {
        getLookups: vi.fn(lookups),
        getLockers: vi.fn(() => ok([])),
        listGarments: vi.fn(() => ok([])),
        assignLocker: vi.fn(() => ok({})),
      };
      const store = setup(LockersStore, api) as InstanceType<typeof LockersStore>;
      await store.init();

      await store.assign('g1', { employee_name: 'Marco', locker_code: 'A-01' });
      await store.release('g1');

      expect(api.assignLocker).toHaveBeenNthCalledWith(1, 'g1', { employee_name: 'Marco', locker_code: 'A-01' });
      expect(api.assignLocker).toHaveBeenNthCalledWith(2, 'g1', { employee_name: null, locker_code: null });
      expect(api.getLockers).toHaveBeenCalledTimes(3);
    });

    it('reports a taken locker', async () => {
      const api = {
        getLookups: vi.fn(lookups),
        getLockers: vi.fn(() => ok([])),
        listGarments: vi.fn(() => ok([])),
        assignLocker: vi.fn(() => problem('locker_taken')),
      };
      const store = setup(LockersStore, api) as InstanceType<typeof LockersStore>;

      const outcome = await store.assign('g1', { employee_name: 'Giulia', locker_code: 'A-01' });

      expect(outcome.errorKey).toBe('industrialLaundry.error.locker_taken');
    });
  });

  describe('RabcConsoleStore', () => {
    const base = () => ({
      getLookups: vi.fn(lookups),
      listRollCages: vi.fn(() => ok([{ barcode: 'RC-1', tare_weight_kg: '38.5' }])),
      listScans: vi.fn(() =>
        ok([{ id: 's1', direction: 'inbound_soil' }, { id: 's2', direction: 'outbound_clean' }]),
      ),
      listWashBatches: vi.fn(() => ok([{ id: 'b1' }])),
      submitScan: vi.fn(() => ok({ id: 's3', direction: 'inbound_soil' })),
      createWashBatch: vi.fn(() => ok({})),
      certifyWashBatch: vi.fn(() => ok({})),
    });

    it('loads the console and exposes the soiled sessions and the cage tare', async () => {
      const store = setup(RabcConsoleStore, base()) as InstanceType<typeof RabcConsoleStore>;

      await store.init();

      expect(store.soiledSessions().map((item) => item.id)).toEqual(['s1']);
      expect(store.tareOf()('RC-1')).toBe('38.5');
      expect(store.tareOf()('RC-X')).toBeNull();
      expect(store.program()('THERMAL_71_3MIN')).not.toBeNull();
      expect(store.batches()).toHaveLength(1);
    });

    it('keeps the last scan and refuses an unknown cage with its key', async () => {
      const api = base();
      const store = setup(RabcConsoleStore, api) as InstanceType<typeof RabcConsoleStore>;

      const accepted = await store.scan({} as never);

      expect(accepted.ok).toBe(true);
      expect(store.lastScan()?.id).toBe('s3');

      store.clearScan();
      expect(store.lastScan()).toBeNull();

      api.submitScan.mockReturnValueOnce(problem('roll_cage_unknown'));
      const refused = await store.scan({} as never);

      expect(refused.ok).toBe(false);
      expect(refused.session).toBeNull();
      expect(refused.errorKey).toBe('industrialLaundry.error.roll_cage_unknown');
    });

    it('creates and certifies a batch and reloads the sessions and batches', async () => {
      const api = base();
      const store = setup(RabcConsoleStore, api) as InstanceType<typeof RabcConsoleStore>;

      expect((await store.createBatch({ program_code: 'X' } as never)).ok).toBe(true);
      expect((await store.certify('b1', { verifier_name: 'Rossi' } as never)).ok).toBe(true);

      expect(api.certifyWashBatch).toHaveBeenCalledWith('b1', { verifier_name: 'Rossi' });
      expect(api.listWashBatches).toHaveBeenCalledTimes(2);

      api.certifyWashBatch.mockReturnValueOnce(problem('batch_already_certified'));
      expect((await store.certify('b1', {} as never)).errorKey).toBe('industrialLaundry.error.batch_already_certified');
    });
  });

  describe('BillingStore', () => {
    const base = () => ({
      listParContracts: vi.fn(() => ok([{ id: 'p1' }])),
      listBillingRuns: vi.fn(() => ok([{ id: 'r1' }])),
      previewBilling: vi.fn(() => ok({ total: '59.78' })),
      calculateBilling: vi.fn(() => ok({ id: 'r2' })),
      invoiceBillingRun: vi.fn(() => ok({ id: 'r2' })),
    });

    it('loads the contracts and the runs', async () => {
      const store = setup(BillingStore, base()) as InstanceType<typeof BillingStore>;

      await store.init();

      expect(store.contracts()).toHaveLength(1);
      expect(store.runs()).toHaveLength(1);
    });

    it('previews, then clears the preview once the run is consolidated', async () => {
      const api = base();
      const store = setup(BillingStore, api) as InstanceType<typeof BillingStore>;

      await store.previewFor({ contract_id: 'p1' } as never);
      expect(store.preview()?.total).toBe('59.78');

      await store.calculate({ contract_id: 'p1' } as never);

      expect(store.preview()).toBeNull();
      expect(api.listBillingRuns).toHaveBeenCalledTimes(1);
    });

    it('drops the preview and reports the code when the billing is refused', async () => {
      const api = base();
      api.previewBilling.mockReturnValueOnce(problem('period_already_billed'));
      const store = setup(BillingStore, api) as InstanceType<typeof BillingStore>;

      const outcome = await store.previewFor({} as never);

      expect(outcome.errorKey).toBe('industrialLaundry.error.period_already_billed');
      expect(store.preview()).toBeNull();
    });

    it('drafts the invoice of a run and reloads the runs', async () => {
      const api = base();
      const store = setup(BillingStore, api) as InstanceType<typeof BillingStore>;

      const outcome = await store.invoice('r2');

      expect(outcome.ok).toBe(true);
      expect(api.invoiceBillingRun).toHaveBeenCalledWith('r2');
      expect(api.listBillingRuns).toHaveBeenCalledTimes(1);
    });
  });
});
