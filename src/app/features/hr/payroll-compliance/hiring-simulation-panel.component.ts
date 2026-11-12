import { Component, computed, inject, input, signal } from '@angular/core';
import {
  HiringSimulationPayload,
  HiringSimulationResult,
  PayrollComplianceApiService,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { tap } from 'rxjs';
import { ActionFormComponent, ActionFormConfig } from '../shared/action-form/action-form.component';

/** What a hiring costs: from the annual gross to the net, or from the wanted net to the gross. Nothing is saved. */
@Component({
  selector: 'app-hiring-simulation-panel',
  styleUrl: './hiring-simulation-panel.component.scss',
  imports: [
    ActionFormComponent,
    MoneyPipe,
    NzAlertModule,
    NzDescriptionsModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <p>{{ 'hrmCompliance.hiring.hint' | translate }}</p>
    <app-action-form [config]="config" [canWrite]="canSimulate()" />

    @if (result(); as r) {
      <h4 class="mt-4">{{ 'hrmCompliance.hiring.result' | translate }}</h4>
      <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
        <nz-descriptions-item [nzTitle]="'hrmCompliance.hiring.direction' | translate">
          {{ r.direction }}
          @if (!r.is_exact) {
            <nz-tag nzColor="orange">{{ 'hrmCompliance.hiring.approximate' | translate }}</nz-tag>
          }
        </nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmCompliance.hiring.annualGross' | translate">{{
          r.annual_gross | money: r.currency
        }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmCompliance.hiring.monthlyGross' | translate">{{
          r.monthly_gross | money: r.currency
        }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmPayroll.deductions' | translate">{{
          r.total_deductions | money: r.currency
        }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmCompliance.hiring.monthlyNet' | translate">
          <strong>{{ r.monthly_net | money: r.currency }}</strong>
        </nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'hrmCompliance.hiring.employerCost' | translate">{{
          r.employer_total_cost | money: r.currency
        }}</nz-descriptions-item>
        @for (entry of deductionEntries(); track entry[0]) {
          <nz-descriptions-item [nzTitle]="entry[0]">{{
            entry[1] | money: r.currency
          }}</nz-descriptions-item>
        }
      </nz-descriptions>
      @if (r.notes) {
        <nz-alert class="mt-2" nzType="info" nzShowIcon [nzMessage]="r.notes" />
      }
    }
  `,
})
export class HiringSimulationPanelComponent {
  /** The simulation does not write anything: reading the payroll module is enough. */
  readonly canSimulate = input(true);

  private readonly api = inject(PayrollComplianceApiService);

  protected readonly result = signal<HiringSimulationResult | null>(null);
  protected readonly deductionEntries = computed(() =>
    Object.entries(this.result()?.deductions ?? {}),
  );

  protected readonly config: ActionFormConfig = {
    submitLabelKey: 'hrmCompliance.hiring.simulate',
    successKey: 'hrmCompliance.hiring.simulated',
    fields: [
      {
        key: 'year',
        labelKey: 'hrmCommon.year',
        type: 'integer',
        required: true,
        min: 2000,
        max: 2100,
        defaultValue: String(new Date().getFullYear()),
      },
      {
        key: 'annual_gross',
        labelKey: 'hrmCompliance.hiring.annualGross',
        type: 'decimal',
        requiredWithout: 'target_net_monthly',
        prohibits: 'target_net_monthly',
        positive: true,
        max: 100000000,
      },
      {
        key: 'target_net_monthly',
        labelKey: 'hrmCompliance.hiring.targetNet',
        type: 'decimal',
        requiredWithout: 'annual_gross',
        positive: true,
        max: 10000000,
      },
      { key: 'date_of_birth', labelKey: 'hrmCompliance.hiring.dateOfBirth', type: 'date' },
      { key: 'fte_ratio', labelKey: 'hrmCompliance.hiring.fteRatio', type: 'decimal', positive: true, max: 1 },
      {
        key: 'salary_installments_per_year',
        labelKey: 'hrmCompliance.hiring.installments',
        type: 'integer',
        min: 12,
        max: 14,
      },
      {
        key: 'withholding_tax_rate_percent',
        labelKey: 'hrmCompliance.hiring.withholdingRate',
        type: 'decimal',
        min: 0,
        max: 100,
      },
      {
        key: 'pension_fund_employee_rate_percent',
        labelKey: 'hrmCompliance.hiring.pensionRate',
        type: 'decimal',
        min: 0,
        max: 100,
      },
      {
        key: 'residence_country',
        labelKey: 'hrmCompliance.hiring.residenceCountry',
        type: 'text',
        minLength: 2,
        maxLength: 2,
      },
    ],
    submit: (payload) =>
      this.api
        .simulateHiring(payload as unknown as HiringSimulationPayload)
        .pipe(tap((res) => this.result.set(res.data))),
  };
}
