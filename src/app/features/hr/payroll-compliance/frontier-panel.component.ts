import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import {
  CrossBorderEmployee,
  HrApiService,
  I18nService,
  PayrollComplianceApiService,
  WithholdingTaxParameters,
} from '@core';
import { TranslatePipe, GridExportDirective, GridSortPipe } from '@shared';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { defer } from 'rxjs';
import { ActionFormComponent, ActionFormConfig } from '../shared/action-form/action-form.component';
import { CrudOption } from '../shared/crud/crud.types';
import { reportHttpError } from '../shared/hr-http.util';

/** Frontier workers (IT-CH): the nights away of a year, the registered commuters and the withholding parameters of the company. */
@Component({
  selector: 'app-frontier-panel',
  styleUrl: './frontier-panel.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
    ActionFormComponent, NzDescriptionsModule, NzTableModule, TranslatePipe],
  template: `
    <h4>{{ 'hrmCompliance.frontier.nightsTitle' | translate }}</h4>
    <p>{{ 'hrmCompliance.frontier.nightsHint' | translate }}</p>
    <app-action-form [config]="nightsConfig()" [canWrite]="canWrite()" />

    <h4 class="mt-4">{{ 'hrmCompliance.frontier.commuters' | translate }}</h4>
    <nz-table #table [nzData]="commuters()" [nzFrontPagination]="false" nzSize="small">
      <thead>
        <tr>
          <th [nzSortFn]="'name' | gridSort">{{ 'hrmCommon.name' | translate }}</th>
          <th [nzSortFn]="'email' | gridSort">Email</th>
          <th [nzSortFn]="'job_title' | gridSort">{{ 'hrmCompliance.frontier.jobTitle' | translate }}</th>
          <th [nzSortFn]="'hire_date' | gridSort">{{ 'hrmCompliance.frontier.hireDate' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track row.id) {
          <tr>
            <td>{{ row.name }}</td>
            <td>{{ row.email }}</td>
            <td>{{ row.job_title }}</td>
            <td>{{ row.hire_date }}</td>
          </tr>
        }
      </tbody>
    </nz-table>

    <h4 class="mt-4">{{ 'hrmCompliance.frontier.parameters' | translate }}</h4>
    <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
      @for (entry of parameterEntries(); track entry[0]) {
        <nz-descriptions-item [nzTitle]="entry[0]">{{ entry[1] }}</nz-descriptions-item>
      }
    </nz-descriptions>
  `,
})
export class FrontierPanelComponent implements OnInit {
  readonly canWrite = input(false);
  readonly employees = input<CrudOption[]>([]);

  private readonly api = inject(PayrollComplianceApiService);
  private readonly hrApi = inject(HrApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly commuters = signal<CrossBorderEmployee[]>([]);
  private readonly parameters = signal<WithholdingTaxParameters>({});
  protected readonly parameterEntries = computed(() => Object.entries(this.parameters()));

  protected readonly nightsConfig = computed<ActionFormConfig>(() => ({
    submitLabelKey: 'hrmCommon.save',
    fields: [
      {
        key: 'employee_id',
        labelKey: 'hrmCommon.employee',
        type: 'select',
        required: true,
        options: () => this.employees(),
      },
      {
        key: 'year',
        labelKey: 'hrmCommon.year',
        type: 'integer',
        required: true,
        min: 2024,
        max: 2100,
        defaultValue: String(new Date().getFullYear()),
      },
      {
        key: 'nights_away',
        labelKey: 'hrmCompliance.frontier.nightsAway',
        type: 'integer',
        required: true,
        min: 0,
        max: 366,
      },
    ],
    submit: (payload) =>
      defer(() =>
        this.api.saveFrontierNights(String(payload['employee_id']), {
          year: Number(payload['year']),
          nights_away: Number(payload['nights_away']),
        }),
      ),
  }));

  ngOnInit(): void {
    this.hrApi.getCrossBorderEmployees().subscribe({
      next: (res) => this.commuters.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
    this.hrApi.getWithholdingTaxParameters().subscribe({
      next: (res) => this.parameters.set(res.data),
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
  }
}
