import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  TranslateService,
  WorkshopApiService,
  WorkshopFolder,
  WorkshopFolderKind,
  WorkshopFolderLine,
  WorkshopFolderLineRequest,
  WorkshopFolderRequest,
  WorkshopFolderStatus,
  WorkshopLineType,
  WorkshopRecurringService,
  WorkshopRecurringServiceRequest,
  WorkshopSellRequest,
  WorkshopStockUnitRequest,
  WorkshopTimeBillRequest,
  WorkshopTimeEntry,
  WorkshopVehicleHistoryEntry,
  WorkshopVehicleStockUnit,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-workshop',
  imports: [
    DatePipe,
    DecimalPipe,
    UpperCasePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTabsModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzFormModule,
    NzModalModule,
    NzDrawerModule,
    NzDescriptionsModule,
    NzSpaceModule,
    NzStatisticModule,
    NzPopconfirmModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
    MoneyPipe,
  ],
  templateUrl: './workshop.component.html',
})
export class WorkshopComponent implements OnInit {
  private readonly api = inject(WorkshopApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  // Tabs state
  readonly selectedTabIndex = signal<number>(0);

  // --- TAB 1: WORKSHOP FOLDERS ---
  readonly folders = signal<WorkshopFolder[]>([]);
  readonly foldersTotal = signal<number>(0);
  readonly foldersLoading = signal<boolean>(false);
  readonly foldersPageIndex = signal<number>(1);
  readonly foldersPageSize = signal<number>(10);
  readonly filterFolderStatus = signal<WorkshopFolderStatus | ''>('');
  readonly filterFolderSearch = signal<string>('');

  // Folder Detail Drawer
  readonly drawerVisible = signal<boolean>(false);
  readonly selectedFolder = signal<WorkshopFolder | null>(null);
  readonly folderLines = signal<WorkshopFolderLine[]>([]);
  readonly vehicleHistory = signal<WorkshopVehicleHistoryEntry[]>([]);
  readonly folderTimeEntries = signal<WorkshopTimeEntry[]>([]);
  readonly drawerLoading = signal<boolean>(false);

  // Modals visibility
  readonly folderModalVisible = signal<boolean>(false);
  readonly lineModalVisible = signal<boolean>(false);
  readonly timeBillModalVisible = signal<boolean>(false);
  readonly stockModalVisible = signal<boolean>(false);
  readonly sellStockModalVisible = signal<boolean>(false);
  readonly recurringModalVisible = signal<boolean>(false);

  // --- TAB 2: TIME ENTRIES & TIMBRATURE ---
  readonly timerLoading = signal<boolean>(false);

  // --- TAB 3: VEHICLE STOCK ---
  readonly stockUnits = signal<WorkshopVehicleStockUnit[]>([]);
  readonly stockTotal = signal<number>(0);
  readonly stockLoading = signal<boolean>(false);
  readonly stockPageIndex = signal<number>(1);
  readonly stockPageSize = signal<number>(10);
  readonly filterStockStatus = signal<'available' | 'reserved' | 'sold' | ''>('');
  readonly selectedStockUnit = signal<WorkshopVehicleStockUnit | null>(null);

  // --- TAB 4: RECURRING SERVICES (TAGLIANDI / REVISIONI) ---
  readonly recurringServices = signal<WorkshopRecurringService[]>([]);
  readonly recurringLoading = signal<boolean>(false);

  // --- FORMS ---
  readonly folderForm = this.fb.group({
    vehicle_id: ['', [Validators.required]],
    contact_id: [''],
    kind: ['repair' as WorkshopFolderKind, [Validators.required]],
    currency: ['EUR', [Validators.required]],
    mileage_in: [0],
    notes: [''],
  });

  readonly lineForm = this.fb.group({
    line_type: ['part' as WorkshopLineType, [Validators.required]],
    description: ['', [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    unit_price: ['0.00', [Validators.required]],
    tax_rate: ['22.00', [Validators.required]],
  });

  readonly timeBillForm = this.fb.group({
    hourly_rate: ['50.00', [Validators.required]],
    tax_rate: ['22.00', [Validators.required]],
    description: ['Manodopera e collaudo'],
  });

  readonly stockForm = this.fb.group({
    stock_number: ['', [Validators.required]],
    condition: ['used' as 'new' | 'used', [Validators.required]],
    make: ['', [Validators.required]],
    model: ['', [Validators.required]],
    vin: [''],
    year: [new Date().getFullYear()],
    mileage: [0],
    purchase_cost: ['0.00'],
    list_price: ['0.00', [Validators.required]],
    currency: ['EUR', [Validators.required]],
  });

  readonly sellStockForm = this.fb.group({
    buyer_contact_id: ['', [Validators.required]],
    sale_date: [new Date().toISOString().substring(0, 10), [Validators.required]],
    sale_price: ['0.00', [Validators.required]],
    tax_rate: ['22.00', [Validators.required]],
  });

  readonly recurringForm = this.fb.group({
    vehicle_id: ['', [Validators.required]],
    service_type: ['scheduled_maintenance', [Validators.required]],
    name: ['', [Validators.required]],
    interval: ['1 year', [Validators.required]],
    start_date: [new Date().toISOString().substring(0, 10), [Validators.required]],
    unit_price: ['150.00', [Validators.required]],
    tax_rate: ['22.00', [Validators.required]],
    currency: ['EUR', [Validators.required]],
  });

  ngOnInit(): void {
    this.loadFolders();
    this.loadStock();
    this.loadRecurringServices();
  }

  // --- FOLDERS METHODS ---
  loadFolders(): void {
    this.foldersLoading.set(true);
    const status = this.filterFolderStatus();
    const search = this.filterFolderSearch().trim();

    this.api
      .getFolders({
        page: this.foldersPageIndex(),
        per_page: this.foldersPageSize(),
        status: status ? status : undefined,
        search: search ? search : undefined,
      })
      .subscribe({
        next: (res) => {
          this.folders.set(res.data);
          this.foldersTotal.set(res.meta?.total ?? res.data.length);
          this.foldersLoading.set(false);
        },
        error: () => {
          this.foldersLoading.set(false);
          this.message.error(this.translate.instant('WORKSHOP.LOAD_ERROR'));
        },
      });
  }

  onFoldersTableQueryChange(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    this.foldersPageIndex.set(pageIndex);
    this.foldersPageSize.set(pageSize);
    this.loadFolders();
  }

  openCreateFolderModal(): void {
    this.folderForm.reset({
      vehicle_id: '',
      contact_id: '',
      kind: 'repair',
      currency: 'EUR',
      mileage_in: 0,
      notes: '',
    });
    this.folderModalVisible.set(true);
  }

  saveFolder(): void {
    if (this.folderForm.invalid) {
      this.folderForm.markAllAsTouched();
      return;
    }
    const val = this.folderForm.getRawValue();
    const payload: WorkshopFolderRequest = {
      vehicle_id: val.vehicle_id,
      contact_id: val.contact_id || undefined,
      kind: val.kind,
      currency: val.currency,
      mileage_in: val.mileage_in ? Number(val.mileage_in) : undefined,
      notes: val.notes || undefined,
    };

    this.api.createFolder(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('WORKSHOP.FOLDER_CREATED'));
        this.folderModalVisible.set(false);
        this.loadFolders();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKSHOP.ACTION_ERROR'));
      },
    });
  }

  changeFolderStatus(folder: WorkshopFolder, newStatus: WorkshopFolderStatus): void {
    this.api.changeStatus(folder.id, { status: newStatus }).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('WORKSHOP.STATUS_UPDATED'));
        if (this.selectedFolder()?.id === folder.id) {
          this.selectedFolder.set(res.data);
        }
        this.loadFolders();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKSHOP.ACTION_ERROR'));
      },
    });
  }

  convertToQuote(folder: WorkshopFolder): void {
    this.api.convertToQuote(folder.id).subscribe({
      next: (res) => {
        this.message.success(
          `${this.translate.instant('WORKSHOP.QUOTE_GENERATED')}: #${res.data.quote_id}`,
        );
        this.loadFolders();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKSHOP.ACTION_ERROR'));
      },
    });
  }

  convertToDeliveryNote(folder: WorkshopFolder): void {
    this.api.convertToDeliveryNote(folder.id).subscribe({
      next: (res) => {
        this.message.success(
          `${this.translate.instant('WORKSHOP.DELIVERY_NOTE_GENERATED')}: #${res.data.delivery_note_id}`,
        );
        this.loadFolders();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKSHOP.ACTION_ERROR'));
      },
    });
  }

  convertToInvoice(folder: WorkshopFolder): void {
    this.api.convertToInvoice(folder.id).subscribe({
      next: (res) => {
        this.message.success(
          `${this.translate.instant('WORKSHOP.INVOICE_GENERATED')}: #${res.data.invoice_id}`,
        );
        this.loadFolders();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKSHOP.ACTION_ERROR'));
      },
    });
  }

  // --- DRAWER DETAILS & LINES ---
  openFolderDrawer(folder: WorkshopFolder): void {
    this.selectedFolder.set(folder);
    this.drawerVisible.set(true);
    this.loadFolderDetails(folder.id, folder.vehicle_id);
  }

  closeFolderDrawer(): void {
    this.drawerVisible.set(false);
    this.selectedFolder.set(null);
    this.folderLines.set([]);
    this.vehicleHistory.set([]);
    this.folderTimeEntries.set([]);
  }

  loadFolderDetails(folderId: string, vehicleId?: string): void {
    this.drawerLoading.set(true);
    this.api.getFolder(folderId).subscribe({
      next: (res) => {
        this.selectedFolder.set(res.data);
        this.folderLines.set(res.data.lines || []);
        this.drawerLoading.set(false);
      },
      error: () => {
        this.drawerLoading.set(false);
      },
    });

    this.api.getTimeEntries(folderId).subscribe({
      next: (res) => {
        this.folderTimeEntries.set(res.data || []);
      },
    });

    if (vehicleId) {
      this.api.getVehicleHistory(vehicleId).subscribe({
        next: (res) => {
          this.vehicleHistory.set(res.data || []);
        },
      });
    }
  }

  openAddLineModal(): void {
    this.lineForm.reset({
      line_type: 'part',
      description: '',
      quantity: 1,
      unit_price: '0.00',
      tax_rate: '22.00',
    });
    this.lineModalVisible.set(true);
  }

  saveLine(): void {
    const folder = this.selectedFolder();
    if (!folder || this.lineForm.invalid) {
      this.lineForm.markAllAsTouched();
      return;
    }
    const val = this.lineForm.getRawValue();
    const payload: WorkshopFolderLineRequest = {
      line_type: val.line_type,
      description: val.description,
      quantity: Number(val.quantity),
      unit_price: val.unit_price,
      tax_rate: val.tax_rate,
    };

    this.api.addLine(folder.id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('WORKSHOP.LINE_ADDED'));
        this.lineModalVisible.set(false);
        this.loadFolderDetails(folder.id, folder.vehicle_id);
        this.loadFolders();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKSHOP.ACTION_ERROR'));
      },
    });
  }

  deleteLine(lineId: string): void {
    const folder = this.selectedFolder();
    if (!folder) return;

    this.api.deleteLine(folder.id, lineId).subscribe({
      next: () => {
        this.message.success(this.translate.instant('WORKSHOP.LINE_DELETED'));
        this.loadFolderDetails(folder.id, folder.vehicle_id);
        this.loadFolders();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKSHOP.ACTION_ERROR'));
      },
    });
  }

  // --- TIME TRACKING METHODS ---
  startTimeEntry(folderId: string): void {
    this.timerLoading.set(true);
    this.api.startTimeEntry(folderId, {}).subscribe({
      next: () => {
        this.timerLoading.set(false);
        this.message.success(this.translate.instant('WORKSHOP.TIMER_STARTED'));
        if (this.selectedFolder()?.id === folderId) {
          this.loadFolderDetails(folderId, this.selectedFolder()?.vehicle_id);
        }
      },
      error: () => {
        this.timerLoading.set(false);
        this.message.error(this.translate.instant('WORKSHOP.ACTION_ERROR'));
      },
    });
  }

  stopTimeEntry(timeEntryId: string): void {
    this.timerLoading.set(true);
    this.api.stopTimeEntry(timeEntryId).subscribe({
      next: () => {
        this.timerLoading.set(false);
        this.message.success(this.translate.instant('WORKSHOP.TIMER_STOPPED'));
        const folder = this.selectedFolder();
        if (folder) {
          this.loadFolderDetails(folder.id, folder.vehicle_id);
        }
      },
      error: () => {
        this.timerLoading.set(false);
        this.message.error(this.translate.instant('WORKSHOP.ACTION_ERROR'));
      },
    });
  }

  openTimeBillModal(): void {
    this.timeBillForm.reset({
      hourly_rate: '50.00',
      tax_rate: '22.00',
      description: 'Manodopera e collaudo',
    });
    this.timeBillModalVisible.set(true);
  }

  billTimeEntries(): void {
    const folder = this.selectedFolder();
    if (!folder || this.timeBillForm.invalid) {
      this.timeBillForm.markAllAsTouched();
      return;
    }
    const val = this.timeBillForm.getRawValue();
    const payload: WorkshopTimeBillRequest = {
      hourly_rate: val.hourly_rate,
      tax_rate: val.tax_rate,
      description: val.description,
    };

    this.api.billTimeEntries(folder.id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('WORKSHOP.TIME_BILLED'));
        this.timeBillModalVisible.set(false);
        this.loadFolderDetails(folder.id, folder.vehicle_id);
        this.loadFolders();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKSHOP.ACTION_ERROR'));
      },
    });
  }

  // --- VEHICLE STOCK METHODS ---
  loadStock(): void {
    this.stockLoading.set(true);
    const status = this.filterStockStatus();

    this.api
      .getVehicleStock({
        page: this.stockPageIndex(),
        per_page: this.stockPageSize(),
        status: status ? status : undefined,
      })
      .subscribe({
        next: (res) => {
          this.stockUnits.set(res.data);
          this.stockTotal.set(res.meta?.total ?? res.data.length);
          this.stockLoading.set(false);
        },
        error: () => {
          this.stockLoading.set(false);
          this.message.error(this.translate.instant('WORKSHOP.LOAD_ERROR'));
        },
      });
  }

  onStockTableQueryChange(params: NzTableQueryParams): void {
    const { pageIndex, pageSize } = params;
    this.stockPageIndex.set(pageIndex);
    this.stockPageSize.set(pageSize);
    this.loadStock();
  }

  openCreateStockModal(): void {
    this.stockForm.reset({
      stock_number: '',
      condition: 'used',
      make: '',
      model: '',
      vin: '',
      year: new Date().getFullYear(),
      mileage: 0,
      purchase_cost: '0.00',
      list_price: '0.00',
      currency: 'EUR',
    });
    this.stockModalVisible.set(true);
  }

  saveStock(): void {
    if (this.stockForm.invalid) {
      this.stockForm.markAllAsTouched();
      return;
    }
    const val = this.stockForm.getRawValue();
    const payload: WorkshopStockUnitRequest = {
      stock_number: val.stock_number,
      condition: val.condition,
      make: val.make,
      model: val.model,
      vin: val.vin || undefined,
      year: val.year ? Number(val.year) : undefined,
      mileage: val.mileage ? Number(val.mileage) : undefined,
      purchase_cost: val.purchase_cost || undefined,
      list_price: val.list_price,
      currency: val.currency,
    };

    this.api.createVehicleStock(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('WORKSHOP.STOCK_CREATED'));
        this.stockModalVisible.set(false);
        this.loadStock();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKSHOP.ACTION_ERROR'));
      },
    });
  }

  openSellStockModal(stockUnit: WorkshopVehicleStockUnit): void {
    this.selectedStockUnit.set(stockUnit);
    this.sellStockForm.reset({
      buyer_contact_id: '',
      sale_date: new Date().toISOString().substring(0, 10),
      sale_price: stockUnit.list_price || '0.00',
      tax_rate: '22.00',
    });
    this.sellStockModalVisible.set(true);
  }

  saveSellStock(): void {
    const unit = this.selectedStockUnit();
    if (!unit || this.sellStockForm.invalid) {
      this.sellStockForm.markAllAsTouched();
      return;
    }
    const val = this.sellStockForm.getRawValue();
    const payload: WorkshopSellRequest = {
      buyer_contact_id: val.buyer_contact_id,
      sale_date: val.sale_date,
      sale_price: val.sale_price,
      tax_rate: val.tax_rate,
    };

    this.api.sellVehicleStock(unit.id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('WORKSHOP.STOCK_SOLD'));
        this.sellStockModalVisible.set(false);
        this.loadStock();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKSHOP.ACTION_ERROR'));
      },
    });
  }

  // --- RECURRING SERVICES METHODS ---
  loadRecurringServices(): void {
    this.recurringLoading.set(true);
    this.api.getRecurringServices().subscribe({
      next: (res) => {
        this.recurringServices.set(res.data);
        this.recurringLoading.set(false);
      },
      error: () => {
        this.recurringLoading.set(false);
        this.message.error(this.translate.instant('WORKSHOP.LOAD_ERROR'));
      },
    });
  }

  openCreateRecurringModal(): void {
    this.recurringForm.reset({
      vehicle_id: '',
      service_type: 'scheduled_maintenance',
      name: '',
      interval: '1 year',
      start_date: new Date().toISOString().substring(0, 10),
      unit_price: '150.00',
      tax_rate: '22.00',
      currency: 'EUR',
    });
    this.recurringModalVisible.set(true);
  }

  saveRecurringService(): void {
    if (this.recurringForm.invalid) {
      this.recurringForm.markAllAsTouched();
      return;
    }
    const val = this.recurringForm.getRawValue();
    const payload: WorkshopRecurringServiceRequest = {
      vehicle_id: val.vehicle_id,
      service_type: val.service_type,
      name: val.name,
      interval: val.interval,
      start_date: val.start_date,
      unit_price: val.unit_price,
      tax_rate: val.tax_rate,
      currency: val.currency,
    };

    this.api.createRecurringService(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('WORKSHOP.RECURRING_CREATED'));
        this.recurringModalVisible.set(false);
        this.loadRecurringServices();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKSHOP.ACTION_ERROR'));
      },
    });
  }

  stopRecurring(id: string): void {
    this.api.stopRecurringService(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('WORKSHOP.RECURRING_STOPPED'));
        this.loadRecurringServices();
      },
      error: () => {
        this.message.error(this.translate.instant('WORKSHOP.ACTION_ERROR'));
      },
    });
  }

  // Status tag colors
  getFolderStatusColor(status: WorkshopFolderStatus): string {
    switch (status) {
      case 'draft':
        return 'default';
      case 'open':
        return 'blue';
      case 'in_progress':
        return 'processing';
      case 'completed':
        return 'success';
      case 'delivered':
        return 'geekblue';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  }

  getStockStatusColor(status: 'available' | 'reserved' | 'sold'): string {
    switch (status) {
      case 'available':
        return 'success';
      case 'reserved':
        return 'warning';
      case 'sold':
        return 'magenta';
      default:
        return 'default';
    }
  }
}
