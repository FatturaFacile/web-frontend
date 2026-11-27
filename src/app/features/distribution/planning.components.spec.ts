import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AtpComponent } from './atp.component';
import { DrpComponent } from './drp.component';
import { bodyRows, envelope, provideDistributionTesting, ref } from './distribution.testing';
import { ProposalsComponent } from './proposals.component';

const item = { id: 'i1', sku: 'BOLT', name: 'Bolt', uom: 'PCE' };

const proposal = (id: string, status: string, type = 'replenishment') => ({
  id,
  proposal_type: type,
  status,
  warehouse_id: 'w-POS',
  stock_item_id: 'i1',
  source_warehouse_id: 'w-HUB',
  suggested_quantity: 24,
  original_quantity: 24,
  uom: 'PCE',
  projected_stockout_date: '2028-03-09',
  source_available_quantity: 100,
  shortfall_quantity: null,
  rule_id: 'r1',
  transfer_order_id: null,
  calculation: {
    policy: 'min_max',
    trigger_reason: 'Below the reorder point',
    on_hand: 4,
    in_transit_inbound: 0,
    reserved: 1,
    safety_stock: 5,
    reorder_point: 10,
    max_stock: 30,
    projected_demand: 12,
    net_position: -3,
    steps: [{ label: 'Rounded to the carton', value: 24 }],
  },
  generated_at: '2028-03-01T08:00:00Z',
  warehouse: ref('POS'),
  source_warehouse: ref('HUB'),
  item,
});

describe('ProposalsComponent', () => {
  beforeEach(() => vi.clearAllMocks());

  function setup() {
    const api = {
      getLookups: vi.fn(() => of(envelope({ warehouses: [], items: [item] }))),
      listProposals: vi.fn(() =>
        of(
          envelope([
            proposal('p1', 'pending'),
            proposal('p2', 'pending', 'balancing'),
            proposal('p3', 'converted'),
          ]),
        ),
      ),
      getProposal: vi.fn((id: string) => of(envelope(proposal(id, 'pending')))),
      generateProposals: vi.fn(() => of(envelope({ created: 2, balancing: 1, shortfalls: 0 }))),
      updateProposal: vi.fn(() => of(envelope(proposal('p1', 'pending')))),
      approveProposals: vi.fn(() =>
        of(envelope({ transfers: [{ id: 't1', transfer_number: 'TO-1' }], shortfalls: [] })),
      ),
      rejectProposal: vi.fn(() => of(envelope(proposal('p1', 'rejected')))),
    };
    provideDistributionTesting(api);
    return api;
  }

  async function render() {
    const fixture = TestBed.createComponent(ProposalsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  interface Internals {
    store: { toggleAll(selected: boolean): void; selectedIds(): string[] };
    approve(status: 'draft' | 'approved'): Promise<void>;
    commit(row: unknown): Promise<void>;
    edited: { set(value: { id: string; value: number }): void };
    inspect(row: unknown): Promise<void>;
    calcRows(): { label: string; value: string }[];
  }

  it('lists the replenishment and balancing proposals', async () => {
    setup();
    const fixture = await render();
    const rows = bodyRows(fixture.nativeElement as HTMLElement);

    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain('distribution.proposalType.replenishment');
    expect(rows[1].textContent).toContain('distribution.proposalType.balancing');
    expect(rows[2].textContent).toContain('distribution.proposalStatus.converted');
  });

  it('bulk-approves the selected pending proposals into approved transfers', async () => {
    const api = setup();
    const fixture = await render();
    const component = fixture.componentInstance as unknown as Internals;

    component.store.toggleAll(true);
    await component.approve('approved');

    expect(api.approveProposals).toHaveBeenCalledWith(['p1', 'p2'], 'approved');
    expect(component.store.selectedIds()).toEqual([]);
  });

  it('saves an adjusted quantity only when it changed', async () => {
    const api = setup();
    const fixture = await render();
    const component = fixture.componentInstance as unknown as Internals;
    const row = proposal('p1', 'pending');

    component.edited.set({ id: 'p1', value: 24 });
    await component.commit(row);
    expect(api.updateProposal).not.toHaveBeenCalled();

    component.edited.set({ id: 'p1', value: 30 });
    await component.commit(row);
    expect(api.updateProposal).toHaveBeenCalledWith('p1', 30);
  });

  it('opens the calculation drawer with the stock position and the steps of the engine', async () => {
    setup();
    const fixture = await render();
    const component = fixture.componentInstance as unknown as Internals;

    await component.inspect(proposal('p1', 'pending'));

    const labels = component.calcRows().map((row) => row.label);
    expect(labels).toContain('distribution.calc.onHand');
    expect(labels).toContain('distribution.calc.projectedDemand');
    expect(labels).toContain('Rounded to the carton');
  });
});

describe('DrpComponent', () => {
  beforeEach(() => vi.clearAllMocks());

  const cell = (index: number, projected: number, net: number, release = 0) => ({
    index,
    gross_requirements: 10,
    scheduled_receipts: 0,
    projected_available: projected,
    net_requirements: net,
    planned_receipts: 0,
    planned_releases: release,
  });

  function setup() {
    const api = {
      getLookups: vi.fn(() => of(envelope({ warehouses: [], items: [item] }))),
      listDrpRuns: vi.fn(() =>
        of(
          envelope([
            {
              id: 'r1',
              run_number: 'DRP-1',
              bucket_type: 'weekly',
              horizon: 2,
              summary: { rows: 1, alerts: 1 },
            },
          ]),
        ),
      ),
      getDrpGrid: vi.fn(() =>
        of(
          envelope({
            buckets: [
              { index: 0, start: '2028-03-06', end: '2028-03-12' },
              { index: 1, start: '2028-03-13', end: '2028-03-19' },
            ],
            rows: [
              {
                warehouse_id: 'w-POS',
                stock_item_id: 'i1',
                warehouse: ref('POS'),
                item,
                lead_time_days: 2,
                source_warehouse_id: 'w-HUB',
                opening_balance: 20,
                safety_stock: 5,
                cells: [cell(0, 10, 0), cell(1, 2, 8, 8)],
              },
            ],
          }),
        ),
      ),
      listDrpAlerts: vi.fn(() =>
        of(
          envelope([
            {
              id: 'a1',
              type: 'stockout_risk',
              severity: 'high',
              warehouse_id: 'w-POS',
              stock_item_id: 'i1',
              bucket_index: 1,
              warehouse: ref('POS'),
              item,
              params: {},
            },
          ]),
        ),
      ),
      runDrp: vi.fn(() =>
        of(envelope({ id: 'r1', run_number: 'DRP-1', bucket_type: 'weekly', horizon: 2 })),
      ),
    };
    provideDistributionTesting(api);
    return api;
  }

  async function render() {
    const fixture = TestBed.createComponent(DrpComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('draws one row per measure and one column per bucket', async () => {
    setup();
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('.drp-table tbody tr')).toHaveLength(6);
    expect(root.querySelectorAll('.drp-table thead th')).toHaveLength(3);
    expect(root.textContent).toContain('distribution.drpRow.planned_releases');
  });

  it('highlights the bucket that falls under the safety stock and lists the alert', async () => {
    setup();
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('.drp-table td.stockout')).toHaveLength(1);
    expect(root.querySelectorAll('.drp-table td.release')).toHaveLength(1);
    expect(root.textContent).toContain('distribution.alertType.stockout_risk');
  });

  it('runs the DRP with the chosen bucket type and horizon', async () => {
    const api = setup();
    const fixture = await render();
    const component = fixture.componentInstance as unknown as {
      run(): Promise<void>;
      store: { setBucket(type: string, horizon: number): void };
    };

    component.store.setBucket('daily', 14);
    await component.run();

    expect(api.runDrp).toHaveBeenCalledWith({ bucket_type: 'daily', horizon: 14 });
  });
});

describe('AtpComponent', () => {
  it('shows the matrix per channel and flags what is not available to promise', async () => {
    const api = {
      getLookups: vi.fn(() => of(envelope({ warehouses: [], items: [item] }))),
      getAtpMatrix: vi.fn(() =>
        of(
          envelope({
            channels: [
              { id: 'c1', code: 'WEB', name: 'Web' },
              { id: 'c2', code: 'B2B', name: 'B2B' },
            ],
            rows: [{ stock_item_id: 'i1', sku: 'BOLT', name: 'Bolt', cells: { c1: 12, c2: 0 } }],
          }),
        ),
      ),
      listChannels: vi.fn(() => of(envelope([]))),
      getAtp: vi.fn(() => of(envelope({ stock_item: item, channels: [] }))),
    };
    provideDistributionTesting(api);

    const fixture = TestBed.createComponent(AtpComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(bodyRows(root)).toHaveLength(1);
    expect(root.textContent).toContain('WEB');
    expect(root.querySelectorAll('td.atp-low')).toHaveLength(1);
  });
});
