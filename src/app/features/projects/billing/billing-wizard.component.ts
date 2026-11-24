import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env';
import { I18nService } from '@core';
import { MoneyPipe, TranslatePipe, RadioControlDirective } from '@shared';
import { ProjectBillingApiService } from './project-billing-api.service';
import {
  BillingContract,
  InvoiceDraft,
  Paginated,
  SalCertificate,
  TimeAndMaterialsPreview,
} from './project-billing.models';
import { modelSupports, previewSal } from './project-billing.utils';

type Family = 'time_and_materials' | 'milestones' | 'progress';

interface MilestoneOption {
  id: string;
  name: string;
  billing_amount: string;
  billing_percentage: string;
  is_completed: boolean;
  is_billed: boolean;
}

/**
 * Billing wizard of a project (Mod 081): pick what to bill (approved hours, expenses and supplier bills as time and
 * materials, a completed fixed milestone, or the work progress as a SAL certificate), review the figures the API will
 * produce, then draft the invoice or the certificate.
 */
@Component({
  selector: 'app-billing-wizard',
  imports: [
    RadioControlDirective,
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzInputModule,
    NzInputNumberModule,
    NzRadioModule,
    NzStepsModule,
    NzTableModule,
    TranslatePipe,
  ],
  template: `
    @if (!contract() || contract()?.billing_status !== 'active') {
      <nz-alert
        nzType="info"
        nzShowIcon
        data-testid="wizard-inactive"
        [nzMessage]="'PROJECT_BILLING.WIZARD_NEEDS_ACTIVE' | translate"
      />
    } @else {
      <nz-steps [nzCurrent]="step()" nzSize="small" class="bf-steps">
        <nz-step [nzTitle]="'PROJECT_BILLING.STEP_SOURCE' | translate" />
        <nz-step [nzTitle]="'PROJECT_BILLING.STEP_REVIEW' | translate" />
        <nz-step [nzTitle]="'PROJECT_BILLING.STEP_DONE' | translate" />
      </nz-steps>

      @if (step() === 0) {
        <nz-radio-group
          [ngModel]="family()"
          (ngModelChange)="family.set($event)"
          data-testid="wizard-family"
        >
          @if (supports('time_and_materials')) {
            <label for="billing-wizard-time-and-materials" appRadioControl nz-radio nzValue="time_and_materials" data-testid="family-tm">{{
              'PROJECT_BILLING.FAMILY_TM' | translate
            }}</label>
          }
          @if (supports('milestones')) {
            <label for="billing-wizard-milestones" appRadioControl nz-radio nzValue="milestones" data-testid="family-milestones">{{
              'PROJECT_BILLING.FAMILY_MILESTONES' | translate
            }}</label>
          }
          @if (supports('progress')) {
            <label for="billing-wizard-progress" appRadioControl nz-radio nzValue="progress" data-testid="family-progress">{{
              'PROJECT_BILLING.FAMILY_PROGRESS' | translate
            }}</label>
          }
        </nz-radio-group>
        <div class="bf-actions">
          <button
            nz-button
            nzType="primary"
            type="button"
            data-testid="wizard-next"
            [disabled]="!family()"
            [nzLoading]="busy()"
            (click)="next()"
          >
            {{ 'PROJECT_BILLING.NEXT' | translate }}
          </button>
        </div>
      }

      @if (step() === 1) {
        @switch (family()) {
          @case ('time_and_materials') {
            <label class="bf-field">
              <span>{{ 'PROJECT_BILLING.UP_TO_DATE' | translate }}</span>
              <input
                nz-input
                type="date"
                [ngModel]="upToDate()"
                (ngModelChange)="changeUpToDate($event)"
              />
            </label>
            @if (preview(); as p) {
              <nz-table
                #tm
                nzSize="small"
                [nzData]="p.lines"
                [nzShowPagination]="false"
                data-testid="tm-lines"
              >
                <thead>
                  <tr>
                    <th>{{ 'PROJECT_BILLING.COL_DESCRIPTION' | translate }}</th>
                    <th class="bf-num">{{ 'PROJECT_BILLING.COL_QUANTITY' | translate }}</th>
                    <th class="bf-num">{{ 'PROJECT_BILLING.COL_AMOUNT' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of tm.data; track $index) {
                    <tr>
                      <td>{{ line.description }}</td>
                      <td class="bf-num">{{ line.quantity }}</td>
                      <td class="bf-num">{{ line.amount | money: currency() }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
              <nz-descriptions nzSize="small" [nzColumn]="2" class="bf-totals">
                <nz-descriptions-item [nzTitle]="'PROJECT_BILLING.TM_LABOUR' | translate">{{
                  p.labour_total | money: currency()
                }}</nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'PROJECT_BILLING.TM_COSTS' | translate">{{
                  p.costs_total | money: currency()
                }}</nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'PROJECT_BILLING.TM_MARKUP' | translate">{{
                  p.markup_total | money: currency()
                }}</nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'PROJECT_BILLING.TM_TOTAL' | translate"
                  ><strong data-testid="tm-total">{{
                    p.billable_total | money: currency()
                  }}</strong></nz-descriptions-item
                >
              </nz-descriptions>
              @if (p.capped_out !== '0.00') {
                <nz-alert
                  nzType="warning"
                  nzShowIcon
                  data-testid="tm-capped"
                  [nzMessage]="'PROJECT_BILLING.TM_CAPPED' | translate: { amount: p.capped_out }"
                />
              }
              @if (p.lines.length === 0) {
                <nz-alert
                  nzType="info"
                  nzShowIcon
                  [nzMessage]="'PROJECT_BILLING.TM_NOTHING' | translate"
                />
              }
            }
          }
          @case ('milestones') {
            <nz-radio-group
              [ngModel]="milestoneId()"
              (ngModelChange)="milestoneId.set($event)"
              data-testid="milestone-list"
            >
              @for (milestone of billableMilestones(); track milestone.id) {
                <label [attr.for]="'billing-wizard-field-3-' + $index" appRadioControl nz-radio [nzValue]="milestone.id"
                  >{{ milestone.name }} ({{ milestone.billing_amount | money: currency() }})</label
                >
              } @empty {
                <span class="bf-muted">{{ 'PROJECT_BILLING.NO_MILESTONES' | translate }}</span>
              }
            </nz-radio-group>
          }
          @case ('progress') {
            <div class="bf-grid">
              <label class="bf-field">
                <span>{{ 'PROJECT_BILLING.PERIOD_START' | translate }}</span>
                <input
                  nz-input
                  type="date"
                  data-testid="sal-start"
                  [ngModel]="periodStart()"
                  (ngModelChange)="periodStart.set($event)"
                />
              </label>

              <label class="bf-field">
                <span>{{ 'PROJECT_BILLING.PERIOD_END' | translate }}</span>
                <input
                  nz-input
                  type="date"
                  data-testid="sal-end"
                  [ngModel]="periodEnd()"
                  (ngModelChange)="periodEnd.set($event)"
                />
              </label>
              <label for="billing-wizard-field-2" class="bf-field">
                <span>{{ 'PROJECT_BILLING.CUMULATIVE_PERCENT' | translate }}</span>
                <nz-input-number nzId="billing-wizard-field-2"
                  data-testid="sal-percent"
                  [ngModel]="percent()"
                  (ngModelChange)="percent.set($event)"
                  [nzMin]="0"
                  [nzMax]="100"
                />
              </label>
            </div>
            <p class="bf-muted">
              {{ 'PROJECT_BILLING.PREVIOUS_PERCENT' | translate: { percent: previousPercent() } }}
            </p>
            @if (salPreview(); as s) {
              <nz-descriptions nzSize="small" [nzColumn]="2" nzBordered data-testid="sal-preview">
                <nz-descriptions-item
                  [nzTitle]="'PROJECT_BILLING.SAL_CUMULATIVE_GROSS' | translate"
                  >{{ s.cumulativeGross | money: currency() }}</nz-descriptions-item
                >
                <nz-descriptions-item [nzTitle]="'PROJECT_BILLING.SAL_CURRENT_GROSS' | translate">{{
                  s.currentGross | money: currency()
                }}</nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'PROJECT_BILLING.SAL_ADVANCE' | translate"
                  >- {{ s.advanceDeduction | money: currency() }}</nz-descriptions-item
                >
                <nz-descriptions-item [nzTitle]="'PROJECT_BILLING.SAL_INVOICE' | translate">{{
                  s.invoiceAmount | money: currency()
                }}</nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'PROJECT_BILLING.SAL_RETENTION' | translate"
                  >- {{ s.retentionWithheld | money: currency() }}</nz-descriptions-item
                >
                <nz-descriptions-item [nzTitle]="'PROJECT_BILLING.SAL_NET' | translate"
                  ><strong data-testid="sal-net">{{
                    s.netBillable | money: currency()
                  }}</strong></nz-descriptions-item
                >
              </nz-descriptions>
              @if (s.isFinal) {
                <nz-alert
                  nzType="info"
                  nzShowIcon
                  [nzMessage]="'PROJECT_BILLING.SAL_FINAL_NOTE' | translate"
                />
              }
            } @else {
              <nz-alert
                nzType="warning"
                nzShowIcon
                data-testid="sal-invalid"
                [nzMessage]="'PROJECT_BILLING.SAL_INVALID' | translate"
              />
            }
          }
        }

        @if (family() !== 'progress') {
          <label for="billing-wizard-field" class="bf-field">
            <span>{{ 'PROJECT_BILLING.TAX_RATE' | translate }}</span>
            <nz-input-number nzId="billing-wizard-field"
              data-testid="wizard-tax"
              [ngModel]="taxRate()"
              (ngModelChange)="taxRate.set($event ?? 0)"
              [nzMin]="0"
              [nzMax]="100"
            />
          </label>
        }

        <div class="bf-actions">
          <button nz-button type="button" (click)="back()">
            {{ 'PROJECT_BILLING.BACK' | translate }}
          </button>
          <button
            nz-button
            nzType="primary"
            type="button"
            data-testid="wizard-confirm"
            [disabled]="!canConfirm()"
            [nzLoading]="busy()"
            (click)="confirm()"
          >
            {{ 'PROJECT_BILLING.CONFIRM' | translate }}
          </button>
        </div>
      }

      @if (step() === 2) {
        <nz-alert
          nzType="success"
          nzShowIcon
          data-testid="wizard-done"
          [nzMessage]="resultMessage()"
        />
        <div class="bf-actions">
          <button nz-button type="button" data-testid="wizard-again" (click)="reset()">
            {{ 'PROJECT_BILLING.BILL_MORE' | translate }}
          </button>
        </div>
      }
    }
  `,
})
export class BillingWizardComponent {
  private readonly api = inject(ProjectBillingApiService);
  private readonly http = inject(HttpClient);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly projectId = input.required<string>();
  readonly contract = input<BillingContract | null>(null);
  readonly sals = input<SalCertificate[]>([]);
  readonly currency = input('EUR');
  readonly billed = output<void>();

  protected readonly step = signal(0);
  protected readonly family = signal<Family | null>(null);
  protected readonly busy = signal(false);
  protected readonly upToDate = signal(new Date().toISOString().slice(0, 10));
  protected readonly taxRate = signal(22);
  protected readonly preview = signal<TimeAndMaterialsPreview | null>(null);
  protected readonly milestones = signal<MilestoneOption[]>([]);
  protected readonly milestoneId = signal<string | null>(null);
  protected readonly periodStart = signal(new Date().toISOString().slice(0, 10));
  protected readonly periodEnd = signal(new Date().toISOString().slice(0, 10));
  protected readonly percent = signal<number | null>(null);
  protected readonly resultMessage = signal('');

  protected readonly billableMilestones = computed(() =>
    this.milestones().filter((milestone) => milestone.is_completed && !milestone.is_billed),
  );
  protected readonly lastSal = computed(
    () =>
      [...this.sals()]
        .filter((sal) => sal.status !== 'cancelled')
        .sort((a, b) => b.sal_number - a.sal_number)[0] ?? null,
  );
  protected readonly previousPercent = computed(
    () => this.lastSal()?.cumulative_completion_percent ?? '0',
  );
  protected readonly salPreview = computed(() => {
    const contract = this.contract();
    const percent = this.percent();

    if (contract === null || percent === null) {
      return null;
    }

    const advanceTotal =
      Number(contract.advance_payment_amount) > 0
        ? Number(contract.advance_payment_amount)
        : (Number(contract.contract_total_value) * Number(contract.advance_payment_percent)) / 100;

    return previewSal({
      contractValue: contract.contract_total_value,
      cumulativePercent: percent,
      previousPercent: Number(this.previousPercent()),
      previousCumulativeGross: this.lastSal()?.cumulative_gross_earned_value ?? '0',
      advanceTotal,
      advanceRecouped: this.sals()
        .filter((sal) => sal.status !== 'cancelled')
        .reduce((sum, sal) => sum + Number(sal.advance_deduction_amount), 0),
      retentionPercent: this.retentionPercent(),
    });
  });
  protected readonly canConfirm = computed(() => {
    switch (this.family()) {
      case 'time_and_materials':
        return (
          (this.preview()?.lines.length ?? 0) > 0 && Number(this.preview()?.billable_total ?? 0) > 0
        );
      case 'milestones':
        return this.milestoneId() !== null;
      case 'progress':
        return this.salPreview() !== null && this.periodEnd() >= this.periodStart();
      default:
        return false;
    }
  });

  protected supports(family: 'time_and_materials' | 'milestones' | 'progress'): boolean {
    return modelSupports(this.contract()?.billing_model ?? null, family);
  }

  /** The retention the SAL will carry: the contract percentage, or the 0.50% statutory one of an Italian public contract. */
  private retentionPercent(): number {
    const contract = this.contract();

    if (contract === null) {
      return 0;
    }

    const own = Number(contract.retention_guarantee_percent);

    return own > 0
      ? own
      : contract.fiscal_jurisdiction === 'IT' && (contract.cig ?? '') !== ''
        ? 0.5
        : 0;
  }

  protected next(): void {
    const family = this.family();

    if (family === 'time_and_materials') {
      this.loadPreview();
    } else if (family === 'milestones') {
      this.loadMilestones();
    } else {
      this.step.set(1);
    }
  }

  protected back(): void {
    this.step.set(0);
  }

  protected reset(): void {
    this.step.set(0);
    this.family.set(null);
    this.percent.set(null);
    this.milestoneId.set(null);
    this.preview.set(null);
  }

  protected changeUpToDate(date: string): void {
    this.upToDate.set(date);
    this.loadPreview();
  }

  protected confirm(): void {
    const family = this.family();
    const id = this.projectId();
    this.busy.set(true);

    const done = (key: string, params?: Record<string, string | number>) => {
      this.busy.set(false);
      this.resultMessage.set(this.i18n.translate(key, params));
      this.step.set(2);
      this.billed.emit();
    };
    const failed = () => {
      this.busy.set(false);
      this.message.error(this.i18n.translate('PROJECT_BILLING.SAVE_ERROR'));
    };

    if (family === 'time_and_materials') {
      this.api.draftTimeAndMaterials(id, this.upToDate(), this.taxRate()).subscribe({
        next: (r: { data: InvoiceDraft }) =>
          done('PROJECT_BILLING.DONE_INVOICE', { number: r.data.invoice_number }),
        error: failed,
      });
    } else if (family === 'milestones') {
      this.api.billMilestone(id, this.milestoneId() ?? '', this.taxRate()).subscribe({
        next: (r: { data: InvoiceDraft }) =>
          done('PROJECT_BILLING.DONE_INVOICE', { number: r.data.invoice_number }),
        error: failed,
      });
    } else {
      this.api
        .createSal(id, {
          period_start_date: this.periodStart(),
          period_end_date: this.periodEnd(),
          cumulative_completion_percent: this.percent() ?? 0,
        })
        .subscribe({
          next: (r) => done('PROJECT_BILLING.DONE_SAL', { number: r.data.sal_number }),
          error: failed,
        });
    }
  }

  private loadPreview(): void {
    this.busy.set(true);
    this.api.timeAndMaterialsPreview(this.projectId(), this.upToDate()).subscribe({
      next: (response) => {
        this.preview.set(response.data);
        this.busy.set(false);
        this.step.set(1);
      },
      error: () => {
        this.busy.set(false);
        this.message.error(this.i18n.translate('PROJECT_BILLING.SAVE_ERROR'));
      },
    });
  }

  private loadMilestones(): void {
    this.busy.set(true);
    this.http
      .get<Paginated<MilestoneOption>>(
        `${environment.apiBaseUrl}/projects/${this.projectId()}/milestones`,
        { params: { per_page: 100 } },
      )
      .subscribe({
        next: (response) => {
          this.milestones.set(response.data);
          this.busy.set(false);
          this.step.set(1);
        },
        error: () => {
          this.busy.set(false);
          this.message.error(this.i18n.translate('PROJECT_BILLING.SAVE_ERROR'));
        },
      });
  }
}
