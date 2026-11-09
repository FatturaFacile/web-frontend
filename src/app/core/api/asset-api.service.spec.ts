import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import {
  AssetApiService,
  AssetBookResource,
  AssetTagData,
  DepreciationScheduleResource,
  FixedAssetResource,
  StoreFixedAssetPayload,
} from '@core';

describe('AssetApiService', () => {
  let service: AssetApiService;
  let httpMock: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/eam`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AssetApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AssetApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches assets with filters and pagination', () => {
    const mockAssets: FixedAssetResource[] = [
      {
        id: 'asset-1',
        asset_number: 'AST-001',
        barcode_tag: 'BC-001',
        serial_number: 'SN12345',
        name: 'CNC Milling Machine',
        description: '5-axis precision mill',
        category_id: 'cat-1',
        asset_class_id: null,
        location_id: 'loc-1',
        parent_asset_id: null,
        custodian_user_id: null,
        project_id: null,
        cost_center_id: null,
        supplier_id: null,
        status: 'active',
        condition: 'excellent',
        acquisition_type: 'purchase',
        acquisition_date: '2026-01-15',
        capitalization_date: '2026-01-20',
        commissioning_date: '2026-01-20',
        in_service_date: '2026-01-20',
        depreciation_start_date: '2026-02-01',
        retirement_date: null,
        disposal_date: null,
        currency: 'CHF',
        acquisition_cost: '120000.00',
        capitalized_cost: '120000.00',
        salvage_value: '10000.00',
        depreciable_base: '110000.00',
        accumulated_depreciation: '9166.67',
        carrying_amount: '110833.33',
        replacement_cost: null,
        depreciation_method: 'straight_line',
        useful_life_years: 10,
        useful_life_months: 120,
        depreciation_rate_percent: '10.00',
        is_depreciable: true,
        is_fully_depreciated: false,
        approval_status: 'approved',
        is_locked: false,
        created_at: '2026-01-15',
        updated_at: '2026-01-15',
      },
    ];

    service.getAssets({ page: 1, per_page: 10, status: 'active' }).subscribe((res) => {
      expect(res.data).toEqual(mockAssets);
      expect(res.meta.total).toBe(1);
    });

    const req = httpMock.expectOne((r) => r.url === `${baseUrl}/assets` && r.params.get('status') === 'active');
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: mockAssets,
      meta: { current_page: 1, total: 1, last_page: 1, per_page: 10 },
    });
  });

  it('creates asset and triggers capitalization/commission lifecycle', () => {
    const payload: StoreFixedAssetPayload = {
      name: 'Industrial Laser Cutter',
      category_id: 'cat-1',
      acquisition_cost: 85000,
      currency: 'CHF',
      depreciation_method: 'straight_line',
      useful_life_years: 8,
    };

    service.createAsset(payload).subscribe((res) => {
      expect(res.data.id).toBe('asset-2');
    });

    const reqCreate = httpMock.expectOne(`${baseUrl}/assets`);
    expect(reqCreate.request.method).toBe('POST');
    reqCreate.flush({ success: true, data: { id: 'asset-2', ...payload, status: 'acquired' } });

    service.capitalizeAsset('asset-2').subscribe((res) => {
      expect(res.data.status).toBe('capitalized');
    });

    const reqCap = httpMock.expectOne(`${baseUrl}/assets/asset-2/capitalize`);
    expect(reqCap.request.method).toBe('POST');
    reqCap.flush({ success: true, data: { id: 'asset-2', status: 'capitalized' } });

    service.commissionAsset('asset-2').subscribe((res) => {
      expect(res.data.status).toBe('in_service');
    });

    const reqCom = httpMock.expectOne(`${baseUrl}/assets/asset-2/commission`);
    expect(reqCom.request.method).toBe('POST');
    reqCom.flush({ success: true, data: { id: 'asset-2', status: 'in_service' } });
  });

  it('retrieves parallel books for an asset (statutory vs tax vs internal)', () => {
    const mockBooks: AssetBookResource[] = [
      {
        id: 'book-1',
        asset_id: 'asset-1',
        ledger_type: 'statutory',
        depreciation_method: 'straight_line',
        useful_life_months: 120,
        rate_percent: '10.00',
        cost: '120000.00',
        salvage_value: '10000.00',
        depreciable_base: '110000.00',
        accumulated_depreciation: '10000.00',
        net_book_value: '110000.00',
        is_fully_depreciated: false,
        posts_to_gl: true,
      },
      {
        id: 'book-2',
        asset_id: 'asset-1',
        ledger_type: 'tax',
        depreciation_method: 'declining_balance',
        useful_life_months: 96,
        rate_percent: '20.00',
        cost: '120000.00',
        salvage_value: '0.00',
        depreciable_base: '120000.00',
        accumulated_depreciation: '24000.00',
        net_book_value: '96000.00',
        is_fully_depreciated: false,
        posts_to_gl: false,
      },
    ];

    service.getAssetBooks('asset-1').subscribe((res) => {
      expect(res.data.length).toBe(2);
      expect(res.data[0].ledger_type).toBe('statutory');
      expect(res.data[1].ledger_type).toBe('tax');
    });

    const req = httpMock.expectOne(`${baseUrl}/assets/asset-1/books`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockBooks });
  });

  it('retrieves asset tag and QR payload', () => {
    const mockTag: AssetTagData = {
      asset_id: 'asset-1',
      asset_number: 'AST-001',
      barcode_value: 'AST001',
      barcode_symbology: 'code128',
      qr_payload: 'https://fatturafacile.eu/eam/assets/asset-1',
      label_lines: [],
    };

    service.getAssetTag('asset-1').subscribe((res) => {
      expect(res.data.qr_payload).toBe('https://fatturafacile.eu/eam/assets/asset-1');
      expect(res.data.barcode_symbology).toBe('code128');
    });

    const req = httpMock.expectOne(`${baseUrl}/assets/asset-1/tag`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockTag });
  });

  it('runs depreciation schedules and generates runs', () => {
    const mockSchedules: DepreciationScheduleResource[] = [
      {
        id: 'sch-1',
        asset_id: 'asset-1',
        run_id: 'run-1',
        ledger_type: 'statutory',
        period_code: '2026-01',
        depreciation_method: 'straight_line',
        opening_book_value: '120000.00',
        depreciation_amount: '1000.00',
        closing_book_value: '119000.00',
        accumulated_depreciation: '1000.00',
        status: 'posted',
        posted_at: '2026-01-31',
      },
    ];

    service.getDepreciationSchedules('asset-1').subscribe((res) => {
      expect(res.data).toEqual(mockSchedules);
    });

    const reqSch = httpMock.expectOne(`${baseUrl}/assets/asset-1/depreciation-schedules`);
    expect(reqSch.request.method).toBe('GET');
    reqSch.flush({ success: true, data: mockSchedules });

    const runPayload = {
      period_code: '2026-02',
      ledger_type: 'statutory',
      post_to_gl: true,
    };

    service.createDepreciationRun(runPayload).subscribe((res) => {
      expect(res.data.id).toBe('run-2');
    });

    const reqRun = httpMock.expectOne(`${baseUrl}/depreciation/runs`);
    expect(reqRun.request.method).toBe('POST');
    reqRun.flush({
      success: true,
      data: {
        id: 'run-2',
        run_number: 'DEP-2026-02',
        period_code: '2026-02',
        status: 'posted',
        total_depreciation_amount: '1000.00',
        assets_processed_count: 1,
      },
    });
  });
});
