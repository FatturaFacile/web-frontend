import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DP_CALCULATION_MODES,
  DP_INSTRUMENTS,
  DP_PRESETS,
  DP_TRIGGERS,
  DpCalculationMode,
  DpChainDetail,
  DpCreatePayload,
  DpInstrument,
  DpPlanPayload,
  DpSourceType,
  DpTrigger,
  TranslateService,
} from '@core';
import { ModalActionsDirective, MoneyPipe, TranslatePipe } from '@shared';
import { ChainStore } from './chain.store';
import { checkRow, DpMilestoneRow, DpOutcome, inputOf, rowIsValid } from './down-payments.util';
import { DpFeedbackComponent } from './feedback.component';
import { DpJurisdictionNoticeComponent } from './jurisdiction-notice.component';

type PlanMode = 'preset' | 'custom';

let nextRowKey = 1;

const newRow = (patch: Partial<DpMilestoneRow> = {}): DpMilestoneRow => ({
  key: nextRowKey++,
  label: '',
  trigger: 'on_order_confirmation',
  mode: 'percentage',
  value: null,
  instrument: 'advance_invoice_immediate',
  dueDate: null,
  ...patch,
});

/**
 * Wizard that opens the down-payment chain of a sales order or quote: 1) a preset (30/40/30, 50/50, caparra + balance) or custom
 * milestones, 2) the live cent-exact split of every installment over the VAT rates of the source, 3) the confirmation, with the
 * option to emit the first installment at once.
 */
@Component({
  selector: 'app-dp-wizard-modal',
  imports: [
    FormsModule,
    ModalActionsDirective,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDatePickerModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
    DpFeedbackComponent,
    DpJurisdictionNoticeComponent,
    TranslatePipe,
  ],
  styleUrl: './down-payments.scss',
  template: `
    <nz-modal
      appModalActions
      [nzVisible]="visible()"
      [nzWidth]="980"
      [nzTitle]="'down_payments.modal.wizard' | translate"
      [nzFooter]="null"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        <nz-steps [nzCurrent]="step()" nzSize="small" class="wizard-steps">
          <nz-step [nzTitle]="'down_payments.step.plan' | translate"></nz-step>
          <nz-step [nzTitle]="'down_payments.step.preview' | translate"></nz-step>
          <nz-step [nzTitle]="'down_payments.step.confirm' | translate"></nz-step>
        </nz-steps>

        <app-dp-feedback [outcome]="feedback()" (dismissed)="feedback.set(null)" />

        @switch (step()) {
          @case (0) {
            <p class="muted">
              {{ 'down_payments.hint.wizardPlan' | translate: { source: sourceLabel() ?? '' } }}
            </p>

            <div class="choice-grid" data-test="presets">
              @for (key of presetKeys(); track key) {
                <div
                  class="choice"
                  role="button"
                  tabindex="0"
                  [class.selected]="mode() === 'preset' && preset() === key"
                  [attr.data-test]="'preset-' + key"
                  (click)="choosePreset(key)"
                  (keydown.enter)="choosePreset(key)"
                >
                  <div class="choice-title">{{ 'down_payments.preset.' + key | translate }}</div>
                  <div class="muted">{{ presetSummary(key) }}</div>
                </div>
              }
              <div
                class="choice"
                role="button"
                tabindex="0"
                [class.selected]="mode() === 'custom'"
                data-test="preset-custom"
                (click)="chooseCustom()"
                (keydown.enter)="chooseCustom()"
              >
                <div class="choice-title">{{ 'down_payments.preset.custom' | translate }}</div>
                <div class="muted">{{ 'down_payments.hint.customPlan' | translate }}</div>
              </div>
            </div>

            @if (mode() === 'custom') {
              @for (row of rows(); track row.key; let index = $index) {
                <div class="milestone-row" [attr.data-test]="'row-' + index">
                  <div class="field">
                    <label [for]="'dp-w-label-' + row.key">{{
                      'down_payments.field.milestone' | translate
                    }}</label>
                    <input
                      nz-input
                      maxlength="200"
                      [id]="'dp-w-label-' + row.key"
                      [ngModel]="row.label"
                      (ngModelChange)="patchRow(row.key, { label: $event })"
                    />
                  </div>
                  <div class="field">
                    <label [for]="'dp-w-trigger-' + row.key">{{
                      'down_payments.field.trigger' | translate
                    }}</label>
                    <nz-select
                      [nzId]="'dp-w-trigger-' + row.key"
                      [ngModel]="row.trigger"
                      (ngModelChange)="patchRow(row.key, { trigger: $event })"
                    >
                      @for (item of triggers; track item) {
                        <nz-option
                          [nzValue]="item"
                          [nzLabel]="'down_payments.trigger.' + item | translate"
                        ></nz-option>
                      }
                    </nz-select>
                  </div>
                  <div class="field">
                    <label [for]="'dp-w-mode-' + row.key">{{
                      'down_payments.field.calculationMode' | translate
                    }}</label>
                    <nz-select
                      [nzId]="'dp-w-mode-' + row.key"
                      [ngModel]="row.mode"
                      (ngModelChange)="patchRow(row.key, { mode: $event })"
                    >
                      @for (item of modes; track item) {
                        <nz-option
                          [nzValue]="item"
                          [nzLabel]="'down_payments.mode.' + item | translate"
                        ></nz-option>
                      }
                    </nz-select>
                  </div>
                  <div class="field">
                    <label [for]="'dp-w-value-' + row.key">{{
                      (row.mode === 'percentage'
                        ? 'down_payments.field.percentage'
                        : 'down_payments.field.amount'
                      ) | translate
                    }}</label>
                    <nz-input-number
                      [nzId]="'dp-w-value-' + row.key"
                      [nzMin]="0"
                      [nzMax]="row.mode === 'percentage' ? 100 : 999999999"
                      [nzPrecision]="2"
                      [ngModel]="row.value"
                      (ngModelChange)="patchRow(row.key, { value: $event })"
                    ></nz-input-number>
                  </div>
                  <div class="field">
                    <label [for]="'dp-w-instrument-' + row.key">{{
                      'down_payments.field.instrument' | translate
                    }}</label>
                    <nz-select
                      [nzId]="'dp-w-instrument-' + row.key"
                      [ngModel]="row.instrument"
                      (ngModelChange)="patchRow(row.key, { instrument: $event })"
                    >
                      @for (item of instruments; track item) {
                        <nz-option
                          [nzValue]="item"
                          [nzLabel]="'down_payments.instrument.' + item | translate"
                        ></nz-option>
                      }
                    </nz-select>
                  </div>
                  <div class="field">
                    <label [for]="'dp-w-due-' + row.key">{{
                      'down_payments.field.dueDate' | translate
                    }}</label>
                    <nz-date-picker
                      [nzId]="'dp-w-due-' + row.key"
                      [ngModel]="row.dueDate"
                      (ngModelChange)="patchRow(row.key, { dueDate: $event })"
                    ></nz-date-picker>
                  </div>
                  <button
                    nz-button
                    nzDanger
                    type="button"
                    data-test="remove-row"
                    [disabled]="rows().length === 1"
                    [attr.aria-label]="'down_payments.action.removeMilestone' | translate"
                    (click)="removeRow(row.key)"
                  >
                    {{ 'down_payments.action.removeMilestone' | translate }}
                  </button>
                </div>
              }
              <button nz-button type="button" data-test="add-row" (click)="addRow()">
                {{ 'down_payments.action.addMilestone' | translate }}
              </button>
            }

            <div class="wizard-actions">
              <button
                nz-button
                nzType="primary"
                type="button"
                data-test="to-preview"
                [disabled]="!planReady()"
                [nzLoading]="store.previewing()"
                (click)="goToPreview()"
              >
                {{ 'down_payments.action.next' | translate }}
              </button>
              <button nz-button type="button" (click)="closed.emit()">
                {{ 'down_payments.action.close' | translate }}
              </button>
            </div>
          }

          @case (1) {
            @if (store.plan(); as plan) {
              <app-dp-jurisdiction-notice [jurisdiction]="plan.source.jurisdiction" />

              <nz-table
                nzSize="small"
                [nzData]="plan.installments"
                [nzShowPagination]="false"
                data-test="plan-table"
              >
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">{{ 'down_payments.field.milestone' | translate }}</th>
                    <th scope="col">{{ 'down_payments.field.instrument' | translate }}</th>
                    <th scope="col">{{ 'down_payments.field.vatRate' | translate }}</th>
                    <th scope="col" class="num">{{ 'down_payments.field.net' | translate }}</th>
                    <th scope="col" class="num">{{ 'down_payments.field.vat' | translate }}</th>
                    <th scope="col" class="num">{{ 'down_payments.field.gross' | translate }}</th>
                    <th scope="col">{{ 'down_payments.field.verification' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of plan.installments; track row.sequence) {
                    @let check = checkOf(row);
                    @for (slice of row.vat_breakdown; track slice.vat_rate; let first = $first) {
                      <tr [attr.data-test]="'plan-' + row.sequence + '-' + slice.vat_rate">
                        <td>{{ first ? row.sequence : '' }}</td>
                        <td>
                          @if (first) {
                            {{ row.milestone_label }}
                            <small class="muted">{{
                              'down_payments.trigger.' + row.trigger_type | translate
                            }}</small>
                          }
                        </td>
                        <td>
                          @if (first) {
                            {{ 'down_payments.instrument.' + row.instrument_type | translate }}
                          }
                        </td>
                        <td>{{ slice.vat_rate }}%</td>
                        <td class="num">{{ slice.net | money: plan.source.currency }}</td>
                        <td class="num">{{ slice.vat | money: plan.source.currency }}</td>
                        <td class="num">{{ slice.gross | money: plan.source.currency }}</td>
                        <td>
                          @if (first) {
                            <span
                              class="check"
                              [class.ok]="check.exact"
                              [class.ko]="!check.exact"
                              [attr.data-test]="'check-' + row.sequence"
                            >
                              {{
                                (check.exact
                                  ? 'down_payments.check.exact'
                                  : 'down_payments.check.mismatch'
                                ) | translate
                              }}
                            </span>
                          }
                        </td>
                      </tr>
                    } @empty {
                      <tr [attr.data-test]="'plan-' + row.sequence + '-deposit'">
                        <td>{{ row.sequence }}</td>
                        <td>
                          {{ row.milestone_label }}
                          <small class="muted">{{
                            'down_payments.trigger.' + row.trigger_type | translate
                          }}</small>
                        </td>
                        <td>{{ 'down_payments.instrument.' + row.instrument_type | translate }}</td>
                        <td>{{ 'down_payments.field.outOfVat' | translate }}</td>
                        <td class="num">{{ row.amount_net | money: plan.source.currency }}</td>
                        <td class="num">{{ row.amount_vat | money: plan.source.currency }}</td>
                        <td class="num">{{ row.amount_gross | money: plan.source.currency }}</td>
                        <td>
                          <span class="check ok">{{
                            'down_payments.check.noSplit' | translate
                          }}</span>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </nz-table>

              <div class="preview-box" data-test="plan-totals">
                <dl>
                  <dt>{{ 'down_payments.field.contractGross' | translate }}</dt>
                  <dd>{{ plan.contract_gross | money: plan.source.currency }}</dd>
                  <dt>{{ 'down_payments.field.plannedGross' | translate }}</dt>
                  <dd>{{ plan.planned_gross | money: plan.source.currency }}</dd>
                  <dt class="total">{{ 'down_payments.field.sliceSum' | translate }}</dt>
                  <dd
                    class="total check"
                    [class.ok]="allExact()"
                    [class.ko]="!allExact()"
                    data-test="slice-sum"
                  >
                    {{
                      (allExact() ? 'down_payments.check.exact' : 'down_payments.check.mismatch')
                        | translate
                    }}
                  </dd>
                </dl>
              </div>

              @if (hasDrift()) {
                <nz-alert
                  class="notice"
                  nzType="warning"
                  nzShowIcon
                  data-test="rounding-drift"
                  [nzMessage]="
                    'down_payments.warning.roundingDrift'
                      | translate: { drift: plan.rounding_drift }
                  "
                  [nzDescription]="'down_payments.warning.roundingDriftHint' | translate"
                ></nz-alert>
              }
            }

            <div class="wizard-actions">
              <button nz-button type="button" data-test="back" (click)="back()">
                {{ 'down_payments.action.back' | translate }}
              </button>
              <button
                nz-button
                nzType="primary"
                type="button"
                data-test="to-confirm"
                [disabled]="!store.plan()"
                (click)="step.set(2)"
              >
                {{ 'down_payments.action.next' | translate }}
              </button>
            </div>
          }

          @case (2) {
            @if (store.plan(); as plan) {
              <app-dp-jurisdiction-notice [jurisdiction]="plan.source.jurisdiction" />

              <div class="preview-box" data-test="summary">
                <dl>
                  <dt>{{ 'down_payments.field.source' | translate }}</dt>
                  <dd>
                    {{ 'down_payments.sourceType.' + plan.source.type | translate }}
                    {{ plan.source.number }}
                    <nz-tag>{{ plan.source.jurisdiction }}</nz-tag>
                  </dd>
                  <dt>{{ 'down_payments.field.customer' | translate }}</dt>
                  <dd>{{ plan.source.customer_name }}</dd>
                  <dt>{{ 'down_payments.field.installments' | translate }}</dt>
                  <dd>{{ plan.installments.length }}</dd>
                  <dt class="total">{{ 'down_payments.field.plannedGross' | translate }}</dt>
                  <dd class="total">{{ plan.planned_gross | money: plan.source.currency }}</dd>
                </dl>
              </div>

              <label for="dp-w-notes" class="field">
                <span>{{ 'down_payments.field.notes' | translate }}</span>
                <textarea
                  nz-input
                  id="dp-w-notes"
                  rows="2"
                  maxlength="2000"
                  [ngModel]="notes()"
                  (ngModelChange)="notes.set($event)"
                ></textarea>
              </label>

              @if (firstIsEmittable()) {
                <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                <label
                  nz-checkbox
                  data-test="emit-first"
                  [ngModel]="emitFirst()"
                  (ngModelChange)="emitFirst.set($event)"
                >
                  {{ 'down_payments.field.emitFirst' | translate }}
                </label>
              }
            }

            <div class="wizard-actions">
              <button nz-button type="button" data-test="back" (click)="step.set(1)">
                {{ 'down_payments.action.back' | translate }}
              </button>
              <button
                nz-button
                nzType="primary"
                type="button"
                data-test="create"
                [nzLoading]="store.saving()"
                (click)="create()"
              >
                {{ 'down_payments.action.openChain' | translate }}
              </button>
            </div>
          }
        }
      </ng-container>
    </nz-modal>
  `,
})
export class DownPaymentWizardModalComponent {
  readonly visible = input.required<boolean>();
  readonly sourceType = input.required<DpSourceType>();
  readonly sourceId = input.required<string>();
  /** Number of the order or quote, for the hint of the first step. */
  readonly sourceLabel = input<string | null>(null);
  readonly closed = output<void>();
  readonly created = output<DpChainDetail>();

  protected readonly store = inject(ChainStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly triggers: readonly DpTrigger[] = DP_TRIGGERS;
  protected readonly modes: readonly DpCalculationMode[] = DP_CALCULATION_MODES;
  protected readonly instruments: readonly DpInstrument[] = DP_INSTRUMENTS;

  protected readonly step = signal(0);
  protected readonly mode = signal<PlanMode>('preset');
  protected readonly preset = signal<string | null>(null);
  protected readonly rows = signal<DpMilestoneRow[]>([newRow()]);
  protected readonly notes = signal('');
  protected readonly emitFirst = signal(false);
  protected readonly feedback = signal<DpOutcome | null>(null);

  protected readonly presetKeys = computed<string[]>(() => {
    const keys = Object.keys(this.store.lookups()?.presets ?? {});
    return keys.length > 0 ? keys : [...DP_PRESETS];
  });

  protected readonly planReady = computed(() =>
    this.mode() === 'preset' ? this.preset() !== null : this.rows().every((row) => rowIsValid(row)),
  );

  protected readonly allExact = computed(() =>
    (this.store.plan()?.installments ?? []).every((row) => checkRow(row).exact),
  );

  protected readonly hasDrift = computed(() => {
    const drift = Number(this.store.plan()?.rounding_drift ?? 0);
    return drift !== 0 || !this.allExact();
  });

  protected readonly firstIsEmittable = computed(() => {
    const first = this.store.plan()?.installments[0];
    return first !== undefined && first.trigger_type === 'on_order_confirmation';
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.reset();
      }
    });
  }

  private reset(): void {
    this.step.set(0);
    this.mode.set('preset');
    this.preset.set(null);
    this.rows.set([newRow()]);
    this.notes.set('');
    this.emitFirst.set(false);
    this.feedback.set(null);
    this.store.clearPlan();
    void this.store.loadLookups();
  }

  /** The installments of a preset as a short text: `30% · 40% · 30%`. */
  protected presetSummary(key: string): string {
    return (this.store.lookups()?.presets[key] ?? [])
      .map((item) => (item.percentage ? `${Number(item.percentage)}%` : (item.amount ?? '')))
      .join(' · ');
  }

  protected checkOf = checkRow;

  protected choosePreset(key: string): void {
    this.mode.set('preset');
    this.preset.set(key);
    this.store.clearPlan();
  }

  protected chooseCustom(): void {
    if (this.mode() !== 'custom') {
      const seed = this.store.lookups()?.presets[this.preset() ?? ''] ?? [];
      this.rows.set(
        seed.length > 0
          ? seed.map((item) =>
              newRow({
                trigger: item.trigger_type,
                mode: item.calculation_mode,
                value: Number(item.percentage ?? item.amount ?? 0) || null,
                instrument: item.instrument_type,
              }),
            )
          : [newRow()],
      );
    }
    this.mode.set('custom');
    this.store.clearPlan();
  }

  protected patchRow(key: number, patch: Partial<DpMilestoneRow>): void {
    this.rows.update((rows) => rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
    this.store.clearPlan();
  }

  protected addRow(): void {
    this.rows.update((rows) => [...rows, newRow()]);
    this.store.clearPlan();
  }

  protected removeRow(key: number): void {
    this.rows.update((rows) => (rows.length > 1 ? rows.filter((row) => row.key !== key) : rows));
    this.store.clearPlan();
  }

  private planPayload(): DpPlanPayload {
    const base = { source_type: this.sourceType(), source_id: this.sourceId() };
    return this.mode() === 'preset'
      ? { ...base, ...(this.preset() ? { template: this.preset() as string } : {}) }
      : { ...base, installments: this.rows().map(inputOf) };
  }

  protected async goToPreview(): Promise<void> {
    const outcome = await this.store.previewPlan(this.planPayload());
    this.feedback.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.step.set(1);
    }
  }

  protected back(): void {
    this.feedback.set(null);
    this.step.set(0);
  }

  protected async create(): Promise<void> {
    const payload: DpCreatePayload = {
      ...this.planPayload(),
      ...(this.notes().trim() ? { notes: this.notes().trim() } : {}),
    };
    const outcome = await this.store.create(payload, this.emitFirst());
    if (!outcome.ok || outcome.chain === null) {
      this.feedback.set(outcome);
      return;
    }
    if (outcome.emitFailure) {
      this.message.warning(this.i18n.instant('down_payments.message.createdEmitFailed'));
    } else {
      this.message.success(
        this.i18n.instant(
          this.emitFirst()
            ? 'down_payments.message.createdEmitted'
            : 'down_payments.message.created',
        ),
      );
    }
    this.created.emit(outcome.chain);
    this.closed.emit();
  }
}
