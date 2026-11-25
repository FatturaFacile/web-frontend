import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CCV_REIMBURSEMENT_STATUSES,
  CCV_WELFARE_JURISDICTIONS,
  CCV_WELFARE_PROVIDERS,
  CcvPendingQuota,
  CcvWelfareProvider,
  CcvWelfareRedemption,
  PermissionsService,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import {
  CcvOutcome,
  CORPORATE_CONVENTIONS_FINANCE_MODULE,
  parseStatement,
  previousMonth,
  reimbursementStatusColor,
} from './corporate-conventions.util';
import { ReconciliationStore } from './reconciliation.store';

type AnonymizeChoice = 'default' | 'nominal' | 'anonymized';

/**
 * Administrative centre. Tab 1: the pending employer quotas by convention, the beneficiary schedule of a period (nominal or
 * anonymized) and the one-click consolidated B2B invoice. Tab 2: the redeemed welfare vouchers with gross, merchant fee and net
 * receivable, the batch sent to a provider and the reconciliation against its settlement statement or self-invoice.
 */
@Component({
  selector: 'app-ccv-billing-reconciliation',
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [ReconciliationStore],
  styleUrl: './corporate-conventions.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.CORPORATE_CONVENTIONS_BILLING' | translate"
    ></app-page-header>

    @if (feedback(); as failure) {
      <nz-alert
        nzType="error"
        nzShowIcon
        nzCloseable
        class="form-alert"
        [nzMessage]="failure.errorKey ?? '' | translate: failure.params"
        [nzDescription]="failure.detail"
        (nzOnClose)="feedback.set(null)"
      ></nz-alert>
    }
    @if (store.error(); as key) {
      <nz-alert
        nzType="error"
        nzShowIcon
        class="form-alert"
        [nzMessage]="key | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <nz-tabs>
        <nz-tab [nzTitle]="'corporateConventions.tab.splitBilling' | translate" nzForceRender>
          <div class="toolbar">
            <label class="field" for="ccv-b-month">
              <span>{{ 'corporateConventions.field.month' | translate }}</span>
              <nz-date-picker
                nzId="ccv-b-month"
                nzMode="month"
                [ngModel]="monthDate()"
                (ngModelChange)="onMonth($event)"
              ></nz-date-picker>
            </label>
            <label class="field" for="ccv-b-anon">
              <span>{{ 'corporateConventions.field.schedule' | translate }}</span>
              <nz-select
                nzId="ccv-b-anon"
                [ngModel]="anonymize()"
                (ngModelChange)="anonymize.set($event)"
              >
                <nz-option
                  nzValue="default"
                  [nzLabel]="'corporateConventions.label.scheduleDefault' | translate"
                ></nz-option>
                <nz-option
                  nzValue="nominal"
                  [nzLabel]="'corporateConventions.label.scheduleNominal' | translate"
                ></nz-option>
                <nz-option
                  nzValue="anonymized"
                  [nzLabel]="'corporateConventions.label.scheduleAnonymized' | translate"
                ></nz-option>
              </nz-select>
            </label>
          </div>

          @if (store.lastInvoice(); as invoice) {
            <nz-alert
              nzType="success"
              nzShowIcon
              nzCloseable
              class="form-alert"
              [nzMessage]="
                'corporateConventions.label.invoiceCreated'
                  | translate: { number: invoice.invoice_number, rows: invoice.rows_count }
              "
              [nzDescription]="invoice.total_employer_quota"
            ></nz-alert>
            <button
              nz-button
              type="button"
              class="download"
              (click)="downloadSchedule(invoice.invoice_id)"
            >
              {{ 'corporateConventions.action.downloadSchedule' | translate }}
            </button>
          }

          <nz-table
            #pendingTable
            nzSize="middle"
            [nzData]="store.pending()"
            [nzShowPagination]="false"
          >
            <thead>
              <tr>
                <th>{{ 'corporateConventions.column.convention' | translate }}</th>
                <th>{{ 'corporateConventions.column.partner' | translate }}</th>
                <th>{{ 'corporateConventions.column.billingCycle' | translate }}</th>
                <th>{{ 'corporateConventions.column.operations' | translate }}</th>
                <th>{{ 'corporateConventions.column.employerQuota' | translate }}</th>
                <th>{{ 'corporateConventions.column.period' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (row of pendingTable.data; track row.convention_id) {
                <tr [class.selected]="row.convention_id === selectedConvention()">
                  <td>
                    <strong>{{ row.convention_name }}</strong>
                  </td>
                  <td>{{ row.partner_company_name }}</td>
                  <td>
                    {{ 'corporateConventions.billingCycle.' + row.billing_cycle | translate }}
                  </td>
                  <td>{{ row.rows_count }}</td>
                  <td>{{ row.total_employer_quota | money: row.currency }}</td>
                  <td>{{ row.oldest_transaction_date }} – {{ row.newest_transaction_date }}</td>
                  <td class="row-actions">
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      [nzLoading]="store.working()"
                      (click)="preview(row)"
                    >
                      {{ 'corporateConventions.action.preview' | translate }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7">
                    <nz-empty
                      [nzNotFoundContent]="'corporateConventions.empty.pendingQuotas' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>

          @if (store.preview(); as preview) {
            <section class="preview">
              <h3>
                {{ preview.convention_name }} · {{ preview.period_from }} – {{ preview.period_to }}
                <nz-tag [nzColor]="preview.anonymized ? 'purple' : 'blue'">
                  {{
                    (preview.anonymized
                      ? 'corporateConventions.label.scheduleAnonymized'
                      : 'corporateConventions.label.scheduleNominal'
                    ) | translate
                  }}
                </nz-tag>
              </h3>
              <p>
                {{ 'corporateConventions.column.operations' | translate }}:
                {{ preview.rows_count }} ·
                {{ 'corporateConventions.column.employerQuota' | translate }}:
                <strong>{{ preview.total_employer_quota | money: preview.currency }}</strong>
              </p>
              <nz-table #scheduleTable nzSize="small" [nzData]="preview.schedule" [nzPageSize]="10">
                <thead>
                  <tr>
                    <th>{{ 'corporateConventions.column.date' | translate }}</th>
                    <th>{{ 'corporateConventions.column.beneficiary' | translate }}</th>
                    <th>{{ 'corporateConventions.column.document' | translate }}</th>
                    <th>{{ 'corporateConventions.column.gross' | translate }}</th>
                    <th>{{ 'corporateConventions.column.discount' | translate }}</th>
                    <th>{{ 'corporateConventions.column.employerQuota' | translate }}</th>
                    <th>{{ 'corporateConventions.column.employeePaid' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (line of scheduleTable.data; track $index) {
                    <tr>
                      <td>{{ line.date }}</td>
                      <td>{{ line.beneficiary }}</td>
                      <td class="mono">{{ line.document }}</td>
                      <td>{{ line.gross | money: preview.currency }}</td>
                      <td>{{ line.discount | money: preview.currency }}</td>
                      <td>{{ line.employer_quota | money: preview.currency }}</td>
                      <td>{{ line.employee_paid | money: preview.currency }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
              @if (canBill) {
                <button
                  nz-button
                  nzType="primary"
                  type="button"
                  [nzLoading]="store.working()"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'corporateConventions.confirm.generateInvoice' | translate"
                  [nzOkText]="'corporateConventions.action.confirm' | translate"
                  [nzCancelText]="'corporateConventions.action.cancel' | translate"
                  (nzOnConfirm)="generate(preview.convention_id)"
                >
                  {{ 'corporateConventions.action.generateInvoice' | translate }}
                </button>
              }
            </section>
          }
        </nz-tab>

        <nz-tab [nzTitle]="'corporateConventions.tab.welfare' | translate" nzForceRender>
          <nz-table
            #summaryTable
            nzSize="small"
            [nzData]="store.summary()"
            [nzShowPagination]="false"
          >
            <thead>
              <tr>
                <th>{{ 'corporateConventions.column.provider' | translate }}</th>
                <th>{{ 'corporateConventions.column.status' | translate }}</th>
                <th>{{ 'corporateConventions.column.vouchers' | translate }}</th>
                <th>{{ 'corporateConventions.column.gross' | translate }}</th>
                <th>{{ 'corporateConventions.column.merchantFee' | translate }}</th>
                <th>{{ 'corporateConventions.column.netReceivable' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of summaryTable.data; track $index) {
                <tr>
                  <td>{{ 'corporateConventions.provider.' + row.provider | translate }}</td>
                  <td>
                    <nz-tag [nzColor]="reimbursementColor(row.reimbursement_status)">{{
                      'corporateConventions.reimbursement.' + row.reimbursement_status | translate
                    }}</nz-tag>
                  </td>
                  <td>{{ row.vouchers }}</td>
                  <td>{{ row.gross | money: row.currency }}</td>
                  <td>{{ row.fee | money: row.currency }}</td>
                  <td>{{ row.net | money: row.currency }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="6">
                    <nz-empty
                      [nzNotFoundContent]="'corporateConventions.empty.vouchers' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>

          <div class="toolbar">
            <label class="field" for="ccv-v-provider">
              <span>{{ 'corporateConventions.column.provider' | translate }}</span>
              <nz-select
                nzId="ccv-v-provider"
                nzAllowClear
                [ngModel]="store.voucherFilters().provider || null"
                (ngModelChange)="store.setVoucherFilters({ provider: $event ?? '' })"
              >
                @for (provider of providers; track provider) {
                  <nz-option
                    [nzValue]="provider"
                    [nzLabel]="'corporateConventions.provider.' + provider | translate"
                  ></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="ccv-v-jurisdiction">
              <span>{{ 'corporateConventions.field.jurisdiction' | translate }}</span>
              <nz-select
                nzId="ccv-v-jurisdiction"
                nzAllowClear
                [ngModel]="store.voucherFilters().jurisdiction || null"
                (ngModelChange)="store.setVoucherFilters({ jurisdiction: $event ?? '' })"
              >
                @for (jurisdiction of jurisdictions; track jurisdiction) {
                  <nz-option
                    [nzValue]="jurisdiction"
                    [nzLabel]="'corporateConventions.jurisdiction.' + jurisdiction | translate"
                  ></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="ccv-v-status">
              <span>{{ 'corporateConventions.field.status' | translate }}</span>
              <nz-select
                nzId="ccv-v-status"
                nzAllowClear
                [ngModel]="store.voucherFilters().status || null"
                (ngModelChange)="store.setVoucherFilters({ status: $event ?? '' })"
              >
                @for (status of statuses; track status) {
                  <nz-option
                    [nzValue]="status"
                    [nzLabel]="'corporateConventions.reimbursement.' + status | translate"
                  ></nz-option>
                }
              </nz-select>
            </label>
          </div>

          <nz-table
            #voucherTable
            nzSize="small"
            nzFrontPagination="false"
            [nzData]="store.vouchers()"
            [nzTotal]="store.voucherTotal()"
            [nzPageIndex]="store.voucherPage()"
            [nzPageSize]="store.voucherPageSize()"
            (nzPageIndexChange)="store.setVoucherPage($event)"
          >
            <thead>
              <tr>
                @if (canBill) {
                  <th></th>
                }
                <th>{{ 'corporateConventions.column.date' | translate }}</th>
                <th>{{ 'corporateConventions.column.provider' | translate }}</th>
                <th>{{ 'corporateConventions.column.voucher' | translate }}</th>
                <th>{{ 'corporateConventions.column.category' | translate }}</th>
                <th>{{ 'corporateConventions.column.gross' | translate }}</th>
                <th>{{ 'corporateConventions.column.merchantFee' | translate }}</th>
                <th>{{ 'corporateConventions.column.netReceivable' | translate }}</th>
                <th>{{ 'corporateConventions.column.status' | translate }}</th>
                <th>{{ 'corporateConventions.column.batch' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (voucher of voucherTable.data; track voucher.id) {
                <tr>
                  @if (canBill) {
                    <td>
                      <input
                        type="checkbox"
                        [disabled]="voucher.reimbursement_status !== 'PENDING_SETTLEMENT'"
                        [checked]="isSelected(voucher)"
                        (change)="toggle(voucher)"
                        [attr.aria-label]="'corporateConventions.action.select' | translate"
                      />
                    </td>
                  }
                  <td>{{ (voucher.created_at ?? '').slice(0, 10) }}</td>
                  <td>{{ 'corporateConventions.provider.' + voucher.provider | translate }}</td>
                  <td class="mono">{{ voucher.voucher_code_masked }}</td>
                  <td>
                    {{
                      'corporateConventions.welfareCategory.' + voucher.welfare_category | translate
                    }}
                  </td>
                  <td>{{ voucher.gross_voucher_amount | money: voucher.currency }}</td>
                  <td>
                    {{ voucher.merchant_fee_amount | money: voucher.currency }}
                    <span class="muted">({{ voucher.merchant_fee_percentage }} %)</span>
                  </td>
                  <td>{{ voucher.net_expected_reimbursement | money: voucher.currency }}</td>
                  <td>
                    <nz-tag [nzColor]="reimbursementColor(voucher.reimbursement_status)">{{
                      'corporateConventions.reimbursement.' + voucher.reimbursement_status
                        | translate
                    }}</nz-tag>
                  </td>
                  <td>{{ voucher.settlement_batch_reference ?? '' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td [attr.colspan]="canBill ? 10 : 9">
                    <nz-empty
                      [nzNotFoundContent]="'corporateConventions.empty.vouchers' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>

          @if (canBill) {
            <section class="settlement">
              <h3>{{ 'corporateConventions.section.settlement' | translate }}</h3>
              <div class="toolbar">
                <label class="field" for="ccv-s-provider">
                  <span>{{ 'corporateConventions.column.provider' | translate }}</span>
                  <nz-select
                    nzId="ccv-s-provider"
                    [ngModel]="settlementProvider()"
                    (ngModelChange)="settlementProvider.set($event)"
                  >
                    @for (provider of providers; track provider) {
                      <nz-option
                        [nzValue]="provider"
                        [nzLabel]="'corporateConventions.provider.' + provider | translate"
                      ></nz-option>
                    }
                  </nz-select>
                </label>
                <label class="field" for="ccv-s-batch">
                  <span>{{ 'corporateConventions.field.batchReference' | translate }}</span>
                  <input
                    nz-input
                    id="ccv-s-batch"
                    [ngModel]="batchReference()"
                    (ngModelChange)="batchReference.set($event)"
                    maxlength="80"
                  />
                </label>
                <label class="field" for="ccv-s-self">
                  <span>{{ 'corporateConventions.field.selfInvoice' | translate }}</span>
                  <input
                    nz-input
                    id="ccv-s-self"
                    [ngModel]="selfInvoice()"
                    (ngModelChange)="selfInvoice.set($event)"
                    maxlength="80"
                  />
                </label>
              </div>
              <div class="actions">
                <button
                  nz-button
                  type="button"
                  [disabled]="
                    selected().length === 0 ||
                    batchReference().trim() === '' ||
                    settlementProvider() === null ||
                    store.working()
                  "
                  (click)="submitBatch()"
                >
                  {{ 'corporateConventions.action.submitBatch' | translate }} ({{
                    selected().length
                  }})
                </button>
              </div>
              <label class="field" for="ccv-s-statement">
                <span>{{ 'corporateConventions.field.statement' | translate }}</span>
                <textarea
                  nz-input
                  id="ccv-s-statement"
                  rows="6"
                  [ngModel]="statement()"
                  (ngModelChange)="statement.set($event)"
                  [placeholder]="'corporateConventions.placeholder.statement' | translate"
                ></textarea>
              </label>
              @if (parsedStatement().invalid.length > 0) {
                <small class="error"
                  >{{ 'corporateConventions.hint.invalidStatementLines' | translate }}:
                  {{ parsedStatement().invalid.join(', ') }}</small
                >
              }
              <div class="actions">
                <button
                  nz-button
                  nzType="primary"
                  type="button"
                  [disabled]="!canReconcile() || store.working()"
                  (click)="reconcile()"
                >
                  {{ 'corporateConventions.action.reconcile' | translate }} ({{
                    parsedStatement().lines.length
                  }})
                </button>
              </div>
              @if (store.lastReconciliation(); as result) {
                <nz-alert
                  [nzType]="result.rejected > 0 ? 'warning' : 'success'"
                  nzShowIcon
                  [nzMessage]="
                    'corporateConventions.label.reconciliationResult'
                      | translate: { reconciled: result.reconciled, rejected: result.rejected }
                  "
                  [nzDescription]="result.total_settled + ' / ' + result.total_expected"
                ></nz-alert>
                @if (result.discrepancies.length > 0) {
                  <nz-table
                    nzSize="small"
                    [nzData]="result.discrepancies"
                    [nzShowPagination]="false"
                  >
                    <thead>
                      <tr>
                        <th>{{ 'corporateConventions.column.voucher' | translate }}</th>
                        <th>{{ 'corporateConventions.column.expected' | translate }}</th>
                        <th>{{ 'corporateConventions.column.settled' | translate }}</th>
                        <th>{{ 'corporateConventions.column.difference' | translate }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of result.discrepancies; track row.redemption_id) {
                        <tr>
                          <td class="mono">{{ row.voucher_code_masked }}</td>
                          <td>{{ row.expected }}</td>
                          <td>{{ row.settled }}</td>
                          <td class="negative-text">{{ row.difference }}</td>
                        </tr>
                      }
                    </tbody>
                  </nz-table>
                }
              }
            </section>
          }
        </nz-tab>
      </nz-tabs>
    </nz-spin>
  `,
})
export class BillingReconciliationComponent implements OnInit {
  protected readonly store = inject(ReconciliationStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canBill = this.permissions.canWrite(CORPORATE_CONVENTIONS_FINANCE_MODULE);
  protected readonly providers = CCV_WELFARE_PROVIDERS;
  protected readonly jurisdictions = CCV_WELFARE_JURISDICTIONS;
  protected readonly statuses = CCV_REIMBURSEMENT_STATUSES;

  protected readonly feedback = signal<CcvOutcome | null>(null);
  protected readonly month = signal(previousMonth());
  protected readonly anonymize = signal<AnonymizeChoice>('default');
  protected readonly selectedConvention = signal<string | null>(null);

  protected readonly selected = signal<string[]>([]);
  protected readonly settlementProvider = signal<CcvWelfareProvider | null>(null);
  protected readonly batchReference = signal('');
  protected readonly selfInvoice = signal('');
  protected readonly statement = signal('');

  protected readonly monthDate = computed(() => {
    const [year, month] = this.month().split('-').map(Number);
    return new Date(year, month - 1, 1);
  });
  protected readonly parsedStatement = computed(() => parseStatement(this.statement()));
  protected readonly canReconcile = computed(
    () =>
      this.canBill &&
      this.settlementProvider() !== null &&
      this.batchReference().trim() !== '' &&
      this.parsedStatement().lines.length > 0 &&
      this.parsedStatement().invalid.length === 0,
  );

  protected readonly reimbursementColor = reimbursementStatusColor;

  ngOnInit(): void {
    void this.store.init();
  }

  protected onMonth(date: Date | null): void {
    if (date !== null) {
      this.month.set(`${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}`);
      this.store.clearPreview();
    }
  }

  private anonymizeFlag(): boolean | null {
    const choice = this.anonymize();
    return choice === 'default' ? null : choice === 'anonymized';
  }

  protected async preview(row: CcvPendingQuota): Promise<void> {
    this.selectedConvention.set(row.convention_id);
    const outcome = await this.store.previewConsolidation({
      convention_id: row.convention_id,
      period: this.month(),
      anonymize: this.anonymizeFlag(),
    });
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async generate(conventionId: string): Promise<void> {
    const outcome = await this.store.generateInvoice({
      convention_id: conventionId,
      period: this.month(),
      anonymize: this.anonymizeFlag(),
    });
    if (outcome.ok) {
      this.feedback.set(null);
      this.message.success(this.i18n.instant('corporateConventions.notification.invoiceCreated'));
    } else {
      this.feedback.set(outcome);
    }
  }

  protected async downloadSchedule(invoiceId: string): Promise<void> {
    const outcome = await this.store.downloadSchedule(invoiceId);
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected isSelected(voucher: CcvWelfareRedemption): boolean {
    return this.selected().includes(voucher.id);
  }

  protected toggle(voucher: CcvWelfareRedemption): void {
    this.selected.update((ids) =>
      ids.includes(voucher.id) ? ids.filter((id) => id !== voucher.id) : [...ids, voucher.id],
    );
    this.settlementProvider.set(voucher.provider);
  }

  protected async submitBatch(): Promise<void> {
    const provider = this.settlementProvider();
    if (provider === null) {
      return;
    }
    const outcome = await this.store.submitBatch(
      provider,
      this.batchReference().trim(),
      this.selected(),
    );
    if (outcome.ok) {
      this.feedback.set(null);
      this.selected.set([]);
      this.message.success(this.i18n.instant('corporateConventions.notification.batchSubmitted'));
    } else {
      this.feedback.set(outcome);
    }
  }

  protected async reconcile(): Promise<void> {
    const provider = this.settlementProvider();
    if (provider === null) {
      return;
    }
    const outcome = await this.store.reconcile({
      provider,
      batch_reference: this.batchReference().trim(),
      self_invoice_number: this.selfInvoice().trim() === '' ? null : this.selfInvoice().trim(),
      lines: this.parsedStatement().lines,
    });
    if (outcome.ok) {
      this.feedback.set(null);
      this.statement.set('');
      this.message.success(this.i18n.instant('corporateConventions.notification.reconciled'));
    } else {
      this.feedback.set(outcome);
    }
  }
}
