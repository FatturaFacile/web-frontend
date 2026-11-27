import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { DistributionApiService } from './distribution-api.service';

describe('DistributionApiService (DRP)', () => {
  let service: DistributionApiService;
  let http: HttpTestingController;
  const base = `${environment.apiBaseUrl}/distribution`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DistributionApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(DistributionApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the lookups and the dashboard', () => {
    service.getLookups().subscribe();
    http.expectOne(`${base}/lookups`).flush({ data: {} });
    service.getDashboard().subscribe();
    http.expectOne(`${base}/dashboard`).flush({ data: {} });
  });

  it('saves a warehouse profile and manages the lanes', () => {
    service.saveProfile('w1', { role: 'consignment_out' }).subscribe();
    const profile = http.expectOne(`${base}/network/warehouses/w1/profile`);
    expect(profile.request.method).toBe('PUT');
    profile.flush({ data: {} });

    service
      .createLane({
        source_warehouse_id: 'a',
        destination_warehouse_id: 'b',
        lead_time_days: 2,
        transport_mode: 'road',
      })
      .subscribe();
    expect(http.expectOne(`${base}/lanes`).request.method).toBe('POST');
    service.deleteLane('l1').subscribe();
    expect(http.expectOne(`${base}/lanes/l1`).request.method).toBe('DELETE');
  });

  it('lists transfers with filters, dropping the empty ones', () => {
    service.listTransfers({ status: 'in_transit', q: '', warehouse_id: null, page: 2 }).subscribe();
    const request = http.expectOne((req) => req.url === `${base}/transfers`);
    expect(request.request.params.get('status')).toBe('in_transit');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.has('q')).toBe(false);
    expect(request.request.params.has('warehouse_id')).toBe(false);
    request.flush({ data: [], meta: {} });
  });

  it('runs the transfer workflow actions', () => {
    service.approveTransfer('t1').subscribe();
    http.expectOne(`${base}/transfers/t1/approve`).flush({ data: {} });
    service.dispatchTransfer('t1', { carrier: 'DHL', ddt_reference: 'DDT-1' }).subscribe();
    const dispatch = http.expectOne(`${base}/transfers/t1/dispatch`);
    expect(dispatch.request.body).toEqual({ carrier: 'DHL', ddt_reference: 'DDT-1' });
    dispatch.flush({ data: {} });
    service
      .receiveTransfer('t1', {
        lines: [{ line_id: 'l', quantity: 3, damaged_quantity: 1 }],
        final: true,
        resolution: 'write_off',
      })
      .subscribe();
    expect(http.expectOne(`${base}/transfers/t1/receive`).request.body.resolution).toBe(
      'write_off',
    );
    service.cancelTransfer('t1').subscribe();
    http.expectOne(`${base}/transfers/t1/cancel`).flush({ data: {} });
  });

  it('reads the availability and the goods in transit', () => {
    service.getAvailability('w1', 'i1').subscribe();
    const availability = http.expectOne((req) => req.url === `${base}/availability`);
    expect(availability.request.params.get('warehouse_id')).toBe('w1');
    expect(availability.request.params.get('stock_item_id')).toBe('i1');
    availability.flush({ data: {} });

    service.listInTransit({ overdue: true, lot_id: 'x', stock_item_id: null }).subscribe();
    const transit = http.expectOne((req) => req.url === `${base}/in-transit`);
    expect(transit.request.params.get('overdue')).toBe('1');
    expect(transit.request.params.get('lot_id')).toBe('x');
    expect(transit.request.params.has('stock_item_id')).toBe(false);
    transit.flush({ data: [], meta: {} });

    service.listInTransit().subscribe();
    const plain = http.expectOne((req) => req.url === `${base}/in-transit`);
    expect(plain.request.params.has('overdue')).toBe(false);
    plain.flush({ data: [], meta: {} });
  });

  it('manages rules and proposals', () => {
    service.listRules().subscribe();
    http.expectOne((req) => req.url === `${base}/replenishment-rules`).flush({ data: [] });
    service.updateProposal('p1', 12).subscribe();
    expect(http.expectOne(`${base}/proposals/p1`).request.body).toEqual({ suggested_quantity: 12 });
    service.approveProposals(['p1', 'p2'], 'approved').subscribe();
    expect(http.expectOne(`${base}/proposals/approve`).request.body).toEqual({
      ids: ['p1', 'p2'],
      transfer_status: 'approved',
    });
    service.generateProposals({}).subscribe();
    http.expectOne(`${base}/proposals/generate`).flush({ data: {} });
    service.rejectProposal('p1').subscribe();
    http.expectOne(`${base}/proposals/p1/reject`).flush({ data: {} });
    service.listProposals({ proposal_type: 'balancing' }).subscribe();
    const list = http.expectOne((req) => req.url === `${base}/proposals`);
    expect(list.request.params.get('proposal_type')).toBe('balancing');
    list.flush({ data: [], meta: {} });
  });

  it('runs the DRP and reads the grid of a run', () => {
    service.runDrp({ bucket_type: 'weekly', horizon: 8 }).subscribe();
    expect(http.expectOne(`${base}/drp/runs`).request.body).toEqual({
      bucket_type: 'weekly',
      horizon: 8,
    });
    service.getDrpGrid('r1', 'w1', null).subscribe();
    const grid = http.expectOne((req) => req.url === `${base}/drp/runs/r1/grid`);
    expect(grid.request.params.get('warehouse_id')).toBe('w1');
    expect(grid.request.params.has('stock_item_id')).toBe(false);
    grid.flush({ data: {} });
    service.listDrpAlerts('r1').subscribe();
    expect(
      http.expectOne((req) => req.url === `${base}/drp/alerts`).request.params.get('run_id'),
    ).toBe('r1');
  });

  it('manages channels, their warehouse rules and reads the ATP', () => {
    service
      .createChannelRule('c1', {
        warehouse_id: 'w1',
        allocation_mode: 'percentage',
        allocation_percentage: 60,
      })
      .subscribe();
    expect(http.expectOne(`${base}/channels/c1/warehouses`).request.method).toBe('POST');
    service.updateChannelRule('r1', { safety_buffer_qty: 2 }).subscribe();
    expect(http.expectOne(`${base}/channel-warehouses/r1`).request.method).toBe('PUT');
    service.deleteChannelRule('r1').subscribe();
    expect(http.expectOne(`${base}/channel-warehouses/r1`).request.method).toBe('DELETE');
    service.getAtp('i1', 'c1').subscribe();
    const atp = http.expectOne((req) => req.url === `${base}/atp`);
    expect(atp.request.params.get('sales_channel_id')).toBe('c1');
    atp.flush({ data: {} });
    service.getAtpMatrix(3).subscribe();
    expect(
      http.expectOne((req) => req.url === `${base}/atp/matrix`).request.params.get('page'),
    ).toBe('3');
  });

  it('works the consignment and the 3PL endpoints', () => {
    service.listConsignmentStock('out').subscribe();
    const stock = http.expectOne((req) => req.url === `${base}/consignment/stock`);
    expect(stock.request.params.get('direction')).toBe('out');
    stock.flush({ data: [], meta: {} });
    service
      .createSettlement({ warehouse_id: 'w', lines: [{ stock_item_id: 'i', quantity: 1 }] })
      .subscribe();
    http.expectOne(`${base}/consignment/settlements`).flush({ data: {} });
    service
      .createConsignmentReturn({
        warehouse_id: 'w',
        destination_warehouse_id: 'c',
        lines: [{ stock_item_id: 'i', quantity: 1 }],
      })
      .subscribe();
    http.expectOne(`${base}/consignment/returns`).flush({ data: {} });
    service
      .createReconciliation({
        warehouse_id: 'w',
        lines: [{ stock_item_id: 'i', external_quantity: 4 }],
      })
      .subscribe();
    http.expectOne(`${base}/threepl/reconciliations`).flush({ data: {} });
  });
});
