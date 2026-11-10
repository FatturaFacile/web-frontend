import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  applyServerErrors,
  HrSelfServiceApiService,
  I18nService,
  isValidationError,
  SelfServiceLeaveBalance,
  SelfServiceLeaveRequest,
  SelfServiceLeaveType,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { decimalStringValidator } from '../shared/hr-decimal.validator';
import { reportHttpError } from '../shared/hr-http.util';
import { HrStatusTagComponent } from '../shared/hr-status-tag.component';

@Component({
  selector: 'app-ss-leave',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    TranslatePipe,
    HrStatusTagComponent,
  ],
  templateUrl: './ss-leave.component.html',
})
export class SsLeaveComponent implements OnInit {
  private readonly api = inject(HrSelfServiceApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly balances = signal<SelfServiceLeaveBalance[]>([]);
  protected readonly requests = signal<SelfServiceLeaveRequest[]>([]);
  protected readonly leaveTypes = signal<SelfServiceLeaveType[]>([]);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly formOpen = signal(false);
  protected readonly cancelTarget = signal<SelfServiceLeaveRequest | null>(null);

  private readonly leaveTypeNames = computed(
    () => new Map(this.leaveTypes().map((type) => [type.id, type.name])),
  );

  protected readonly form = this.fb.group({
    leave_type_id: ['', Validators.required],
    start_date: ['', Validators.required],
    end_date: ['', Validators.required],
    total_hours: ['', [Validators.required, decimalStringValidator]],
    reason: ['', Validators.maxLength(500)],
  });
  protected readonly cancelReason = this.fb.control('', Validators.required);

  ngOnInit(): void {
    // The portal endpoint needs no HR role: the employee only labels own balances and requests.
    this.api.getLeaveTypes().subscribe({
      next: (res) => this.leaveTypes.set(res.data.filter((type) => type.is_active)),
      error: () => this.leaveTypes.set([]),
    });
    this.reload();
  }

  protected typeName(id: string): string {
    return this.leaveTypeNames().get(id) ?? id.slice(0, 8);
  }

  protected canCancel(request: SelfServiceLeaveRequest): boolean {
    return !request.is_locked && (request.status === 'pending' || request.status === 'approved');
  }

  protected reload(): void {
    this.loading.set(true);
    this.api.getLeaveBalances().subscribe({
      next: (res) => this.balances.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
    this.api.getLeaveRequests().subscribe({
      next: (res) => {
        this.requests.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        reportHttpError(err, this.message, this.i18n);
        this.loading.set(false);
      },
    });
  }

  protected openForm(): void {
    this.form.reset();
    this.formOpen.set(true);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.api
      .submitLeaveRequest({
        leave_type_id: value.leave_type_id,
        start_date: value.start_date,
        end_date: value.end_date,
        total_hours: value.total_hours.trim(),
        reason: value.reason || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.formOpen.set(false);
          this.message.success(this.i18n.translate('hrmSelfService.requestSubmitted'));
          this.reload();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          if (isValidationError(err)) {
            applyServerErrors(this.form, err);
          } else {
            reportHttpError(err, this.message, this.i18n);
          }
        },
      });
  }

  protected askCancel(request: SelfServiceLeaveRequest): void {
    this.cancelReason.reset();
    this.cancelTarget.set(request);
  }

  protected confirmCancel(): void {
    const target = this.cancelTarget();
    if (!target || this.cancelReason.invalid) {
      this.cancelReason.markAsTouched();
      return;
    }
    this.saving.set(true);
    this.api.cancelLeaveRequest(target.id, this.cancelReason.value).subscribe({
      next: () => {
        this.saving.set(false);
        this.cancelTarget.set(null);
        this.message.success(this.i18n.translate('hrmSelfService.requestCancelled'));
        this.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }
}
