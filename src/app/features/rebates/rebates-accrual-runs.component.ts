import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ChartOfAccount, RebateAccrualRun, RebateAgreement, RebatesApiService, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { apiErrorText, canReverseRun, journalPreview, RUN_STATUS_COLORS, todayIso } from './rebates.util';

/** Accrual runs of a supplier agreement: run for a period, reverse, the journal it books and the invoices behind it. */
@Component({
  selector: 'app-rebates-accrual-runs',
  styleUrl: './rebates.scss',
  imports: [DecimalPipe, FormsModule, TranslatePipe, NzButtonModule, NzCardModule, NzDrawerModule, NzEmptyModule, NzInputModule, NzModalModule, NzTableModule, NzTagModule],
  template: `
    <nz-card class="main-card" [nzTitle]="'SUPPLIER_REBATES.ACCRUAL_RUNS' | translate">
      @if (agreement().status === 'active') {
        <div class="toolbar">
          <input nz-input style="width: 180px" type="date" [ngModel]="periodEnd()" (ngModelChange)="periodEnd.set($event)" [attr.aria-label]="'SUPPLIER_REBATES.PERIOD_END' | translate" />
          <button nz-button nzType="primary" type="button" [disabled]="!periodEnd() || running()" (click)="run()">{{ 'SUPPLIER_REBATES.RUN_ACCRUAL' | translate }}</button>
        </div>
      }

      <nz-table #runTable [nzData]="runs()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'SUPPLIER_REBATES.PERIOD' | translate }}</th>
            <th class="num">{{ 'SUPPLIER_REBATES.BASE_AMOUNT' | translate }}</th>
            <th class="num">{{ 'SUPPLIER_REBATES.CUMULATIVE' | translate }}</th>
            <th class="num">{{ 'SUPPLIER_REBATES.DELTA' | translate }}</th>
            <th>{{ 'REBATES.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of runTable.data; track row.id) {
            <tr>
              <td>{{ row.period_start }} - {{ row.period_end }}</td>
              <td class="num">{{ row.base_amount | number: '1.2-2' }}</td>
              <td class="num">{{ row.cumulative_rebate | number: '1.2-2' }}</td>
              <td class="num">{{ row.delta_amount | number: '1.2-2' }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">{{ (row.status === 'posted' ? 'SUPPLIER_REBATES.RUN_POSTED' : 'SUPPLIER_REBATES.RUN_REVERSED') | translate }}</nz-tag>
              </td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" type="button" (click)="detail.set(row)">{{ 'SUPPLIER_REBATES.CONTRIBUTING_INVOICES' | translate }}</button>
                  @if (canReverse(row) && agreement().status === 'active') {
                    <button nz-button nzType="text" nzDanger type="button" (click)="openReverse(row)">{{ 'SUPPLIER_REBATES.REVERSE_RUN' | translate }}</button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (runs().length === 0) {
        <nz-empty [nzNotFoundContent]="'SUPPLIER_REBATES.EMPTY' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [nzVisible]="reverseTarget() !== null" [nzTitle]="'SUPPLIER_REBATES.REVERSE_RUN' | translate" [nzOkText]="'SUPPLIER_REBATES.REVERSE_RUN' | translate" [nzCancelText]="'SUPPLIER_REBATES.CANCEL' | translate" [nzOkDisabled]="reason().trim() === ''" (nzOnCancel)="reverseTarget.set(null)" (nzOnOk)="reverse()">
      <ng-container *nzModalContent>
        <label for="run-reason">{{ 'SUPPLIER_REBATES.REVERSE_REASON' | translate }}</label>
        <textarea nz-input id="run-reason" rows="3" maxlength="200" [ngModel]="reason()" (ngModelChange)="reason.set($event)"></textarea>
      </ng-container>
    </nz-modal>

    <nz-drawer [nzVisible]="detail() !== null" nzPlacement="right" [nzWidth]="560" [nzTitle]="'SUPPLIER_REBATES.CONTRIBUTING_INVOICES' | translate" (nzOnClose)="detail.set(null)">
      <ng-container *nzDrawerContent>
        @if (detail(); as run) {
          @let journal = journalOf(run);
          <h4>{{ 'SUPPLIER_REBATES.JOURNAL_PREVIEW' | translate }}</h4>
          <div class="journal-preview">
            @for (line of journal.lines; track line.side) {
              <span>{{ (line.side === 'debit' ? 'SUPPLIER_REBATES.DEBIT_ACCRUED_INCOME' : 'SUPPLIER_REBATES.CREDIT_SUPPLIER_INCOME') | translate }}</span>
              <span>{{ accountLabel(line.accountId) }}</span>
              <span class="num">{{ line.amount | number: '1.2-2' }}</span>
            }
          </div>
          @if (!journal.posted) {
            <p class="muted">{{ 'SUPPLIER_REBATES.NOT_POSTED' | translate }}</p>
          }

          <nz-table [nzData]="run.lines ?? []" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'SUPPLIER_REBATES.INVOICE' | translate }}</th>
                <th>{{ 'SUPPLIER_REBATES.INVOICE_DATE' | translate }}</th>
                <th class="num">{{ 'SUPPLIER_REBATES.NET_AMOUNT' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (line of run.lines ?? []; track line.passive_invoice_id) {
                <tr>
                  <td>{{ line.invoice_number }}</td>
                  <td>{{ line.invoice_date }}</td>
                  <td class="num">{{ line.net_amount | number: '1.2-2' }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class RebatesAccrualRunsComponent implements OnInit {
  private readonly api = inject(RebatesApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly agreement = input.required<RebateAgreement>();
  readonly accounts = input<ChartOfAccount[]>([]);
  /** Emitted after a run or a reversal so the cockpit refreshes the progress and the accruals. */
  readonly changed = output<void>();

  readonly runs = signal<RebateAccrualRun[]>([]);
  readonly periodEnd = signal(todayIso());
  readonly running = signal(false);
  readonly reverseTarget = signal<RebateAccrualRun | null>(null);
  readonly reason = signal('');
  readonly detail = signal<RebateAccrualRun | null>(null);

  private readonly accountNames = computed(() => new Map(this.accounts().map((account) => [account.id, `${account.account_code} - ${account.name}`])));

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getAccrualRuns(this.agreement().id).subscribe({
      next: (response) => this.runs.set(response.data),
      error: (error: unknown) => this.fail(error),
    });
  }

  statusColor(status: string): string {
    return RUN_STATUS_COLORS[status] ?? 'default';
  }

  canReverse(run: RebateAccrualRun): boolean {
    return canReverseRun(run);
  }

  journalOf(run: RebateAccrualRun) {
    return journalPreview(this.agreement(), run);
  }

  accountLabel(id: string | null): string {
    return id === null ? '-' : (this.accountNames().get(id) ?? id);
  }

  run(): void {
    this.running.set(true);
    this.api.createAccrualRun(this.agreement().id, { period_end: this.periodEnd() }).subscribe({
      next: () => {
        this.running.set(false);
        this.message.success(this.translate.instant('SUPPLIER_REBATES.RUN_POSTED'));
        this.load();
        this.changed.emit();
      },
      error: (error: unknown) => {
        this.running.set(false);
        this.fail(error);
      },
    });
  }

  openReverse(run: RebateAccrualRun): void {
    this.reason.set('');
    this.reverseTarget.set(run);
  }

  reverse(): void {
    const target = this.reverseTarget();
    const reason = this.reason().trim();
    if (!target || reason === '') {
      return;
    }

    this.api.reverseAccrualRun(target.id, reason).subscribe({
      next: () => {
        this.reverseTarget.set(null);
        this.message.success(this.translate.instant('SUPPLIER_REBATES.RUN_REVERSED'));
        this.load();
        this.changed.emit();
      },
      error: (error: unknown) => this.fail(error),
    });
  }

  private fail(error: unknown): void {
    this.message.error(apiErrorText(error) ?? this.translate.instant('SUPPLIER_REBATES.SAVE_ERROR'));
  }
}
