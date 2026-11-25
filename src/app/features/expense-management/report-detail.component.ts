import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import {
  EXM_PAYOUT_CHANNELS,
  ExmLine,
  ExmLinePayload,
  ExmMileagePayload,
  ExmPayout,
  ExmPayoutChannel,
  ExmPerDiemPayload,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { ExmOutcome, isPositive, saveBlob, statusColor } from './expense-management.util';
import { FiscalNoticesComponent } from './fiscal-notices.component';
import { LineFormComponent } from './line-form.component';
import { MileageFormComponent } from './mileage-form.component';
import { PerDiemFormComponent } from './per-diem-form.component';
import { ReportDetailStore } from './report-detail.store';
import { ViolationBadgesComponent } from './violation-badges.component';

type Panel = 'line' | 'mileage' | 'perDiem' | null;
type Dialog = 'approve' | 'reject' | 'payout' | null;

/**
 * Expense report editor (Mod 075): lines with their violation badges, mileage claims, per diems, totals, the audit trail
 * and every action of the workflow (submit, approve, reject, payout, confirm reimbursement, cancel).
 */
@Component({
  selector: 'app-exm-report-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FiscalNoticesComponent,
    FormsModule,
    LineFormComponent,
    MileageFormComponent,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    NzTimelineModule,
    PageHeaderComponent,
    PerDiemFormComponent,
    RouterLink,
    TranslatePipe,
    ViolationBadgesComponent,
  ],
  providers: [ReportDetailStore],
  template: `
    <app-page-header [title]="'PAGE_TITLE.EXPENSE_MANAGEMENT_REPORT' | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (actionError(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.report(); as report) {
        <header class="head">
          <div>
            <h2>
              {{ report.report_number }}
              <nz-tag [nzColor]="color(report.status)">{{
                'expenseManagement.status.' + report.status | translate
              }}</nz-tag>
            </h2>
            <p class="muted">
              {{ report.employee?.name }} · {{ report.period_start }} – {{ report.period_end }}
              @if (report.title) {
                · {{ report.title }}
              }
            </p>
          </div>
          <div class="actions">
            <a nz-button routerLink="/expense-management">{{
              'expenseManagement.action.back' | translate
            }}</a>
            @if (store.canSubmit()) {
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="store.busy()"
                (click)="run(store.submit(), 'submitted')"
              >
                {{ 'expenseManagement.action.submit' | translate }}
              </button>
            }
            @if (store.canDecide()) {
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="store.busy()"
                (click)="openDialog('approve')"
              >
                {{ 'expenseManagement.action.approve' | translate }}
              </button>
              <button
                nz-button
                nzDanger
                type="button"
                [disabled]="store.busy()"
                (click)="openDialog('reject')"
              >
                {{ 'expenseManagement.action.reject' | translate }}
              </button>
            }
            @if (store.canExport()) {
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="store.busy()"
                (click)="openDialog('payout')"
              >
                {{ 'expenseManagement.action.exportPayout' | translate }}
              </button>
            }
            @if (store.canConfirmReimbursement()) {
              <button
                nz-button
                type="button"
                [disabled]="store.busy()"
                (click)="run(store.confirmReimbursement(), 'reimbursed')"
              >
                {{ 'expenseManagement.action.confirmReimbursement' | translate }}
              </button>
            }
            @if (store.canCancel()) {
              <button
                nz-button
                nzDanger
                type="button"
                [disabled]="store.busy()"
                (click)="run(store.cancel(), 'cancelled')"
              >
                {{ 'expenseManagement.action.cancelReport' | translate }}
              </button>
            }
          </div>
        </header>

        @if (report.rejection_reason) {
          <nz-alert
            class="feedback"
            nzType="warning"
            nzShowIcon
            [nzMessage]="'expenseManagement.field.rejectionReason' | translate"
            [nzDescription]="report.rejection_reason"
          ></nz-alert>
        }
        @if (report.blocking_violations_count > 0) {
          <nz-alert
            class="feedback"
            nzType="error"
            nzShowIcon
            [nzMessage]="'expenseManagement.error.blocking_violations' | translate"
          ></nz-alert>
        }

        <section class="stats" [attr.aria-label]="'expenseManagement.field.total' | translate">
          <nz-statistic
            [nzTitle]="'expenseManagement.field.total' | translate"
            [nzValue]="report.total_amount | money: report.currency"
          ></nz-statistic>
          <nz-statistic
            [nzTitle]="'expenseManagement.field.reimbursable' | translate"
            [nzValue]="report.reimbursable_amount | money: report.currency"
          ></nz-statistic>
          <nz-statistic
            [nzTitle]="'expenseManagement.field.nonReimbursable' | translate"
            [nzValue]="report.non_reimbursable_amount | money: report.currency"
          ></nz-statistic>
          <nz-statistic
            [nzTitle]="'expenseManagement.field.taxable' | translate"
            [nzValue]="report.taxable_amount | money: report.currency"
          ></nz-statistic>
          @if (report.approved_amount !== null) {
            <nz-statistic
              [nzTitle]="'expenseManagement.field.approved' | translate"
              [nzValue]="report.approved_amount | money: report.currency"
            ></nz-statistic>
          }
        </section>

        <app-exm-fiscal-notices
          [jurisdiction]="store.jurisdiction()"
          [noticeCodes]="store.fiscalNoticeCodes()"
        ></app-exm-fiscal-notices>

        <section>
          <div class="section-head">
            <h3>{{ 'expenseManagement.section.lines' | translate }}</h3>
            @if (store.editable()) {
              <div class="actions">
                <a
                  nz-button
                  [routerLink]="['/expense-management/workbench']"
                  [queryParams]="{ report: report.id }"
                >
                  {{ 'expenseManagement.action.scanReceipt' | translate }}
                </a>
                <button nz-button type="button" (click)="openPanel('line')">
                  {{ 'expenseManagement.action.addLine' | translate }}
                </button>
                <button nz-button type="button" (click)="openPanel('mileage')">
                  {{ 'expenseManagement.action.addMileage' | translate }}
                </button>
                <button nz-button type="button" (click)="openPanel('perDiem')">
                  {{ 'expenseManagement.action.addPerDiem' | translate }}
                </button>
              </div>
            }
          </div>
          <nz-table #lines nzSize="small" [nzData]="store.lines()" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col">{{ 'expenseManagement.field.expenseDate' | translate }}</th>
                <th scope="col">{{ 'expenseManagement.field.category' | translate }}</th>
                <th scope="col">{{ 'expenseManagement.field.merchant' | translate }}</th>
                <th scope="col">{{ 'expenseManagement.field.paymentMethod' | translate }}</th>
                <th scope="col" class="num">{{ 'expenseManagement.field.amount' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'expenseManagement.field.amountBase' | translate }}
                </th>
                <th scope="col">{{ 'expenseManagement.field.violations' | translate }}</th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              @for (line of lines.data; track line.id) {
                <tr>
                  <td>{{ line.expense_date }}</td>
                  <td>
                    @if (line.category) {
                      {{ 'expenseManagement.category.' + line.category.code | translate }}
                    }
                  </td>
                  <td>
                    {{ line.merchant_name }}
                    @if (line.mileage) {
                      <small class="muted">
                        {{ line.mileage.origin_address }} → {{ line.mileage.destination_address }} ·
                        {{ line.mileage.distance_km }} km
                      </small>
                    }
                  </td>
                  <td>
                    {{ 'expenseManagement.paymentMethod.' + line.payment_method | translate }}
                    @if (!line.is_traceable_payment) {
                      <nz-tag nzColor="orange">{{
                        'expenseManagement.field.cash' | translate
                      }}</nz-tag>
                    }
                    @if (line.is_taxable_benefit) {
                      <nz-tag nzColor="volcano">{{
                        'expenseManagement.field.taxable' | translate
                      }}</nz-tag>
                    }
                  </td>
                  <td class="num">{{ line.original_amount | money: line.original_currency }}</td>
                  <td class="num">{{ line.amount_in_base_currency | money: report.currency }}</td>
                  <td>
                    <app-exm-violation-badges
                      [violations]="line.policy_violations"
                    ></app-exm-violation-badges>
                  </td>
                  <td class="row-actions">
                    @if (store.editable()) {
                      @if (!line.mileage) {
                        <button nz-button nzSize="small" type="button" (click)="editLine(line)">
                          {{ 'expenseManagement.action.edit' | translate }}
                        </button>
                      }
                      <button
                        nz-button
                        nzSize="small"
                        nzDanger
                        type="button"
                        (click)="removeLine(line)"
                      >
                        {{ 'expenseManagement.action.remove' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8">
                    <nz-empty
                      [nzNotFoundContent]="'expenseManagement.empty.lines' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </section>

        <section>
          <h3>{{ 'expenseManagement.section.perDiems' | translate }}</h3>
          <nz-table #perDiems nzSize="small" [nzData]="report.per_diems" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col">{{ 'expenseManagement.field.destinationType' | translate }}</th>
                <th scope="col">{{ 'expenseManagement.field.allowanceMethod' | translate }}</th>
                <th scope="col">{{ 'expenseManagement.field.period' | translate }}</th>
                <th scope="col" class="num">{{ 'expenseManagement.perDiem.days' | translate }}</th>
                <th scope="col" class="num">{{ 'expenseManagement.perDiem.gross' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'expenseManagement.perDiem.taxFree' | translate }}
                </th>
                <th scope="col" class="num">
                  {{ 'expenseManagement.perDiem.taxableExcess' | translate }}
                </th>
                <th scope="col"></th>
              </tr>
            </thead>
            <tbody>
              @for (item of perDiems.data; track item.id) {
                <tr>
                  <td>
                    {{ item.country_code }} ·
                    {{ 'expenseManagement.destinationType.' + item.destination_type | translate }}
                  </td>
                  <td>
                    {{ 'expenseManagement.allowanceMethod.' + item.allowance_method | translate }}
                  </td>
                  <td>{{ item.trip_start_at }} – {{ item.trip_end_at }}</td>
                  <td class="num">{{ item.days_count }}</td>
                  <td class="num">{{ item.gross_allowance_amount | money: report.currency }}</td>
                  <td class="num">{{ item.tax_free_amount | money: report.currency }}</td>
                  <td class="num">
                    @if (positive(item.taxable_excess_amount)) {
                      <nz-tag nzColor="volcano">{{
                        item.taxable_excess_amount | money: report.currency
                      }}</nz-tag>
                    } @else {
                      {{ item.taxable_excess_amount | money: report.currency }}
                    }
                  </td>
                  <td>
                    @if (store.editable() && item.id) {
                      <button
                        nz-button
                        nzSize="small"
                        nzDanger
                        type="button"
                        (click)="removePerDiem(item.id)"
                      >
                        {{ 'expenseManagement.action.remove' | translate }}
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8">
                    <nz-empty
                      [nzNotFoundContent]="'expenseManagement.empty.perDiems' | translate"
                    ></nz-empty>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        </section>

        @if (report.payouts.length > 0) {
          <section>
            <h3>{{ 'expenseManagement.section.payouts' | translate }}</h3>
            <nz-table #payouts nzSize="small" [nzData]="report.payouts" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th scope="col">{{ 'expenseManagement.field.channel' | translate }}</th>
                  <th scope="col" class="num">{{ 'expenseManagement.field.total' | translate }}</th>
                  <th scope="col" class="num">
                    {{ 'expenseManagement.field.taxable' | translate }}
                  </th>
                  <th scope="col" class="num">
                    {{ 'expenseManagement.field.exempt' | translate }}
                  </th>
                  <th scope="col"></th>
                </tr>
              </thead>
              <tbody>
                @for (payout of payouts.data; track payout.id) {
                  <tr>
                    <td>{{ 'expenseManagement.channel.' + payout.channel | translate }}</td>
                    <td class="num">{{ payout.total_amount | money: report.currency }}</td>
                    <td class="num">{{ payout.taxable_amount | money: report.currency }}</td>
                    <td class="num">{{ payout.exempt_amount | money: report.currency }}</td>
                    <td>
                      @if (payout.file_name) {
                        <button nz-button nzSize="small" type="button" (click)="download(payout)">
                          {{ 'expenseManagement.action.download' | translate }}
                        </button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </section>
        }

        <section>
          <h3>{{ 'expenseManagement.section.audit' | translate }}</h3>
          <nz-timeline>
            @for (entry of report.audit; track entry.id) {
              <nz-timeline-item>
                <strong>{{ 'expenseManagement.audit.' + entry.action | translate }}</strong>
                <small class="muted"
                  >{{ entry.created_at
                  }}{{ entry.actor_name ? ' · ' + entry.actor_name : '' }}</small
                >
              </nz-timeline-item>
            }
          </nz-timeline>
        </section>
      }
    </nz-spin>

    <nz-drawer
      [nzVisible]="panel() === 'line'"
      [nzTitle]="'expenseManagement.section.line' | translate"
      nzWidth="480"
      (nzOnClose)="closePanel()"
    >
      <ng-container *nzDrawerContent>
        <app-exm-line-form
          [categories]="store.categories()"
          [currency]="store.report()?.currency ?? 'EUR'"
          [jurisdiction]="store.jurisdiction()"
          [line]="editing()"
          [saving]="store.busy()"
          [errorKey]="panelError()"
          (saved)="saveLine($event)"
          (cancelled)="closePanel()"
        ></app-exm-line-form>
      </ng-container>
    </nz-drawer>

    <nz-drawer
      [nzVisible]="panel() === 'mileage'"
      [nzTitle]="'expenseManagement.section.mileage' | translate"
      nzWidth="480"
      (nzOnClose)="closePanel()"
    >
      <ng-container *nzDrawerContent>
        <app-exm-mileage-form
          [jurisdiction]="store.jurisdiction()"
          [saving]="store.busy()"
          [errorKey]="panelError()"
          (saved)="saveMileage($event)"
          (cancelled)="closePanel()"
        ></app-exm-mileage-form>
      </ng-container>
    </nz-drawer>

    <nz-drawer
      [nzVisible]="panel() === 'perDiem'"
      [nzTitle]="'expenseManagement.section.perDiem' | translate"
      nzWidth="480"
      (nzOnClose)="closePanel()"
    >
      <ng-container *nzDrawerContent>
        <app-exm-per-diem-form
          [jurisdiction]="store.jurisdiction()"
          [currency]="store.report()?.currency ?? 'EUR'"
          [saving]="store.busy()"
          [errorKey]="panelError()"
          (saved)="savePerDiem($event)"
          (cancelled)="closePanel()"
        ></app-exm-per-diem-form>
      </ng-container>
    </nz-drawer>

    <nz-modal
      [nzVisible]="dialog() === 'approve'"
      [nzTitle]="'expenseManagement.action.approve' | translate"
      [nzOkText]="'expenseManagement.action.approve' | translate"
      [nzCancelText]="'expenseManagement.action.cancel' | translate"
      [nzOkLoading]="store.busy()"
      (nzOnOk)="approve()"
      (nzOnCancel)="dialog.set(null)"
    >
      <ng-container *nzModalContent>
        <label for="exm-approve-amount">{{
          'expenseManagement.field.approvedAmount' | translate
        }}</label>
        <input
          nz-input
          id="exm-approve-amount"
          type="number"
          step="0.01"
          min="0"
          [ngModel]="approvedAmount()"
          (ngModelChange)="approvedAmount.set($event)"
        />
        <label for="exm-approve-comment">{{ 'expenseManagement.field.comment' | translate }}</label>
        <textarea
          nz-input
          id="exm-approve-comment"
          rows="3"
          [ngModel]="comment()"
          (ngModelChange)="comment.set($event)"
        ></textarea>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="dialog() === 'reject'"
      [nzTitle]="'expenseManagement.action.reject' | translate"
      [nzOkText]="'expenseManagement.action.reject' | translate"
      [nzCancelText]="'expenseManagement.action.cancel' | translate"
      [nzOkLoading]="store.busy()"
      [nzOkDisabled]="reason().trim() === ''"
      [nzOkDanger]="true"
      (nzOnOk)="reject()"
      (nzOnCancel)="dialog.set(null)"
    >
      <ng-container *nzModalContent>
        <label for="exm-reject-reason">{{
          'expenseManagement.field.rejectionReason' | translate
        }}</label>
        <textarea
          nz-input
          id="exm-reject-reason"
          rows="4"
          [ngModel]="reason()"
          (ngModelChange)="reason.set($event)"
        ></textarea>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="dialog() === 'payout'"
      [nzTitle]="'expenseManagement.action.exportPayout' | translate"
      [nzOkText]="'expenseManagement.action.exportPayout' | translate"
      [nzCancelText]="'expenseManagement.action.cancel' | translate"
      [nzOkLoading]="store.busy()"
      (nzOnOk)="exportPayout()"
      (nzOnCancel)="dialog.set(null)"
    >
      <ng-container *nzModalContent>
        <label for="exm-payout-channel">{{ 'expenseManagement.field.channel' | translate }}</label>
        <nz-select
          nzId="exm-payout-channel"
          [ngModel]="channel()"
          (ngModelChange)="channel.set($event)"
        >
          @for (item of channels; track item) {
            <nz-option
              [nzValue]="item"
              [nzLabel]="'expenseManagement.channel.' + item | translate"
            ></nz-option>
          }
        </nz-select>
        @if (channel() === 'pain001') {
          <label for="exm-payout-date">{{
            'expenseManagement.field.executionDate' | translate
          }}</label>
          <input
            nz-input
            id="exm-payout-date"
            type="date"
            [ngModel]="executionDate()"
            (ngModelChange)="executionDate.set($event)"
          />
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .head,
    .section-head {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .actions,
    .row-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 32px;
      margin-bottom: 16px;
    }
    .feedback {
      margin-bottom: 12px;
    }
    .num {
      text-align: right;
    }
    .muted {
      display: block;
      opacity: 0.65;
    }
    section {
      margin-bottom: 24px;
    }
  `,
})
export class ReportDetailComponent implements OnInit {
  protected readonly store = inject(ReportDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly channels: readonly ExmPayoutChannel[] = EXM_PAYOUT_CHANNELS;

  protected readonly panel = signal<Panel>(null);
  protected readonly editing = signal<ExmLine | null>(null);
  protected readonly panelError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly dialog = signal<Dialog>(null);
  protected readonly approvedAmount = signal<string>('');
  protected readonly comment = signal('');
  protected readonly reason = signal('');
  protected readonly channel = signal<ExmPayoutChannel>('pain001');
  protected readonly executionDate = signal('');

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      void this.store.load(id);
    } else {
      void this.router.navigate(['/expense-management']);
    }
  }

  protected color = statusColor;
  protected positive = isPositive;

  protected openPanel(panel: Exclude<Panel, null>): void {
    this.panelError.set(null);
    this.editing.set(null);
    this.panel.set(panel);
  }

  protected editLine(line: ExmLine): void {
    this.panelError.set(null);
    this.editing.set(line);
    this.panel.set('line');
  }

  protected closePanel(): void {
    this.panel.set(null);
    this.editing.set(null);
  }

  protected openDialog(dialog: Exclude<Dialog, null>): void {
    this.actionError.set(null);
    this.dialog.set(dialog);
  }

  /** Runs a store write, shows the refusal or the confirmation. */
  protected async run(pending: Promise<ExmOutcome>, done: string): Promise<boolean> {
    const outcome = await pending;
    if (outcome.ok) {
      this.actionError.set(null);
      this.message.success(this.i18n.instant(`expenseManagement.message.${done}`));
    } else {
      this.actionError.set(outcome.errorKey);
    }
    return outcome.ok;
  }

  protected async saveLine(payload: ExmLinePayload): Promise<void> {
    const outcome = await this.store.saveLine(payload, this.editing()?.id);
    this.finishPanel(outcome);
  }

  protected async saveMileage(payload: ExmMileagePayload): Promise<void> {
    this.finishPanel(await this.store.addMileage(payload));
  }

  protected async savePerDiem(payload: ExmPerDiemPayload): Promise<void> {
    this.finishPanel(await this.store.addPerDiem(payload));
  }

  protected removeLine(line: ExmLine): void {
    void this.run(this.store.removeLine(line.id), 'lineRemoved');
  }

  protected removePerDiem(id: string): void {
    void this.run(this.store.removePerDiem(id), 'perDiemRemoved');
  }

  protected async approve(): Promise<void> {
    const amount = this.approvedAmount().trim();
    const ok = await this.run(
      this.store.approve({
        approved_amount: amount === '' ? null : amount,
        comment: this.comment() || null,
      }),
      'approved',
    );
    if (ok) {
      this.dialog.set(null);
    }
  }

  protected async reject(): Promise<void> {
    if (await this.run(this.store.reject(this.reason().trim()), 'rejected')) {
      this.dialog.set(null);
      this.reason.set('');
    }
  }

  protected async exportPayout(): Promise<void> {
    if (
      await this.run(
        this.store.exportPayout(this.channel(), this.executionDate()),
        'payoutExported',
      )
    ) {
      this.dialog.set(null);
    }
  }

  protected async download(payout: ExmPayout): Promise<void> {
    const file = await this.store.downloadPayout(payout);
    if (file) {
      saveBlob(file.blob, file.fileName);
    }
  }

  private finishPanel(outcome: ExmOutcome): void {
    if (outcome.ok) {
      this.closePanel();
      this.message.success(this.i18n.instant('expenseManagement.message.saved'));
    } else {
      this.panelError.set(outcome.errorKey);
    }
  }
}
