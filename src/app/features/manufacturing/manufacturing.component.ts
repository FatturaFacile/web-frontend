import { DatePipe, JsonPipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
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
import { toDayKey, toTimestamp } from '@shared/utils/date-validators';
import { formErrorTip } from '../inventory/form-error-tip';
import { apiErrorText, hasAnyRole } from '../sales/cycle/shared/sales-api-helpers';

/** Roles that may activate a BOM revision (the API answers 403 to anyone else). */
const BOM_MANAGER_ROLES: readonly string[] = ['owner', 'admin', 'production'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The control may not be earlier than the sibling control `startKey` (`after_or_equal` in the API). */
function notBefore(startKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const start = control.parent?.get(startKey)?.value;
    if (!start || !control.value) {
      return null;
    }
    return new Date(control.value).getTime() < new Date(start).getTime() ? { dateOrder: true } : null;
  };
}

/** Mirrors `before_or_equal:<start + 2 years>` of RunMrpRequest: the horizon cannot extend past two years from its start. */
function withinTwoYearsOf(startKey: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const startRaw = control.parent?.get(startKey)?.value;
    const endDay = toDayKey(control.value);
    const startTime = toTimestamp(startRaw);
    if (!endDay || startTime === null) {
      return null;
    }
    const limit = new Date(startTime);
    limit.setFullYear(limit.getFullYear() + 2);
    const limitDay = toDayKey(limit);
    return limitDay !== null && endDay > limitDay ? { exceedsMax: true } : null;
  };
}

@Component({
  selector: 'app-manufacturing',
  styleUrl: './manufacturing.component.scss',
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
    mfg_item_id: ['', [Validators.required, Validators.pattern(UUID)]],
    target_quantity: [1, [Validators.required, Validators.min(0.001)]],
    planned_start_date: [new Date(), [Validators.required]],
    planned_end_date: [new Date(Date.now() + 7 * 86400000), [Validators.required, notBefore('planned_start_date')]],
    bom_id: [''],
    notes: ['', [Validators.maxLength(5000)]],
  });

  /** The end date must be re-checked when the start date changes. */
  private readonly recheckOrderEnd = this.orderForm.controls.planned_start_date.valueChanges.subscribe(() =>
    this.orderForm.controls.planned_end_date.updateValueAndValidity(),
  );

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
    mfg_item_id: ['', [Validators.required, Validators.pattern(UUID)]],
    bom_number: ['', [Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    revision: ['A', [Validators.maxLength(20)]],
    bom_type: ['standard' as BomType],
    base_quantity: [1, [Validators.min(0.001)]],
    uom: ['PZ', [Validators.maxLength(20)]],
    notes: ['', [Validators.maxLength(5000)]],
    components: this.fb.array([
      this.fb.group({
        component_item_id: ['', [Validators.required, Validators.pattern(UUID)]],
        quantity_per: [1, [Validators.required, Validators.min(0.001)]],
        notes: ['', [Validators.maxLength(1000)]],
      }),
    ]),
  });

  readonly isRunMrpModalVisible = signal(false);
  readonly isSubmittingMrp = signal(false);
  readonly mrpForm = this.fb.group({
    horizon_start_date: [new Date(), [Validators.required]],
    horizon_end_date: [new Date(Date.now() + 90 * 86400000), [Validators.required, notBefore('horizon_start_date'), withinTwoYearsOf('horizon_start_date')]],
    run_type: ['regenerative' as MrpRunType],
  });

  /** The end of the horizon must be re-checked when its start changes. */
  private readonly recheckMrpEnd = this.mrpForm.controls.horizon_start_date.valueChanges.subscribe(() =>
    this.mrpForm.controls.horizon_end_date.updateValueAndValidity(),
  );

  readonly isCreateWorkCenterModalVisible = signal(false);
  readonly isSubmittingWorkCenter = signal(false);
  readonly workCenterForm = this.fb.group({
    work_center_code: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    department_code: ['PROD', [Validators.maxLength(50)]],
    capacity_hours_per_day: [8 as number | null, [Validators.min(0), Validators.max(24)]],
    hourly_cost_rate: [50 as number | null, [Validators.min(0)]],
    description: ['', [Validators.maxLength(5000)]],
  });

  // Explode BOM modal
  readonly isExplodeModalVisible = signal(false);
  readonly explodedBomData = signal<unknown>(null);
  readonly selectedBomName = signal<string>('');

  get bomComponentsFormArray(): FormArray {
    return this.bomForm.get('components') as FormArray;
  }

  errorTip(form: FormGroup, path: string): string {
    return formErrorTip(form, path, this.translate);
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
        this.message.error(this.translate.instant('MFG.MSG_IMPOSSIBILE_CARICARE_GLI_ORDINI_DI_PRODUZIONE'));
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
      this.orderForm.markAllAsTouched();
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
        this.message.success(this.translate.instant('MFG.MSG_ORDINE_DI_PRODUZIONE_CREATO_CON_SUCCESSO'));
        this.isSubmittingOrder.set(false);
        this.isCreateOrderModalVisible.set(false);
        this.loadOrders(1);
      },
      error: (err) => {
        // 422 carries the reason (no released BOM revision on the start date, item bought not made, ...)
        this.message.error(apiErrorText(err) || this.translate.instant('MFG.MSG_ERRORE_DURANTE_LA_CREAZIONE_DELL_ORDINE'));
        this.isSubmittingOrder.set(false);
      },
    });
  }

  releaseOrder(order: MfgProductionOrderResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('MFG.DLG_RILASCIARE_L_ORDINE', { order_number: order.order_number }),
      nzContent: this.translate.instant('MFG.DLG_LO_STATO_PASSERA_A_RILASCIATO_E'),
      nzOkText: this.translate.instant('MFG.DLG_RILASCIA'),
      nzOnOk: () => {
        this.api.releaseProductionOrder(order.id).subscribe({
          next: () => {
            this.message.success(this.translate.instant('MFG.MSG_ORDINE_RILASCIATO_CON_SUCCESSO'));
            this.loadOrders(this.ordersPage());
          },
          error: () => this.message.error(this.translate.instant('MFG.MSG_ERRORE_DURANTE_IL_RILASCIO_DELL_ORDINE')),
        });
      },
    });
  }

  startOrder(order: MfgProductionOrderResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('MFG.DLG_AVVIARE_L_ORDINE', { order_number: order.order_number }),
      nzContent: this.translate.instant('MFG.DLG_LO_STATO_PASSERA_A_IN_LAVORAZIONE'),
      nzOkText: this.translate.instant('MFG.DLG_AVVIA'),
      nzOnOk: () => {
        this.api.startProductionOrder(order.id).subscribe({
          next: () => {
            this.message.success(this.translate.instant('MFG.MSG_ORDINE_AVVIATO_CON_SUCCESSO'));
            this.loadOrders(this.ordersPage());
          },
          error: () => this.message.error(this.translate.instant('MFG.MSG_ERRORE_DURANTE_L_AVVIO_DELL_ORDINE')),
        });
      },
    });
  }

  completeOrder(order: MfgProductionOrderResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('MFG.DLG_COMPLETARE_TECNICAMENTE_L_ORDINE', { order_number: order.order_number }),
      nzContent: this.translate.instant('MFG.DLG_I_PRODOTTI_FINITI_VERRANNO_REGISTRATI_A'),
      nzOkText: this.translate.instant('MFG.DLG_COMPLETA'),
      nzOnOk: () => {
        this.api.completeProductionOrder(order.id).subscribe({
          next: () => {
            this.message.success(this.translate.instant('MFG.MSG_ORDINE_COMPLETATO_CON_SUCCESSO'));
            this.loadOrders(this.ordersPage());
          },
          error: () => this.message.error(this.translate.instant('MFG.MSG_ERRORE_DURANTE_IL_COMPLETAMENTO_DELL_ORDINE')),
        });
      },
    });
  }

  closeOrder(order: MfgProductionOrderResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('MFG.DLG_CHIUDERE_L_ORDINE_E_SALDARE_VARIANZE', { order_number: order.order_number }),
      nzContent:
        this.translate.instant('MFG.DLG_VERRANNO_CALCOLATE_LE_VARIANZE_DI_COSTO'),
      nzOkText: this.translate.instant('MFG.DLG_CHIUDI_E_SALDA'),
      nzOnOk: () => {
        this.api.closeProductionOrder(order.id).subscribe({
          next: () => {
            this.message.success(this.translate.instant('MFG.MSG_ORDINE_CHIUSO_E_VARIANZE_SALDATE'));
            this.loadOrders(this.ordersPage());
          },
          error: () => this.message.error(this.translate.instant('MFG.MSG_ERRORE_DURANTE_LA_CHIUSURA_DELL_ORDINE')),
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
        this.message.success(this.translate.instant('MFG.MSG_ORDINE_ANNULLATO'));
        this.loadOrders(this.ordersPage());
      },
      error: (err) => {
        this.isCancellingOrder.set(false);
        this.message.error(apiErrorText(err) || this.translate.instant('MFG.MSG_ERRORE_DURANTE_L_ANNULLAMENTO_DELL_ORDINE'));
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
        this.message.error(this.translate.instant('MFG.MSG_IMPOSSIBILE_CARICARE_LE_DISTINTE_BASE'));
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
        component_item_id: ['', [Validators.required, Validators.pattern(UUID)]],
        quantity_per: [1, [Validators.required, Validators.min(0.001)]],
        notes: ['', [Validators.maxLength(1000)]],
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
      bom_number: val.bom_number || null,
      name: val.name,
      revision: val.revision || null,
      bom_type: val.bom_type,
      base_quantity: val.base_quantity === null ? null : Number(val.base_quantity),
      uom: val.uom || null,
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
        this.message.error(this.translate.instant('MFG.MSG_ERRORE_DURANTE_LA_CREAZIONE_DELLA_DISTINTA'));
        this.isSubmittingBom.set(false);
      },
    });
  }

  activateBom(bom: MfgBomResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('MFG.DLG_ATTIVARE_LA_DISTINTA_BASE_REV', { bom_number: bom.bom_number, revision: bom.revision }),
      nzContent: this.translate.instant('MFG.DLG_QUESTA_VERSIONE_DIVENTERA_ATTIVA_E_UTILIZZABILE'),
      nzOkText: this.translate.instant('MFG.DLG_ATTIVA'),
      nzOnOk: () => {
        this.api.activateBom(bom.id).subscribe({
          next: () => {
            this.message.success(this.translate.instant('MFG.MSG_DISTINTA_BASE_ATTIVATA'));
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
      nzTitle: this.translate.instant('MFG.DLG_CREARE_UNA_NUOVA_REVISIONE_PER', { bom_number: bom.bom_number }),
      nzContent: this.translate.instant('MFG.DLG_VERRA_CREATA_UNA_COPIA_IN_BOZZA'),
      nzOkText: this.translate.instant('MFG.DLG_NUOVA_REVISIONE'),
      nzOnOk: () => {
        this.api.reviseBom(bom.id).subscribe({
          next: () => {
            this.message.success(this.translate.instant('MFG.MSG_NUOVA_REVISIONE_CREATA'));
            this.loadBoms(1);
          },
          error: () => this.message.error(this.translate.instant('MFG.MSG_ERRORE_DURANTE_LA_REVISIONE_DELLA_DISTINTA')),
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
      error: () => this.message.error(this.translate.instant('MFG.MSG_ERRORE_DURANTE_L_ESPLOSIONE_DELLA_DISTINTA')),
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
    if (this.mrpForm.invalid) {
      this.mrpForm.markAllAsTouched();
      return;
    }

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
        this.message.success(this.translate.instant('MFG.MSG_ELABORAZIONE_MRP_COMPLETATA'));
        this.isSubmittingMrp.set(false);
        this.isRunMrpModalVisible.set(false);
        this.loadMrpRuns(1);
        this.loadPlannedOrders(1);
        this.loadShortages(1);
      },
      error: () => {
        this.message.error(this.translate.instant('MFG.MSG_ERRORE_DURANTE_L_ELABORAZIONE_MRP'));
        this.isSubmittingMrp.set(false);
      },
    });
  }

  convertPlannedOrder(order: MfgPlannedOrderResource): void {
    this.modal.confirm({
      nzTitle: this.translate.instant('MFG.DLG_CONVERTIRE_L_ORDINE_PIANIFICATO', { planned_order_number: order.planned_order_number }),
      nzContent: this.translate.instant('MFG.DLG_VERRA_GENERATO_UN_NUOVO_ORDINE_DI', { quantity: order.quantity, uom: order.uom }),
      nzOkText: this.translate.instant('MFG.DLG_CONVERTI_IN_ODP'),
      nzOnOk: () => {
        this.api.convertPlannedOrder(order.id).subscribe({
          next: () => {
            this.message.success(this.translate.instant('MFG.MSG_ORDINE_PIANIFICATO_CONVERTITO_CON_SUCCESSO'));
            this.loadPlannedOrders(this.plannedPage());
            this.loadOrders(1);
          },
          error: () => this.message.error(this.translate.instant('MFG.MSG_ERRORE_DURANTE_LA_CONVERSIONE')),
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
      capacity_hours_per_day: val.capacity_hours_per_day === null ? undefined : Number(val.capacity_hours_per_day),
      hourly_cost_rate: val.hourly_cost_rate === null ? undefined : Number(val.hourly_cost_rate),
      description: val.description || null,
      status: 'active',
    };

    this.api.createWorkCenter(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('MFG.MSG_CENTRO_DI_LAVORO_CREATO'));
        this.isSubmittingWorkCenter.set(false);
        this.isCreateWorkCenterModalVisible.set(false);
        this.loadWorkCenters();
      },
      error: () => {
        this.message.error(this.translate.instant('MFG.MSG_ERRORE_DURANTE_LA_CREAZIONE_DEL_CENTRO'));
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
