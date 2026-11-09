import { Component, computed, inject, input, signal } from '@angular/core';
import { EmploymentContractResource, HrEmployeeApiService, PermissionsService } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { map } from 'rxjs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig } from '../shared/crud/crud.types';

type Row = { id: string } & Record<string, unknown>;

/**
 * Contract history of an employee. A new contract supersedes the active one; only the active
 * contract can be edited (descriptive data) or have its salary components changed.
 */
@Component({
  selector: 'app-employee-contracts',
  imports: [NzAlertModule, NzDrawerModule, TranslatePipe, CrudTableComponent],
  template: `
    <nz-alert nzType="info" nzShowIcon class="mb-3" [nzMessage]="'hrmEmp.supersedeHint' | translate" />
    <app-crud-table [config]="contractsConfig()" />
    <nz-drawer
      [nzVisible]="componentsOf() !== null"
      [nzTitle]="'hrmEmp.salaryComponents' | translate"
      nzWidth="720"
      (nzOnClose)="componentsOf.set(null)"
    >
      <ng-container *nzDrawerContent>
        @if (componentsConfig(); as config) {
          <app-crud-table [config]="config" />
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class EmployeeContractsComponent {
  readonly employeeId = input.required<string>();

  private readonly api = inject(HrEmployeeApiService);
  private readonly permissions = inject(PermissionsService);

  protected readonly componentsOf = signal<EmploymentContractResource | null>(null);
  private readonly canWrite = computed(() => this.permissions.canWrite('hr'));

  protected readonly contractsConfig = computed<CrudConfig<Row>>(() => {
    const employeeId = this.employeeId();
    return {
      titleKey: 'hrmEmp.contracts',
      canWrite: this.canWrite(),
      list: () => this.api.getContracts(employeeId).pipe(map((res) => res.data as unknown as Row[])),
      create: (payload) => this.api.createContract(employeeId, payload as never),
      update: (id, payload) => this.api.updateContract(id, payload as never),
      isReadonly: (row) => row['is_active'] !== true,
      rowActions: [{ labelKey: 'hrmEmp.salaryComponents', run: (row) => this.componentsOf.set(row as never) }],
      fields: [
        { key: 'contract_number', labelKey: 'hrmEmp.contractNumber', type: 'text', createOnly: true, maxLength: 50 },
        {
          key: 'contract_type',
          labelKey: 'hrmCommon.type',
          type: 'select',
          required: true,
          createOnly: true,
          defaultValue: 'permanent',
          options: () =>
            ['permanent', 'fixed_term', 'apprenticeship', 'contractor', 'internship', 'seasonal'].map((value) => ({
              value,
              labelKey: `hrmEmp.contractType.${value}`,
            })),
        },
        { key: 'job_title', labelKey: 'hrmEmp.jobTitle', type: 'text', required: true, maxLength: 255 },
        { key: 'start_date', labelKey: 'hrmCommon.from', type: 'date', required: true, createOnly: true },
        { key: 'end_date', labelKey: 'hrmCommon.to', type: 'date', nullable: true },
        { key: 'probation_end_date', labelKey: 'hrmEmp.probationEnd', type: 'date', nullable: true, column: false },
        { key: 'weekly_hours', labelKey: 'hrmEmp.weeklyHours', type: 'decimal', required: true, createOnly: true },
        {
          key: 'base_annual_salary',
          labelKey: 'hrmEmp.baseAnnualSalary',
          type: 'decimal',
          required: true,
          createOnly: true,
        },
        { key: 'currency', labelKey: 'hrmEmp.currency', type: 'text', createOnly: true, maxLength: 3, defaultValue: 'CHF' },
        { key: 'notes', labelKey: 'hrmCommon.notes', type: 'textarea', nullable: true, column: false },
        { key: 'status', labelKey: 'hrmCommon.statusCol', type: 'text', noForm: true },
      ],
    };
  });

  protected readonly componentsConfig = computed<CrudConfig<Row> | null>(() => {
    const contract = this.componentsOf();
    if (!contract) {
      return null;
    }
    const employeeId = this.employeeId();
    return {
      titleKey: 'hrmEmp.salaryComponents',
      canWrite: this.canWrite() && contract.is_active,
      list: () =>
        this.api.getContracts(employeeId).pipe(
          map((res) => (res.data.find((c) => c.id === contract.id)?.salary_components ?? []) as unknown as Row[]),
        ),
      create: (payload) => this.api.addSalaryComponent(contract.id, payload as never),
      update: (id, payload) => this.api.updateSalaryComponent(id, payload as never),
      remove: (id) => this.api.deleteSalaryComponent(id),
      fields: [
        { key: 'wage_type_code', labelKey: 'hrmEmp.wageTypeCode', type: 'text', required: true, maxLength: 50 },
        { key: 'description', labelKey: 'hrmCommon.description', type: 'text', required: true, maxLength: 255 },
        { key: 'amount', labelKey: 'hrmEmp.amount', type: 'decimal', required: true },
        {
          key: 'frequency',
          labelKey: 'hrmEmp.frequency',
          type: 'select',
          defaultValue: 'monthly',
          options: () => ['monthly', 'annual'].map((value) => ({ value, labelKey: `hrmEmp.frequencyValue.${value}` })),
        },
        { key: 'valid_from', labelKey: 'hrmCommon.from', type: 'date' },
        { key: 'valid_to', labelKey: 'hrmCommon.to', type: 'date', nullable: true },
      ],
    };
  });
}
