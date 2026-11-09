import { DatePipe, JsonPipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  BomType,
  CreateBomPayload,
  CreateProductionOrderPayload,
  CreateWorkCenterPayload,
  ManufacturingApiService,
  MfgBomResource,
  MfgMrpRunResource,
  MfgPlannedOrderResource,
  MfgProductionOrderResource,
  MfgRoutingResource,
  MfgShortageResource,
  MfgWorkCenterResource,
  MrpRunType,
  RunMrpPayload,
  TranslateService,
} from '@core';
import {
  MoneyPipe,
  PageHeaderComponent,
  TranslatePipe,
} from '@shared';
import { apiErrorText, hasAnyRole } from '../sales/cycle/shared/sales-api-helpers';

/** Roles that may activate a BOM revision (the API answers 403 to anyone else). */
const BOM_MANAGER_ROLES: readonly string[] = ['owner', 'admin', 'production'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-manufacturing',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    DatePipe,
    JsonPipe,
    UpperCasePipe,
    MoneyPipe,
    NzCardModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzDatePickerModule,
    NzTabsModule,
    NzGridModule,
    NzStatisticModule,
    NzModalModule,
    NzFormModule,
    NzDividerModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './manufacturing.component.html',
})
export class ManufacturingComponent implements OnInit {
  private readonly api = inject(ManufacturingApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly authStore = inject(AuthStore);
  private readonly translate = inject(TranslateService);

  protected readonly canActivateBom = computed(() => hasAnyRole(this.authStore.activeRoles(), BOM_MANAGER_ROLES));

  readonly selectedTab = signal<number>(0);

  // --- Production Orders State ---
  readonly orders = signal<MfgProductionOrderResource[]>([]);
  readonly loadingOrders = signal(false);
  readonly ordersTotal = signal(0);
  readonly ordersPage = signal(1);
  readonly ordersSearch = signal('');
  readonly ordersStatusFilter = signal<string | null>(null);

  // --- BOMs State ---
  readonly boms = signal<MfgBomResource[]>([]);
  readonly loadingBoms = signal(false);
  readonly bomsTotal = signal(0);
  readonly bomsPage = signal(1);
  readonly bomsSearch = signal('');

  // --- MRP State ---
  readonly mrpRuns = signal<MfgMrpRunResource[]>([]);
  readonly loadingMrp = signal(false);
  readonly mrpTotal = signal(0);
  readonly mrpPage = signal(1);

  readonly plannedOrders = signal<MfgPlannedOrderResource[]>([]);
  readonly loadingPlanned = signal(false);
  readonly plannedTotal = signal(0);
  readonly plannedPage = signal(1);

  readonly shortages = signal<MfgShortageResource[]>([]);
  readonly loadingShortages = signal(false);
  readonly shortagesTotal = signal(0);
  readonly shortagesPage = signal(1);

  // --- Work Centers & Routings State ---
  readonly workCenters = signal<MfgWorkCenterResource[]>([]);
  readonly loadingWorkCenters = signal(false);
  readonly routings = signal<MfgRoutingResource[]>([]);
  readonly loadingRoutings = signal(false);

  // --- KPI Computed Metrics ---
  readonly kpiTotalOrders = computed(() => this.orders().length);
  readonly kpiInProgressOrders = computed(
    () => this.orders().filter((o) => o.status === 'in_progress').length
  );
  readonly kpiCompletedOrders = computed(
    () => this.orders().filter((o) => o.status === 'completed' || o.status === 'closed').length
  );
  readonly kpiTotalBoms = computed(() => this.boms().length);

  // --- Forms & Modals ---
  readonly isCreateOrderModalVisible = signal(false);
  readonly isSubmittingOrder = signal(false);
  readonly orderForm = this.fb.group({
    mfg_item_id: ['', [Validators.required]],
    target_quantity: [1, [Validators.required, Validators.min(0.001)]],
    planned_start_date: [new Date(), [Validators.required]],
    planned_end_date: [new Date(Date.now() + 7 * 86400000), [Validators.required]],
    bom_id: [''],
    notes: [''],
  });

  /** Active BOM revisions of the item typed in the order form (empty list: the API will refuse the order). */
  readonly orderBoms = signal<MfgBomResource[]>([]);
  readonly orderBomsChecked = signal(false);

  /** Order waiting for the cancellation reason (opens the cancel modal). */
  readonly cancellingOrder = signal<MfgProductionOrderResource | null>(null);
  readonly cancelReason = signal('');
  readonly isCancellingOrder = signal(false);

  readonly isCreateBomModalVisible = signal(false);
  readonly isSubmittingBom = signal(false);
  readonly bomForm = this.fb.group({
    mfg_item_id: ['', [Validators.required]],
    bom_number: ['', [Validators.required]],
    name: ['', [Validators.required]],
    revision: ['A', [Validators.required]],
    bom_type: ['standard' as BomType],
    base_quantity: [1, [Validators.required, Validators.min(0.001)]],
    uom: ['PZ', [Validators.required]],
    notes: [''],
    components: this.fb.array([
      this.fb.group({
        component_item_id: ['', [Validators.required]],
        quantity_per: [1, [Validators.required, Validators.min(0.001)]],
        notes: [''],
      }),
    ]),
  });

  readonly isRunMrpModalVisible = signal(false);
  readonly isSubmittingMrp = signal(false);
  readonly mrpForm = this.fb.group({
    horizon_start_date: [new Date(), [Validators.required]],
    horizon_end_date: [new Date(Date.now() + 90 * 86400000), [Validators.required]],
    run_type: ['regenerative' as MrpRunType, [Validators.required]],
  });

  readonly isCreateWorkCenterModalVisible = signal(false);
  readonly isSubmittingWorkCenter = signal(false);
  readonly workCenterForm = this.fb.group({
    work_center_code: ['', [Validators.required]],
    name: ['', [Validators.required]],
    department_code: ['PROD'],
    capacity_hours_per_day: [8, [Validators.required, Validators.min(0), Validators.max(24)]],
    hourly_cost_rate: [50, [Validators.required, Validators.min(0)]],
    description: [''],
  });

  // Explode BOM modal
  readonly isExplodeModalVisible = signal(false);
  readonly explodedBomData = signal<unknown>(null);
  readonly selectedBomName = signal<string>('');

  get bomComponentsFormArray(): FormArray {
    return this.bomForm.get('components') as FormArray;
  }

  ngOnInit(): void {
    this.loadOrders();
    this.loadBoms();
    this.loadMrpRuns();
    this.loadPlannedOrders();
    this.loadShortages();
    this.loadWorkCenters();
    this.loadRoutings();
  }

  // --- Orders Logic ---

  loadOrders(page = 1): void {
    this.loadingOrders.set(true);
    this.ordersPage.set(page);

    const params: Record<string, string | number> = {
      page,
      per_page: 15,
    };
    if (this.ordersSearch().trim()) {
      params['search'] = this.ordersSearch().trim();
    }
    if (this.ordersStatusFilter()) {
      params['status'] = this.ordersStatusFilter()!;
    }

    this.api.getProductionOrders(params).subscribe({
      next: (res) => {
        this.orders.set(res?.data || []);
        this.ordersTotal.set(res?.meta?.total ?? res?.data?.length ?? 0);
        this.loadingOrders.set(false);
      },
      error: () => {
        this.message.error('Impossibile caricare gli ordini di produzione');
        this.loadingOrders.set(false);
      },
    });
  }

  openCreateOrderModal(): void {
    this.orderForm.reset({
      mfg_item_id: '',
      target_quantity: 1,
      planned_start_date: new Date(),
      planned_end_date: new Date(Date.now() + 7 * 86400000),
      bom_id: '',
      notes: '',
    });
    this.orderBoms.set([]);
    this.orderBomsChecked.set(false);
    this.isCreateOrderModalVisible.set(true);
  }

  /** Looks up the active BOM revisions of the item, so the order is not sent against a draft or missing BOM. */
  onOrderItemChange(itemId: string): void {
    this.orderForm.patchValue({ bom_id: '' });
    this.orderBoms.set([]);
    this.orderBomsChecked.set(false);
    if (!UUID.test(itemId.trim())) {
      return;
    }
    const filters: Record<string, string | number> = { mfg_item_id: itemId.trim(), status: 'active', per_page: 50 };
    this.api.getBoms(filters).subscribe({
      next: (res) => {
        this.orderBoms.set((res?.data || []).filter((bom) => bom.status === 'active'));
        this.orderBomsChecked.set(true);
      },
      error: () => this.orderBomsChecked.set(false),
    });
  }

  submitCreateOrder(): void {
    if (this.orderForm.invalid) {
      Object.values(this.orderForm.controls).forEach((c) => {
        c.markAsDirty();
        c.updateValueAndValidity();
      });
      return;
    }

    this.isSubmittingOrder.set(true);
    const val = this.orderForm.getRawValue();
    const payload: CreateProductionOrderPayload = {
      mfg_item_id: val.mfg_item_id,
      target_quantity: Number(val.target_quantity),
      planned_start_date:
        val.planned_start_date instanceof Date
          ? val.planned_start_date.toISOString()
          : String(val.planned_start_date),
      planned_end_date:
        val.planned_end_date instanceof Date
          ? val.planned_end_date.toISOString()
          : String(val.planned_end_date),
      bom_id: val.bom_id || null,
      notes: val.notes || null,
    };

    this.api.createProductionOrder(payload).subscribe({
      next: () => {
        this.message.success('Ordine di produzione creato con successo');
        this.isSubmittingOrder.set(false);
        this.isCreateOrderModalVisible.set(false);
        this.loadOrders(1);
      },
      error: (err) => {
        // 422 carries the reason (no released BOM revision on the start date, item bought not made, ...)
        this.message.error(apiErrorText(err) || 'Errore durante la creazione dell’ordine di produzione');
        this.isSubmittingOrder.set(false);
      },
    });
  }

  releaseOrder(order: MfgProductionOrderResource): void {
    this.modal.confirm({
      nzTitle: `Rilasciare l'ordine ${order.order_number}?`,
      nzContent: 'Lo stato passerà a "Rilasciato" e i materiali potranno essere prelevati.',
      nzOkText: 'Rilascia',
      nzOnOk: () => {
        this.api.releaseProductionOrder(order.id).subscribe({
          next: () => {
            this.message.success('Ordine rilasciato con successo');
            this.loadOrders(this.ordersPage());
          },
          error: () => this.message.error('Errore durante il rilascio dell’ordine'),
        });
      },
    });
  }

  startOrder(order: MfgProductionOrderResource): void {
    this.modal.confirm({
      nzTitle: `Avviare l'ordine ${order.order_number}?`,
      nzContent: 'Lo stato passerà a "In Lavorazione".',
      nzOkText: 'Avvia',
      nzOnOk: () => {
        this.api.startProductionOrder(order.id).subscribe({
          next: () => {
            this.message.success('Ordine avviato con successo');
            this.loadOrders(this.ordersPage());
          },
          error: () => this.message.error('Errore durante l’avvio dell’ordine'),
        });
      },
    });
  }

  completeOrder(order: MfgProductionOrderResource): void {
    this.modal.confirm({
      nzTitle: `Completare tecnicamente l'ordine ${order.order_number}?`,
      nzContent: 'I prodotti finiti verranno registrati a magazzino.',
      nzOkText: 'Completa',
      nzOnOk: () => {
        this.api.completeProductionOrder(order.id).subscribe({
          next: () => {
            this.message.success('Ordine completato con successo');
            this.loadOrders(this.ordersPage());
          },
          error: () => this.message.error('Errore durante il completamento dell’ordine'),
        });
      },
    });
  }

  closeOrder(order: MfgProductionOrderResource): void {
    this.modal.confirm({
      nzTitle: `Chiudere l'ordine ${order.order_number} e saldare varianze?`,
      nzContent:
        'Verranno calcolate le varianze di costo e registrate in contabilità generale.',
      nzOkText: 'Chiudi e Salda',
      nzOnOk: () => {
        this.api.closeProductionOrder(order.id).subscribe({
          next: () => {
            this.message.success('Ordine chiuso e varianze saldate');
            this.loadOrders(this.ordersPage());
          },
          error: () => this.message.error('Errore durante la chiusura dell’ordine'),
        });
      },
    });
  }

  cancelOrder(order: MfgProductionOrderResource): void {
    this.cancelReason.set('');
    this.cancellingOrder.set(order);
  }

  confirmCancelOrder(): void {
    const order = this.cancellingOrder();
    const reason = this.cancelReason().trim();
    if (!order || !reason) {
      return;
    }
    this.isCancellingOrder.set(true);
    this.api.cancelProductionOrder(order.id, reason).subscribe({
      next: () => {
        this.isCancellingOrder.set(false);
        this.cancellingOrder.set(null);
        this.message.success('Ordine annullato');
        this.loadOrders(this.ordersPage());
      },
      error: (err) => {
        this.isCancellingOrder.set(false);
        this.message.error(apiErrorText(err) || 'Errore durante l’annullamento dell’ordine');
      },
    });
  }

  // --- BOMs Logic ---

  loadBoms(page = 1): void {
    this.loadingBoms.set(true);
    this.bomsPage.set(page);

    const params: Record<string, string | number> = {
      page,
      per_page: 15,
    };
    if (this.bomsSearch().trim()) {
      params['search'] = this.bomsSearch().trim();
    }

    this.api.getBoms(params).subscribe({
      next: (res) => {
        this.boms.set(res?.data || []);
        this.bomsTotal.set(res?.meta?.total ?? res?.data?.length ?? 0);
        this.loadingBoms.set(false);
      },
      error: () => {
        this.message.error('Impossibile caricare le distinte base');
        this.loadingBoms.set(false);
      },
    });
  }

  openCreateBomModal(): void {
    while (this.bomComponentsFormArray.length !== 0) {
      this.bomComponentsFormArray.removeAt(0);
    }
    this.addComponentRow();

    this.bomForm.reset({
      mfg_item_id: '',
      bom_number: '',
      name: '',
      revision: 'A',
      bom_type: 'standard',
      base_quantity: 1,
      uom: 'PZ',
      notes: '',
    });
    this.isCreateBomModalVisible.set(true);
  }

  addComponentRow(): void {
    this.bomComponentsFormArray.push(
      this.fb.group({
        component_item_id: ['', [Validators.required]],
        quantity_per: [1, [Validators.required, Validators.min(0.001)]],
        notes: [''],
      })
    );
  }

  removeComponentRow(index: number): void {
    if (this.bomComponentsFormArray.length > 1) {
      this.bomComponentsFormArray.removeAt(index);
    }
  }

  submitCreateBom(): void {
    if (this.bomForm.invalid) {
      this.bomForm.markAllAsTouched();
      return;
    }

    this.isSubmittingBom.set(true);
    const val = this.bomForm.getRawValue();
    const rawComps = val.components as {
      component_item_id: string;
      quantity_per: number;
      notes?: string;
    }[];

    const payload: CreateBomPayload = {
      mfg_item_id: val.mfg_item_id,
      bom_number: val.bom_number,
      name: val.name,
      revision: val.revision,
      bom_type: val.bom_type,
      base_quantity: Number(val.base_quantity),
      uom: val.uom,
      notes: val.notes || null,
      components: rawComps.map((c, idx) => ({
        component_item_id: c.component_item_id,
        quantity_per: Number(c.quantity_per),
        sequence: idx + 1,
        notes: c.notes || null,
      })),
    };

    this.api.createBom(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('MFG.BOM_CREATED_DRAFT'));
        this.isSubmittingBom.set(false);
        this.isCreateBomModalVisible.set(false);
        this.loadBoms(1);
      },
      error: () => {
        this.message.error('Errore durante la creazione della distinta base');
        this.isSubmittingBom.set(false);
      },
    });
  }

  activateBom(bom: MfgBomResource): void {
    this.modal.confirm({
      nzTitle: `Attivare la distinta base ${bom.bom_number} (Rev. ${bom.revision})?`,
      nzContent: 'Questa versione diventerà attiva e utilizzabile negli ordini.',
      nzOkText: 'Attiva',
      nzOnOk: () => {
        this.api.activateBom(bom.id).subscribe({
          next: () => {
            this.message.success('Distinta base attivata');
            this.loadBoms(this.bomsPage());
          },
          error: (err) =>
            this.message.error(
              err?.status === 403
                ? this.translate.instant('MFG.BOM_ACTIVATE_FORBIDDEN')
                : apiErrorText(err) || 'Errore durante l’attivazione della distinta base',
            ),
        });
      },
    });
  }

  reviseBom(bom: MfgBomResource): void {
    this.modal.confirm({
      nzTitle: `Creare una nuova revisione per ${bom.bom_number}?`,
      nzContent: 'Verrà creata una copia in bozza con numero di revisione successivo.',
      nzOkText: 'Nuova Revisione',
      nzOnOk: () => {
        this.api.reviseBom(bom.id).subscribe({
          next: () => {
            this.message.success('Nuova revisione creata');
            this.loadBoms(1);
          },
          error: () => this.message.error('Errore durante la revisione della distinta base'),
        });
      },
    });
  }

  explodeBom(bom: MfgBomResource): void {
    this.selectedBomName.set(`${bom.bom_number} - ${bom.name}`);
    this.api.explodeBom(bom.id).subscribe({
      next: (res) => {
        this.explodedBomData.set(res?.data || {});
        this.isExplodeModalVisible.set(true);
      },
      error: () => this.message.error('Errore durante l’esplosione della distinta base'),
    });
  }

  // --- MRP Logic ---

  loadMrpRuns(page = 1): void {
    this.loadingMrp.set(true);
    this.mrpPage.set(page);
    this.api.getMrpRuns({ page, per_page: 10 }).subscribe({
      next: (res) => {
        this.mrpRuns.set(res?.data || []);
        this.mrpTotal.set(res?.meta?.total ?? res?.data?.length ?? 0);
        this.loadingMrp.set(false);
      },
      error: () => {
        this.loadingMrp.set(false);
      },
    });
  }

  loadPlannedOrders(page = 1): void {
    this.loadingPlanned.set(true);
    this.plannedPage.set(page);
    this.api.getPlannedOrders({ page, per_page: 10 }).subscribe({
      next: (res) => {
        this.plannedOrders.set(res?.data || []);
        this.plannedTotal.set(res?.meta?.total ?? res?.data?.length ?? 0);
        this.loadingPlanned.set(false);
      },
      error: () => {
        this.loadingPlanned.set(false);
      },
    });
  }

  loadShortages(page = 1): void {
    this.loadingShortages.set(true);
    this.shortagesPage.set(page);
    this.api.getShortages({ page, per_page: 10 }).subscribe({
      next: (res) => {
        this.shortages.set(res?.data || []);
        this.shortagesTotal.set(res?.meta?.total ?? res?.data?.length ?? 0);
        this.loadingShortages.set(false);
      },
      error: () => {
        this.loadingShortages.set(false);
      },
    });
  }

  openRunMrpModal(): void {
    this.mrpForm.reset({
      horizon_start_date: new Date(),
      horizon_end_date: new Date(Date.now() + 90 * 86400000),
      run_type: 'regenerative',
    });
    this.isRunMrpModalVisible.set(true);
  }

  submitRunMrp(): void {
    if (this.mrpForm.invalid) return;

    this.isSubmittingMrp.set(true);
    const val = this.mrpForm.getRawValue();
    const payload: RunMrpPayload = {
      horizon_start_date:
        val.horizon_start_date instanceof Date
          ? val.horizon_start_date.toISOString()
          : String(val.horizon_start_date),
      horizon_end_date:
        val.horizon_end_date instanceof Date
          ? val.horizon_end_date.toISOString()
          : String(val.horizon_end_date),
      run_type: val.run_type,
    };

    this.api.runMrp(payload).subscribe({
      next: () => {
        this.message.success('Elaborazione MRP completata');
        this.isSubmittingMrp.set(false);
        this.isRunMrpModalVisible.set(false);
        this.loadMrpRuns(1);
        this.loadPlannedOrders(1);
        this.loadShortages(1);
      },
      error: () => {
        this.message.error('Errore durante l’elaborazione MRP');
        this.isSubmittingMrp.set(false);
      },
    });
  }

  convertPlannedOrder(order: MfgPlannedOrderResource): void {
    this.modal.confirm({
      nzTitle: `Convertire l'ordine pianificato ${order.planned_order_number}?`,
      nzContent: `Verrà generato un nuovo Ordine di Produzione per quantità ${order.quantity} ${order.uom}.`,
      nzOkText: 'Converti in OdP',
      nzOnOk: () => {
        this.api.convertPlannedOrder(order.id).subscribe({
          next: () => {
            this.message.success('Ordine pianificato convertito con successo');
            this.loadPlannedOrders(this.plannedPage());
            this.loadOrders(1);
          },
          error: () => this.message.error('Errore durante la conversione'),
        });
      },
    });
  }

  // --- Work Centers & Routings Logic ---

  loadWorkCenters(): void {
    this.loadingWorkCenters.set(true);
    this.api.getWorkCenters().subscribe({
      next: (res) => {
        this.workCenters.set(res?.data || []);
        this.loadingWorkCenters.set(false);
      },
      error: () => this.loadingWorkCenters.set(false),
    });
  }

  loadRoutings(): void {
    this.loadingRoutings.set(true);
    this.api.getRoutings().subscribe({
      next: (res) => {
        this.routings.set(res?.data || []);
        this.loadingRoutings.set(false);
      },
      error: () => this.loadingRoutings.set(false),
    });
  }

  openCreateWorkCenterModal(): void {
    this.workCenterForm.reset({
      work_center_code: '',
      name: '',
      department_code: 'PROD',
      capacity_hours_per_day: 8,
      hourly_cost_rate: 50,
      description: '',
    });
    this.isCreateWorkCenterModalVisible.set(true);
  }

  submitCreateWorkCenter(): void {
    if (this.workCenterForm.invalid) {
      this.workCenterForm.markAllAsTouched();
      return;
    }

    this.isSubmittingWorkCenter.set(true);
    const val = this.workCenterForm.getRawValue();
    const payload: CreateWorkCenterPayload = {
      work_center_code: val.work_center_code,
      name: val.name,
      department_code: val.department_code || null,
      capacity_hours_per_day: Number(val.capacity_hours_per_day),
      hourly_cost_rate: Number(val.hourly_cost_rate),
      description: val.description || null,
      status: 'active',
    };

    this.api.createWorkCenter(payload).subscribe({
      next: () => {
        this.message.success('Centro di lavoro creato');
        this.isSubmittingWorkCenter.set(false);
        this.isCreateWorkCenterModalVisible.set(false);
        this.loadWorkCenters();
      },
      error: () => {
        this.message.error('Errore durante la creazione del centro di lavoro');
        this.isSubmittingWorkCenter.set(false);
      },
    });
  }

  // --- Helpers ---

  getOrderStatusColor(status: string): string {
    switch (status) {
      case 'planned':
        return 'default';
      case 'released':
        return 'processing';
      case 'in_progress':
        return 'warning';
      case 'completed':
        return 'success';
      case 'closed':
        return 'purple';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  }

  getBomStatusColor(status: string): string {
    switch (status) {
      case 'draft':
        return 'default';
      case 'active':
        return 'success';
      case 'superseded':
        return 'warning';
      case 'archived':
        return 'error';
      default:
        return 'default';
    }
  }
}
