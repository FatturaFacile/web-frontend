import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { ProjectBillingApiService } from './project-billing-api.service';
import { SalCertificate, SalStatus } from './project-billing.models';
import { SAL_STATUS_COLORS, SAL_STATUS_KEYS } from './project-billing.utils';

/**
 * SAL progress certificates of a project (Mod 081): cumulative against incremental progress, advance deduction,
 * guarantee retention withheld and net billable amount, with the submit, approve-and-invoice and cancel workflow.
 */
@Component({
  selector: 'app-sal-certificates',
  imports: [
    FormsModule,
    MoneyPipe,
    NzButtonModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    @if (sals().length === 0) {
      <nz-empty
        data-testid="sal-empty"
        [nzNotFoundContent]="'PROJECT_BILLING.SAL_NONE' | translate"
      />
    } @else {
      <nz-table
        #table
        nzSize="small"
        [nzData]="sals()"
        [nzShowPagination]="false"
        data-testid="sal-table"
      >
        <thead>
          <tr>
            <th>{{ 'PROJECT_BILLING.COL_SAL' | translate }}</th>
            <th>{{ 'PROJECT_BILLING.COL_PERIOD' | translate }}</th>
            <th class="bf-num">{{ 'PROJECT_BILLING.COL_PROGRESS' | translate }}</th>
            <th class="bf-num">{{ 'PROJECT_BILLING.SAL_CURRENT_GROSS' | translate }}</th>
            <th class="bf-num">{{ 'PROJECT_BILLING.SAL_ADVANCE' | translate }}</th>
            <th class="bf-num">{{ 'PROJECT_BILLING.SAL_RETENTION' | translate }}</th>
            <th class="bf-num">{{ 'PROJECT_BILLING.SAL_NET' | translate }}</th>
            <th>{{ 'PROJECT_BILLING.COL_STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (sal of table.data; track sal.id) {
            <tr [attr.data-testid]="'sal-row-' + sal.sal_number">
              <td>
                {{ sal.sal_number }}
                @if (sal.is_final) {
                  <nz-tag nzColor="purple">{{ 'PROJECT_BILLING.SAL_FINAL' | translate }}</nz-tag>
                }
              </td>
              <td>{{ sal.period_start_date }} → {{ sal.period_end_date }}</td>
              <td class="bf-num">
                {{ sal.previous_completion_percent }}% → {{ sal.cumulative_completion_percent }}%
              </td>
              <td class="bf-num">{{ sal.current_period_gross_sal | money: currency() }}</td>
              <td class="bf-num">{{ sal.advance_deduction_amount | money: currency() }}</td>
              <td class="bf-num">{{ sal.guarantee_retention_withheld | money: currency() }}</td>
              <td class="bf-num">{{ sal.net_billable_amount | money: currency() }}</td>
              <td>
                <nz-tag [nzColor]="color(sal.status)">{{
                  statusKey(sal.status) | translate
                }}</nz-tag>
              </td>
              <td>
                @if (canWrite()) {
                  @if (sal.status === 'draft') {
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      [attr.data-testid]="'sal-submit-' + sal.sal_number"
                      (click)="submit(sal)"
                    >
                      {{ 'PROJECT_BILLING.SAL_SUBMIT' | translate }}
                    </button>
                  }
                  @if (
                    sal.status === 'draft' ||
                    sal.status === 'pending_approval' ||
                    sal.status === 'approved'
                  ) {
                    <button
                      nz-button
                      nzSize="small"
                      nzType="primary"
                      type="button"
                      [attr.data-testid]="'sal-approve-' + sal.sal_number"
                      (click)="openApprove(sal)"
                    >
                      {{ 'PROJECT_BILLING.SAL_APPROVE_INVOICE' | translate }}
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      [attr.data-testid]="'sal-cancel-' + sal.sal_number"
                      (click)="cancel(sal)"
                    >
                      {{ 'PROJECT_BILLING.SAL_CANCEL' | translate }}
                    </button>
                  }
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }

    <nz-modal
      [nzVisible]="target() !== null"
      [nzTitle]="'PROJECT_BILLING.SAL_APPROVE_INVOICE' | translate"
      (nzOnCancel)="target.set(null)"
      (nzOnOk)="approve()"
      [nzOkText]="'PROJECT_BILLING.CONFIRM' | translate"
      [nzCancelText]="'PROJECT_BILLING.CANCEL' | translate"
    >
      <ng-container *nzModalContent>
        <label for="sal-tax">{{ 'PROJECT_BILLING.TAX_RATE' | translate }}</label>
        <nz-input-number
          id="sal-tax"
          data-testid="sal-tax"
          [nzMin]="0"
          [nzMax]="100"
          [ngModel]="taxRate()"
          (ngModelChange)="taxRate.set($event ?? 0)"
        />
        <label for="sal-approver">{{ 'PROJECT_BILLING.APPROVED_BY' | translate }}</label>
        <input
          id="sal-approver"
          nz-input
          maxlength="150"
          [ngModel]="approvedBy()"
          (ngModelChange)="approvedBy.set($event)"
        />
      </ng-container>
    </nz-modal>
  `,
})
export class SalCertificatesComponent {
  private readonly api = inject(ProjectBillingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly projectId = input.required<string>();
  readonly sals = input<SalCertificate[]>([]);
  readonly currency = input('EUR');
  readonly canWrite = input(false);
  readonly changed = output<void>();

  protected readonly target = signal<SalCertificate | null>(null);
  protected readonly taxRate = signal(22);
  protected readonly approvedBy = signal('');
  protected readonly hasOpen = computed(() =>
    this.sals().some((sal) => ['draft', 'pending_approval', 'approved'].includes(sal.status)),
  );

  protected color(status: SalStatus): string {
    return SAL_STATUS_COLORS[status];
  }

  protected statusKey(status: SalStatus): string {
    return SAL_STATUS_KEYS[status];
  }

  protected submit(sal: SalCertificate): void {
    this.api
      .submitSal(this.projectId(), sal.id)
      .subscribe({ next: () => this.changed.emit(), error: () => this.fail() });
  }

  protected openApprove(sal: SalCertificate): void {
    this.approvedBy.set('');
    this.target.set(sal);
  }

  protected approve(): void {
    const sal = this.target();

    if (sal === null) {
      return;
    }

    this.api
      .approveAndInvoiceSal(
        this.projectId(),
        sal.id,
        this.taxRate(),
        this.approvedBy().trim() || null,
      )
      .subscribe({
        next: () => {
          this.target.set(null);
          this.message.success(this.i18n.translate('PROJECT_BILLING.SAL_INVOICED_OK'));
          this.changed.emit();
        },
        error: () => this.fail(),
      });
  }

  protected cancel(sal: SalCertificate): void {
    this.api
      .cancelSal(this.projectId(), sal.id, null)
      .subscribe({ next: () => this.changed.emit(), error: () => this.fail() });
  }

  private fail(): void {
    this.message.error(this.i18n.translate('PROJECT_BILLING.SAVE_ERROR'));
  }
}
