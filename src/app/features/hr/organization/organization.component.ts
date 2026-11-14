import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  DepartmentResource,
  EmployeeResource,
  HrApiService,
  HrEmployeeApiService,
  PermissionsService,
  PositionResource,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig, CrudOption, crudPage, isRowsQuery } from '../shared/crud/crud.types';
import { PayrollForecastComponent } from './payroll-forecast.component';
import { PositionSuccessorDialogComponent } from './position-successor-dialog.component';

type Row = { id: string } & Record<string, unknown>;

const READINESS = ['ready_now', 'ready_1_2_years', 'developing'];

/** Org chart: departments (tree, no cycles: server 422) and positions. */
@Component({
  selector: 'app-hr-organization',
  styleUrl: './organization.component.scss',
  imports: [
    NzCardModule,
    NzTabsModule,
    PageHeaderComponent,
    TranslatePipe,
    CrudTableComponent,
    PayrollForecastComponent,
    PositionSuccessorDialogComponent,
  ],
  template: `
    <app-page-header
      [title]="'hrmOrg.title' | translate"
      [subtitle]="'hrmOrg.subtitle' | translate"
    />
    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'hrmOrg.departments' | translate">
          <app-crud-table [config]="departmentsConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmOrg.positions' | translate">
          <app-crud-table [config]="positionsConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmOrgX.forecast' | translate">
          <app-payroll-forecast [canWrite]="canWrite()" />
        </nz-tab>
      </nz-tabs>
    </nz-card>
    <app-position-successor-dialog
      [(open)]="successorOpen"
      [positionId]="successorPosition()?.id ?? null"
      [currentSuccessor]="successorPosition()?.successor_employee_id ?? null"
      [employees]="employeeOptions()"
      (assigned)="positionsVersion.update((v) => v + 1)"
    />
  `,
})
export class OrganizationComponent implements OnInit {
  private readonly api = inject(HrEmployeeApiService);
  private readonly permissions = inject(PermissionsService);

  private readonly hrApi = inject(HrApiService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('hr'));
  protected readonly successorOpen = signal(false);
  protected readonly successorPosition = signal<PositionResource | null>(null);
  protected readonly positionsVersion = signal(0);
  private readonly employees = signal<EmployeeResource[]>([]);
  protected readonly employeeOptions = computed<CrudOption[]>(() =>
    this.employees().map((e) => ({ value: e.id, label: `${e.employee_number} - ${e.full_name}` })),
  );
  private readonly positions = signal<PositionResource[]>([]);
  private readonly departments = signal<DepartmentResource[]>([]);
  private readonly departmentOptions = computed<CrudOption[]>(() =>
    this.departments().map((d) => ({ value: d.id, label: `${d.code} - ${d.name}` })),
  );

  /** The department options of the positions need every department, not the filtered page of the grid. */
  private loadDepartments(): void {
    this.api.getDepartments().subscribe({ next: (res) => this.departments.set(res.data) });
  }

  protected readonly departmentsConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmOrg.departments',
    canWrite: this.permissions.canWrite('hr'),
    gridList: (query) => {
      if (isRowsQuery(query)) {
        this.loadDepartments();
      }
      return crudPage(this.api.getDepartments(query));
    },
    create: (payload) => this.api.createDepartment(payload as never),
    update: (id, payload) => this.api.updateDepartment(id, payload as never),
    fields: [
      { key: 'code', labelKey: 'hrmCommon.code', type: 'text', required: true, maxLength: 60 },
      { key: 'name', labelKey: 'hrmCommon.name', type: 'text', required: true, maxLength: 150 },
      {
        key: 'parent_id',
        labelKey: 'hrmOrg.parent',
        type: 'select',
        nullable: true,
        options: () => this.departmentOptions(),
      },
      { key: 'is_active', labelKey: 'hrmCommon.active', type: 'boolean', defaultValue: true },
    ],
  }));

  protected readonly positionsConfig = computed<CrudConfig<Row>>(() => {
    this.positionsVersion();
    return {
      titleKey: 'hrmOrg.positions',
      canWrite: this.permissions.canWrite('hr'),
      gridList: (query) => {
        if (isRowsQuery(query)) {
          this.api.getPositions().subscribe({ next: (res) => this.positions.set(res.data) });
        }
        return crudPage(this.api.getPositions(query));
      },
      rowActions: [
        {
          labelKey: 'hrmOrgX.assignSuccessor',
          writeOnly: true,
          run: (row) => {
            this.successorPosition.set(this.positions().find((p) => p.id === row.id) ?? null);
            this.successorOpen.set(true);
          },
        },
      ],
      create: (payload) => this.api.createPosition(payload as never),
      update: (id, payload) => this.api.updatePosition(id, payload as never),
      fields: [
        { key: 'code', labelKey: 'hrmCommon.code', type: 'text', required: true, maxLength: 60 },
        { key: 'title', labelKey: 'hrmCommon.title', type: 'text', required: true, maxLength: 150 },
        {
          key: 'department_id',
          labelKey: 'hrmOrg.department',
          type: 'select',
          nullable: true,
          options: () => this.departmentOptions(),
        },
        { key: 'headcount_budget', labelKey: 'hrmOrg.headcountBudget', type: 'integer' },
        {
          key: 'is_critical_role',
          labelKey: 'hrmOrg.criticalRole',
          type: 'boolean',
          defaultValue: false,
        },
        {
          key: 'successor_employee_id',
          labelKey: 'hrmOrgX.successor',
          type: 'select',
          noForm: true,
          options: () => this.employeeOptions(),
        },
        {
          key: 'readiness_level',
          labelKey: 'hrmOrgX.readiness',
          type: 'select',
          noForm: true,
          options: () =>
            READINESS.map((value) => ({ value, labelKey: `hrmOrgX.readinessLevels.${value}` })),
        },
        { key: 'is_active', labelKey: 'hrmCommon.active', type: 'boolean', defaultValue: true },
      ],
    };
  });

  ngOnInit(): void {
    this.hrApi
      .getEmployees({ per_page: 100 })
      .subscribe({ next: (res) => this.employees.set(res.data) });
  }
}
