import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n';
import { PurchaseRequisitionApiService } from '@data-access/procurement/purchase-requisition-api.service';
import {
  computeLineSubtotal,
  computeRemainingQuantity,
  ConversionQuantityValidationResult,
  ConvertiblePrLineRow,
  ConvertRequisitionLinesPayload,
  PurchaseRequisitionSummary,
  PurchaseRequisitionUrgency,
  roundCurrency,
  validateConversionQuantity,
} from '@domain/procurement/purchase-requisition.models';
import { DateFormatPipe, MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import {
  extractApiErrorMessage,
  prStatusLabelKey,
  prStatusTagColor,
  prUrgencyLabelKey,
  prUrgencyTagColor,
} from './pr-status.helpers';
import { PurchaseRequisitionStore } from './purchase-requisition.store';

/**
 * Buyer Conversion Workbench for grouping approved / partially-converted PR lines
 * across multiple requisitions, splitting partial quantities, and converting them into
 * an RDO (Mod 045) or a Purchase Order (Mod 046).
 */
@Component({
  selector: 'app-pr-convert-workbench',
  imports: [
    FormsModule,
    RouterLink,
    DateFormatPipe,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzRadioModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  templateUrl: './pr-convert-workbench.component.html',
  styleUrl: './pr-convert-workbench.component.scss',
})
export class PrConvertWorkbenchComponent implements OnInit {
  readonly store = inject(PurchaseRequisitionStore);
  private readonly api = inject(PurchaseRequisitionApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);

  readonly loading = signal<boolean>(false);
  readonly converting = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  readonly allLines = signal<ConvertiblePrLineRow[]>([]);
  readonly selectedQuantities = signal<Record<string, number>>({});

  readonly searchFilter = signal<string>('');
  readonly costCenterFilter = signal<string | null>(null);
  readonly projectFilter = signal<string | null>(null);
  readonly urgencyFilter = signal<PurchaseRequisitionUrgency | null>(null);
  readonly requisitionIdFilter = signal<string | null>(null);

  readonly targetType = signal<'rfq' | 'po'>('rfq');
  readonly selectedSupplierId = signal<string | null>(null);

  readonly urgencies: readonly { value: PurchaseRequisitionUrgency; labelKey: string }[] = [
    { value: 'low', labelKey: 'PR.URGENCY_LOW' },
    { value: 'normal', labelKey: 'PR.URGENCY_NORMAL' },
    { value: 'high', labelKey: 'PR.URGENCY_HIGH' },
    { value: 'critical', labelKey: 'PR.URGENCY_CRITICAL' },
  ];

  readonly filteredLines = computed(() => {
    const query = this.searchFilter().trim().toLowerCase();
    const ccId = this.costCenterFilter();
    const projId = this.projectFilter();
    const urgency = this.urgencyFilter();
    const reqId = this.requisitionIdFilter();

    return this.allLines().filter((row) => {
      if (reqId && row.requisition_id !== reqId) {
        return false;
      }
      if (ccId && row.cost_center_id !== ccId) {
        return false;
      }
      if (projId && row.project_id !== projId) {
        return false;
      }
      if (urgency && row.urgency !== urgency) {
        return false;
      }
      if (query) {
        const matches =
          row.requisition_number.toLowerCase().includes(query) ||
          row.description.toLowerCase().includes(query) ||
          (row.item_code ?? '').toLowerCase().includes(query) ||
          row.requester_name.toLowerCase().includes(query);
        if (!matches) {
          return false;
        }
      }
      return true;
    });
  });

  readonly selectedLineRows = computed(() => {
    const selected = this.selectedQuantities();
    return this.allLines().filter((row) => Object.hasOwn(selected, row.line_id));
  });

  readonly selectedCount = computed(() => this.selectedLineRows().length);

  readonly distinctRequisitionCount = computed(
    () => new Set(this.selectedLineRows().map((row) => row.requisition_id)).size,
  );

  readonly estimatedSelectionTotal = computed(() => {
    const selected = this.selectedQuantities();
    const sum = this.selectedLineRows().reduce((acc, row) => {
      const qty = selected[row.line_id] ?? 0;
      return acc + computeLineSubtotal(Math.max(0, qty), row.estimated_unit_price);
    }, 0);
    return roundCurrency(sum);
  });

  readonly displayCurrency = computed(() => this.selectedLineRows()[0]?.currency ?? 'EUR');

  readonly allFilteredSelected = computed(() => {
    const visible = this.filteredLines();
    if (visible.length === 0) {
      return false;
    }
    const selected = this.selectedQuantities();
    return visible.every((row) => Object.hasOwn(selected, row.line_id));
  });

  readonly someFilteredSelected = computed(() => {
    const visible = this.filteredLines();
    if (visible.length === 0) {
      return false;
    }
    const selected = this.selectedQuantities();
    const count = visible.filter((row) => Object.hasOwn(selected, row.line_id)).length;
    return count > 0 && count < visible.length;
  });

  readonly hasInvalidSelectedQuantity = computed(() => {
    const selected = this.selectedQuantities();
    return this.selectedLineRows().some(
      (row) => validateConversionQuantity(selected[row.line_id], row.remaining_quantity) !== 'valid',
    );
  });

  readonly canConvert = computed(() => {
    if (this.converting() || this.selectedCount() === 0 || this.hasInvalidSelectedQuantity()) {
      return false;
    }
    if (this.targetType() === 'po' && !this.selectedSupplierId()) {
      return false;
    }
    return true;
  });

  readonly statusLabel = prStatusLabelKey;
  readonly statusColor = prStatusTagColor;
  readonly urgencyLabel = prUrgencyLabelKey;
  readonly urgencyColor = prUrgencyTagColor;

  ngOnInit(): void {
    const reqParam = this.route.snapshot.queryParamMap.get('requisitionId');
    if (reqParam) {
      this.requisitionIdFilter.set(reqParam);
    }

    this.store.loadLookups().subscribe();
    this.loadConvertibleLines();
  }

  loadConvertibleLines(): void {
    this.loading.set(true);
    this.error.set(null);

    forkJoin({
      approved: this.api.list({ status: 'approved', per_page: 100 }),
      partial: this.api.list({ status: 'partially_converted', per_page: 100 }),
    })
      .pipe(
        map(({ approved, partial }) => {
          const deduped = new Map<string, PurchaseRequisitionSummary>();
          for (const req of [...(approved.data ?? []), ...(partial.data ?? [])]) {
            deduped.set(req.id, req);
          }
          return Array.from(deduped.values());
        }),
        switchMap((summaries) => {
          if (summaries.length === 0) {
            return of([] as PurchaseRequisitionSummary[]);
          }
          const needsDetail = summaries.filter((req) => req.lines === undefined);
          if (needsDetail.length === 0) {
            return of(summaries);
          }
          return forkJoin(
            summaries.map((req) =>
              req.lines !== undefined
                ? of(req)
                : this.api.getById(req.id).pipe(
                    map((res) => res.data as PurchaseRequisitionSummary),
                    catchError(() => of(req)),
                  ),
            ),
          );
        }),
      )
      .subscribe({
        next: (requisitions) => {
          const rows: ConvertiblePrLineRow[] = [];
          for (const req of requisitions) {
            for (const line of req.lines ?? []) {
              const remaining = computeRemainingQuantity(line);
              if (remaining <= 0) {
                continue;
              }
              rows.push({
                requisition_id: req.id,
                requisition_number: req.requisition_number,
                requisition_title: req.title,
                requisition_status: req.status,
                urgency: req.urgency,
                currency: req.currency,
                requested_delivery_date: req.requested_delivery_date,
                requester_name: req.requester_name,
                cost_center_id: line.cost_center_id ?? req.cost_center_id,
                cost_center_name: line.cost_center_name ?? req.cost_center_name ?? req.cost_center_code ?? null,
                project_id: line.project_id ?? req.project_id ?? null,
                project_name: line.project_name ?? req.project_name ?? req.project_code ?? null,
                line_id: line.id,
                line_number: line.line_number,
                catalog_item_id: line.catalog_item_id ?? null,
                item_code: line.item_code ?? null,
                description: line.description,
                uom: line.uom,
                estimated_unit_price: Number(line.estimated_unit_price ?? 0),
                quantity: Number(line.quantity ?? 0),
                converted_quantity: Number(line.converted_quantity ?? 0),
                remaining_quantity: remaining,
              });
            }
          }
          this.allLines.set(rows);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(extractApiErrorMessage(err) || this.i18n.translate('PR.LOAD_ERROR'));
          this.loading.set(false);
        },
      });
  }

  clearRequisitionFilter(): void {
    this.requisitionIdFilter.set(null);
  }

  isLineSelected(lineId: string): boolean {
    return Object.hasOwn(this.selectedQuantities(), lineId);
  }

  selectedQuantity(row: ConvertiblePrLineRow): number {
    return this.selectedQuantities()[row.line_id] ?? row.remaining_quantity;
  }

  quantityValidationState(row: ConvertiblePrLineRow): ConversionQuantityValidationResult {
    if (!this.isLineSelected(row.line_id)) {
      return 'valid';
    }
    return validateConversionQuantity(this.selectedQuantities()[row.line_id], row.remaining_quantity);
  }

  isPartialSplit(row: ConvertiblePrLineRow): boolean {
    if (!this.isLineSelected(row.line_id)) {
      return false;
    }
    const qty = this.selectedQuantities()[row.line_id];
    return (
      validateConversionQuantity(qty, row.remaining_quantity) === 'valid' &&
      qty < row.remaining_quantity - 1e-6
    );
  }

  toggleLineSelection(row: ConvertiblePrLineRow, checked: boolean): void {
    this.selectedQuantities.update((current) => {
      const next = { ...current };
      if (checked) {
        next[row.line_id] = next[row.line_id] ?? row.remaining_quantity;
      } else {
        delete next[row.line_id];
      }
      return next;
    });
  }

  toggleAllFiltered(checked: boolean): void {
    const visible = this.filteredLines();
    this.selectedQuantities.update((current) => {
      const next = { ...current };
      for (const row of visible) {
        if (checked) {
          next[row.line_id] = next[row.line_id] ?? row.remaining_quantity;
        } else {
          delete next[row.line_id];
        }
      }
      return next;
    });
  }

  updateSplitQuantity(row: ConvertiblePrLineRow, quantity: number | null): void {
    const parsed = quantity === null || quantity === undefined ? 0 : Number(quantity);
    this.selectedQuantities.update((current) => ({
      ...current,
      [row.line_id]: parsed,
    }));
  }

  convertSelected(): void {
    if (!this.canConvert()) {
      return;
    }

    const selected = this.selectedQuantities();
    const target = this.targetType();
    const supplierId = this.selectedSupplierId();

    const payload: ConvertRequisitionLinesPayload = {
      target_type: target,
      ...(target === 'po' && supplierId ? { supplier_id: supplierId } : {}),
      items: this.selectedLineRows().map((row) => ({
        requisition_line_id: row.line_id,
        quantity: selected[row.line_id],
      })),
    };

    this.converting.set(true);
    this.error.set(null);

    this.api.convert(payload).subscribe({
      next: (res) => {
        this.converting.set(false);
        const targetId =
          res.data.target_document_id ||
          res.data.rfq_id ||
          res.data.purchase_order_id ||
          res.data.target_id;
        if (target === 'rfq') {
          this.message.success(this.i18n.translate('PR.CONVERT.SUCCESS_RFQ'));
          if (targetId) {
            void this.router.navigate(['/procurement/rfqs', targetId, 'edit']);
          } else {
            void this.router.navigate(['/procurement/rfqs']);
          }
        } else {
          this.message.success(this.i18n.translate('PR.CONVERT.SUCCESS_PO'));
          void this.router.navigate(['/procurement/orders'], {
            queryParams: targetId ? { poId: targetId } : undefined,
          });
        }
      },
      error: (err: unknown) => {
        this.converting.set(false);
        const msg = extractApiErrorMessage(err) || this.i18n.translate('PR.ACTION_ERROR');
        this.error.set(msg);
        this.message.error(msg);
      },
    });
  }
}
