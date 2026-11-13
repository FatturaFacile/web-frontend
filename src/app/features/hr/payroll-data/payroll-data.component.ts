import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthStore, EmployeeResource, HrApiService, PayrollEmployeeApiService, PermissionsService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { map, tap } from 'rxjs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig, CrudField, CrudOption } from '../shared/crud/crud.types';

type Row = { id: string } & Record<string, unknown>;

const CANTONS = ['AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR', 'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG', 'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH'];
const PERMITS = ['CH', 'C', 'B', 'L', 'G', 'F', 'N', 'S', 'CI', 'Ci', 'Meldeverfahren'];
const ABSENCE_TYPES = ['Sickness', 'Accident', 'Maternity', 'Paternity', 'Military', 'Vacation', 'Unpaid', 'Other'];

/** Payroll data of the employees: variable inputs, absences, children and payroll profiles (sensitive data). */
@Component({
  selector: 'app-payroll-data',
  styleUrl: './payroll-data.component.scss',
  imports: [FormsModule, NzCardModule, NzSelectModule, NzTabsModule, PageHeaderComponent, TranslatePipe, CrudTableComponent],
  template: `
    <app-page-header [title]="'hrmPayData.title' | translate" [subtitle]="'hrmPayData.subtitle' | translate" />
    <nz-card>
      <div class="mb-3">
        <label for="pd-employee">{{ 'hrmPayData.filterEmployee' | translate }}</label>
        <nz-select id="pd-employee" class="w-field-lg" nzAllowClear nzShowSearch [ngModel]="employeeId()" (ngModelChange)="employeeId.set($event)">
          @for (option of employeeOptions(); track option.value) {
            <nz-option [nzValue]="option.value" [nzLabel]="option.label ?? option.value" />
          }
        </nz-select>
      </div>
      <nz-tabs>
        <nz-tab [nzTitle]="'hrmPayData.inputs' | translate">
          <app-crud-table [config]="inputsConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmPayData.absences' | translate">
          <app-crud-table [config]="absencesConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmPayData.children' | translate">
          <app-crud-table [config]="childrenConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmPayData.profiles' | translate">
          <app-crud-table [config]="profilesConfig()" />
        </nz-tab>
      </nz-tabs>
    </nz-card>
  `,
})
export class PayrollDataComponent implements OnInit {
  private readonly api = inject(PayrollEmployeeApiService);
  private readonly hrApi = inject(HrApiService);
  private readonly permissions = inject(PermissionsService);
  private readonly authStore = inject(AuthStore);

  protected readonly employeeId = signal<string | null>(null);
  private readonly employees = signal<EmployeeResource[]>([]);
  private readonly profileEmployees = signal<Record<string, string>>({});
  private readonly canWrite = computed(() => this.permissions.canWrite('payroll'));

  protected readonly employeeOptions = computed<CrudOption[]>(() =>
    this.employees().map((e) => ({ value: e.id, label: `${e.employee_number} - ${e.full_name}` })),
  );

  private employeeField(): CrudField {
    return {
      key: 'employee_id',
      labelKey: 'hrmCommon.employee',
      type: 'select',
      required: true,
      options: () => this.employeeOptions(),
    };
  }

  protected readonly inputsConfig = computed<CrudConfig<Row>>(() => {
    const employeeId = this.employeeId() ?? undefined;
    return {
      titleKey: 'hrmPayData.inputs',
      canWrite: this.canWrite(),
      list: () => this.api.getInputs({ employee_id: employeeId, per_page: 100 }).pipe(map((r) => r.data as unknown as Row[])),
      create: (payload) => this.api.createInput(payload as never),
      update: (id, payload) => this.api.updateInput(id, payload as never),
      remove: (id) => this.api.deleteInput(id),
      fields: [
        this.employeeField(),
        { key: 'year', labelKey: 'hrmCommon.year', type: 'integer', required: true, min: 2000, max: 2100 },
        { key: 'month', labelKey: 'hrmLeave.month', type: 'integer', required: true, min: 1, max: 12 },
        { key: 'wage_type_code', labelKey: 'hrmEmp.wageTypeCode', type: 'text', required: true, maxLength: 6 },
        { key: 'quantity', labelKey: 'hrmPayData.quantity', type: 'decimal' },
        { key: 'rate', labelKey: 'hrmPayData.rate', type: 'decimal' },
        { key: 'amount', labelKey: 'hrmEmp.amount', type: 'decimal' },
        { key: 'note', labelKey: 'hrmCommon.notes', type: 'text', nullable: true, maxLength: 255 },
      ],
    };
  });

  protected readonly absencesConfig = computed<CrudConfig<Row>>(() => {
    const employeeId = this.employeeId() ?? undefined;
    return {
      titleKey: 'hrmPayData.absences',
      canWrite: this.canWrite(),
      list: () => this.api.getAbsences({ employee_id: employeeId, per_page: 100 }).pipe(map((r) => r.data as unknown as Row[])),
      create: (payload) => this.api.createAbsence(payload as never),
      update: (id, payload) => this.api.updateAbsence(id, payload as never),
      remove: (id) => this.api.deleteAbsence(id),
      fields: [
        this.employeeField(),
        {
          key: 'absence_type',
          labelKey: 'hrmCommon.type',
          type: 'select',
          required: true,
          options: () => ABSENCE_TYPES.map((value) => ({ value, labelKey: `hrmPayData.absenceType.${value}` })),
        },
        { key: 'start_date', labelKey: 'hrmCommon.from', type: 'date', required: true },
        { key: 'end_date', labelKey: 'hrmCommon.to', type: 'date', required: true, notBefore: 'start_date' },
        { key: 'percent', labelKey: 'hrmPayData.percent', type: 'decimal', min: 1, max: 100 },
        { key: 'note', labelKey: 'hrmCommon.notes', type: 'text', nullable: true, maxLength: 255 },
      ],
    };
  });

  protected readonly childrenConfig = computed<CrudConfig<Row>>(() => {
    const employeeId = this.employeeId() ?? undefined;
    return {
      titleKey: 'hrmPayData.children',
      canWrite: this.canWrite(),
      list: () => this.api.getChildren({ employee_id: employeeId, per_page: 100 }).pipe(map((r) => r.data as unknown as Row[])),
      create: (payload) => this.api.createChild(payload as never),
      update: (id, payload) => this.api.updateChild(id, payload as never),
      remove: (id) => this.api.deleteChild(id),
      fields: [
        this.employeeField(),
        { key: 'first_name', labelKey: 'hrmRecruiting.firstName', type: 'text', required: true, maxLength: 100 },
        { key: 'last_name', labelKey: 'hrmRecruiting.lastName', type: 'text', nullable: true, maxLength: 100 },
        { key: 'date_of_birth', labelKey: 'hrmPayData.dateOfBirth', type: 'date', required: true, maxMonthsAhead: 9 },
        { key: 'in_education', labelKey: 'hrmPayData.inEducation', type: 'boolean' },
        { key: 'education_end_date', labelKey: 'hrmPayData.educationEnd', type: 'date', nullable: true, column: false, notBefore: 'date_of_birth' },
        { key: 'allowance_eligible', labelKey: 'hrmPayData.allowanceEligible', type: 'boolean', defaultValue: true },
      ],
    };
  });

  protected readonly profilesConfig = computed<CrudConfig<Row>>(() => {
    const employeeId = this.employeeId() ?? undefined;
    return {
      titleKey: 'hrmPayData.profiles',
      canWrite: this.canWrite(),
      list: () =>
        this.api.getProfiles({ employee_id: employeeId, per_page: 100 }).pipe(
          tap((r) => {
            const map: Record<string, string> = {};
            for (const profile of r.data as unknown as Row[]) {
              map[profile.id] = String(profile['employee_id']);
            }
            this.profileEmployees.set(map);
          }),
          map((r) => r.data as unknown as Row[]),
        ),
      update: (id, payload) => this.api.saveProfile(this.profileEmployees()[id] ?? '', payload as never),
      fields: [
        { key: 'employee_id', labelKey: 'hrmCommon.employee', type: 'text', noForm: true },
        { key: 'iban', labelKey: 'hrmPayData.iban', type: 'text', nullable: true, column: false, maxLength: 34 },
        {
          key: 'social_security_number',
          labelKey: 'hrmPayData.ssn',
          type: 'text',
          nullable: true,
          column: false,
          maxLength: 30,
          // The API checks the AHV number format for Swiss tenants only.
          pattern: this.authStore.isSwissJurisdiction() ? '^756\\.?\\d{4}\\.?\\d{4}\\.?\\d{2}$' : undefined,
        },
        { key: 'street', labelKey: 'hrmPayData.street', type: 'text', nullable: true, column: false, maxLength: 255 },
        { key: 'postal_code', labelKey: 'hrmPayData.postalCode', type: 'text', nullable: true, column: false, maxLength: 20 },
        { key: 'city', labelKey: 'hrmPayData.city', type: 'text', nullable: true, column: false, maxLength: 255 },
        {
          key: 'pay_type',
          labelKey: 'hrmPayData.payType',
          type: 'select',
          options: () => ['monthly', 'hourly'].map((value) => ({ value, labelKey: `hrmPayData.payTypeValue.${value}` })),
        },
        { key: 'weekly_hours', labelKey: 'hrmEmp.weeklyHours', type: 'decimal', min: 0, max: 80 },
        { key: 'hourly_wage', labelKey: 'hrmPayData.hourlyWage', type: 'decimal', column: false, min: 0 },
        { key: 'holiday_weeks', labelKey: 'hrmPayData.holidayWeeks', type: 'integer', column: false, min: 0, max: 12 },
        {
          key: 'work_canton',
          labelKey: 'hrmPayroll.canton',
          type: 'select',
          nullable: true,
          options: () => CANTONS.map((value) => ({ value, label: value })),
        },
        {
          key: 'swiss_permit_type',
          labelKey: 'hrmPayData.swissPermitType',
          type: 'select',
          nullable: true,
          options: () => PERMITS.map((value) => ({ value, label: value })),
        },
        { key: 'swiss_permit_valid_until', labelKey: 'hrmPayData.swissPermitValidUntil', type: 'date', nullable: true, column: false },
        { key: 'waive_retiree_allowance', labelKey: 'hrmPayData.waiveRetireeAllowance', type: 'boolean', column: false },
        { key: 'is_withholding_tax_subject', labelKey: 'hrmPayroll.subjectWithholding', type: 'boolean' },
        {
          key: 'withholding_tax_code',
          labelKey: 'hrmPayData.withholdingCode',
          type: 'text',
          nullable: true,
          column: false,
          requiredIf: 'is_withholding_tax_subject',
          pattern: '^[A-Z][0-9][NY]$',
        },
        { key: 'withholding_tax_rate_percent', labelKey: 'hrmPayData.withholdingRate', type: 'decimal', nullable: true, column: false, min: 0, max: 100 },
        { key: 'extrapolate_qst_to_full_time', labelKey: 'hrmPayData.extrapolateQst', type: 'boolean', column: false },
        { key: 'other_employment_fte_percent', labelKey: 'hrmPayData.otherEmploymentFtePercent', type: 'decimal', column: false, min: 0, max: 100 },
        { key: 'frontier_apply_80_percent_basis', labelKey: 'hrmPayData.frontierApply80Percent', type: 'boolean', column: false },
        { key: 'italian_tax_code', labelKey: 'hrmPayData.italianTaxCode', type: 'text', nullable: true, column: false, pattern: '^[A-Z0-9]{16}$' },
        { key: 'collective_agreement_code', labelKey: 'hrmPayData.agreementCode', type: 'text', nullable: true, maxLength: 30 },
        { key: 'contract_level', labelKey: 'hrmPayData.contractLevel', type: 'text', nullable: true, maxLength: 30 },
      ],
    };
  });

  ngOnInit(): void {
    this.hrApi.getEmployees({ per_page: 100 }).subscribe({ next: (res) => this.employees.set(res.data) });
  }

}
