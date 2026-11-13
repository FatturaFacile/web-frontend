import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../icons-provider';
import {
  AutomotiveApiService,
  ClientApiService,
  PaginatedResponse,
  WorkshopApiService,
  WorkshopFolder,
  WorkshopFolderLine,
  WorkshopRecurringService,
  WorkshopTimeEntry,
  WorkshopVehicleHistoryEntry,
  WorkshopVehicleStockUnit,
} from '@core';
import { WorkshopComponent } from './workshop.component';

const VEHICLE_ID = '11111111-1111-4111-8111-111111111111';
const CONTACT_ID = '22222222-2222-4222-8222-222222222222';

describe('WorkshopComponent', () => {
  let fixture: ComponentFixture<WorkshopComponent>;
  let component: WorkshopComponent;

  const mockFolder: WorkshopFolder = {
    id: 'f-1-uuid',
    folder_number: 'OFF-2026-0001',
    vehicle_id: 'veh-1',
    license_plate: 'AB123CD',
    vin: 'ZFA12345678901234',
    vehicle_model: 'Fiat Panda 1.2 Fire',
    customer_name: 'Mario Rossi',
    kind: 'mechanics',
    status: 'open',
    mileage_in: 45000,
    currency: 'EUR',
    total_labour: '100.00',
    total_parts: '250.00',
    total_net: '350.00',
    total_gross: '427.00',
  };

  const mockFolderLine: WorkshopFolderLine = {
    id: 'line-1-uuid',
    workshop_folder_id: 'f-1-uuid',
    line_type: 'part',
    description: 'Filtro Olio e Olio Sintetico 5W30',
    quantity: 1,
    unit_price: '85.00',
    tax_rate: '22.00',
    subtotal: '85.00',
  };

  const mockTimeEntry: WorkshopTimeEntry = {
    id: 'time-1-uuid',
    workshop_folder_id: 'f-1-uuid',
    technician_user_id: 'tech-1',
    technician_name: 'Luigi Meccanico',
    started_at: '2026-03-01T08:00:00Z',
    stopped_at: '2026-03-01T09:30:00Z',
    minutes: 90,
    is_billed: false,
  };

  const mockStockUnit: WorkshopVehicleStockUnit = {
    id: 'stock-1-uuid',
    stock_number: 'STK-001',
    condition: 'used',
    make: 'Volkswagen',
    model: 'Golf VII 1.6 TDI',
    vin: 'WVWZZZAUZHP123456',
    year: 2019,
    mileage_km: 68000,
    purchase_price: '9500.00',
    list_price: '13900.00',
    currency: 'EUR',
    status: 'in_stock',
  };

  const mockRecurringService: WorkshopRecurringService = {
    id: 'rec-1-uuid',
    vehicle_id: 'veh-1',
    license_plate: 'AB123CD',
    service_type: 'maintenance_plan',
    name: 'Tagliando Annuale / 15.000 km',
    interval: 'yearly',
    start_date: '2026-01-15',
    unit_price: '200.00',
    currency: 'EUR',
    is_active: true,
  };

  const mockHistoryEntry: WorkshopVehicleHistoryEntry = {
    id: 'f-0-uuid',
    folder_number: 'OFF-2025-0042',
    kind: 'maintenance',
    status: 'delivered',
    mileage_in: 30000,
    total_gross: '210.00',
    completed_at: '2025-06-10',
    summary: 'Sostituzione pastiglie freni anteriori',
  };

  const mockPaginatedFolders: PaginatedResponse<WorkshopFolder> = {
    data: [mockFolder],
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 10,
      total: 1,
    },
  };

  const mockPaginatedStock: PaginatedResponse<WorkshopVehicleStockUnit> = {
    data: [mockStockUnit],
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 10,
      total: 1,
    },
  };

  const mockWorkshopApi = {
    getFolders: vi.fn().mockReturnValue(of(mockPaginatedFolders)),
    getFolder: vi.fn().mockReturnValue(of({ data: { ...mockFolder, lines: [mockFolderLine] } })),
    createFolder: vi.fn().mockReturnValue(of({ data: mockFolder })),
    updateFolder: vi.fn().mockReturnValue(of({ data: mockFolder })),
    addLine: vi.fn().mockReturnValue(of({ data: mockFolderLine })),
    deleteLine: vi.fn().mockReturnValue(of(undefined)),
    changeStatus: vi.fn().mockReturnValue(of({ data: { ...mockFolder, status: 'in_progress' } })),
    convertToQuote: vi.fn().mockReturnValue(of({ data: { quote_id: 'Q-2026-001' } })),
    convertToDeliveryNote: vi.fn().mockReturnValue(of({ data: { delivery_note_id: 'DDT-2026-001' } })),
    convertToInvoice: vi.fn().mockReturnValue(of({ data: { invoice_id: 'INV-2026-001' } })),
    getTimeEntries: vi.fn().mockReturnValue(of({ data: [mockTimeEntry] })),
    startTimeEntry: vi.fn().mockReturnValue(of({ data: mockTimeEntry })),
    stopTimeEntry: vi.fn().mockReturnValue(of({ data: { ...mockTimeEntry, stopped_at: '2026-03-01T10:00:00Z' } })),
    billTimeEntries: vi.fn().mockReturnValue(of({ data: { line_id: 'line-billed-1' } })),
    getVehicleHistory: vi.fn().mockReturnValue(of({ data: [mockHistoryEntry] })),
    getRecurringServices: vi.fn().mockReturnValue(of({ data: [mockRecurringService], meta: { total: 1, last_page: 1 } })),
    createRecurringService: vi.fn().mockReturnValue(of({ data: mockRecurringService })),
    stopRecurringService: vi.fn().mockReturnValue(of({ data: { success: true } })),
    getVehicleStock: vi.fn().mockReturnValue(of(mockPaginatedStock)),
    createVehicleStock: vi.fn().mockReturnValue(of({ data: mockStockUnit })),
    createVehicleStockUnit: vi.fn().mockReturnValue(of({ data: mockStockUnit })),
    sellVehicleStock: vi.fn().mockReturnValue(of({ data: { ...mockStockUnit, status: 'sold' } })),
  };

  const mockAutomotiveApi = {
    getVehicles: vi.fn().mockReturnValue(
      of({ data: { data: [{ id: VEHICLE_ID, license_plate: 'AB123CD', make: 'Fiat', model: 'Panda' }] } }),
    ),
  };

  const mockClientApi = {
    list: vi.fn().mockReturnValue(of({ data: [{ id: CONTACT_ID, company_name: 'Rossi Srl' }], meta: {} })),
  };

  const mockMessageService = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [WorkshopComponent],
      providers: [
        provideNzIcons(icons),
        { provide: WorkshopApiService, useValue: mockWorkshopApi },
        { provide: AutomotiveApiService, useValue: mockAutomotiveApi },
        { provide: ClientApiService, useValue: mockClientApi },
        { provide: NzMessageService, useValue: mockMessageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkshopComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    // The grids load after their debounce (0 ms for the first request).
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  it('should initialize and load folders, stock, and recurring services', () => {
    expect(component).toBeTruthy();
    expect(mockWorkshopApi.getFolders).toHaveBeenCalled();
    expect(mockWorkshopApi.getVehicleStock).toHaveBeenCalled();
    expect(mockWorkshopApi.getRecurringServices).toHaveBeenCalled();
    expect(component.folders().length).toBe(1);
    expect(component.stockUnits().length).toBe(1);
    expect(component.recurringServices().length).toBe(1);
  });

  it('should create a new workshop folder via saveFolder', () => {
    component.openCreateFolderModal();
    expect(component.folderModalVisible()).toBe(true);

    component.folderForm.patchValue({
      vehicle_id: VEHICLE_ID,
      contact_id: CONTACT_ID,
      kind: 'mechanics',
      currency: 'EUR',
      mileage_in: 50000,
      complaint: 'Rumore freni',
    });

    component.saveFolder();

    expect(mockWorkshopApi.createFolder).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicle_id: VEHICLE_ID,
        contact_id: CONTACT_ID,
        kind: 'mechanics',
        complaint: 'Rumore freni',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.folderModalVisible()).toBe(false);
  });

  it('should not call the API when the forms are submitted empty or with an invalid price', () => {
    component.openCreateFolderModal();
    component.folderForm.patchValue({ vehicle_id: '' });
    component.saveFolder();
    expect(mockWorkshopApi.createFolder).not.toHaveBeenCalled();
    expect(component.folderForm.controls.vehicle_id.touched).toBe(true);

    component.stockForm.patchValue({ stock_number: '', make: '', model: '' });
    component.saveStock();
    expect(mockWorkshopApi.createVehicleStock).not.toHaveBeenCalled();

    component.recurringForm.patchValue({ vehicle_id: VEHICLE_ID, name: 'Service', unit_price: '12.345678' });
    component.saveRecurringService();
    expect(mockWorkshopApi.createRecurringService).not.toHaveBeenCalled();
  });

  it('should change folder status', () => {
    component.changeFolderStatus(mockFolder, 'in_progress');
    expect(mockWorkshopApi.changeStatus).toHaveBeenCalledWith('f-1-uuid', { status: 'in_progress' });
    expect(mockMessageService.success).toHaveBeenCalled();
  });

  it('should convert folder to quote, delivery note, and invoice', () => {
    component.convertToQuote(mockFolder);
    expect(mockWorkshopApi.convertToQuote).toHaveBeenCalledWith('f-1-uuid');
    expect(mockMessageService.success).toHaveBeenCalled();

    component.convertToDeliveryNote(mockFolder);
    expect(mockWorkshopApi.convertToDeliveryNote).toHaveBeenCalledWith('f-1-uuid');
    expect(mockMessageService.success).toHaveBeenCalled();

    component.convertToInvoice(mockFolder);
    expect(mockWorkshopApi.convertToInvoice).toHaveBeenCalledWith('f-1-uuid');
    expect(mockMessageService.success).toHaveBeenCalled();
  });

  it('should open folder drawer, load details, add line, and delete line', () => {
    component.openFolderDrawer(mockFolder);
    expect(component.drawerVisible()).toBe(true);
    expect(mockWorkshopApi.getFolder).toHaveBeenCalledWith('f-1-uuid');
    expect(mockWorkshopApi.getTimeEntries).toHaveBeenCalledWith('f-1-uuid');
    expect(mockWorkshopApi.getVehicleHistory).toHaveBeenCalledWith('veh-1');

    component.openAddLineModal();
    expect(component.lineModalVisible()).toBe(true);

    component.lineForm.patchValue({
      line_type: 'part',
      description: 'Pastiglie Freni',
      quantity: 2,
      unit_price: '60.00',
      tax_rate: '22.00',
    });

    component.saveLine();
    expect(mockWorkshopApi.addLine).toHaveBeenCalledWith(
      'f-1-uuid',
      expect.objectContaining({
        description: 'Pastiglie Freni',
        quantity: 2,
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.lineModalVisible()).toBe(false);

    component.deleteLine('line-1-uuid');
    expect(mockWorkshopApi.deleteLine).toHaveBeenCalledWith('f-1-uuid', 'line-1-uuid');
    expect(mockMessageService.success).toHaveBeenCalled();

    component.closeFolderDrawer();
    expect(component.drawerVisible()).toBe(false);
    expect(component.selectedFolder()).toBeNull();
  });

  it('should start timer, stop timer, and bill time entries', () => {
    component.selectedFolder.set(mockFolder);

    component.startTimeEntry('f-1-uuid');
    expect(mockWorkshopApi.startTimeEntry).toHaveBeenCalledWith('f-1-uuid', {});
    expect(mockMessageService.success).toHaveBeenCalled();

    component.stopTimeEntry('time-1-uuid');
    expect(mockWorkshopApi.stopTimeEntry).toHaveBeenCalledWith('time-1-uuid');
    expect(mockMessageService.success).toHaveBeenCalled();

    component.openTimeBillModal();
    expect(component.timeBillModalVisible()).toBe(true);

    component.timeBillForm.patchValue({
      hourly_rate: '55.00',
      tax_rate: '22.00',
      description: 'Ore collaudo officina',
    });

    component.billTimeEntries();
    expect(mockWorkshopApi.billTimeEntries).toHaveBeenCalledWith(
      'f-1-uuid',
      expect.objectContaining({
        hourly_rate: '55.00',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.timeBillModalVisible()).toBe(false);
  });

  it('should create stock vehicle and register sale', () => {
    component.openCreateStockModal();
    expect(component.stockModalVisible()).toBe(true);

    component.stockForm.patchValue({
      stock_number: 'STK-002',
      condition: 'used',
      make: 'Fiat',
      model: '500X',
      list_price: '16500.00',
      currency: 'EUR',
      mileage_km: 1200,
      purchase_price: '9000.00',
    });

    component.saveStock();
    expect(mockWorkshopApi.createVehicleStock).toHaveBeenCalledWith(
      expect.objectContaining({
        stock_number: 'STK-002',
        make: 'Fiat',
        mileage_km: 1200,
        purchase_price: '9000.00',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.stockModalVisible()).toBe(false);

    component.openSellStockModal(mockStockUnit);
    expect(component.sellStockModalVisible()).toBe(true);

    component.sellStockForm.patchValue({
      buyer_contact_id: CONTACT_ID,
      sale_date: '2026-03-01',
      sale_price: '13500.00',
      tax_rate: '22.00',
    });

    component.saveSellStock();
    expect(mockWorkshopApi.sellVehicleStock).toHaveBeenCalledWith(
      'stock-1-uuid',
      expect.objectContaining({
        buyer_contact_id: CONTACT_ID,
        sale_price: '13500.00',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.sellStockModalVisible()).toBe(false);
  });

  it('loads the vehicle and contact options from the API and rejects a non-UUID id', () => {
    expect(mockAutomotiveApi.getVehicles).toHaveBeenCalled();
    expect(mockClientApi.list).toHaveBeenCalledWith({ search: '', per_page: 20 });

    component.openCreateFolderModal();
    component.folderForm.patchValue({ vehicle_id: 'AB123CD', contact_id: 'not-a-uuid' });
    expect(component.folderForm.controls.vehicle_id.hasError('uuid')).toBe(true);
    expect(component.folderForm.controls.contact_id.hasError('uuid')).toBe(true);
    component.saveFolder();
    expect(mockWorkshopApi.createFolder).not.toHaveBeenCalled();
  });

  it('blocks a promised date before the received date', () => {
    component.openCreateFolderModal();
    component.folderForm.patchValue({ vehicle_id: VEHICLE_ID, received_at: '2026-03-10', promised_at: '2026-03-01' });
    expect(component.folderForm.controls.promised_at.hasError('endsBeforeStart')).toBe(true);
    component.saveFolder();
    expect(mockWorkshopApi.createFolder).not.toHaveBeenCalled();
  });

  it('should create recurring service and stop it', () => {
    component.openCreateRecurringModal();
    expect(component.recurringModalVisible()).toBe(true);

    component.recurringForm.patchValue({
      vehicle_id: VEHICLE_ID,
      service_type: 'maintenance_plan',
      name: 'Revisione Biennale',
      interval: 'semiannual',
      start_date: '2026-03-01',
      unit_price: '80.00',
      tax_rate: '22.00',
      currency: 'EUR',
    });

    component.saveRecurringService();
    expect(mockWorkshopApi.createRecurringService).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicle_id: VEHICLE_ID,
        name: 'Revisione Biennale',
      }),
    );
    expect(mockMessageService.success).toHaveBeenCalled();
    expect(component.recurringModalVisible()).toBe(false);

    component.stopRecurring('rec-1-uuid');
    expect(mockWorkshopApi.stopRecurringService).toHaveBeenCalledWith('rec-1-uuid');
    expect(mockMessageService.success).toHaveBeenCalled();
  });
});
