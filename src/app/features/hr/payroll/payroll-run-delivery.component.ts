import { Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  BankAccountResource,
  DepartmentResource,
  HrEmployeeApiService,
  I18nService,
  PaymentBatchAllocation,
  PayrollApiService,
  PayrollPaymentBatch,
  PayslipDeliveryResult,
  TreasuryApiService,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { reportHttpError } from '../shared/hr-http.util';

interface AllocationRow {
  bankAccountId: string | null;
  departmentId: string | null;
}

/** After the run is final: mail the payslip links to the employees and create the payment batches of the net pay (Treasury). */
@Component({
  selector: 'app-payroll-run-delivery',
  styleUrl: './payroll-run-delivery.component.scss',
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    TranslatePipe,
  ],
  template: `
    <button nz-button type="button" [nzLoading]="delivering()" (click)="confirmDeliver.set(true)">
      {{ 'hrmPayroll.deliver.deliver' | translate }}
    </button>
    <button nz-button type="button" (click)="openBatches()">
      {{ 'hrmPayroll.deliver.paymentBatches' | translate }}
    </button>

    @if (delivery(); as d) {
      <nz-alert
        class="mt-2"
        [nzType]="d.skipped.length > 0 ? 'warning' : 'success'"
        nzShowIcon
        [nzMessage]="
          'hrmPayroll.deliver.result' | translate: { sent: d.sent, skipped: d.skipped.length }
        "
        [nzDescription]="skippedText()"
      />
    }
    @if (batches(); as list) {
      <nz-table #batchTable class="mt-2" [nzData]="list" [nzFrontPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'hrmPayroll.deliver.reference' | translate }}</th>
            <th>{{ 'hrmPayroll.deliver.items' | translate }}</th>
            <th>{{ 'hrmPayroll.deliver.total' | translate }}</th>
            <th>{{ 'hrmCommon.statusCol' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (batch of batchTable.data; track batch.id) {
            <tr>
              <td>{{ batch.batch_reference }}</td>
              <td>{{ batch.item_count }}</td>
              <td>{{ batch.total_amount | money: currency() }}</td>
              <td>{{ batch.status }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    }

    <nz-modal
      [nzVisible]="confirmDeliver()"
      [nzTitle]="'hrmPayroll.deliver.deliver' | translate"
      [nzOkText]="'hrmCommon.confirm' | translate"
      [nzCancelText]="'hrmCommon.cancel' | translate"
      (nzOnOk)="deliver()"
      (nzOnCancel)="confirmDeliver.set(false)"
    >
      <ng-container *nzModalContent>{{
        'hrmPayroll.deliver.deliverConfirm' | translate
      }}</ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="batchesOpen()"
      [nzTitle]="'hrmPayroll.deliver.paymentBatches' | translate"
      nzWidth="640px"
      [nzOkText]="'hrmPayroll.deliver.create' | translate"
      [nzCancelText]="'hrmCommon.cancel' | translate"
      [nzOkLoading]="creating()"
      [nzOkDisabled]="!canCreate()"
      (nzOnOk)="createBatches()"
      (nzOnCancel)="batchesOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <p>{{ 'hrmPayroll.deliver.allocationHint' | translate }}</p>
        @for (row of rows(); track $index; let i = $index) {
          <div class="flex gap-2 items-end mb-2">
            <div class="flex-1">
              <label [attr.for]="'alloc-bank-' + i">{{
                'hrmPayroll.deliver.bankAccount' | translate
              }}<span class="required-mark" aria-hidden="true">*</span></label>
              <nz-select
                [id]="'alloc-bank-' + i"
                class="w-full"
                nzShowSearch
                [ngModel]="row.bankAccountId"
                (ngModelChange)="update(i, { bankAccountId: $event })"
              >
                @for (account of bankAccounts(); track account.id) {
                  <nz-option [nzValue]="account.id" [nzLabel]="accountLabel(account)" />
                }
              </nz-select>
            </div>
            <div class="flex-1">
              <label [attr.for]="'alloc-dep-' + i">{{ 'hrmOrg.department' | translate }}</label>
              <nz-select
                [id]="'alloc-dep-' + i"
                class="w-full"
                nzAllowClear
                [ngModel]="row.departmentId"
                (ngModelChange)="update(i, { departmentId: $event })"
              >
                @for (department of departments(); track department.id) {
                  <nz-option
                    [nzValue]="department.id"
                    [nzLabel]="department.code + ' - ' + department.name"
                  />
                }
              </nz-select>
            </div>
            <button
              nz-button
              nzDanger
              type="button"
              [disabled]="rows().length < 2"
              (click)="removeRow(i)"
            >
              {{ 'hrmCommon.delete' | translate }}
            </button>
          </div>
        }
        <button nz-button type="button" (click)="addRow()">
          {{ 'hrmPayroll.deliver.addAllocation' | translate }}
        </button>
      </ng-container>
    </nz-modal>
  `,
})
export class PayrollRunDeliveryComponent {
  readonly runId = input.required<string>();
  readonly currency = input('CHF');

  private readonly api = inject(PayrollApiService);
  private readonly treasury = inject(TreasuryApiService);
  private readonly orgApi = inject(HrEmployeeApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly confirmDeliver = signal(false);
  protected readonly delivering = signal(false);
  protected readonly delivery = signal<PayslipDeliveryResult | null>(null);
  protected readonly batchesOpen = signal(false);
  protected readonly creating = signal(false);
  protected readonly batches = signal<PayrollPaymentBatch[] | null>(null);
  protected readonly bankAccounts = signal<BankAccountResource[]>([]);
  protected readonly departments = signal<DepartmentResource[]>([]);
  protected readonly rows = signal<AllocationRow[]>([{ bankAccountId: null, departmentId: null }]);
  protected readonly canCreate = computed(() => this.rows().every((row) => !!row.bankAccountId));
  protected readonly skippedText = computed(() =>
    (this.delivery()?.skipped ?? [])
      .map((s) => `${s.employee_id.slice(0, 8)}: ${s.reason}`)
      .join(' | '),
  );

  protected deliver(): void {
    this.confirmDeliver.set(false);
    this.delivering.set(true);
    this.api.deliverPayslips(this.runId()).subscribe({
      next: (res) => {
        this.delivering.set(false);
        this.delivery.set(res.data);
      },
      error: (err: unknown) => {
        this.delivering.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }

  protected openBatches(): void {
    if (this.bankAccounts().length === 0) {
      this.treasury.getBankAccounts().subscribe({ next: (res) => this.bankAccounts.set(res.data) });
      this.orgApi.getDepartments().subscribe({ next: (res) => this.departments.set(res.data) });
    }
    this.batchesOpen.set(true);
  }

  protected accountLabel(account: BankAccountResource): string {
    return [account.bank_name, account.iban].filter(Boolean).join(' - ') || account.id;
  }

  protected addRow(): void {
    this.rows.update((rows) => [...rows, { bankAccountId: null, departmentId: null }]);
  }

  protected removeRow(index: number): void {
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected update(index: number, change: Partial<AllocationRow>): void {
    this.rows.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...change } : row)));
  }

  protected createBatches(): void {
    const allocations: PaymentBatchAllocation[] = this.rows().map((row) => ({
      bank_account_id: row.bankAccountId as string,
      ...(row.departmentId ? { department_id: row.departmentId } : {}),
    }));
    this.creating.set(true);
    this.api.createPaymentBatches(this.runId(), allocations).subscribe({
      next: (res) => {
        this.creating.set(false);
        this.batchesOpen.set(false);
        this.batches.set(res.data);
        this.message.success(this.i18n.translate('hrmPayroll.deliver.created'));
      },
      error: (err: unknown) => {
        this.creating.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }
}
