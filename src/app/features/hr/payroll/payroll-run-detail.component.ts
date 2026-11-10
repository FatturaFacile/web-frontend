import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { I18nService, PayrollApiService, PayrollCostAllocation, PayrollRunRecord } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { reportHttpError, saveBlob } from '../shared/hr-http.util';
import { ReasonButtonComponent } from '../shared/reason-button.component';
import { PayrollRunDeliveryComponent } from './payroll-run-delivery.component';
import { PayrollRunStatusTagComponent } from './payroll-run-status-tag.component';

/**
 * A run with its payslips, history and cost allocation.
 * Draft/Calculated -> approve -> Approved -> finalize -> Final. Reopen needs a reason: on an approved
 * run it revokes the approval (back to Calculated). The same user may calculate and approve.
 */
@Component({
  selector: 'app-payroll-run-detail',
  imports: [
    DatePipe,
    MoneyPipe,
    NzButtonModule,
    NzDescriptionsModule,
    NzSkeletonModule,
    NzTableModule,
    NzTabsModule,
    TranslatePipe,
    PayrollRunDeliveryComponent,
    PayrollRunStatusTagComponent,
    ReasonButtonComponent,
  ],
  templateUrl: './payroll-run-detail.component.html',
})
export class PayrollRunDetailComponent {
  readonly runId = input.required<string>();
  readonly canWrite = input(false);
  readonly changed = output<void>();

  private readonly api = inject(PayrollApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);

  protected readonly run = signal<PayrollRunRecord | null>(null);
  protected readonly allocation = signal<PayrollCostAllocation | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);

  protected readonly canApprove = computed(() => this.run()?.status === 'Calculated');
  protected readonly canFinalize = computed(() => this.run()?.status === 'Approved');
  protected readonly canReopen = computed(() => ['Approved', 'Final'].includes(this.run()?.status ?? ''));

  constructor() {
    effect(() => {
      this.runId();
      untracked(() => this.load());
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.allocation.set(null);
    this.api.getRun(this.runId()).subscribe({
      next: (res) => {
        this.run.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        reportHttpError(err, this.message, this.i18n);
        this.loading.set(false);
      },
    });
  }

  protected loadAllocation(): void {
    if (this.allocation()) {
      return;
    }
    this.api.getCostAllocation(this.runId()).subscribe({
      next: (res) => this.allocation.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected approve(): void {
    this.transition(this.api.approveRun(this.runId()), 'hrmPayroll.approved');
  }

  protected askFinalize(): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('hrmPayroll.finalizeTitle'),
      nzContent: this.i18n.translate('hrmPayroll.finalizeText'),
      nzOkText: this.i18n.translate('hrmCommon.confirm'),
      nzCancelText: this.i18n.translate('hrmCommon.cancel'),
      nzOnOk: () => this.transition(this.api.finalizeRun(this.runId()), 'hrmPayroll.finalized'),
    });
  }

  protected reopen(reason: string): void {
    this.transition(this.api.reopenRun(this.runId(), reason), 'hrmPayroll.reopened');
  }

  protected downloadLabourBook(): void {
    this.api.downloadLabourBook(this.runId()).subscribe({
      next: (blob) => saveBlob(blob, `labour-book-${this.run()?.year}-${this.run()?.month}.pdf`),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  protected downloadPayslip(id: string, name: string): void {
    this.api.downloadPayslipPdf(id).subscribe({
      next: (blob) => saveBlob(blob, `payslip-${name}.pdf`),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }

  private transition(request: ReturnType<PayrollApiService['approveRun']>, successKey: string): void {
    this.busy.set(true);
    request.subscribe({
      next: (res) => {
        this.busy.set(false);
        this.run.set({ ...(this.run() as PayrollRunRecord), ...res.data });
        this.allocation.set(null);
        this.message.success(this.i18n.translate(successKey));
        this.changed.emit();
        this.load();
      },
      // 409/422: wrong state for the transition (e.g. finalize needs Approved): show the server message.
      error: (err: unknown) => {
        this.busy.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }
}
