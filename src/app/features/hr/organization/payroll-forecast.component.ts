import { Component, computed, inject, input, signal } from '@angular/core';
import { AuthStore, HrEmployeeApiService, PayrollForecast } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { tap } from 'rxjs';
import { ActionFormComponent, ActionFormConfig } from '../shared/action-form/action-form.component';

/** Cost and payroll forecast of a month from the active employees. It publishes the forecast and, if positive, an accrual event. */
@Component({
  selector: 'app-payroll-forecast',
  styleUrl: './payroll-forecast.component.scss',
  imports: [ActionFormComponent, MoneyPipe, NzAlertModule, NzDescriptionsModule, TranslatePipe],
  template: `
    <nz-alert
      nzType="info"
      nzShowIcon
      class="mb-3"
      [nzMessage]="'hrmOrgX.forecastHint' | translate"
    />
    <app-action-form [config]="config" [canWrite]="canWrite()" />
    @if (forecast(); as f) {
      <nz-descriptions nzBordered nzSize="small" [nzColumn]="1" class="mt-3">
        <nz-descriptions-item [nzTitle]="'hrmOrgX.period' | translate">{{
          f.period_code
        }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmOrgX.headcount' | translate">{{
          f.active_headcount
        }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmOrgX.outflow' | translate">{{
          f.estimated_payroll_outflow | money: currency()
        }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmOrgX.accrual' | translate">{{
          f.accrual_amount | money: currency()
        }}</nz-descriptions-item>
      </nz-descriptions>
    }
  `,
})
export class PayrollForecastComponent {
  readonly canWrite = input(false);

  private readonly api = inject(HrEmployeeApiService);
  private readonly authStore = inject(AuthStore);

  protected readonly forecast = signal<PayrollForecast | null>(null);
  protected readonly currency = computed(() => this.authStore.activeCurrency() || 'CHF');

  protected readonly config: ActionFormConfig = {
    submitLabelKey: 'hrmOrgX.generateForecast',
    successKey: 'hrmOrgX.forecastGenerated',
    fields: [
      {
        key: 'period_code',
        labelKey: 'hrmOrgX.periodCode',
        type: 'text',
        maxLength: 7,
        defaultValue: new Date().toISOString().slice(0, 7),
      },
    ],
    submit: (payload) =>
      this.api
        .generatePayrollForecast(payload['period_code'] as string | undefined)
        .pipe(tap((res) => this.forecast.set(res.data))),
  };
}
