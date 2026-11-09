import { Component, computed, inject } from '@angular/core';
import { PayrollApiService, PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { map } from 'rxjs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig } from '../shared/crud/crud.types';
import { PayrollDocumentsComponent } from './payroll-documents.component';
import { PayrollExportsComponent } from './payroll-exports.component';
import { PayrollRunsComponent } from './payroll-runs.component';
import { PayrollSettingsComponent } from './payroll-settings.component';

type Row = { id: string } & Record<string, unknown>;

const KINDS = ['Earning', 'NonCash', 'Expense', 'Deduction', 'Employer', 'Information'];
const CANTONS = ['AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ'];

/** Payroll workbench: runs, payslips and certificates, wage types, family allowances, settings and exports. */
@Component({
  selector: 'app-hr-payroll',
  imports: [
    NzAlertModule,
    NzCardModule,
    NzTabsModule,
    PageHeaderComponent,
    TranslatePipe,
    CrudTableComponent,
    PayrollRunsComponent,
    PayrollDocumentsComponent,
    PayrollSettingsComponent,
    PayrollExportsComponent,
  ],
  template: `
    <app-page-header [title]="'hrmPayroll.title' | translate" [subtitle]="'hrmPayroll.subtitle' | translate" />
    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'hrmPayroll.runs' | translate">
          <app-payroll-runs [canWrite]="canWrite()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmPayroll.documents' | translate">
          <app-payroll-documents [canWrite]="canWrite()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmPayroll.wageTypes' | translate">
          <app-crud-table [config]="wageTypesConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmPayroll.familyAllowances' | translate">
          <app-crud-table [config]="familyConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmPayroll.settingsSwiss' | translate">
          <app-payroll-settings country="swiss" [canWrite]="canWrite()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmPayroll.settingsItalian' | translate">
          <app-payroll-settings country="italian" [canWrite]="canWrite()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmPayroll.exports' | translate">
          <app-payroll-exports />
        </nz-tab>
      </nz-tabs>
      <nz-alert nzType="info" nzShowIcon class="mt-3" [nzMessage]="'hrmPayroll.swissdecUnavailable' | translate" />
    </nz-card>
  `,
})
export class PayrollComponent {
  private readonly api = inject(PayrollApiService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('payroll'));

  protected readonly wageTypesConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmPayroll.wageTypes',
    canWrite: this.canWrite(),
    list: () => this.api.getWageTypes().pipe(map((res) => res.data as unknown as Row[])),
    create: (payload) => this.api.createWageType(payload as never),
    update: (id, payload) => this.api.updateWageType(id, payload as never),
    remove: (id) => this.api.deleteWageType(id),
    fields: [
      { key: 'code', labelKey: 'hrmCommon.code', type: 'text', required: true, maxLength: 10 },
      { key: 'name', labelKey: 'hrmCommon.name', type: 'text', required: true, maxLength: 255 },
      {
        key: 'kind',
        labelKey: 'hrmPayroll.kind',
        type: 'select',
        required: true,
        options: () => KINDS.map((value) => ({ value, labelKey: `hrmPayroll.kindValue.${value}` })),
      },
      { key: 'subject_to_ahv', labelKey: 'hrmPayroll.subjectAhv', type: 'boolean', column: false },
      { key: 'subject_to_alv', labelKey: 'hrmPayroll.subjectAlv', type: 'boolean', column: false },
      { key: 'subject_to_uvg', labelKey: 'hrmPayroll.subjectUvg', type: 'boolean', column: false },
      { key: 'subject_to_ktg', labelKey: 'hrmPayroll.subjectKtg', type: 'boolean', column: false },
      { key: 'subject_to_bvg', labelKey: 'hrmPayroll.subjectBvg', type: 'boolean', column: false },
      { key: 'subject_to_withholding_tax', labelKey: 'hrmPayroll.subjectWithholding', type: 'boolean', column: false },
      { key: 'is_irregular', labelKey: 'hrmPayroll.irregular', type: 'boolean', column: false },
      { key: 'certificate_box', labelKey: 'hrmPayroll.certificateBox', type: 'text', nullable: true },
      { key: 'sort_order', labelKey: 'hrmTime.priority', type: 'integer', column: false },
      { key: 'is_active', labelKey: 'hrmCommon.active', type: 'boolean', defaultValue: true },
    ],
  }));

  protected readonly familyConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmPayroll.familyAllowances',
    canWrite: this.canWrite(),
    list: () => this.api.getFamilyAllowanceRates().pipe(map((res) => res.data as unknown as Row[])),
    create: (payload) => this.api.createFamilyAllowanceRate(payload as never),
    update: (id, payload) => this.api.updateFamilyAllowanceRate(id, payload as never),
    remove: (id) => this.api.deleteFamilyAllowanceRate(id),
    fields: [
      {
        key: 'canton',
        labelKey: 'hrmPayroll.canton',
        type: 'select',
        required: true,
        options: () => CANTONS.map((value) => ({ value, label: value })),
      },
      { key: 'valid_from', labelKey: 'hrmCommon.from', type: 'date', required: true },
      { key: 'child_allowance', labelKey: 'hrmPayroll.childAllowance', type: 'decimal', required: true },
      { key: 'education_allowance', labelKey: 'hrmPayroll.educationAllowance', type: 'decimal', required: true },
    ],
  }));
}
