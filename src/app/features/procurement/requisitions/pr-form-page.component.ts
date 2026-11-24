import {
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChildren,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '@core/auth/auth.store';
import { applyServerErrors, serverErrorMessage } from '@core/http/laravel-http.utils';
import { I18nService } from '@core/i18n';
import { PurchaseRequisitionApiService } from '@data-access/procurement/purchase-requisition-api.service';
import {
  BudgetPreviewRequest,
  CatalogItemOption,
  computeLineSubtotal,
  computeRequisitionTotal,
  PrCurrency,
  PrLineMode,
  PurchaseRequisitionDetail,
  PurchaseRequisitionUrgency,
  SavePurchaseRequisitionLinePayload,
  SavePurchaseRequisitionPayload,
} from '@domain/procurement/purchase-requisition.models';
import { MoneyPipe, PageHeaderComponent, TranslatePipe, RadioControlDirective } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  map,
  merge,
  of,
  startWith,
  Subject,
  switchMap,
} from 'rxjs';
import { PrBudgetIndicatorCardComponent } from './pr-budget-indicator-card.component';
import { extractApiErrorMessage, toIsoDateString } from './pr-status.helpers';
import { PurchaseRequisitionStore } from './purchase-requisition.store';

export interface PrLineFormControls {
  id: FormControl<string | null>;
  mode: FormControl<PrLineMode>;
  catalog_item_id: FormControl<string | null>;
  item_code: FormControl<string>;
  description: FormControl<string>;
  quantity: FormControl<number>;
  uom: FormControl<string>;
  estimated_unit_price: FormControl<number>;
  cost_center_id: FormControl<string | null>;
  project_id: FormControl<string | null>;
  notes: FormControl<string>;
}

export type PrLineFormGroup = FormGroup<PrLineFormControls>;

/**
 * Fast Purchase Requisition creation and editing workspace with real-time Cost Center
 * budget checking, catalog autocomplete / free-text lines, and keyboard fast-entry.
 */
@Component({
  selector: 'app-pr-form-page',
  imports: [
    RadioControlDirective,
    ReactiveFormsModule,
    RouterLink,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    PrBudgetIndicatorCardComponent,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzRadioModule,
    NzSelectModule,
    NzSpinModule,
    NzTagModule,
  ],
  templateUrl: './pr-form-page.component.html',
  styleUrl: './pr-form-page.component.scss',
  host: {
    '(window:keydown.alt.n)': 'onAltNShortcut($event)',
  },
})
export class PrFormPageComponent implements OnInit {
  readonly store = inject(PurchaseRequisitionStore);
  private readonly api = inject(PurchaseRequisitionApiService);
  private readonly authStore = inject(AuthStore);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly freeTextInputs = viewChildren<ElementRef<HTMLInputElement>>('freeTextDescInput');

  readonly requisitionId = signal<string | null>(null);
  readonly loading = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly formError = signal<string | null>(null);
  readonly catalogItems = signal<CatalogItemOption[]>([]);
  readonly catalogSearching = signal<boolean>(false);
  readonly expandedOverrideRows = signal<ReadonlySet<number>>(new Set());

  private readonly catalogSearch$ = new Subject<string>();
  private readonly budgetTrigger$ = new Subject<void>();

  readonly currencies: readonly PrCurrency[] = ['CHF', 'EUR'];
  readonly urgencies: readonly { value: PurchaseRequisitionUrgency; labelKey: string }[] = [
    { value: 'low', labelKey: 'PR.URGENCY_LOW' },
    { value: 'normal', labelKey: 'PR.URGENCY_NORMAL' },
    { value: 'high', labelKey: 'PR.URGENCY_HIGH' },
    { value: 'critical', labelKey: 'PR.URGENCY_CRITICAL' },
  ];

  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    cost_center_id: ['', [Validators.required]],
    project_id: new FormControl<string | null>(null),
    urgency: this.fb.nonNullable.control<PurchaseRequisitionUrgency>('normal', [Validators.required]),
    requested_delivery_date: new FormControl<Date | null>(this.defaultDeliveryDate(), [
      Validators.required,
    ]),
    currency: this.fb.nonNullable.control<PrCurrency>(this.authStore.activeCurrency(), [
      Validators.required,
    ]),
    economic_justification: ['', [Validators.required, Validators.maxLength(2000)]],
    lines: this.fb.array<PrLineFormGroup>([this.createLineGroup()]),
  });

  private readonly formValueSignal = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue())),
    { initialValue: this.form.getRawValue() },
  );

  readonly activeCurrency = computed<PrCurrency>(
    () => (this.formValueSignal().currency as PrCurrency) || 'EUR',
  );

  readonly hasCostCenter = computed(() => Boolean(this.formValueSignal().cost_center_id));

  readonly grandTotal = computed(() => {
    void this.formValueSignal();
    const rawLines = this.linesArray.getRawValue();
    return computeRequisitionTotal(rawLines);
  });

  readonly isEditMode = computed(() => Boolean(this.requisitionId()));
  readonly isSubmitDisabled = computed(
    () => this.saving() || this.store.isBudgetHardBlocked(),
  );

  get linesArray(): FormArray<PrLineFormGroup> {
    return this.form.controls.lines;
  }

  ngOnInit(): void {
    this.store.clearBudgetPreview();
    this.store.loadLookups().subscribe();
    this.loadInitialCatalogItems();
    this.setupCatalogSearchStream();
    this.setupBudgetPreviewStream();

    const routeId = this.route.snapshot.paramMap.get('id');
    if (routeId) {
      this.requisitionId.set(routeId);
      this.loadExistingRequisition(routeId);
    }
  }

  lineSubtotal(index: number): number {
    void this.formValueSignal();
    const row = this.linesArray.at(index)?.getRawValue();
    if (!row) {
      return 0;
    }
    return computeLineSubtotal(Number(row.quantity ?? 0), Number(row.estimated_unit_price ?? 0));
  }

  lineMode(index: number): PrLineMode {
    return this.linesArray.at(index)?.controls.mode.getRawValue() ?? 'catalog';
  }

  isOverrideExpanded(index: number): boolean {
    return this.expandedOverrideRows().has(index);
  }

  hasLineOverride(index: number): boolean {
    const row = this.linesArray.at(index)?.getRawValue();
    return Boolean(row && (row.cost_center_id || row.project_id));
  }

  toggleLineOverride(index: number): void {
    this.expandedOverrideRows.update((current) => {
      const next = new Set(current);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }

  setLineMode(index: number, mode: PrLineMode): void {
    const group = this.linesArray.at(index);
    if (!group) {
      return;
    }
    group.controls.mode.setValue(mode);
    if (mode === 'free_text') {
      group.controls.catalog_item_id.setValue(null);
    }
    group.updateValueAndValidity();
  }

  onCatalogSearch(term: string): void {
    this.catalogSearch$.next(term);
  }

  onCatalogItemSelected(index: number, itemId: string | null): void {
    const group = this.linesArray.at(index);
    if (!group) {
      return;
    }
    group.controls.catalog_item_id.setValue(itemId, { emitEvent: false });
    this.applyCatalogItemToGroup(group, itemId);
  }

  private applyCatalogItemToGroup(group: PrLineFormGroup, itemId: string | null): void {
    if (!itemId) {
      return;
    }
    const item = this.catalogItems().find((c) => c.id === itemId);
    if (!item) {
      return;
    }
    group.patchValue({
      item_code: item.sku,
      description: item.name,
      uom: item.unit_measure || 'PCS',
      estimated_unit_price: item.cost_price,
    });
    group.controls.description.markAsDirty();
    this.triggerBudgetCheck();
  }

  addLine(focusNewRow = false): void {
    this.linesArray.push(this.createLineGroup());
    const newIndex = this.linesArray.length - 1;
    this.form.updateValueAndValidity();

    if (focusNewRow) {
      setTimeout(() => {
        const inputs = this.freeTextInputs();
        const lastInput = inputs[inputs.length - 1];
        if (lastInput?.nativeElement) {
          lastInput.nativeElement.focus();
        }
      }, 0);
      if (this.lineMode(newIndex) === 'catalog') {
        this.setLineMode(newIndex, 'free_text');
      }
    }
  }

  removeLine(index: number): void {
    if (this.linesArray.length <= 1) {
      this.linesArray.at(0).reset({
        id: null,
        mode: 'catalog',
        catalog_item_id: null,
        item_code: '',
        description: '',
        quantity: 1,
        uom: 'PCS',
        estimated_unit_price: 0,
        cost_center_id: null,
        project_id: null,
        notes: '',
      });
    } else {
      this.linesArray.removeAt(index);
    }
    this.form.updateValueAndValidity();
    this.triggerBudgetCheck();
  }

  onLineEnterKey(index: number, event: Event): void {
    if (index !== this.linesArray.length - 1) {
      return;
    }
    event.preventDefault();
    this.addLine(true);
  }

  onAltNShortcut(event: Event): void {
    event.preventDefault();
    this.addLine(true);
  }

  fieldError(path: string): string | null {
    return serverErrorMessage(this.form, path);
  }

  lineFieldError(index: number, fieldName: keyof PrLineFormControls): string | null {
    const group = this.linesArray.at(index);
    if (!group) {
      return null;
    }
    const control = group.controls[fieldName];
    const serverErr = control.errors?.['serverError'];
    if (typeof serverErr === 'string') {
      return serverErr;
    }
    if (control.invalid && (control.dirty || control.touched)) {
      return this.i18n.translate('PR.FORM.REQUIRED_FIELD');
    }
    return null;
  }

  async saveDraft(): Promise<void> {
    await this.persist(false);
  }

  async submitForApproval(): Promise<void> {
    if (this.store.isBudgetHardBlocked()) {
      return;
    }
    await this.persist(true);
  }

  private async persist(shouldSubmit: boolean): Promise<void> {
    this.markAllControlsDirty(this.form);
    if (this.form.invalid) {
      this.formError.set(this.i18n.translate('PR.FORM.VALIDATION_SUMMARY'));
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const payload = this.buildPayload();
    const existingId = this.requisitionId();

    try {
      const saveRes = existingId
        ? await firstValueFrom(this.api.update(existingId, payload))
        : await firstValueFrom(this.api.create(payload));

      let saved = saveRes.data;
      this.requisitionId.set(saved.id);

      if (shouldSubmit) {
        const submitRes = await firstValueFrom(this.api.submit(saved.id));
        saved = submitRes.data;
        this.store.loadPendingApprovalCount().subscribe();
        this.message.success(this.i18n.translate('PR.SUBMIT_SUCCESS'));
      } else {
        this.message.success(this.i18n.translate('PR.FORM.DRAFT_SAVED'));
      }

      this.store.setSelectedRequisition(saved);
      void this.router.navigate(['/procurement/requisitions', saved.id]);
    } catch (err: unknown) {
      const unmapped = applyServerErrors(this.form, err);
      const fallback = extractApiErrorMessage(err) || this.i18n.translate('PR.ACTION_ERROR');
      this.formError.set(unmapped[0] || fallback);
    } finally {
      this.saving.set(false);
    }
  }

  private buildPayload(): SavePurchaseRequisitionPayload {
    const raw = this.form.getRawValue();
    const lines: SavePurchaseRequisitionLinePayload[] = raw.lines.map((line) => ({
      ...(line.id ? { id: line.id } : {}),
      item_type: line.mode === 'catalog' ? 'catalog_item' : 'free_text',
      catalog_item_id: line.mode === 'catalog' ? line.catalog_item_id : null,
      item_code: line.item_code.trim() || null,
      description: line.description.trim(),
      quantity: Number(line.quantity),
      unit_of_measure: line.uom.trim() || 'PCS',
      estimated_unit_price: Number(line.estimated_unit_price),
      cost_center_id: line.cost_center_id || null,
      project_id: line.project_id || null,
      notes: line.notes.trim() || null,
    }));

    return {
      title: raw.title.trim(),
      cost_center_id: raw.cost_center_id,
      project_id: raw.project_id || null,
      urgency: raw.urgency,
      requested_delivery_date: toIsoDateString(raw.requested_delivery_date) ?? '',
      currency: raw.currency,
      economic_justification: raw.economic_justification.trim(),
      lines,
    };
  }

  private loadExistingRequisition(id: string): void {
    this.loading.set(true);
    this.api.getById(id).subscribe({
      next: (res) => {
        this.patchFormFromDetail(res.data);
        this.loading.set(false);
        this.triggerBudgetCheck();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.formError.set(extractApiErrorMessage(err) || this.i18n.translate('PR.LOAD_ERROR'));
      },
    });
  }

  private patchFormFromDetail(detail: PurchaseRequisitionDetail): void {
    const parsedDate = detail.requested_delivery_date
      ? new Date(`${detail.requested_delivery_date.slice(0, 10)}T00:00:00`)
      : this.defaultDeliveryDate();

    this.form.patchValue(
      {
        title: detail.title,
        cost_center_id: detail.cost_center_id ?? '',
        project_id: detail.project_id ?? null,
        urgency: detail.urgency,
        requested_delivery_date: Number.isNaN(parsedDate.getTime())
          ? this.defaultDeliveryDate()
          : parsedDate,
        currency: detail.currency,
        economic_justification: detail.economic_justification ?? '',
      },
      { emitEvent: false },
    );

    this.linesArray.clear({ emitEvent: false });
    const expanded = new Set<number>();
    const existingCatalogExtras: CatalogItemOption[] = [];

    const sourceLines = detail.lines ?? [];
    if (sourceLines.length === 0) {
      this.linesArray.push(this.createLineGroup(), { emitEvent: false });
    } else {
      sourceLines.forEach((line, idx) => {
        const mode: PrLineMode = line.catalog_item_id ? 'catalog' : 'free_text';
        if (line.catalog_item_id) {
          existingCatalogExtras.push({
            id: line.catalog_item_id,
            sku: line.item_code ?? '',
            name: line.description,
            unit_measure: line.uom,
            cost_price: line.estimated_unit_price,
            label: line.item_code ? `${line.item_code} — ${line.description}` : line.description,
          });
        }
        if (line.cost_center_id || line.project_id) {
          expanded.add(idx);
        }
        this.linesArray.push(
          this.createLineGroup({
            id: line.id,
            mode,
            catalog_item_id: line.catalog_item_id ?? null,
            item_code: line.item_code ?? '',
            description: line.description,
            quantity: Number(line.quantity),
            uom: line.uom || 'PCS',
            estimated_unit_price: Number(line.estimated_unit_price),
            cost_center_id: line.cost_center_id ?? null,
            project_id: line.project_id ?? null,
            notes: line.notes ?? '',
          }),
          { emitEvent: false },
        );
      });
    }

    if (existingCatalogExtras.length > 0) {
      this.mergeCatalogItems(existingCatalogExtras);
    }
    this.expandedOverrideRows.set(expanded);

    if (detail.budget_check_snapshot) {
      this.store.setBudgetPreviewSnapshot(detail.budget_check_snapshot);
    }
    this.form.updateValueAndValidity();
  }

  private setupBudgetPreviewStream(): void {
    merge(this.form.valueChanges, this.budgetTrigger$)
      .pipe(
        map(() => this.buildBudgetPreviewPayload()),
        debounceTime(350),
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
        switchMap((payload) => {
          if (!payload) {
            this.store.clearBudgetPreview();
            return of(null);
          }
          return this.store.loadBudgetPreview(payload);
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe();
  }

  private buildBudgetPreviewPayload(): BudgetPreviewRequest | null {
    const raw = this.form.getRawValue();
    const linesPayload = raw.lines
      .filter((line) => Number(line.quantity ?? 0) > 0)
      .map((line) => ({
        quantity: Number(line.quantity),
        estimated_unit_price: Math.max(0, Number(line.estimated_unit_price ?? 0)),
        cost_center_id: line.cost_center_id || raw.cost_center_id || null,
      }));

    if (!raw.cost_center_id && linesPayload.every((line) => !line.cost_center_id)) {
      return null;
    }

    if (linesPayload.length === 0) {
      return null;
    }

    return {
      cost_center_id: raw.cost_center_id || null,
      currency: raw.currency,
      exclude_requisition_id: this.requisitionId(),
      lines: linesPayload,
    };
  }

  private triggerBudgetCheck(): void {
    this.budgetTrigger$.next();
  }

  private loadInitialCatalogItems(): void {
    this.catalogSearching.set(true);
    this.api
      .listCatalogItems()
      .pipe(
        catchError(() => of([] as CatalogItemOption[])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        this.mergeCatalogItems(items);
        this.catalogSearching.set(false);
      });
  }

  private setupCatalogSearchStream(): void {
    this.catalogSearch$
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((term) => {
          this.catalogSearching.set(true);
          return this.api.listCatalogItems(term).pipe(catchError(() => of([] as CatalogItemOption[])));
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((items) => {
        this.mergeCatalogItems(items);
        this.catalogSearching.set(false);
      });
  }

  private mergeCatalogItems(incoming: readonly CatalogItemOption[]): void {
    this.catalogItems.update((existing) => {
      const merged = new Map<string, CatalogItemOption>();
      for (const item of existing) {
        merged.set(item.id, item);
      }
      for (const item of incoming) {
        merged.set(item.id, item);
      }
      return Array.from(merged.values());
    });
  }

  private createLineGroup(initial?: Partial<{
    id: string | null;
    mode: PrLineMode;
    catalog_item_id: string | null;
    item_code: string;
    description: string;
    quantity: number;
    uom: string;
    estimated_unit_price: number;
    cost_center_id: string | null;
    project_id: string | null;
    notes: string;
  }>): PrLineFormGroup {
    const group = this.fb.group<PrLineFormControls>({
      id: new FormControl<string | null>(initial?.id ?? null),
      mode: this.fb.nonNullable.control<PrLineMode>(initial?.mode ?? 'catalog'),
      catalog_item_id: new FormControl<string | null>(initial?.catalog_item_id ?? null),
      item_code: this.fb.nonNullable.control<string>(initial?.item_code ?? ''),
      description: this.fb.nonNullable.control<string>(initial?.description ?? '', [
        Validators.required,
        Validators.maxLength(500),
      ]),
      quantity: this.fb.nonNullable.control<number>(initial?.quantity ?? 1, [
        Validators.required,
        Validators.min(0.0001),
      ]),
      uom: this.fb.nonNullable.control<string>(initial?.uom ?? 'PCS', [
        Validators.required,
        Validators.maxLength(20),
      ]),
      estimated_unit_price: this.fb.nonNullable.control<number>(initial?.estimated_unit_price ?? 0, [
        Validators.required,
        Validators.min(0),
      ]),
      cost_center_id: new FormControl<string | null>(initial?.cost_center_id ?? null),
      project_id: new FormControl<string | null>(initial?.project_id ?? null),
      notes: this.fb.nonNullable.control<string>(initial?.notes ?? ''),
    });

    group.controls.mode.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((mode) => {
      if (mode === 'free_text' && group.controls.catalog_item_id.value !== null) {
        group.controls.catalog_item_id.setValue(null, { emitEvent: false });
      }
    });

    group.controls.catalog_item_id.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((itemId) => {
        this.applyCatalogItemToGroup(group, itemId);
      });

    return group;
  }

  private markAllControlsDirty(control: AbstractControl): void {
    control.markAsDirty();
    control.markAsTouched();
    if (control instanceof FormGroup || control instanceof FormArray) {
      for (const child of Object.values(control.controls)) {
        this.markAllControlsDirty(child);
      }
    }
  }

  private defaultDeliveryDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 7);
    date.setHours(0, 0, 0, 0);
    return date;
  }
}
