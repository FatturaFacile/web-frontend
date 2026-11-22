import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { map, Observable } from 'rxjs';
import { CountApproval, CountEvent, CountVariance, I18nService, InventoryCountApiService, VarianceLine } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { httpStatus, inventoryErrorKey, validationMessages } from '../shared/inventory-valuation.utils';
import {
  APPROVAL_LEVEL_LABELS,
  APPROVAL_STATUS_LABELS,
  COUNT_STATUS_LABELS,
  COUNT_TYPE_LABELS,
  currentStepIndex,
  decidableLevels,
  recountableLines,
  stepStatus,
  toNumber,
} from './inventory-counting.utils';

type Decision = { level: 1 | 2; kind: 'approve' | 'reject' };

@Component({
  selector: 'app-count-reconcile',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzStatisticModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
    NzTimelineModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './count-reconcile.component.html',
  styleUrl: '../shared/inventory-valuation.scss',
})
export class CountReconcileComponent {
  private readonly api = inject(InventoryCountApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly statusLabels = COUNT_STATUS_LABELS;
  protected readonly typeLabels = COUNT_TYPE_LABELS;
  protected readonly approvalStatusLabels = APPROVAL_STATUS_LABELS;
  protected readonly levelLabels = APPROVAL_LEVEL_LABELS;
  protected readonly stepStatus = stepStatus;

  readonly id = signal<string | null>(null);
  readonly data = signal<CountVariance | null>(null);
  readonly events = signal<CountEvent[]>([]);
  readonly loading = signal(false);
  readonly busy = signal(false);
  readonly errorKey = signal<string | null>(null);
  readonly actionErrors = signal<string[]>([]);
  readonly selectedIds = signal<ReadonlySet<string>>(new Set());

  readonly decision = signal<Decision | null>(null);
  readonly decisionText = signal('');

  readonly lines = computed<VarianceLine[]>(() => this.data()?.lines ?? []);
  readonly approvals = computed<CountApproval[]>(() =>
    [...(this.data()?.approvals ?? [])].sort((a, b) => a.level - b.level),
  );
  readonly currentStep = computed(() => currentStepIndex(this.approvals()));
  readonly decidable = computed(() => decidableLevels(this.approvals()));
  readonly recountable = computed(() => recountableLines(this.lines()));
  readonly canRecount = computed(() => this.selectedIds().size > 0 && !this.busy());
  readonly canSubmit = computed(() => {
    const d = this.data();
    return !!d && d.session.status === 'in_progress' && !d.adjustment;
  });
  readonly allSelected = computed(
    () => this.recountable().length > 0 && this.recountable().every((l) => this.selectedIds().has(l.id)),
  );
  readonly decisionRequiresReason = computed(() => this.decision()?.kind === 'reject');
  readonly decisionValid = computed(() => !this.decisionRequiresReason() || this.decisionText().trim().length > 0);

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        takeUntilDestroyed(),
      )
      .subscribe((id) => {
        this.id.set(id);
        this.load();
      });
  }

  load(): void {
    const id = this.id();
    if (!id) {
      return;
    }
    this.loading.set(true);
    this.errorKey.set(null);
    this.api.getVariance(id).subscribe({
      next: (data) => {
        this.data.set(data);
        this.loading.set(false);
        this.selectedIds.set(new Set());
      },
      error: (err: unknown) => {
        this.data.set(null);
        this.errorKey.set(inventoryErrorKey(err));
        this.loading.set(false);
      },
    });
    this.api.getEvents(id).subscribe({ next: (e) => this.events.set(e), error: () => this.events.set([]) });
  }

  // ------------------------------------------------------------- selection

  toggleLine(lineId: string, checked: boolean): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(lineId);
      } else {
        next.delete(lineId);
      }
      return next;
    });
  }

  toggleAll(checked: boolean): void {
    this.selectedIds.set(checked ? new Set(this.recountable().map((l) => l.id)) : new Set());
  }

  // -------------------------------------------------------------- actions

  recount(): void {
    const id = this.id();
    if (!id || !this.canRecount()) {
      return;
    }
    this.run(this.api.recount(id, [...this.selectedIds()]), 'INVENTORY_COUNT.SESSION.ACTION_DONE');
  }

  submitDifferences(): void {
    const id = this.id();
    if (!id || this.busy()) {
      return;
    }
    this.run(this.api.reconcile(id), 'INVENTORY_COUNT.SESSION.ACTION_DONE');
  }

  openDecision(level: number, kind: 'approve' | 'reject'): void {
    this.decisionText.set('');
    this.actionErrors.set([]);
    this.decision.set({ level: level === 2 ? 2 : 1, kind });
  }

  closeDecision(): void {
    this.decision.set(null);
  }

  confirmDecision(): void {
    const id = this.id();
    const d = this.decision();
    if (!id || !d || !this.decisionValid() || this.busy()) {
      return;
    }
    const text = this.decisionText().trim();
    const request = d.kind === 'approve' ? this.api.approve(id, d.level, text || undefined) : this.api.reject(id, d.level, text);
    this.run(request, 'INVENTORY_COUNT.RECON.DECISION_DONE', () => this.decision.set(null));
  }

  // ---------------------------------------------------------------- helpers

  variance(line: VarianceLine): number {
    return toNumber(line.variance_quantity);
  }

  varianceClass(value: number | string): string {
    const n = toNumber(value);
    return n === 0 ? '' : n > 0 ? 'iv-gain' : 'iv-diff-alert';
  }

  private run(request: Observable<unknown>, successKey: string, done?: () => void): void {
    this.busy.set(true);
    this.actionErrors.set([]);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.message.success(this.i18n.translate(successKey));
        done?.();
        this.load();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        if (httpStatus(err) === 422) {
          const messages = validationMessages(err);
          this.actionErrors.set(messages.length ? messages : [this.i18n.translate(inventoryErrorKey(err))]);
        } else {
          done?.();
          this.load();
        }
      },
    });
  }
}
