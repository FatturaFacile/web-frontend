import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { PortalApiService } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';

/** Public page of a mailed payslip link: the PDF opens against the date of birth of the employee. */
@Component({
  selector: 'app-payslip-link',
  imports: [ReactiveFormsModule, NzAlertModule, NzButtonModule, NzCardModule, NzFormModule, NzIconModule, NzInputModule, TranslatePipe],
  template: `
    <nz-card class="payslip-card" [nzTitle]="'PAYSLIP_LINK.TITLE' | translate">
      <p>{{ 'PAYSLIP_LINK.INTRO' | translate }}</p>
      <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="open()">
        <nz-form-item>
          <nz-form-label nzRequired nzFor="payslip-birth-date">{{ 'PAYSLIP_LINK.BIRTH_DATE' | translate }}</nz-form-label>
          <nz-form-control [nzErrorTip]="'PAYSLIP_LINK.BIRTH_DATE_REQUIRED' | translate">
            <input nz-input id="payslip-birth-date" type="date" autocomplete="bday" formControlName="birth_date" />
          </nz-form-control>
        </nz-form-item>
        @if (failed()) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="'PAYSLIP_LINK.FAILED' | translate" class="payslip-alert" />
        }
        @if (opened()) {
          <nz-alert nzType="success" nzShowIcon [nzMessage]="'PAYSLIP_LINK.OPENED' | translate" class="payslip-alert" />
        }
        <button nz-button nzType="primary" type="submit" [nzLoading]="loading()">
          <span nz-icon nzType="download"></span>{{ 'PAYSLIP_LINK.OPEN' | translate }}
        </button>
      </form>
    </nz-card>
  `,
})
export class PayslipLinkComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PortalApiService);
  private readonly fb = inject(FormBuilder);

  protected readonly loading = signal(false);
  protected readonly failed = signal(false);
  protected readonly opened = signal(false);
  protected readonly form = this.fb.nonNullable.group({ birth_date: ['', Validators.required] });

  protected open(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    this.loading.set(true);
    this.failed.set(false);
    this.opened.set(false);
    this.api.openPayslipLink(token, this.form.getRawValue()).subscribe({
      next: (blob) => {
        this.loading.set(false);
        this.opened.set(true);
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'payslip.pdf';
        anchor.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => {
        this.loading.set(false);
        this.failed.set(true);
      },
    });
  }
}
