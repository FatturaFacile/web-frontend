import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { WorkshopApiService } from './workshop-api.service';
import {
  WorkshopFolderLineRequest,
  WorkshopFolderRequest,
  WorkshopStockUnitRequest,
} from '../models';

describe('WorkshopApiService', () => {
  let service: WorkshopApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/workshop`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WorkshopApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WorkshopApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('fetches workshop folders list with query params', () => {
    service
      .getFolders({ status: 'in_progress', search: 'TI 123456', page: 1, per_page: 10 })
      .subscribe((res) => {
        expect(res.data.length).toBe(1);
        expect(res.data[0].folder_number).toBe('OFF-2026-001');
      });

    const req = httpTesting.expectOne((r) => r.url === `${base}/folders`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('in_progress');
    expect(req.request.params.get('search')).toBe('TI 123456');

    req.flush({
      success: true,
      data: [{ id: 'fld-1', folder_number: 'OFF-2026-001', status: 'in_progress', currency: 'CHF' }],
      meta: { current_page: 1, total: 1 },
    });
  });

  it('creates a new repair folder and adds a line', () => {
    const folderPayload: WorkshopFolderRequest = {
      vehicle_id: 'veh-123',
      kind: 'repair',
      currency: 'CHF',
      mileage_in: 85400,
      notes: 'Sostituzione pastiglie freni anteriori',
    };

    service.createFolder(folderPayload).subscribe((res) => {
      expect(res.data.id).toBe('fld-101');
    });

    const reqFolder = httpTesting.expectOne(`${base}/folders`);
    expect(reqFolder.request.method).toBe('POST');
    reqFolder.flush({ success: true, data: { id: 'fld-101', ...folderPayload, status: 'open' } });

    const linePayload: WorkshopFolderLineRequest = {
      line_type: 'part',
      description: 'Kit pastiglie freno Brembo',
      quantity: 1,
      unit_price: '145.00',
      tax_rate: '8.10',
    };

    service.addLine('fld-101', linePayload).subscribe((res) => {
      expect(res.data.id).toBe('line-1');
    });

    const reqLine = httpTesting.expectOne(`${base}/folders/fld-101/lines`);
    expect(reqLine.request.method).toBe('POST');
    reqLine.flush({ success: true, data: { id: 'line-1', ...linePayload, subtotal: '145.00' } });
  });

  it('handles technician time tracking (start and stop)', () => {
    service.startTimeEntry('fld-101', { notes: 'Smontaggio ruote e pinze' }).subscribe((res) => {
      expect(res.data.id).toBe('time-1');
    });

    const reqStart = httpTesting.expectOne(`${base}/folders/fld-101/time-entries/start`);
    expect(reqStart.request.method).toBe('POST');
    reqStart.flush({ success: true, data: { id: 'time-1', started_at: '2026-11-09T09:00:00Z' } });

    service.stopTimeEntry('time-1').subscribe((res) => {
      expect(res.data.minutes).toBe(75);
    });

    const reqStop = httpTesting.expectOne(`${base}/time-entries/time-1/stop`);
    expect(reqStop.request.method).toBe('POST');
    reqStop.flush({ success: true, data: { id: 'time-1', minutes: 75, stopped_at: '2026-11-09T10:15:00Z' } });
  });

  it('converts workshop folder to quote, delivery note, or invoice', () => {
    service.convertToInvoice('fld-101').subscribe((res) => {
      expect(res.data.invoice_id).toBe('inv-999');
    });

    const reqInv = httpTesting.expectOne(`${base}/folders/fld-101/invoice`);
    expect(reqInv.request.method).toBe('POST');
    reqInv.flush({ success: true, data: { invoice_id: 'inv-999' } });
  });

  it('manages vehicle stock units and sales', () => {
    const stockPayload: WorkshopStockUnitRequest = {
      stock_number: 'USATO-2026-01',
      condition: 'used',
      make: 'Volkswagen',
      model: 'Golf 2.0 TDI',
      list_price: '18500.00',
      currency: 'CHF',
    };

    service.createVehicleStock(stockPayload).subscribe((res) => {
      expect(res.data.id).toBe('stk-1');
    });

    const reqStock = httpTesting.expectOne(`${base}/vehicle-stock`);
    expect(reqStock.request.method).toBe('POST');
    reqStock.flush({ success: true, data: { id: 'stk-1', ...stockPayload, status: 'available' } });
  });
});
