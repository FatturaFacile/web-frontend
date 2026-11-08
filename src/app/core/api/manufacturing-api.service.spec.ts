import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { ManufacturingApiService } from './manufacturing-api.service';
import {
  CreateBomPayload,
  CreateProductionOrderPayload,
  CreateWorkCenterPayload,
  MfgBomResource,
  MfgMrpRunResource,
  MfgProductionOrderResource,
  MfgWorkCenterResource,
  PaginatedResponse,
  RunMrpPayload,
} from '../models';

describe('ManufacturingApiService', () => {
  let service: ManufacturingApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/manufacturing`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ManufacturingApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ManufacturingApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches production orders list and executes order actions', () => {
    const mockOrder: MfgProductionOrderResource = {
      id: 'po-1',
      order_number: 'PO-2026-001',
      mfg_item_id: 'item-1',
      status: 'planned',
      target_quantity: 100,
      completed_quantity: 0,
      scrapped_quantity: 0,
      uom: 'PZ',
      planned_start_date: '2026-04-01T08:00:00Z',
      planned_end_date: '2026-04-05T17:00:00Z',
    };

    const mockResponse: PaginatedResponse<MfgProductionOrderResource> = {
      data: [mockOrder],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
    };

    service.getProductionOrders({ page: 1 }).subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].order_number).toBe('PO-2026-001');
    });

    const getReq = httpMock.expectOne((req) => req.url === `${baseUrl}/production-orders` && req.params.get('page') === '1');
    expect(getReq.request.method).toBe('GET');
    getReq.flush(mockResponse);

    // Release order
    service.releaseProductionOrder('po-1').subscribe((res) => {
      expect(res.data.status).toBe('released');
    });
    const relReq = httpMock.expectOne(`${baseUrl}/production-orders/po-1/release`);
    expect(relReq.request.method).toBe('POST');
    relReq.flush({ data: { ...mockOrder, status: 'released' } });

    // Start order
    service.startProductionOrder('po-1').subscribe((res) => {
      expect(res.data.status).toBe('in_progress');
    });
    const startReq = httpMock.expectOne(`${baseUrl}/production-orders/po-1/start`);
    expect(startReq.request.method).toBe('POST');
    startReq.flush({ data: { ...mockOrder, status: 'in_progress' } });

    // Complete order
    service.completeProductionOrder('po-1').subscribe((res) => {
      expect(res.data.status).toBe('completed');
    });
    const compReq = httpMock.expectOne(`${baseUrl}/production-orders/po-1/complete`);
    expect(compReq.request.method).toBe('POST');
    compReq.flush({ data: { ...mockOrder, status: 'completed' } });

    // Close order
    service.closeProductionOrder('po-1').subscribe((res) => {
      expect(res.data.status).toBe('closed');
    });
    const closeReq = httpMock.expectOne(`${baseUrl}/production-orders/po-1/close`);
    expect(closeReq.request.method).toBe('POST');
    closeReq.flush({ data: { ...mockOrder, status: 'closed' } });
  });

  it('creates production order with payload', () => {
    const payload: CreateProductionOrderPayload = {
      mfg_item_id: 'item-10',
      target_quantity: 50,
      planned_start_date: '2026-05-01T08:00:00Z',
      planned_end_date: '2026-05-03T18:00:00Z',
    };

    service.createProductionOrder(payload).subscribe((res) => {
      expect(res.data.id).toBe('po-new');
    });

    const req = httpMock.expectOne(`${baseUrl}/production-orders`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ data: { id: 'po-new', order_number: 'PO-2026-002', ...payload, completed_quantity: 0, scrapped_quantity: 0, uom: 'PZ', status: 'planned' } });
  });

  it('fetches and creates bills of materials (BOMs)', () => {
    const payload: CreateBomPayload = {
      mfg_item_id: 'item-fin-1',
      name: 'Main Assembly BOM',
      revision: 'A',
      base_quantity: 1,
      components: [
        { component_item_id: 'comp-1', quantity_per: 4 },
        { component_item_id: 'comp-2', quantity_per: 2 },
      ],
    };

    service.createBom(payload).subscribe((res) => {
      expect(res.data.id).toBe('bom-1');
    });

    const postReq = httpMock.expectOne(`${baseUrl}/boms`);
    expect(postReq.request.method).toBe('POST');
    postReq.flush({
      data: {
        id: 'bom-1',
        bom_number: 'BOM-001',
        status: 'draft',
        ...payload,
        uom: 'PZ',
      },
    });

    // Activate BOM
    service.activateBom('bom-1').subscribe((res) => {
      expect(res.data.status).toBe('active');
    });
    const actReq = httpMock.expectOne(`${baseUrl}/boms/bom-1/activate`);
    expect(actReq.request.method).toBe('POST');
    actReq.flush({ data: { id: 'bom-1', status: 'active' } });
  });

  it('triggers MRP run and converts planned orders', () => {
    const payload: RunMrpPayload = {
      horizon_start_date: '2026-04-01T00:00:00Z',
      horizon_end_date: '2026-06-30T23:59:59Z',
      run_type: 'regenerative',
    };

    service.runMrp(payload).subscribe((res) => {
      expect(res.data.run_number).toBe('MRP-2026-001');
    });

    const runReq = httpMock.expectOne(`${baseUrl}/mrp/runs`);
    expect(runReq.request.method).toBe('POST');
    runReq.flush({
      data: {
        id: 'mrp-1',
        run_number: 'MRP-2026-001',
        run_type: 'regenerative',
        status: 'completed',
        horizon_start_date: payload.horizon_start_date,
        horizon_end_date: payload.horizon_end_date,
        total_items_processed: 45,
        total_planned_orders: 12,
        total_shortages: 3,
      },
    });

    // Convert planned order
    service.convertPlannedOrder('plan-ord-1').subscribe((res) => {
      expect(res.data.id).toBe('po-from-mrp');
    });
    const convReq = httpMock.expectOne(`${baseUrl}/mrp/planned-orders/plan-ord-1/convert`);
    expect(convReq.request.method).toBe('POST');
    convReq.flush({ data: { id: 'po-from-mrp', order_number: 'PO-MRP-001', status: 'planned' } });
  });

  it('manages work centers and routings', () => {
    const wcPayload: CreateWorkCenterPayload = {
      work_center_code: 'WC-CNC-01',
      name: 'Centro Lavoro CNC 5 Assi',
      capacity_hours_per_day: 16,
      hourly_cost_rate: 85,
    };

    service.createWorkCenter(wcPayload).subscribe((res) => {
      expect(res.data.id).toBe('wc-1');
    });

    const wcReq = httpMock.expectOne(`${baseUrl}/work-centers`);
    expect(wcReq.request.method).toBe('POST');
    wcReq.flush({
      data: {
        id: 'wc-1',
        ...wcPayload,
        status: 'active',
        created_at: '2026-01-10T10:00:00Z',
      },
    });
  });
});
