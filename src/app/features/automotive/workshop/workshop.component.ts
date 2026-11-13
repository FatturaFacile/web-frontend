import { DatePipe, DecimalPipe, UpperCasePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { decimalPattern, positiveNumber } from '@shared/utils/decimal-validators';
import { uuidFormat } from '@shared/utils/uuid-validator';
import { catchError, debounceTime, distinctUntilChanged, map, of, startWith, switchMap } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
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
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AutomotiveApiService,
  ClientApiService,
  contactDisplayName,
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
  WorkshopFolderParams,
  WorkshopStockParams,
  FetchGridModel,
  WorkshopRecurringInterval,
  WorkshopRecurringServiceRequest,
  WorkshopRecurringServiceType,
  WorkshopSellRequest,
  WorkshopStockUnitRequest,
  WorkshopTimeBillRequest,
  WorkshopTimeEntry,
  WorkshopVehicleHistoryEntry,
  WorkshopVehicleStockUnit,
} from '@core';
import { BaseTableComponent, MoneyPipe, PageHeaderComponent, TableColumnDef, TranslatePipe, ModalActionsDirective, IconActionDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';

@Component({
  selector: 'app-workshop',
  styleUrl: './workshop.component.scss',
  imports: [
    BaseTableComponent,
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    ModalActionsDirective,
    IconActionDirective,
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
export class WorkshopComponent {
  private readonly api = inject(WorkshopApiService);
  private readonly automotiveApi = inject(AutomotiveApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  // Tabs state
  readonly selectedTabIndex = signal<number>(0);

  // --- TAB 1: WORKSHOP FOLDERS ---
  /** Server-driven grids: paging, sorting, column filters, grouping and export run on the API. */
  readonly foldersGrid = new FetchGridModel<WorkshopFolder, WorkshopFolderParams>((query) => this.api.getFolders(query));
  readonly folders = this.foldersGrid.items;
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
  readonly stockGrid = new FetchGridModel<WorkshopVehicleStockUnit, WorkshopStockParams>((query) => this.api.getVehicleStock(query));
  readonly stockUnits = this.stockGrid.items;
  readonly filterStockStatus = signal<'in_stock' | 'reserved' | 'sold' | ''>('');
  readonly selectedStockUnit = signal<WorkshopVehicleStockUnit | null>(null);

  // --- TAB 4: RECURRING SERVICES (TAGLIANDI / REVISIONI) ---
  readonly recurringGrid = new FetchGridModel<WorkshopRecurringService>((query) => this.api.getRecurringServices(query));
  readonly recurringServices = this.recurringGrid.items;

  // --- LOOKUPS (vehicle and contact selects) ---
  /** Vehicles of the registry: the API list has no search filter, so the select filters the loaded page on the client. */
  protected readonly vehicleOptions = toSignal(
    this.automotiveApi.getVehicles().pipe(
      map((res) =>
        (res.data?.data ?? []).map((v) => ({
          label: [v.license_plate, [v.make, v.model].filter(Boolean).join(' ')].filter(Boolean).join(' - '),
          value: v.id,
        })),
      ),
      catchError(() => of([])),
    ),
    { initialValue: [] },
  );

  protected readonly contactSearch = signal('');
  /** Contacts matching the typed text, searched on the server. */
  protected readonly contactOptions = toSignal(
    toObservable(this.contactSearch).pipe(
      debounceTime(250),
      distinctUntilChanged(),
      startWith(''),
      switchMap((search) =>
        this.clientApi.list({ search, per_page: 20 }).pipe(
          map((res) => res.data.map((c) => ({ label: contactDisplayName(c), value: c.id }))),
          catchError(() => of([])),
        ),
      ),
    ),
    { initialValue: [] },
  );

  // --- FORMS ---
  readonly folderForm = this.fb.group({
    vehicle_id: ['', [Validators.required, uuidFormat]],
    contact_id: ['', [uuidFormat]],
    kind: ['mechanics' as WorkshopFolderKind, [Validators.required]],
    currency: ['EUR', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
    received_at: [new Date().toISOString().substring(0, 10)],
    promised_at: ['', [endsNotBefore('received_at')]],
    mileage_in: [0, [Validators.min(0)]],
    complaint: ['', [Validators.maxLength(5000)]],
  });

  readonly lineForm = this.fb.group({
    line_type: ['part' as WorkshopLineType, [Validators.required]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    quantity: [1, [Validators.required, Validators.min(0.01)]],
    unit_price: ['0.00', [Validators.required, decimalPattern(4)]],
    tax_rate: ['22.00', [Validators.required, decimalPattern(2), Validators.max(100)]],
  });

  readonly timeBillForm = this.fb.group({
    hourly_rate: ['50.00', [Validators.required, decimalPattern(4), positiveNumber]],
    tax_rate: ['22.00', [Validators.required, decimalPattern(2), Validators.max(100)]],
    description: ['Manodopera e collaudo', [Validators.maxLength(500)]],
  });

  readonly stockForm = this.fb.group({
    stock_number: ['', [Validators.required, Validators.maxLength(40)]],
    condition: ['used' as 'new' | 'used', [Validators.required]],
    make: ['', [Validators.required, Validators.maxLength(50)]],
    model: ['', [Validators.required, Validators.maxLength(50)]],
    vin: ['', [Validators.maxLength(30)]],
    year: [new Date().getFullYear(), [Validators.min(1900), Validators.max(2100)]],
    mileage_km: [0, [Validators.min(0)]],
    purchase_price: ['0.00', [decimalPattern(2)]],
    list_price: ['0.00', [Validators.required, decimalPattern(2)]],
    currency: ['EUR', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
  });

  readonly sellStockForm = this.fb.group({
    buyer_contact_id: ['', [Validators.required, uuidFormat]],
    sale_date: [new Date().toISOString().substring(0, 10), [Validators.required]],
    sale_price: ['0.00', [Validators.required, decimalPattern(2), positiveNumber]],
    tax_rate: ['22.00', [Validators.required, decimalPattern(2), Validators.max(100)]],
  });

  readonly recurringForm = this.fb.group({
    vehicle_id: ['', [Validators.required, uuidFormat]],
    service_type: ['maintenance_plan' as WorkshopRecurringServiceType, [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    interval: ['yearly' as WorkshopRecurringInterval, [Validators.required]],
    start_date: [new Date().toISOString().substring(0, 10), [Validators.required]],
    unit_price: ['150.00', [Validators.required, decimalPattern(4), positiveNumber]],
    tax_rate: ['22.00', [Validators.required, decimalPattern(2), Validators.max(100)]],
    currency: ['EUR', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]],
  });

  protected readonly recurringTypes: readonly WorkshopRecurringServiceType[] = ['tyre_storage', 'maintenance_plan', 'other'];
  protected readonly recurringIntervals: readonly WorkshopRecurringInterval[] = ['monthly', 'quarterly', 'semiannual', 'yearly'];

  private readonly folderNumberTpl = viewChild<TemplateRef<unknown>>('folderNumberTpl');
  private readonly folderVehicleTpl = viewChild<TemplateRef<unknown>>('folderVehicleTpl');
  private readonly kindTpl = viewChild<TemplateRef<unknown>>('kindTpl');
  private readonly folderStatusTpl = viewChild<TemplateRef<unknown>>('folderStatusTpl');
  private readonly mileageTpl = viewChild<TemplateRef<unknown>>('mileageTpl');
  private readonly moneyTpl = viewChild<TemplateRef<unknown>>('moneyTpl');
  private readonly strongMoneyTpl = viewChild<TemplateRef<unknown>>('strongMoneyTpl');
  private readonly stockNumberTpl = viewChild<TemplateRef<unknown>>('stockNumberTpl');
  private readonly makeModelTpl = viewChild<TemplateRef<unknown>>('makeModelTpl');
  private readonly conditionTpl = viewChild<TemplateRef<unknown>>('conditionTpl');
  private readonly yearKmTpl = viewChild<TemplateRef<unknown>>('yearKmTpl');
  private readonly stockStatusTpl = viewChild<TemplateRef<unknown>>('stockStatusTpl');
  private readonly buyerTpl = viewChild<TemplateRef<unknown>>('buyerTpl');
  private readonly strongTpl = viewChild<TemplateRef<unknown>>('strongTpl');
  private readonly plainTagTpl = viewChild<TemplateRef<unknown>>('plainTagTpl');
  private readonly dateTpl = viewChild<TemplateRef<unknown>>('dateTpl');
  private readonly activeTpl = viewChild<TemplateRef<unknown>>('activeTpl');

  /** Folder columns: the API knows license_plate, customer_name, ... as calculated grid columns (WorkshopFolder::gridColumns). */
  protected readonly folderColumns = computed<TableColumnDef<WorkshopFolder>[]>(() => [
    { key: 'folder_number', header: 'WORKSHOP.COL_NUMBER', customCellTemplate: this.folderNumberTpl() },
    { key: 'license_plate', header: 'WORKSHOP.COL_VEHICLE', valueGetter: (f) => f.license_plate || f.vehicle_id, customCellTemplate: this.folderVehicleTpl() },
    { key: 'customer_name', header: 'WORKSHOP.COL_CUSTOMER', valueGetter: (f) => f.customer_name || '-' },
    { key: 'kind', header: 'WORKSHOP.COL_KIND', customCellTemplate: this.kindTpl() },
    { key: 'status', header: 'WORKSHOP.COL_STATUS', customCellTemplate: this.folderStatusTpl() },
    { key: 'mileage_in', header: 'WORKSHOP.COL_MILEAGE_IN', customCellTemplate: this.mileageTpl() },
    { key: 'total_net', header: 'WORKSHOP.COL_TOTAL_NET', align: 'right', customCellTemplate: this.moneyTpl() },
    { key: 'total_gross', header: 'WORKSHOP.COL_TOTAL_GROSS', align: 'right', customCellTemplate: this.strongMoneyTpl() },
  ]);

  /** Stock columns: sold_at and buyer_name are calculated grid columns (VehicleStockUnit::gridColumns). */
  protected readonly stockColumns = computed<TableColumnDef<WorkshopVehicleStockUnit>[]>(() => [
    { key: 'stock_number', header: 'WORKSHOP.COL_STOCK_NUM', customCellTemplate: this.stockNumberTpl() },
    { key: 'make', header: 'WORKSHOP.COL_MAKE_MODEL', valueGetter: (u) => `${u.make} ${u.model}`, customCellTemplate: this.makeModelTpl() },
    { key: 'condition', header: 'WORKSHOP.COL_CONDITION', customCellTemplate: this.conditionTpl() },
    { key: 'year', header: 'WORKSHOP.COL_YEAR_KM', customCellTemplate: this.yearKmTpl() },
    { key: 'purchase_price', header: 'WORKSHOP.COL_PURCHASE_COST', align: 'right', customCellTemplate: this.moneyTpl() },
    { key: 'list_price', header: 'WORKSHOP.COL_LIST_PRICE', align: 'right', customCellTemplate: this.strongMoneyTpl() },
    { key: 'status', header: 'WORKSHOP.COL_STATUS', customCellTemplate: this.stockStatusTpl() },
    { key: 'buyer_name', header: 'WORKSHOP.COL_BUYER', valueGetter: (u) => u.buyer_name || '-', customCellTemplate: this.buyerTpl() },
  ]);

  /** Recurring service columns: name, interval, price, ... come from the billing subscription (RecurringService::gridColumns). */
  protected readonly recurringColumns = computed<TableColumnDef<WorkshopRecurringService>[]>(() => [
    { key: 'name', header: 'WORKSHOP.COL_SERVICE_NAME', customCellTemplate: this.strongTpl() },
    { key: 'license_plate', header: 'WORKSHOP.COL_VEHICLE', valueGetter: (r) => r.license_plate || r.vehicle_id },
    { key: 'service_type', header: 'WORKSHOP.COL_TYPE', customCellTemplate: this.plainTagTpl() },
    { key: 'interval', header: 'WORKSHOP.COL_INTERVAL' },
    { key: 'start_date', header: 'WORKSHOP.COL_START_DATE', customCellTemplate: this.dateTpl() },
    { key: 'unit_price', header: 'WORKSHOP.COL_PRICE', align: 'right', customCellTemplate: this.moneyTpl() },
    {
      key: 'is_active',
      header: 'WORKSHOP.COL_STATUS',
      valueGetter: (r) => this.translate.instant(r.is_active ? 'WORKSHOP.ACTIVE' : 'WORKSHOP.STOPPED'),
      valueLabel: (value) => this.translate.instant(value === '1' || value === 'true' ? 'WORKSHOP.ACTIVE' : 'WORKSHOP.STOPPED'),
      customCellTemplate: this.activeTpl(),
    },
  ]);

  constructor() {
    revalidateOnStartChange(this.folderForm, 'received_at', 'promised_at', inject(DestroyRef));
  }

  // --- FOLDERS METHODS ---
  /** Applies the toolbar filters (status and text) to the folders grid. */
  applyFolderFilters(): void {
    this.foldersGrid.setFilter({
      status: this.filterFolderStatus() || undefined,
      search: this.filterFolderSearch().trim() || undefined,
    });
  }

  loadFolders(): void {
    this.foldersGrid.reload();
  }

  openCreateFolderModal(): void {
    this.folderForm.reset({
      vehicle_id: '',
      contact_id: '',
      kind: 'mechanics',
      currency: 'EUR',
      received_at: new Date().toISOString().substring(0, 10),
      promised_at: '',
      mileage_in: 0,
      complaint: '',
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
      received_at: val.received_at || undefined,
      promised_at: val.promised_at || undefined,
      mileage_in: val.mileage_in ? Number(val.mileage_in) : undefined,
      complaint: val.complaint || undefined,
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
  /** Applies the toolbar status filter to the stock grid. */
  applyStockFilters(): void {
    this.stockGrid.setFilter({ status: this.filterStockStatus() || undefined });
  }

  loadStock(): void {
    this.stockGrid.reload();
  }

  openCreateStockModal(): void {
    this.stockForm.reset({
      stock_number: '',
      condition: 'used',
      make: '',
      model: '',
      vin: '',
      year: new Date().getFullYear(),
      mileage_km: 0,
      purchase_price: '0.00',
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
      mileage_km: val.mileage_km ? Number(val.mileage_km) : undefined,
      purchase_price: val.purchase_price || undefined,
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
    this.recurringGrid.reload();
  }

  openCreateRecurringModal(): void {
    this.recurringForm.reset({
      vehicle_id: '',
      service_type: 'maintenance_plan',
      name: '',
      interval: 'yearly',
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

  getStockStatusColor(status: 'in_stock' | 'reserved' | 'sold'): string {
    switch (status) {
      case 'in_stock':
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
