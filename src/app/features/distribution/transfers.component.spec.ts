import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DstTransfer } from '@core';
import { bodyRows, envelope, provideDistributionTesting, ref } from './distribution.testing';
import { TransfersComponent } from './transfers.component';

const transfer = (
  id: string,
  status: DstTransfer['status'],
  overrides: Partial<DstTransfer> = {},
): DstTransfer => ({
  id,
  transfer_number: `TO-${id}`,
  status,
  source_warehouse: ref('HUB'),
  destination_warehouse: ref('POS'),
  requested_date: null,
  expected_arrival_date: null,
  shipped_at: null,
  received_at: null,
  carrier: null,
  tracking_number: null,
  ddt_reference: null,
  is_overdue: false,
  notes: null,
  lines: [
    {
      id: `${id}-l1`,
      stock_item_id: 'i1',
      sku: 'BOLT',
      name: 'Bolt',
      uom: 'PCE',
      lot_id: null,
      lot_number: null,
      quantity: 10,
      quantity_shipped: status === 'in_transit' ? 10 : 0,
      quantity_received: 0,
      quantity_damaged: 0,
      discrepancy_qty: 0,
      discrepancy_reason: null,
      unit_cost: 2,
    },
  ],
  discrepancies: [],
  ...overrides,
});

function setup(canWrite = true) {
  const api = {
    listTransfers: vi.fn(() =>
      of(
        envelope(
          [
            transfer('1', 'draft'),
            transfer('2', 'approved'),
            transfer('3', 'in_transit', { is_overdue: true }),
            transfer('4', 'received'),
          ],
          {
            total: 4,
            status_counts: { draft: 1, approved: 1, in_transit: 1, received: 1 },
          },
        ),
      ),
    ),
    getLookups: vi.fn(() => of(envelope({ warehouses: [], items: [] }))),
    listLanes: vi.fn(() => of(envelope([]))),
    getAvailability: vi.fn(() =>
      of(envelope({ on_hand: 5, reserved: 1, available: 4, in_transit_inbound: 0 })),
    ),
    approveTransfer: vi.fn(() => of(envelope(transfer('1', 'approved')))),
    dispatchTransfer: vi.fn(() => of(envelope(transfer('2', 'in_transit')))),
    receiveTransfer: vi.fn(() => of(envelope(transfer('3', 'received')))),
    cancelTransfer: vi.fn(() => of(envelope(transfer('1', 'cancelled')))),
    createTransfer: vi.fn(() => of(envelope(transfer('9', 'draft')))),
  };
  provideDistributionTesting(api, canWrite);
  return api;
}

async function render() {
  const fixture = TestBed.createComponent(TransfersComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

interface Internals {
  openDispatch(row: DstTransfer): void;
  submitDispatch(): Promise<void>;
  dispatchForm: { patchValue(value: Record<string, string>): void };
  openReceive(row: DstTransfer): void;
  submitReceive(): Promise<void>;
  shortageAt(index: number): number;
  receiveNeedsResolution(): boolean;
  receiveLines: { at(index: number): { patchValue(value: Record<string, number>): void } };
  receiveForm: { patchValue(value: Record<string, unknown>): void };
  approve(row: DstTransfer): Promise<void>;
  cancel(row: DstTransfer): Promise<void>;
}

describe('TransfersComponent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lists the transfers with their status and flags the overdue ones', async () => {
    setup();
    const fixture = await render();
    const rows = bodyRows(fixture.nativeElement as HTMLElement);

    expect(rows).toHaveLength(4);
    expect(rows[0].textContent).toContain('TO-1');
    expect(rows[0].textContent).toContain('distribution.transferStatus.draft');
    expect(rows[2].textContent).toContain('distribution.field.overdue');
  });

  it('offers only the actions the status allows and none to a reader', async () => {
    setup();
    const fixture = await render();
    const rows = bodyRows(fixture.nativeElement as HTMLElement);

    expect(rows[0].textContent).toContain('distribution.action.approve');
    expect(rows[0].textContent).toContain('distribution.action.cancelTransfer');
    expect(rows[1].textContent).toContain('distribution.action.dispatch');
    expect(rows[2].textContent).toContain('distribution.action.receive');
    expect(rows[2].textContent).not.toContain('distribution.action.cancelTransfer');
    expect(rows[3].textContent).not.toContain('distribution.action.');
  });

  it('hides every action from a reader', async () => {
    TestBed.resetTestingModule();
    setup(false);
    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'distribution.action.approve',
    );
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'distribution.action.newTransfer',
    );
  });

  it('dispatches with the carrier, the tracking number, the DDT and the expected arrival', async () => {
    const api = setup();
    const fixture = await render();
    const component = fixture.componentInstance as unknown as Internals;

    component.openDispatch(transfer('2', 'approved'));
    component.dispatchForm.patchValue({
      carrier: 'DHL',
      tracking_number: 'TRK1',
      ddt_reference: 'DDT-7',
      expected_arrival_date: '2028-03-05',
    });
    await component.submitDispatch();

    expect(api.dispatchTransfer).toHaveBeenCalledWith('2', {
      carrier: 'DHL',
      tracking_number: 'TRK1',
      ddt_reference: 'DDT-7',
      expected_arrival_date: '2028-03-05',
    });
  });

  it('receives everything outstanding by default, with no resolution needed', async () => {
    const api = setup();
    const fixture = await render();
    const component = fixture.componentInstance as unknown as Internals;

    component.openReceive(transfer('3', 'in_transit'));

    expect(component.shortageAt(0)).toBe(0);
    expect(component.receiveNeedsResolution()).toBe(false);
    await component.submitReceive();

    expect(api.receiveTransfer).toHaveBeenCalledWith('3', {
      lines: [{ line_id: '3-l1', quantity: 10, damaged_quantity: 0 }],
      final: true,
    });
  });

  it('asks for a resolution when a receipt is short or damaged and sends it with the final receipt', async () => {
    const api = setup();
    const fixture = await render();
    const component = fixture.componentInstance as unknown as Internals;

    component.openReceive(transfer('3', 'in_transit'));
    component.receiveLines.at(0).patchValue({ quantity: 6, damaged_quantity: 1 });
    component.receiveForm.patchValue({ resolution: 'carrier_claim' });

    expect(component.shortageAt(0)).toBe(3);
    expect(component.receiveNeedsResolution()).toBe(true);
    await component.submitReceive();

    expect(api.receiveTransfer).toHaveBeenCalledWith('3', {
      lines: [{ line_id: '3-l1', quantity: 6, damaged_quantity: 1 }],
      final: true,
      resolution: 'carrier_claim',
    });
  });

  it('approves and cancels through the store and reloads the list', async () => {
    const api = setup();
    const fixture = await render();
    const component = fixture.componentInstance as unknown as Internals;

    await component.approve(transfer('1', 'draft'));
    await component.cancel(transfer('1', 'draft'));

    expect(api.approveTransfer).toHaveBeenCalledWith('1');
    expect(api.cancelTransfer).toHaveBeenCalledWith('1');
    expect(api.listTransfers).toHaveBeenCalledTimes(3);
  });
});
